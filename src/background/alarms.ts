const ALARM_NAME = 'session-saver-auto-save';

let _alarmListenerRegistered = false;

export function setupAlarms(intervalMinutes: number): void {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes });
}

export async function updateAlarmInterval(intervalMinutes: number): Promise<void> {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes });
}

export function clearAlarms(): void {
  chrome.alarms.clear(ALARM_NAME);
}

export function onAlarm(callback: () => void): void {
  // Guard against duplicate listener registration
  if (_alarmListenerRegistered) return;
  _alarmListenerRegistered = true;

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      callback();
    }
  });
}
