import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from '@core/types/storage.types';
import type { StorageMetadata } from '@core/types/storage.types';
import { getSettingsStorage } from '@core/storage/storage-factory';
import { REMOVED_SETTINGS_KEYS } from '@core/types/settings.types';

interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: () => Promise<void>;
}

const migrations: Migration[] = [
  {
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    // "Auto-delete old sessions" defaulted to 30 days but never ran before 1.1.0.
    // Turn it off so updating cannot suddenly delete old sessions; users opt in again.
    // Also drop settings that no longer exist.
    migrate: async () => {
      const storage = getSettingsStorage();
      const settings = await storage.get<Record<string, unknown>>(STORAGE_KEYS.SETTINGS);
      if (!settings) return;
      const next: Record<string, unknown> = { ...settings, autoDeleteAfterDays: null };
      for (const key of REMOVED_SETTINGS_KEYS) delete next[key];
      await storage.set(STORAGE_KEYS.SETTINGS, next);
    },
  },
];

export async function migrateIfNeeded(): Promise<void> {
  const storage = getSettingsStorage();
  const metadata = await storage.get<StorageMetadata>(STORAGE_KEYS.METADATA);

  const currentVersion = metadata?.version ?? '0.0.0';
  if (currentVersion === CURRENT_SCHEMA_VERSION) return;

  const pending = migrations.filter((m) => compareVersions(m.fromVersion, currentVersion) >= 0);
  pending.sort((a, b) => compareVersions(a.fromVersion, b.fromVersion));

  for (const migration of pending) {
    await migration.migrate();
  }

  await storage.set(STORAGE_KEYS.METADATA, {
    version: CURRENT_SCHEMA_VERSION,
    lastAutoSave: metadata?.lastAutoSave ?? null,
    storageUsedBytes: metadata?.storageUsedBytes ?? 0,
  });
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
