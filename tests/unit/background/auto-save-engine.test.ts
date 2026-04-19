import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Settings } from '@core/types/settings.types';

// ---------------------------------------------------------------------------
// Stable mock function references — shared between vi.doMock factories and tests
// ---------------------------------------------------------------------------
const mockSetupAlarms = vi.fn();
const mockClearAlarms = vi.fn();
const mockOnAlarm = vi.fn();
const mockUpdateAlarmInterval = vi.fn();
const mockUpsertAutoSaveSession = vi.fn().mockResolvedValue({});
const mockCaptureTabGroups = vi.fn().mockReturnValue({ tabs: [], tabGroups: [] });

// ---------------------------------------------------------------------------
// Re-imported per test (vi.resetModules clears module state including _initialized)
// ---------------------------------------------------------------------------
let initAutoSaveEngine: (s: Settings) => void;
let updateSettings: (s: Settings) => void;

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    enableAutoSave: true,
    saveInterval: 15,
    maxAutoSaves: 50,
    saveOnBrowserClose: false,
    saveOnLowBattery: false,
    lowBatteryThreshold: 15,
    saveOnSleep: false,
    saveOnNetworkDisconnect: false,
    autoDeleteAfterDays: null,
    closeTabsAfterSave: false,
    primaryUI: 'sidepanel',
    theme: 'system',
    autoSaveOnTabClose: false,
    removeClosedTabsOnUpdate: false,
    ...overrides,
  };
}

beforeEach(async () => {
  // A fresh module means _initialized = false, _settings = null, _isSaving = false
  vi.resetModules();
  vi.clearAllMocks();

  vi.doMock('@background/alarms', () => ({
    setupAlarms: mockSetupAlarms,
    clearAlarms: mockClearAlarms,
    onAlarm: mockOnAlarm,
    updateAlarmInterval: mockUpdateAlarmInterval,
  }));
  vi.doMock('@core/services/session.service', () => ({
    upsertAutoSaveSession: mockUpsertAutoSaveSession,
    getAllSessions: vi.fn().mockResolvedValue([]),
  }));
  vi.doMock('@core/services/tab-group.service', () => ({
    captureTabGroups: mockCaptureTabGroups,
  }));

  const mod = await import('@background/auto-save-engine');
  initAutoSaveEngine = mod.initAutoSaveEngine;
  updateSettings = mod.updateSettings;
});

afterEach(() => {
  vi.doUnmock('@background/alarms');
  vi.doUnmock('@core/services/session.service');
  vi.doUnmock('@core/services/tab-group.service');
});

// ---------------------------------------------------------------------------
describe('initAutoSaveEngine', () => {
  it('calls clearAlarms and skips setup when enableAutoSave is false', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: false }));
    expect(mockClearAlarms).toHaveBeenCalledTimes(1);
    expect(mockSetupAlarms).not.toHaveBeenCalled();
    expect(mockOnAlarm).not.toHaveBeenCalled();
  });

  it('calls setupAlarms with the configured interval when enabled', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true, saveInterval: 10 }));
    expect(mockSetupAlarms).toHaveBeenCalledWith(10);
    expect(mockOnAlarm).toHaveBeenCalledTimes(1);
  });

  it('registers idle state listener when enabled', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true }));
    expect(chrome.idle.setDetectionInterval).toHaveBeenCalled();
    expect(chrome.idle.onStateChanged.addListener).toHaveBeenCalled();
  });

  it('registers tab and window event listeners when enabled', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true }));
    expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    expect(chrome.windows.onRemoved.addListener).toHaveBeenCalled();
  });

  it('registers runtime.onSuspend listener when enabled', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true }));
    expect(chrome.runtime.onSuspend.addListener).toHaveBeenCalled();
  });

  it('does not register duplicate listeners on a second call (initialized guard)', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true }));
    initAutoSaveEngine(makeSettings({ enableAutoSave: true }));
    // setupAlarms and listener registrations should each be called exactly once
    expect(mockSetupAlarms).toHaveBeenCalledTimes(1);
    expect(chrome.idle.onStateChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it('second call with enableAutoSave=false still calls clearAlarms', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true }));
    // Second call with autoSave disabled — should clear alarms even though initialized
    initAutoSaveEngine(makeSettings({ enableAutoSave: false }));
    expect(mockClearAlarms).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('updateSettings', () => {
  it('calls clearAlarms when enableAutoSave is turned off', () => {
    updateSettings(makeSettings({ enableAutoSave: false }));
    expect(mockClearAlarms).toHaveBeenCalledTimes(1);
    expect(mockUpdateAlarmInterval).not.toHaveBeenCalled();
  });

  it('calls updateAlarmInterval with the new interval when enableAutoSave is true', () => {
    updateSettings(makeSettings({ enableAutoSave: true, saveInterval: 20 }));
    expect(mockUpdateAlarmInterval).toHaveBeenCalledWith(20);
    expect(mockClearAlarms).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3B-01 — onSuspend shutdown flag + startup deferred save
// ---------------------------------------------------------------------------

describe('onSuspend shutdown flag (3B-01)', () => {
  it('writes pendingShutdownSave flag to storage.session when saveOnBrowserClose is true', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true, saveOnBrowserClose: true }));

    const onSuspendCb = vi.mocked(chrome.runtime.onSuspend.addListener).mock.calls[0]?.[0];
    expect(onSuspendCb).toBeDefined();

    // Fire the onSuspend listener
    onSuspendCb!();

    // After fix: pending_shutdown_save flag must be written to session storage.
    // Currently: handler only calls performAutoSave (bare call), no flag write → FAILS.
    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({
        pending_shutdown_save: expect.objectContaining({ timestamp: expect.any(Number) }),
      }),
    );
  });

  it('does NOT write the flag when saveOnBrowserClose is false', () => {
    initAutoSaveEngine(makeSettings({ enableAutoSave: true, saveOnBrowserClose: false }));

    const onSuspendCb = vi.mocked(chrome.runtime.onSuspend.addListener).mock.calls[0]?.[0];
    onSuspendCb?.();

    expect(chrome.storage.session.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ pending_shutdown_save: expect.anything() }),
    );
  });
});

