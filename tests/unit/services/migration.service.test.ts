import { describe, it, expect, vi, beforeEach } from 'vitest';

// migration.service has no module-level mutable state, so vi.resetModules() is not needed.
const { store, settingsStore } = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  settingsStore: {} as Record<string, unknown>,
}));

const mockSettingsStorage = {
  get: vi.fn((key: string) => Promise.resolve(settingsStore[key] ?? null)),
  set: vi.fn((key: string, val: unknown) => { settingsStore[key] = val; return Promise.resolve(); }),
  remove: vi.fn(),
  getAll: vi.fn(() => Promise.resolve({})),
  clear: vi.fn(),
  count: vi.fn(() => Promise.resolve(0)),
};

vi.mock('@core/storage/storage-factory', () => ({
  getSessionRepository: vi.fn(() => ({
    getById: vi.fn((id: string) => Promise.resolve(store[id] ?? null)),
    save: vi.fn((entity: { id: string }) => { store[entity.id] = entity; return Promise.resolve(); }),
    delete: vi.fn(),
    getAll: vi.fn(() => Promise.resolve(Object.values(store))),
    count: vi.fn(() => Promise.resolve(0)),
    getByIndex: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    importMany: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
  })),
  getSettingsStorage: vi.fn(() => mockSettingsStorage),
}));

import { CURRENT_SCHEMA_VERSION, STORAGE_KEYS } from '@core/types/storage.types';
import { migrateIfNeeded } from '@core/services/migration.service';

describe('migrateIfNeeded', () => {
  beforeEach(() => {
    Object.keys(settingsStore).forEach(k => delete settingsStore[k]);
    vi.clearAllMocks();
    // Restore mock implementations after clearAllMocks
    mockSettingsStorage.get.mockImplementation((key: string) => Promise.resolve(settingsStore[key] ?? null));
    mockSettingsStorage.set.mockImplementation((key: string, val: unknown) => { settingsStore[key] = val; return Promise.resolve(); });
  });

  it('reads metadata from storage on every call', async () => {
    settingsStore[STORAGE_KEYS.METADATA] = { version: CURRENT_SCHEMA_VERSION, lastAutoSave: null, storageUsedBytes: 0 };
    await migrateIfNeeded();
    expect(mockSettingsStorage.get).toHaveBeenCalledWith(STORAGE_KEYS.METADATA);
  });

  it('is a no-op (no write) when version already matches current schema', async () => {
    settingsStore[STORAGE_KEYS.METADATA] = { version: CURRENT_SCHEMA_VERSION, lastAutoSave: null, storageUsedBytes: 0 };
    await migrateIfNeeded();
    expect(mockSettingsStorage.set).not.toHaveBeenCalled();
  });

  it('writes current version when no metadata exists (fresh install)', async () => {
    await migrateIfNeeded();
    const written = settingsStore[STORAGE_KEYS.METADATA] as { version: string };
    expect(written.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('writes current version when metadata has old version', async () => {
    settingsStore[STORAGE_KEYS.METADATA] = { version: '0.0.0', lastAutoSave: null, storageUsedBytes: 0 };
    await migrateIfNeeded();
    const written = settingsStore[STORAGE_KEYS.METADATA] as { version: string };
    expect(written.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('preserves lastAutoSave when writing updated version', async () => {
    settingsStore[STORAGE_KEYS.METADATA] = { version: '0.0.0', lastAutoSave: '2026-01-01T00:00:00.000Z', storageUsedBytes: 0 };
    await migrateIfNeeded();
    const written = settingsStore[STORAGE_KEYS.METADATA] as { lastAutoSave: string };
    expect(written.lastAutoSave).toBe('2026-01-01T00:00:00.000Z');
  });
});
