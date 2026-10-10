import { purgeOldTombstones } from '@core/services/maintenance.service';
import { MAINTENANCE_ALARM, ensureAlarm, onAlarm } from './alarms';

const DAILY_MINUTES = 24 * 60;

/** Schedule the daily maintenance run. Must be called synchronously at startup. */
export function initMaintenance(): void {
  onAlarm(MAINTENANCE_ALARM, () => {
    void runMaintenance();
  });
  ensureAlarm(MAINTENANCE_ALARM, DAILY_MINUTES).catch((error: unknown) => {
    console.error('Failed to schedule maintenance:', error);
  });
}

export async function runMaintenance(): Promise<void> {
  try {
    await purgeOldTombstones();
  } catch (error) {
    console.error('Maintenance failed:', error);
  }
}
