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
    if (await isDuplicate(cached.tabs, 'window_close')) return;

    await SessionService.upsertAutoSaveSession(cached.tabs, cached.tabGroups, {
      windowId,
      autoSaveTrigger: 'window_close',
    });
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
    const windows = await chrome.windows.getAll({ populate: false });

    for (const window of windows) {
      if (!window.id) continue;

      const chromeTabs = await chrome.tabs.query({ windowId: window.id });
      if (chromeTabs.length === 0) continue;

      const chromeGroups = await chrome.tabGroups.query({ windowId: window.id });
      const { tabs, tabGroups } = captureTabGroups(chromeTabs, chromeGroups);

      // De-duplication check
      if (await isDuplicate(tabs, trigger)) continue;

      await SessionService.upsertAutoSaveSession(tabs, tabGroups, {
        windowId: window.id,
        autoSaveTrigger: trigger,
      });
    }
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

async function isDuplicate(tabs: Tab[], trigger: AutoSaveTrigger): Promise<boolean> {
  const sessions = await SessionService.getAllSessions({ isAutoSave: true });
  const existing = sessions.find((s) => s.autoSaveTrigger === trigger);

  if (!existing) return false;
  if (existing.tabs.length !== tabs.length) return false;

  const existingUrls = existing.tabs.map((t) => t.url).sort();
  const currentUrls = tabs.map((t) => t.url).sort();

  return existingUrls.every((url, i) => url === currentUrls[i]);
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
