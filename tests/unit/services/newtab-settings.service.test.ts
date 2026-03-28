import { describe, it, expect, vi, beforeEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock('@core/storage/storage-factory', () => ({
  getSettingsStorage: vi.fn(() => ({
    get: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
    set: vi.fn((key: string, val: unknown) => { store[key] = val; return Promise.resolve(); }),
    remove: vi.fn(),
    getAll: vi.fn(() => Promise.resolve({})),
    clear: vi.fn(),
    count: vi.fn(() => Promise.resolve(0)),
  })),
}));

import { getNewTabSettings, updateNewTabSettings } from '@core/services/newtab-settings.service';
import { DEFAULT_NEWTAB_SETTINGS, NEWTAB_SETTINGS_KEY } from '@core/types/newtab.types';

describe('newtab-settings.service', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.clearAllMocks();
  });

  // ── getNewTabSettings ────────────────────────────────────────────────────

  describe('getNewTabSettings', () => {
    it('returns default settings when storage is empty', async () => {
      const settings = await getNewTabSettings();
      expect(settings).toEqual(DEFAULT_NEWTAB_SETTINGS);
    });

    it('merges stored partial with defaults', async () => {
      store[NEWTAB_SETTINGS_KEY] = { layoutMode: 'focus', clockFormat: '24h' };
      const settings = await getNewTabSettings();
      expect(settings.layoutMode).toBe('focus');
      expect(settings.clockFormat).toBe('24h');
      // Defaults still present for un-overridden keys
      expect(settings.enabled).toBe(DEFAULT_NEWTAB_SETTINGS.enabled);
      expect(settings.searchEngine).toBe(DEFAULT_NEWTAB_SETTINGS.searchEngine);
    });

    it('returns full settings object when storage has all keys', async () => {
      store[NEWTAB_SETTINGS_KEY] = { ...DEFAULT_NEWTAB_SETTINGS, layoutMode: 'minimal' };
      const settings = await getNewTabSettings();
      expect(settings.layoutMode).toBe('minimal');
    });
  });

  // ── updateNewTabSettings ─────────────────────────────────────────────────

  describe('updateNewTabSettings', () => {
    it('merges updates with current settings and returns full object', async () => {
      const result = await updateNewTabSettings({ layoutMode: 'focus' });
      expect(result.layoutMode).toBe('focus');
      expect(result.enabled).toBe(DEFAULT_NEWTAB_SETTINGS.enabled);
    });

    it('persists to storage under the correct key', async () => {
      await updateNewTabSettings({ clockFormat: '24h' });
      const persisted = store[NEWTAB_SETTINGS_KEY] as Record<string, unknown>;
      expect(persisted.clockFormat).toBe('24h');
    });

    it('multiple updates accumulate correctly', async () => {
      await updateNewTabSettings({ layoutMode: 'focus' });
      await updateNewTabSettings({ clockFormat: '24h' });
      const settings = await getNewTabSettings();
      expect(settings.layoutMode).toBe('focus');
      expect(settings.clockFormat).toBe('24h');
    });
  });
});
