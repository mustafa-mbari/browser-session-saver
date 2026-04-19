import type { Settings } from '@core/types/settings.types';
import type { AutoSaveTrigger, Tab, TabGroup } from '@core/types/session.types';
import { TAB_CACHE_DEBOUNCE_MS } from '@core/constants/timings';
import * as SessionService from '@core/services/session.service';
import { captureTabGroups } from '@core/services/tab-group.service';
import { setupAlarms, clearAlarms, onAlarm, updateAlarmInterval } from './alarms';

let _isSaving = false;
let _settings: Settings | null = null;
let _initialized = false;
const _pendingCriticalTriggers = new Set<AutoSaveTrigger>();

// Cache of tab state per window for window-close auto-save
const windowTabCache = new Map<number, { tabs: Tab[]; tabGroups: TabGroup[] }>();

// Debounce timer for updateTabCache
let _tabCacheTimer: ReturnType<typeof setTimeout> | null = null;

const TAB_CACHE_KEY = 'window_tab_cache';
const SHUTDOWN_FLAG_KEY = 'pending_shutdown_save';

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

  // Browser close — write a flag to session storage so the next startup can do a deferred save.
  // Calling performAutoSave here would be a fire-and-forget that may not complete before suspend.
  chrome.runtime.onSuspend.addListener(() => {
    if (_settings?.saveOnBrowserClose) {
      void chrome.storage.session.set({ [SHUTDOWN_FLAG_KEY]: { timestamp: Date.now() } });
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

/**
 * Called on service-worker startup. If a pending-shutdown flag was written during the
 * previous session's onSuspend, and it's recent (< 30 min), trigger a deferred save
 * using the tab cache that was rehydrated from session storage.
 */
export async function checkPendingShutdownSave(): Promise<void> {
  try {
    const result = await chrome.storage.session.get(SHUTDOWN_FLAG_KEY);
    const flag = result[SHUTDOWN_FLAG_KEY] as { timestamp: number } | undefined;
    if (!flag) return;

    const age = Date.now() - flag.timestamp;
    if (age > 30 * 60 * 1000) return;

    // Clear the flag so a second startup doesn't re-trigger
    void chrome.storage.session.set({ [SHUTDOWN_FLAG_KEY]: null });

    const allTabs: Tab[] = [];
    const allTabGroups: TabGroup[] = [];
    for (const { tabs, tabGroups } of windowTabCache.values()) {
      allTabs.push(...tabs);
      allTabGroups.push(...tabGroups);
    }

    if (allTabs.length === 0) return;

    await SessionService.upsertAutoSaveSession(
      allTabs,
      allTabGroups,
      { autoSaveTrigger: 'shutdown' },
      false,
    );
  } catch {
    // Non-critical — missed deferred save is acceptable
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
      _pendingCriticalTriggers.add(trigger);
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

    // Process queued critical triggers (may have multiple if both shutdown + window_close fired)
    if (_pendingCriticalTriggers.size > 0) {
      const pending = [..._pendingCriticalTriggers];
      _pendingCriticalTriggers.clear();
      for (const t of pending) {
        void performAutoSave(t);
      }
    }
  }
}


function debouncedUpdateTabCache(_tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
  if (_tabCacheTimer) clearTimeout(_tabCacheTimer);
  const windowId = tab.windowId;
  _tabCacheTimer = setTimeout(() => {
    if (windowId) updateTabCacheForWindow(windowId);
  }, TAB_CACHE_DEBOUNCE_MS);
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
