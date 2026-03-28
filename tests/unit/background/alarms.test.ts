import { describe, it, expect, vi, beforeEach } from 'vitest';

// alarms.ts has module-level `_alarmListenerRegistered` state.
// Use vi.resetModules() + dynamic import per test to get a fresh module.

async function importAlarms() {
  vi.resetModules();
  return await import('@background/alarms');
}

describe('alarms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── setupAlarms ───────────────────────────────────────────────────────────

  it('setupAlarms calls chrome.alarms.create with correct alarm name and interval', async () => {
    const { setupAlarms } = await importAlarms();
    setupAlarms(5);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'browser-hub-auto-save',
      { periodInMinutes: 5 },
    );
  });

  it('setupAlarms with different interval passes correct value', async () => {
    const { setupAlarms } = await importAlarms();
    setupAlarms(15);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'browser-hub-auto-save',
      { periodInMinutes: 15 },
    );
  });

  // ── updateAlarmInterval ───────────────────────────────────────────────────

  it('updateAlarmInterval clears then re-creates the alarm', async () => {
    vi.mocked(chrome.alarms.clear).mockResolvedValue(true);
    const { updateAlarmInterval } = await importAlarms();
    await updateAlarmInterval(10);

    expect(chrome.alarms.clear).toHaveBeenCalledWith('browser-hub-auto-save');
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'browser-hub-auto-save',
      { periodInMinutes: 10 },
    );
  });

  it('updateAlarmInterval calls clear before create', async () => {
    const callOrder: string[] = [];
    vi.mocked(chrome.alarms.clear).mockImplementation(() => {
      callOrder.push('clear');
      return Promise.resolve(true);
    });
    vi.mocked(chrome.alarms.create).mockImplementation(() => {
      callOrder.push('create');
    });

    const { updateAlarmInterval } = await importAlarms();
    await updateAlarmInterval(3);

    expect(callOrder).toEqual(['clear', 'create']);
  });

  // ── clearAlarms ───────────────────────────────────────────────────────────

  it('clearAlarms calls chrome.alarms.clear with the correct name', async () => {
    const { clearAlarms } = await importAlarms();
    clearAlarms();
    expect(chrome.alarms.clear).toHaveBeenCalledWith('browser-hub-auto-save');
  });

  // ── onAlarm ───────────────────────────────────────────────────────────────

  it('onAlarm registers an alarm listener', async () => {
    const { onAlarm } = await importAlarms();
    const cb = vi.fn();
    onAlarm(cb);
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
  });

  it('onAlarm idempotency — second call does NOT register another listener', async () => {
    const { onAlarm } = await importAlarms();
    const cb = vi.fn();
    onAlarm(cb);
    onAlarm(cb); // second call — should be ignored
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
  });

  it('onAlarm listener invokes callback only for matching alarm name', async () => {
    const { onAlarm } = await importAlarms();
    const cb = vi.fn();
    onAlarm(cb);

    // Extract the registered listener
    const listener = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls[0]?.[0] as
      | ((alarm: chrome.alarms.Alarm) => void)
      | undefined;
    expect(listener).toBeDefined();

    // Fire with matching alarm
    listener!({ name: 'browser-hub-auto-save', scheduledTime: Date.now() });
    expect(cb).toHaveBeenCalledOnce();

    // Fire with non-matching alarm
    listener!({ name: 'some-other-alarm', scheduledTime: Date.now() });
    expect(cb).toHaveBeenCalledOnce(); // still just 1
  });
});
