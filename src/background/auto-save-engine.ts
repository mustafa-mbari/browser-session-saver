import type { Settings } from '@core/types/settings.types';
import type { AutoSaveTrigger, Tab, TabGroup } from '@core/types/session.types';
import * as SessionService from '@core/services/session.service';
import { captureTabGroups } from '@core/services/tab-group.service';
import { setupAlarms, clearAlarms, onAlarm, updateAlarmInterval } from './alarms';

let _isSaving = false;
let _settings: Settings | null = null;

// Cache of tab state per window for window-close auto-save
const windowTabCache = new Map<number, { tabs: Tab[]; tabGroups: TabGroup[] }>();

export function initAutoSaveEngine(settings: Settings): void {
  _settings = settings;

  if (!settings.enableAutoSave) {
    clearAlarms();
    return;
  }

  // Periodic timer
  setupAlarms(settings.saveInterval);
  onAlarm(() => performAutoSave('timer'));

  // Browser close
  if (settings.saveOnBrowserClose) {
    chrome.runtime.onSuspend.addListener(() => {
      performAutoSave('shutdown');
    });
  }

  // System sleep/idle
  if (settings.saveOnSleep) {
    chrome.idle.setDetectionInterval(60);
    chrome.idle.onStateChanged.addListener((state) => {
      if (state === 'locked' || state === 'idle') {
        performAutoSave('sleep');
      }
    });
  }

  // Low battery
  if (settings.saveOnLowBattery) {
    initBatteryMonitor(settings.lowBatteryThreshold);
  }

  // Window close - maintain tab cache
  chrome.tabs.onUpdated.addListener(updateTabCache);
  chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
    if (!removeInfo.isWindowClosing) {
      updateTabCacheForWindow(removeInfo.windowId);
    }
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    const cached = windowTabCache.get(windowId);
    if (cached && cached.tabs.length > 0) {
      performAutoSave('window_close');
    }
    windowTabCache.delete(windowId);
  });

  // Network disconnect
  if (settings.saveOnNetworkDisconnect) {
    // Note: navigator.onLine events work in service worker context
    self.addEventListener('offline', () => {
      performAutoSave('network');
    });
  }
}

export function updateSettings(settings: Settings): void {
  _settings = settings;
  if (settings.enableAutoSave) {
    updateAlarmInterval(settings.saveInterval);
  } else {
    clearAlarms();
  }
}

async function performAutoSave(trigger: AutoSaveTrigger): Promise<void> {
  if (_isSaving) return;
  if (!_settings?.enableAutoSave) return;

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
      if (await isDuplicate(tabs)) continue;

      await SessionService.saveSession(tabs, tabGroups, {
        windowId: window.id,
        isAutoSave: true,
        autoSaveTrigger: trigger,
      });
    }
  } catch (error) {
    console.error('Auto-save failed:', error);
  } finally {
    _isSaving = false;
  }
}

async function isDuplicate(tabs: Tab[]): Promise<boolean> {
  const sessions = await SessionService.getAllSessions(
    { isAutoSave: true },
    { field: 'createdAt', direction: 'desc' },
  );

  if (sessions.length === 0) return false;

  const latest = sessions[0];
  if (latest.tabs.length !== tabs.length) return false;

  const latestUrls = latest.tabs.map((t) => t.url).sort();
  const currentUrls = tabs.map((t) => t.url).sort();

  return latestUrls.every((url, i) => url === currentUrls[i]);
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