describe('checkPendingShutdownSave (3B-01)', () => {
  it('is exported from auto-save-engine', async () => {
    const mod = await import('@background/auto-save-engine');
    // After fix: this function is exported.
    // Currently: it does not exist → FAILS.
    expect(typeof (mod as Record<string, unknown>).checkPendingShutdownSave).toBe('function');
  });

  it('triggers upsertAutoSaveSession when a recent flag exists and the tab cache is populated', async () => {
    // Arrange: session storage returns a recent flag
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => {
        if (key === 'pending_shutdown_save') {
          return { pending_shutdown_save: { timestamp: Date.now() } };
        }
        // Provide cached tab data for the engine to use
        if (key === 'window_tab_cache') {
          return {
            window_tab_cache: {
              1: {
                tabs: [{ id: 'tab-1', url: 'https://example.com', title: 'Ex', favIconUrl: '', index: 0, pinned: false, groupId: -1, active: false, scrollPosition: { x: 0, y: 0 } }],
                tabGroups: [],
              },
            },
          };
        }
        return {};
      },
    );

    // Re-import the module (already done in beforeEach via resetModules)
    const mod = await import('@background/auto-save-engine');
    initAutoSaveEngine = mod.initAutoSaveEngine;

    // Initialise engine so the tab cache is rehydrated
    initAutoSaveEngine(makeSettings({ enableAutoSave: true, saveOnBrowserClose: true }));

    // Allow rehydrateTabCache to settle
    await Promise.resolve();
    await Promise.resolve();

    const { checkPendingShutdownSave } = mod as unknown as {
      checkPendingShutdownSave?: () => Promise<void>;
    };

    if (!checkPendingShutdownSave) {
      // Function doesn't exist yet — fail explicitly
      throw new Error('checkPendingShutdownSave is not exported from auto-save-engine');
    }

    await checkPendingShutdownSave();

    // After fix: upsertAutoSaveSession called with the cached tabs.
    // Currently: function doesn't exist → test fails above.
    expect(mockUpsertAutoSaveSession).toHaveBeenCalledTimes(1);
  });

  it('does nothing when flag is absent', async () => {
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const mod = await import('@background/auto-save-engine');
    const { checkPendingShutdownSave } = mod as unknown as {
      checkPendingShutdownSave?: () => Promise<void>;
    };

    if (!checkPendingShutdownSave) return; // skip if not yet implemented

    await checkPendingShutdownSave();
    expect(mockUpsertAutoSaveSession).not.toHaveBeenCalled();
  });

  it('does nothing when the flag is older than 30 minutes', async () => {
    const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockImplementation(
      async (key: string) => {
        if (key === 'pending_shutdown_save') {
          return { pending_shutdown_save: { timestamp: thirtyOneMinutesAgo } };
        }
        return {};
      },
    );

    const mod = await import('@background/auto-save-engine');
    const { checkPendingShutdownSave } = mod as unknown as {
      checkPendingShutdownSave?: () => Promise<void>;
    };

    if (!checkPendingShutdownSave) return; // skip if not yet implemented

    await checkPendingShutdownSave();
    expect(mockUpsertAutoSaveSession).not.toHaveBeenCalled();
  });
});
