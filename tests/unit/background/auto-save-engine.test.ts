import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import type { Tab } from '@core/types/session.types';

// ---------------------------------------------------------------------------
// Stable mock function references — shared between vi.doMock factories and tests
// ---------------------------------------------------------------------------
const mockEnsureAlarm = vi.fn().mockResolvedValue(undefined);
const mockClearAlarm = vi.fn().mockResolvedValue(undefined);
const mockOnAlarm = vi.fn();
const mockUpsertAutoSaveSession = vi.fn().mockResolvedValue({});
const mockCaptureTabGroups = vi.fn();
const mockSettingsGet = vi.fn();

// Re-imported per test (vi.resetModules clears module state including _initialized)
let engine: typeof import('@background/auto-save-engine');

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    enableAutoSave: true,
    saveInterval: 15,
    saveOnBrowserClose: false,
    saveOnSleep: false,
    saveOnNetworkDisconnect: false,
    autoSaveOnTabClose: false,
    ...overrides,
  };
}

function chromeTab(id: number, url: string, windowId = 1): chrome.tabs.Tab {
  return { id, url, title: url, windowId, index: 0 } as chrome.tabs.Tab;
}

function savedTab(id: string, url: string): Tab {
  return {
    id, url, title: url, favIconUrl: '', index: 0, pinned: false,
    groupId: -1, active: false, scrollPosition: { x: 0, y: 0 },
  };
}

