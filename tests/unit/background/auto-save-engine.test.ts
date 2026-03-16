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
