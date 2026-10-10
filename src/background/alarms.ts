export const AUTO_SAVE_ALARM = 'browser-hub-auto-save';
export const MAINTENANCE_ALARM = 'browser-hub-maintenance';

const handlers = new Map<string, () => void>();
let _alarmListenerRegistered = false;

/**
 * Create a repeating alarm unless one with the same name and period already exists.
 *
 * chrome.alarms.create() replaces an existing alarm and restarts its countdown.
 * Chrome re-runs the service worker's startup code every time it wakes the worker,
 * so an unconditional create() keeps pushing the next fire time back and the
 * alarm may never fire during normal browsing.
 */
export async function ensureAlarm(name: string, periodInMinutes: number): Promise<void> {
  const existing = (await chrome.alarms.get(name)) as chrome.alarms.Alarm | undefined;
  if (existing?.periodInMinutes === periodInMinutes) return;
  await chrome.alarms.create(name, { periodInMinutes });
}

export async function clearAlarm(name: string): Promise<void> {
  await chrome.alarms.clear(name);
}

/**
 * Route the named alarm to `callback`. The single chrome.alarms.onAlarm listener is
 * registered on first use, which must happen synchronously during service worker startup.
 */
export function onAlarm(name: string, callback: () => void): void {
  handlers.set(name, callback);
  if (_alarmListenerRegistered) return;
  _alarmListenerRegistered = true;

  chrome.alarms.onAlarm.addListener((alarm) => {
    handlers.get(alarm.name)?.();
  });
}
