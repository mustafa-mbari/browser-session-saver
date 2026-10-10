import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import type { AutoSaveTrigger, Tab, TabGroup } from '@core/types/session.types';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { TAB_CACHE_DEBOUNCE_MS } from '@core/constants/timings';
import { getSettingsStorage } from '@core/storage/storage-factory';
import { withStorageLock } from '@core/storage/storage-mutex';
import * as SessionService from '@core/services/session.service';
import { captureTabGroups } from '@core/services/tab-group.service';
import { AUTO_SAVE_ALARM, ensureAlarm, clearAlarm, onAlarm } from './alarms';

interface WindowTabs {
  tabs: Tab[];
  tabGroups: TabGroup[];
}

interface BrowserSnapshot extends WindowTabs {
  savedAt: number;
}

let _initialized = false;
let _settings: Settings = DEFAULT_SETTINGS;
let _settingsReady: Promise<void> = Promise.resolve();
let _settingsVersion = 0;

// Tabs per window, used by the window-close save. Mirrored to storage.session so it
// survives service worker restarts (storage.session is cleared on browser restart).
const windowTabCache = new Map<number, WindowTabs>();
let _cacheReady: Promise<void> = Promise.resolve();
const _tabCacheTimers = new Map<number, ReturnType<typeof setTimeout>>();

// All open tabs across windows, mirrored to storage.local so the next browser start
// can save what was open when the browser closed. Chrome gives the service worker
// no reliable event on browser exit, so the snapshot has to be kept up to date.
let _previousSnapshot: Promise<BrowserSnapshot | null> = Promise.resolve(null);
let _lastSnapshotJson = '';

const TAB_CACHE_KEY = 'window_tab_cache';
const BROWSER_SNAPSHOT_KEY = 'last_browser_snapshot';
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_SAVE_LOCK = 'auto-save';

export function initAutoSaveEngine(): void {
  // Guard against duplicate listener registration
  if (_initialized) return;
  _initialized = true;

  // Read the last browser session's snapshot before anything can overwrite it.
  _previousSnapshot = readBrowserSnapshot();
  _cacheReady = rehydrateTabCache().then(refreshOpenWindows);
  _settingsReady = loadSettings();

  onAlarm(AUTO_SAVE_ALARM, () => {
    void performAutoSave('timer');
  });

  // Settings can change from any extension page or an import; keep the engine in step.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const change = changes[STORAGE_KEYS.SETTINGS];
    if (areaName !== 'local' || !change?.newValue) return;
    _settingsVersion++;
    void updateSettings({ ...DEFAULT_SETTINGS, ...(change.newValue as Partial<Settings>) });
  });

  // System sleep/idle
  chrome.idle.setDetectionInterval(60);
  chrome.idle.onStateChanged.addListener((state) => {
    if (state === 'locked' || state === 'idle') {
      void performAutoSave('sleep');
    }
  });

  // Keep the per-window tab cache current (debounced per window)
  chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
    scheduleTabCacheUpdate(tab.windowId);
  });
  chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
    if (!removeInfo.isWindowClosing) {
      void updateTabCacheForWindow(removeInfo.windowId);
    }
  });
  chrome.tabs.onAttached.addListener((_tabId, attachInfo) => {
    scheduleTabCacheUpdate(attachInfo.newWindowId);
  });
  chrome.tabs.onDetached.addListener((_tabId, detachInfo) => {
    scheduleTabCacheUpdate(detachInfo.oldWindowId);
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    void handleWindowRemoved(windowId);
  });

  // Network disconnect
  self.addEventListener('offline', () => {
    void performAutoSave('network');
  });
}

/** Apply new settings: keep the periodic alarm in line with the configured interval. */
export async function updateSettings(settings: Settings): Promise<void> {
  _settings = settings;
  try {
    if (settings.enableAutoSave) {
      await ensureAlarm(AUTO_SAVE_ALARM, settings.saveInterval);
    } else {
      await clearAlarm(AUTO_SAVE_ALARM);
    }
  } catch (error) {
    console.error('Failed to update auto-save alarm:', describeError(error));
  }
}

