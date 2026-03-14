const ALARM_NAME = 'session-saver-auto-save';

export function setupAlarms(intervalMinutes: number): void {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes });
}

export function updateAlarmInterval(intervalMinutes: number): void {
  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes });
  });
}

export function clearAlarms(): void {
  chrome.alarms.clear(ALARM_NAME);
}

export function onAlarm(callback: () => void): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      callback();
    }
  });
}
