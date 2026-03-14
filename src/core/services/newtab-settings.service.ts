import {
  DEFAULT_NEWTAB_SETTINGS,
  NEWTAB_SETTINGS_KEY,
  type NewTabSettings,
} from '@core/types/newtab.types';
import { getSettingsStorage } from '@core/storage/storage-factory';

export async function getNewTabSettings(): Promise<NewTabSettings> {
  const storage = getSettingsStorage();
  const saved = await storage.get<NewTabSettings>(NEWTAB_SETTINGS_KEY);
  return { ...DEFAULT_NEWTAB_SETTINGS, ...(saved ?? {}) };
}

export async function updateNewTabSettings(
  updates: Partial<NewTabSettings>,
): Promise<NewTabSettings> {
  const storage = getSettingsStorage();
  const current = await getNewTabSettings();
  const next = { ...current, ...updates };
  await storage.set(NEWTAB_SETTINGS_KEY, next);
  return next;
}
