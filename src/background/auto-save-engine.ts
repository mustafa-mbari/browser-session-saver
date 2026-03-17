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

export function initAutoSaveEngine(settings: Settings): void {
  _settings = settings;

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

  // Low battery
  if (settings.saveOnLowBattery) {
    initBatteryMonitor(settings.lowBatteryThreshold);
  }

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
    console.error('Window close auto-save failed:', error);
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
    console.error('Auto-save failed:', error);
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


function initBatteryMonitor(threshold: number): void {
  try {
    // navigator.getBattery may not be available in service worker
    if ('getBattery' in navigator) {
      (navigator as Navigator & { getBattery(): Promise<BatteryManager> })
        .getBattery()
        .then((battery) => {
          battery.addEventListener('levelchange', () => {
            if (battery.level <= threshold / 100 && !battery.charging) {
              performAutoSave('battery');
            }
          });
        })
        .catch(() => {
          console.warn('Battery API not available in service worker context');
        });
    }
  } catch {
    console.warn('Battery monitoring not supported');
  }
}

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
  addEventListener(type: string, listener: EventListener): void;
}

function debouncedUpdateTabCache(): void {
  if (_tabCacheTimer) clearTimeout(_tabCacheTimer);
  _tabCacheTimer = setTimeout(() => {
    updateTabCache();
  }, 2000);
}

async function updateTabCache(): Promise<void> {
  const windows = await chrome.windows.getAll({ populate: false });
  for (const window of windows) {
    if (window.id) {
      await updateTabCacheForWindow(window.id);
    }
  }
}

async function updateTabCacheForWindow(windowId: number): Promise<void> {
  try {
    const chromeTabs = await chrome.tabs.query({ windowId });
    const chromeGroups = await chrome.tabGroups.query({ windowId });
    const { tabs, tabGroups } = captureTabGroups(chromeTabs, chromeGroups);
    windowTabCache.set(windowId, { tabs, tabGroups });
  } catch {
    // Window may have already closed
  }
}
