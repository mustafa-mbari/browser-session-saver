import { describe, it, expect, beforeEach, vi } from 'vitest';

// Each test needs a fresh module to reset module-level singleton state.
// Use vi.resetModules() + dynamic import per test.
describe('storage-factory singletons', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getSessionStorage returns the same instance on repeated calls', async () => {
    const { getSessionStorage } = await import('@core/storage/storage-factory');
    const a = getSessionStorage();
    const b = getSessionStorage();
    expect(a).toBe(b);
  });

  it('getSettingsStorage returns the same instance on repeated calls', async () => {
    const { getSettingsStorage } = await import('@core/storage/storage-factory');
    const a = getSettingsStorage();
    const b = getSettingsStorage();
    expect(a).toBe(b);
  });

  it('getSessionStorage and getSettingsStorage return different instances', async () => {
    const { getSessionStorage, getSettingsStorage } = await import('@core/storage/storage-factory');
    expect(getSessionStorage()).not.toBe(getSettingsStorage());
  });

  it('getSessionStorage returns an IndexedDBAdapter (has getByIndex method)', async () => {
    const { getSessionStorage } = await import('@core/storage/storage-factory');
    const storage = getSessionStorage();
    expect(typeof (storage as Record<string, unknown>).getByIndex).toBe('function');
  });

  it('getSettingsStorage returns a ChromeStorageAdapter (has getUsedBytes method)', async () => {
    const { getSettingsStorage } = await import('@core/storage/storage-factory');
    const storage = getSettingsStorage();
    expect(typeof (storage as Record<string, unknown>).getUsedBytes).toBe('function');
  });

  it('separate module loads produce separate singleton instances', async () => {
    const mod1 = await import('@core/storage/storage-factory');
    vi.resetModules();
    const mod2 = await import('@core/storage/storage-factory');
    // Each fresh module has its own singleton state — instances are not shared
    expect(mod1.getSessionStorage()).not.toBe(mod2.getSessionStorage());
  });
});
