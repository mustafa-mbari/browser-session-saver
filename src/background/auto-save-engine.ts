import type { Settings } from '@core/types/settings.types';
import type { AutoSaveTrigger, Tab, TabGroup } from '@core/types/session.types';
import * as SessionService from '@core/services/session.service';
import { captureTabGroups } from '@core/services/tab-group.service';
import { setupAlarms, clearAlarms, onAlarm, updateAlarmInterval } from './alarms';

let _isSaving = false;
let _settings: Settings | null = null;
let _initialized = false;
let _pendingCriticalTrigger: AutoSaveTrigger | null = null;

// Cache of tab state per window for window-close auto-save
const windowTabCache = new Map<number, { tabs: Tab[]; tabGroups: TabGroup[] }>();

// Debounce timer for updateTabCache
let _tabCacheTimer: ReturnType<typeof setTimeout> | null = null;

const TAB_CACHE_KEY = 'window_tab_cache';

async function persistTabCache(): Promise<void> {
  try {
    const obj = Object.fromEntries(windowTabCache);
    await chrome.storage.session.set({ [TAB_CACHE_KEY]: obj });
  } catch {
    // storage.session may not be available in all contexts
  }
}

async function rehydrateTabCache(): Promise<void> {
  try {
    const result = await chrome.storage.session.get(TAB_CACHE_KEY);
    const data = result[TAB_CACHE_KEY];
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        const windowId = Number(key);
        if (!isNaN(windowId) && value && typeof value === 'object') {
          windowTabCache.set(windowId, value as { tabs: Tab[]; tabGroups: TabGroup[] });
        }
      }
    }
  } catch {
    // storage.session may not be available
  }
}

export function initAutoSaveEngine(settings: Settings): void {
  _settings = settings;

  // Rehydrate tab cache from storage.session (survives SW restarts)
  void rehydrateTabCache();

  if (!settings.enableAutoSave) {
    clearAlarms();
    return;
  }

  // Guard against duplicate listener registration on service worker restart
  if (_initialized) return;
  _initialized = true;

  // Periodic timer
  setupAlarms(settings.saveInterval);
  onAlarm(() => performAutoSave('timer'));

  // Browser close
  chrome.runtime.onSuspend.addListener(() => {
    if (_settings?.saveOnBrowserClose) {
      // onSuspend gives limited time; save synchronously to storage.session as best-effort
      performAutoSave('shutdown');
    }
  });

  // System sleep/idle
  chrome.idle.setDetectionInterval(60);
  chrome.idle.onStateChanged.addListener((state) => {
    if (_settings?.saveOnSleep && (state === 'locked' || state === 'idle')) {
      performAutoSave('sleep');
    }
  });

  // Window close - maintain tab cache with debounced updates
  chrome.tabs.onUpdated.addListener(debouncedUpdateTabCache);
  chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
    if (!removeInfo.isWindowClosing) {
      updateTabCacheForWindow(removeInfo.windowId);
    }
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    const cached = windowTabCache.get(windowId);
    if (cached && cached.tabs.length > 0) {
      saveClosedWindowFromCache(cached, windowId);
    }
    windowTabCache.delete(windowId);
    void persistTabCache();
  });

  // Network disconnect
  self.addEventListener('offline', () => {
    if (_settings?.saveOnNetworkDisconnect) {
      performAutoSave('network');
    }
  });
}

export function updateSettings(settings: Settings): void {
  _settings = settings;
  if (settings.enableAutoSave) {
    updateAlarmInterval(settings.saveInterval);
  } else {
    clearAlarms();
  }
}

async function saveClosedWindowFromCache(
  cached: { tabs: Tab[]; tabGroups: TabGroup[] },
  windowId: number,
): Promise<void> {
  if (!_settings?.enableAutoSave) return;

  try {
    // Always merge on window close — preserve tabs from the closing window
    await SessionService.upsertAutoSaveSession(
      cached.tabs,
      cached.tabGroups,
      { windowId, autoSaveTrigger: 'window_close' },
      true, // mergeWithExisting
    );
  } catch (error) {
    const detail = error instanceof DOMException
      ? `${error.name}: ${error.message}`
      : String(error);
    console.error('Window close auto-save failed:', detail);
  }
}

async function performAutoSave(trigger: AutoSaveTrigger): Promise<void> {
  if (!_settings?.enableAutoSave) return;

  // If already saving, queue critical triggers (shutdown, window_close) for retry
  if (_isSaving) {
    if (trigger === 'shutdown' || trigger === 'window_close') {
      _pendingCriticalTrigger = trigger;
    }
    return;
  }

  _isSaving = true;

  try {
    // Collect ALL tabs from ALL open windows in parallel
    const windows = await chrome.windows.getAll({ populate: false });
    const windowResults = await Promise.all(
      windows
        .filter((win) => win.id != null)
        .map(async (win) => {
          const [chromeTabs, chromeGroups] = await Promise.all([
            chrome.tabs.query({ windowId: win.id }),
            chrome.tabGroups.query({ windowId: win.id }),
          ]);
          if (chromeTabs.length === 0) return null;
          return captureTabGroups(chromeTabs, chromeGroups);
        }),
    );

    const allTabs: Tab[] = [];
    const allTabGroups: TabGroup[] = [];
    for (const result of windowResults) {
      if (result) {
        allTabs.push(...result.tabs);
        allTabGroups.push(...result.tabGroups);
      }
    }

    if (allTabs.length === 0) return;

    // mergeWithExisting = true when autoSaveOnTabClose is disabled (default).
    // Merge keeps closed tabs in the session; only new URLs are added.
    const mergeWithExisting = !(_settings?.autoSaveOnTabClose ?? true);

    await SessionService.upsertAutoSaveSession(
      allTabs,
      allTabGroups,
      { autoSaveTrigger: trigger },
      mergeWithExisting,
    );
  } catch (error) {
    const detail = error instanceof DOMException
      ? `${error.name}: ${error.message}`
      : String(error);
    console.error('Auto-save failed:', detail);
  } finally {
    _isSaving = false;

    // Process queued critical trigger
    if (_pendingCriticalTrigger) {
      const pending = _pendingCriticalTrigger;
      _pendingCriticalTrigger = null;
      performAutoSave(pending);
    }
  }
}


function debouncedUpdateTabCache(_tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
  if (_tabCacheTimer) clearTimeout(_tabCacheTimer);
  const windowId = tab.windowId;
  _tabCacheTimer = setTimeout(() => {
    if (windowId) updateTabCacheForWindow(windowId);
  }, 5000);
}

async function updateTabCacheForWindow(windowId: number): Promise<void> {
  try {
    const chromeTabs = await chrome.tabs.query({ windowId });
    const chromeGroups = await chrome.tabGroups.query({ windowId });
    const { tabs, tabGroups } = captureTabGroups(chromeTabs, chromeGroups);
    windowTabCache.set(windowId, { tabs, tabGroups });
    void persistTabCache();
  } catch {
    // Window may have already closed
  }
}
