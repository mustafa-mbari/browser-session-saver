import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { getSettingsStorage } from '@core/storage/storage-factory';
import { purgeOldTombstones, deleteSessionsOlderThan } from '@core/services/maintenance.service';
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
    const stored = await getSettingsStorage().get<Settings>(STORAGE_KEYS.SETTINGS);
    const { autoDeleteAfterDays } = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    if (autoDeleteAfterDays != null && autoDeleteAfterDays > 0) {
      await deleteSessionsOlderThan(autoDeleteAfterDays);
    }
    await purgeOldTombstones();
  } catch (error) {
    console.error('Maintenance failed:', error);
  }
}
