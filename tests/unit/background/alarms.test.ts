import { describe, it, expect, vi, beforeEach } from 'vitest';

// alarms.ts has module-level listener state.
// Use vi.resetModules() + dynamic import per test to get a fresh module.

async function importAlarms() {
  vi.resetModules();
  return await import('@background/alarms');
}

describe('alarms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.alarms.get).mockResolvedValue(undefined as unknown as chrome.alarms.Alarm);
  });

  // ── ensureAlarm ───────────────────────────────────────────────────────────

  it('ensureAlarm creates the alarm when it does not exist', async () => {
    const { ensureAlarm, AUTO_SAVE_ALARM } = await importAlarms();
    await ensureAlarm(AUTO_SAVE_ALARM, 5);
    expect(chrome.alarms.create).toHaveBeenCalledWith('browser-hub-auto-save', { periodInMinutes: 5 });
  });

  it('ensureAlarm leaves an existing alarm with the same period alone (no countdown reset)', async () => {
    vi.mocked(chrome.alarms.get).mockResolvedValue({
      name: 'browser-hub-auto-save',
      scheduledTime: Date.now() + 60_000,
      periodInMinutes: 15,
    });
    const { ensureAlarm, AUTO_SAVE_ALARM } = await importAlarms();
    await ensureAlarm(AUTO_SAVE_ALARM, 15);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });

  it('ensureAlarm re-creates the alarm when the period changed', async () => {
    vi.mocked(chrome.alarms.get).mockResolvedValue({
      name: 'browser-hub-auto-save',
      scheduledTime: Date.now() + 60_000,
      periodInMinutes: 15,
    });
    const { ensureAlarm, AUTO_SAVE_ALARM } = await importAlarms();
    await ensureAlarm(AUTO_SAVE_ALARM, 10);
    expect(chrome.alarms.create).toHaveBeenCalledWith('browser-hub-auto-save', { periodInMinutes: 10 });
  });

  // ── clearAlarm ────────────────────────────────────────────────────────────

  it('clearAlarm clears the named alarm', async () => {
    const { clearAlarm, AUTO_SAVE_ALARM } = await importAlarms();
    await clearAlarm(AUTO_SAVE_ALARM);
    expect(chrome.alarms.clear).toHaveBeenCalledWith('browser-hub-auto-save');
  });

  // ── onAlarm ───────────────────────────────────────────────────────────────

  it('onAlarm registers a single chrome listener for all named handlers', async () => {
    const { onAlarm, AUTO_SAVE_ALARM, MAINTENANCE_ALARM } = await importAlarms();
    onAlarm(AUTO_SAVE_ALARM, vi.fn());
    onAlarm(MAINTENANCE_ALARM, vi.fn());
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
  });

  it('onAlarm routes each alarm to its own handler only', async () => {
    const { onAlarm, AUTO_SAVE_ALARM, MAINTENANCE_ALARM } = await importAlarms();
    const autoSave = vi.fn();
    const maintenance = vi.fn();
    onAlarm(AUTO_SAVE_ALARM, autoSave);
    onAlarm(MAINTENANCE_ALARM, maintenance);

    const listener = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls[0]?.[0] as
      | ((alarm: chrome.alarms.Alarm) => void)
      | undefined;
    expect(listener).toBeDefined();

    listener!({ name: 'browser-hub-auto-save', scheduledTime: Date.now() });
    expect(autoSave).toHaveBeenCalledOnce();
    expect(maintenance).not.toHaveBeenCalled();

    listener!({ name: 'browser-hub-maintenance', scheduledTime: Date.now() });
    expect(maintenance).toHaveBeenCalledOnce();

    listener!({ name: 'some-other-alarm', scheduledTime: Date.now() });
    expect(autoSave).toHaveBeenCalledOnce();
    expect(maintenance).toHaveBeenCalledOnce();
  });
});