/**
 * Called on browser startup. Saves the tabs that were open when the browser last
 * closed as the `shutdown` auto-save.
 */
export async function saveShutdownSnapshot(): Promise<void> {
  await _settingsReady;
  if (!isTriggerEnabled('shutdown')) return;

  const snapshot = await _previousSnapshot;
  if (!snapshot || snapshot.tabs.length === 0) return;
  if (Date.now() - snapshot.savedAt > SNAPSHOT_MAX_AGE_MS) return;

  await runSave('Shutdown auto-save', () =>
    SessionService.upsertAutoSaveSession(
      snapshot.tabs,
      snapshot.tabGroups,
      { autoSaveTrigger: 'shutdown' },
      false,
    ),
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  const version = _settingsVersion;
  try {
    const stored = await getSettingsStorage().get<Settings>(STORAGE_KEYS.SETTINGS);
    // A change that arrived while reading is newer than what we just read.
    if (version !== _settingsVersion) return;
    await updateSettings({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
  } catch (error) {
    console.error('Failed to load auto-save settings:', describeError(error));
  }
}

function isTriggerEnabled(trigger: AutoSaveTrigger): boolean {
  if (!_settings.enableAutoSave) return false;
  switch (trigger) {
    case 'sleep':
      return _settings.saveOnSleep;
    case 'network':
      return _settings.saveOnNetworkDisconnect;
    case 'shutdown':
      return _settings.saveOnBrowserClose;
    default:
      return true;
  }
}

// ── Saving ──────────────────────────────────────────────────────────────────

async function performAutoSave(trigger: AutoSaveTrigger): Promise<void> {
  await _settingsReady;
  if (!isTriggerEnabled(trigger)) return;

  await runSave('Auto-save', async () => {
    const { tabs, tabGroups } = combineWindows((await captureOpenWindows()).values());
    if (tabs.length === 0) return;

    // When autoSaveOnTabClose is off, keep closed tabs and only add new URLs.
    const mergeWithExisting = !_settings.autoSaveOnTabClose;
    await SessionService.upsertAutoSaveSession(
      tabs,
      tabGroups,
      { autoSaveTrigger: trigger },
      mergeWithExisting,
    );
  });
}

async function saveClosedWindow(cached: WindowTabs, windowId: number): Promise<void> {
  await _settingsReady;
  if (!isTriggerEnabled('window_close')) return;

  // Always merge on window close — preserve tabs from the closing window
  await runSave('Window close auto-save', () =>
    SessionService.upsertAutoSaveSession(
      cached.tabs,
      cached.tabGroups,
      { windowId, autoSaveTrigger: 'window_close' },
      true,
    ),
  );
}

/** Serialize auto-save writes: each one reads and rewrites the same auto-save entry. */
function runSave(label: string, save: () => Promise<unknown>): Promise<void> {
  return withStorageLock(AUTO_SAVE_LOCK, async () => {
    try {
      await save();
    } catch (error) {
      console.error(`${label} failed:`, describeError(error));
    }
  });
}

function describeError(error: unknown): string {
  return error instanceof DOMException ? `${error.name}: ${error.message}` : String(error);
}

// ── Tab cache ───────────────────────────────────────────────────────────────

async function captureOpenWindows(): Promise<Map<number, WindowTabs>> {
  const windows = await chrome.windows.getAll({ populate: false });
  const entries = await Promise.all(
    windows
      .filter((win) => win.id != null)
      .map(async (win) => {
        const [chromeTabs, chromeGroups] = await Promise.all([
          chrome.tabs.query({ windowId: win.id }),
          chrome.tabGroups.query({ windowId: win.id }),
        ]);
        return [win.id!, captureTabGroups(chromeTabs, chromeGroups)] as const;
      }),
  );
  return new Map(entries.filter(([, data]) => data.tabs.length > 0));
}

function combineWindows(windows: Iterable<WindowTabs>): WindowTabs {
  const tabs: Tab[] = [];
  const tabGroups: TabGroup[] = [];
  for (const entry of windows) {
    tabs.push(...entry.tabs);
    tabGroups.push(...entry.tabGroups);
  }
  return { tabs, tabGroups };
}

async function rehydrateTabCache(): Promise<void> {
  try {
    const result = await chrome.storage.session.get(TAB_CACHE_KEY);
    const data = result[TAB_CACHE_KEY];
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        const windowId = Number(key);
        if (!isNaN(windowId) && value && typeof value === 'object') {
          windowTabCache.set(windowId, value as WindowTabs);
        }
      }
    }
  } catch {
    // storage.session may not be available
  }
}

/**
 * Add every open window to the cache. Entries for windows that are gone are kept:
 * a window-close event may be the reason the worker just woke up, and its handler
 * still needs the closed window's tabs.
 */
async function refreshOpenWindows(): Promise<void> {
  try {
    for (const [windowId, data] of await captureOpenWindows()) {
      windowTabCache.set(windowId, data);
    }
    await persistTabCache();
  } catch {
    // Best effort — events will fill the cache
  }
}

function scheduleTabCacheUpdate(windowId: number): void {
  const pending = _tabCacheTimers.get(windowId);
  if (pending) clearTimeout(pending);
  _tabCacheTimers.set(
    windowId,
    setTimeout(() => {
      _tabCacheTimers.delete(windowId);
      void updateTabCacheForWindow(windowId);
    }, TAB_CACHE_DEBOUNCE_MS),
  );
}

async function updateTabCacheForWindow(windowId: number): Promise<void> {
  await _cacheReady;
  try {
    const [chromeTabs, chromeGroups] = await Promise.all([
      chrome.tabs.query({ windowId }),
      chrome.tabGroups.query({ windowId }),
    ]);
    windowTabCache.set(windowId, captureTabGroups(chromeTabs, chromeGroups));
    await persistTabCache();
  } catch {
    // Window may have already closed
  }
}

async function handleWindowRemoved(windowId: number): Promise<void> {
  await _cacheReady;
  const pending = _tabCacheTimers.get(windowId);
  if (pending) {
    clearTimeout(pending);
    _tabCacheTimers.delete(windowId);
  }

  const cached = windowTabCache.get(windowId);
  windowTabCache.delete(windowId);
  await persistTabCache();

  if (cached && cached.tabs.length > 0) {
    await saveClosedWindow(cached, windowId);
  }
}

async function persistTabCache(): Promise<void> {
  try {
    await chrome.storage.session.set({ [TAB_CACHE_KEY]: Object.fromEntries(windowTabCache) });
  } catch {
    // storage.session may not be available in all contexts
  }
  await persistBrowserSnapshot();
}

async function persistBrowserSnapshot(): Promise<void> {
  const { tabs, tabGroups } = combineWindows(windowTabCache.values());
  // Closing the last window empties the cache. Keep the previous snapshot so the
  // next browser start can still save it.
  if (tabs.length === 0) return;

  const json = JSON.stringify({ tabs, tabGroups });
  if (json === _lastSnapshotJson) return;

  // Never overwrite the last browser session's snapshot before startup has read it.
  await _previousSnapshot;
  try {
    await chrome.storage.local.set({
      [BROWSER_SNAPSHOT_KEY]: { savedAt: Date.now(), tabs, tabGroups },
    });
    _lastSnapshotJson = json;
  } catch {
    // Best effort
  }
}

async function readBrowserSnapshot(): Promise<BrowserSnapshot | null> {
  try {
    const result = await chrome.storage.local.get(BROWSER_SNAPSHOT_KEY);
    const snapshot = result[BROWSER_SNAPSHOT_KEY] as BrowserSnapshot | undefined;
    return snapshot && Array.isArray(snapshot.tabs) ? snapshot : null;
  } catch {
    return null;
  }
}