/** Let all pending promise chains (and zero-delay timers) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function listenerOf<T>(addListener: unknown): T {
  const calls = (addListener as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as T;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (chrome.windows.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1 }]);
  (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (chrome.tabGroups.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  mockSettingsGet.mockResolvedValue(makeSettings());
  mockCaptureTabGroups.mockImplementation((tabs: chrome.tabs.Tab[]) => ({
    tabs: tabs.map((t) => savedTab(String(t.id), t.url ?? '')),
    tabGroups: [],
  }));

  vi.doMock('@background/alarms', () => ({
    AUTO_SAVE_ALARM: 'browser-hub-auto-save',
    ensureAlarm: mockEnsureAlarm,
    clearAlarm: mockClearAlarm,
    onAlarm: mockOnAlarm,
  }));
  vi.doMock('@core/services/session.service', () => ({
    upsertAutoSaveSession: mockUpsertAutoSaveSession,
  }));
  vi.doMock('@core/services/tab-group.service', () => ({
    captureTabGroups: mockCaptureTabGroups,
  }));
  vi.doMock('@core/storage/storage-factory', () => ({
    getSettingsStorage: () => ({ get: mockSettingsGet }),
  }));

  engine = await import('@background/auto-save-engine');
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock('@background/alarms');
  vi.doUnmock('@core/services/session.service');
  vi.doUnmock('@core/services/tab-group.service');
  vi.doUnmock('@core/storage/storage-factory');
});

// ---------------------------------------------------------------------------
describe('initAutoSaveEngine', () => {
  it('registers every listener exactly once', () => {
    engine.initAutoSaveEngine();
    engine.initAutoSaveEngine();

    expect(mockOnAlarm).toHaveBeenCalledTimes(1);
    expect(mockOnAlarm).toHaveBeenCalledWith('browser-hub-auto-save', expect.any(Function));
    expect(chrome.idle.onStateChanged.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.onAttached.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.onDetached.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.windows.onRemoved.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it('applies the stored interval without first creating an alarm from defaults', async () => {
    mockSettingsGet.mockResolvedValue(makeSettings({ saveInterval: 5 }));
    engine.initAutoSaveEngine();
    await flush();

    expect(mockEnsureAlarm).toHaveBeenCalledTimes(1);
    expect(mockEnsureAlarm).toHaveBeenCalledWith('browser-hub-auto-save', 5);
  });

  it('clears the alarm when auto-save is disabled in stored settings', async () => {
    mockSettingsGet.mockResolvedValue(makeSettings({ enableAutoSave: false }));
    engine.initAutoSaveEngine();
    await flush();

    expect(mockClearAlarm).toHaveBeenCalledWith('browser-hub-auto-save');
    expect(mockEnsureAlarm).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('updateSettings', () => {
  it('clears the alarm when enableAutoSave is turned off', async () => {
    await engine.updateSettings(makeSettings({ enableAutoSave: false }));
    expect(mockClearAlarm).toHaveBeenCalledTimes(1);
    expect(mockEnsureAlarm).not.toHaveBeenCalled();
  });

  it('ensures the alarm with the new interval when enabled', async () => {
    await engine.updateSettings(makeSettings({ enableAutoSave: true, saveInterval: 20 }));
    expect(mockEnsureAlarm).toHaveBeenCalledWith('browser-hub-auto-save', 20);
    expect(mockClearAlarm).not.toHaveBeenCalled();
  });

  it('follows settings written by any page via storage.onChanged', async () => {
    engine.initAutoSaveEngine();
    await flush();
    mockEnsureAlarm.mockClear();

    const onChanged = listenerOf<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>(
      chrome.storage.onChanged.addListener,
    );
    onChanged({ settings: { newValue: makeSettings({ saveInterval: 30 }) } }, 'local');
    onChanged({ other_key: { newValue: 1 } }, 'local');
    onChanged({ settings: { newValue: makeSettings({ saveInterval: 45 }) } }, 'session');
    await flush();

    expect(mockEnsureAlarm).toHaveBeenCalledTimes(1);
    expect(mockEnsureAlarm).toHaveBeenCalledWith('browser-hub-auto-save', 30);
  });
});

// ---------------------------------------------------------------------------
describe('triggers', () => {
  it('does not save on sleep when saveOnSleep is off', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([chromeTab(1, 'https://a.com')]);
    engine.initAutoSaveEngine();
    await flush();

    listenerOf<(state: string) => void>(chrome.idle.onStateChanged.addListener)('locked');
    await flush();

    expect(mockUpsertAutoSaveSession).not.toHaveBeenCalled();
  });

  it('saves all open tabs on sleep when saveOnSleep is on', async () => {
    mockSettingsGet.mockResolvedValue(makeSettings({ saveOnSleep: true }));
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([chromeTab(1, 'https://a.com')]);
    engine.initAutoSaveEngine();
    await flush();

    listenerOf<(state: string) => void>(chrome.idle.onStateChanged.addListener)('locked');
    await flush();

    expect(mockUpsertAutoSaveSession).toHaveBeenCalledWith(
      [expect.objectContaining({ url: 'https://a.com' })],
      [],
      { autoSaveTrigger: 'sleep' },
      true, // autoSaveOnTabClose off → merge
    );
  });
});

// ---------------------------------------------------------------------------
describe('saveShutdownSnapshot', () => {
  const previousTabs = [savedTab('t1', 'https://before-quit.com')];

  function storeSnapshot(savedAt: number) {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) =>
      key === 'last_browser_snapshot'
        ? { last_browser_snapshot: { savedAt, tabs: previousTabs, tabGroups: [] } }
        : {},
    );
  }

  it('saves the tabs that were open when the browser closed', async () => {
    storeSnapshot(Date.now() - 60_000);
    mockSettingsGet.mockResolvedValue(makeSettings({ saveOnBrowserClose: true }));
    engine.initAutoSaveEngine();

    await engine.saveShutdownSnapshot();

    expect(mockUpsertAutoSaveSession).toHaveBeenCalledWith(
      previousTabs,
      [],
      { autoSaveTrigger: 'shutdown' },
      false,
    );
  });

  it('uses the previous snapshot even after the new session overwrote storage', async () => {
    storeSnapshot(Date.now() - 60_000);
    mockSettingsGet.mockResolvedValue(makeSettings({ saveOnBrowserClose: true }));
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([chromeTab(9, 'https://new-session.com')]);
    engine.initAutoSaveEngine();
    await flush();

    // The new session's tabs were written to storage.local...
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      last_browser_snapshot: expect.objectContaining({
        tabs: [expect.objectContaining({ url: 'https://new-session.com' })],
      }),
    });

    // ...but the shutdown save still uses what was open before the restart.
    await engine.saveShutdownSnapshot();
    expect(mockUpsertAutoSaveSession).toHaveBeenCalledWith(
      previousTabs, [], { autoSaveTrigger: 'shutdown' }, false,
    );
  });

  it('does nothing when saveOnBrowserClose is off', async () => {
    storeSnapshot(Date.now() - 60_000);
    engine.initAutoSaveEngine();

    await engine.saveShutdownSnapshot();
    expect(mockUpsertAutoSaveSession).not.toHaveBeenCalled();
  });

  it('does nothing when the snapshot is older than a week', async () => {
    storeSnapshot(Date.now() - 8 * 24 * 60 * 60 * 1000);
    mockSettingsGet.mockResolvedValue(makeSettings({ saveOnBrowserClose: true }));
    engine.initAutoSaveEngine();

    await engine.saveShutdownSnapshot();
    expect(mockUpsertAutoSaveSession).not.toHaveBeenCalled();
  });

  it('does nothing when there is no snapshot', async () => {
    mockSettingsGet.mockResolvedValue(makeSettings({ saveOnBrowserClose: true }));
    engine.initAutoSaveEngine();

    await engine.saveShutdownSnapshot();
    expect(mockUpsertAutoSaveSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('browser snapshot', () => {
  it('keeps the snapshot when the last window closes', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([chromeTab(1, 'https://a.com')]);
    engine.initAutoSaveEngine();
    await flush();
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockClear();

    listenerOf<(windowId: number) => void>(chrome.windows.onRemoved.addListener)(1);
    await flush();

    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ last_browser_snapshot: expect.anything() }),
    );
  });
});

// ---------------------------------------------------------------------------
describe('window close', () => {
  it('saves the closed window from the rehydrated cache right after the worker wakes', async () => {
    const cachedTabs = [savedTab('t7', 'https://closed-window.com')];
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      window_tab_cache: { 7: { tabs: cachedTabs, tabGroups: [] } },
    });
    (chrome.windows.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]); // window 7 is gone

    engine.initAutoSaveEngine();
    // Fire immediately, before the cache has been read back from storage.session
    listenerOf<(windowId: number) => void>(chrome.windows.onRemoved.addListener)(7);
    await flush();

    expect(mockUpsertAutoSaveSession).toHaveBeenCalledWith(
      cachedTabs,
      [],
      { windowId: 7, autoSaveTrigger: 'window_close' },
      true,
    );
  });
});

// ---------------------------------------------------------------------------
describe('tab cache', () => {
  it('keeps updates from two windows that change within the debounce period', async () => {
    vi.useFakeTimers();
    (chrome.windows.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(async ({ windowId }: { windowId: number }) =>
      windowId === 1 ? [chromeTab(1, 'https://one.com', 1)] : [chromeTab(2, 'https://two.com', 2)],
    );

    engine.initAutoSaveEngine();
    await vi.advanceTimersByTimeAsync(0);

    const onUpdated = listenerOf<(id: number, info: object, tab: chrome.tabs.Tab) => void>(
      chrome.tabs.onUpdated.addListener,
    );
    onUpdated(1, {}, chromeTab(1, 'https://one.com', 1));
    onUpdated(2, {}, chromeTab(2, 'https://two.com', 2));
    await vi.advanceTimersByTimeAsync(5_000);

    const sessionWrites = (chrome.storage.session.set as ReturnType<typeof vi.fn>).mock.calls;
    const lastCache = sessionWrites[sessionWrites.length - 1][0].window_tab_cache;
    expect(Object.keys(lastCache).sort()).toEqual(['1', '2']);
  });
});
