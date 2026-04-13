/**
 * Phase-2 selective-sync + mass-delete message handlers.
 *
 * These handlers read and write to chrome.storage.local via the sync/state
 * helpers and call into the engine for dirty counts. The test stubs the
 * engine module so no real Supabase is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerEventListeners } from '@background/event-listeners';

// ── Stub every heavy dependency so event-listeners loads quietly ────────────

vi.mock('@core/services/session.service', () => ({
  getAllSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn(),
  deleteSession: vi.fn().mockResolvedValue(false),
  updateSession: vi.fn().mockResolvedValue(null),
  checkDuplicate: vi.fn().mockResolvedValue(false),
}));

vi.mock('@core/storage/storage-factory', () => ({
  getSettingsStorage: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  }),
  getSessionRepository: () => ({
    getById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    getByIndex: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    importMany: vi.fn().mockResolvedValue(undefined),
    replaceAll: vi.fn().mockResolvedValue(undefined),
    markDeleted: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('@core/services/tab-group.service', () => ({
  captureTabGroups: vi.fn().mockReturnValue({ tabs: [], tabGroups: [] }),
  restoreTabGroups: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@core/services/export.service', () => ({
  exportAsJSON: vi.fn(),
  exportAsHTML: vi.fn(),
  exportAsMarkdown: vi.fn(),
  exportAsCSV: vi.fn(),
  exportAsText: vi.fn(),
}));

vi.mock('@core/services/import.service', () => ({
  importFromJSON: vi.fn(),
  importFromHTML: vi.fn(),
  importFromURLList: vi.fn(),
}));

vi.mock('@core/services/sync-auth.service', () => ({
  syncSignIn: vi.fn(),
  syncSignOut: vi.fn(),
  getSyncUserId: vi.fn().mockResolvedValue(null),
  getSyncEmail: vi.fn().mockResolvedValue(null),
}));

vi.mock('@core/services/sync.service', () => ({
  syncAll: vi.fn(),
  getSyncStatus: vi.fn(),
  pushSession: vi.fn(),
  deleteRemoteSession: vi.fn(),
  syncDashboard: vi.fn(),
  pullDashboard: vi.fn(),
  pullAll: vi.fn(),
}));

// Inline fake engine so getDirtyCounts returns something predictable.
const mockGetDirtyCounts = vi.fn().mockResolvedValue({
  sessions: { dirty: 3, tombstones: 1 },
  prompts: { dirty: 0, tombstones: 0 },
});

vi.mock('@core/sync/handlers', () => ({
  getSyncEngine: () => ({
    getDirtyCounts: mockGetDirtyCounts,
  }),
}));

// ── chrome.storage.local backing store ─────────────────────────────────────

function setupChromeStorage(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {}),
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve(undefined);
    },
  );
  return store;
}

function dispatch(message: object): Promise<Record<string, unknown>> {
  const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls.at(-1)![0];
  return new Promise((resolve) => listener(message, {}, resolve));
}

describe('Phase 2 sync handlers', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = setupChromeStorage();
    registerEventListeners();
  });

  // ── SYNC_GET_SETTINGS ────────────────────────────────────────────────────
  it('SYNC_GET_SETTINGS returns defaults when nothing is stored', async () => {
    const res = await dispatch({ action: 'SYNC_GET_SETTINGS', payload: {} });
    expect(res.success).toBe(true);
    const data = res.data as { syncEnabled: boolean; entities: Record<string, boolean> };
    expect(data.syncEnabled).toBe(true);
    expect(data.entities.sessions).toBe(true);
    expect(data.entities.quick_links).toBe(true);
  });

  // ── SYNC_UPDATE_SETTINGS ────────────────────────────────────────────────
  it('SYNC_UPDATE_SETTINGS merges master switch and per-entity toggles', async () => {
    const res = await dispatch({
      action: 'SYNC_UPDATE_SETTINGS',
      payload: { syncEnabled: false, entities: { sessions: false } },
    });
    expect(res.success).toBe(true);
    const data = res.data as { syncEnabled: boolean; entities: Record<string, boolean> };
    expect(data.syncEnabled).toBe(false);
    expect(data.entities.sessions).toBe(false);
    expect(data.entities.prompts).toBe(true); // untouched keys remain on
  });

  it('SYNC_UPDATE_SETTINGS filters unknown entity keys (defensive)', async () => {
    const res = await dispatch({
      action: 'SYNC_UPDATE_SETTINGS',
      payload: { entities: { bogus_key: false } },
    });
    const data = res.data as { entities: Record<string, boolean> };
    expect((data.entities as Record<string, boolean>).bogus_key).toBeUndefined();
  });

  // ── SYNC_PAUSE / SYNC_CLEAR_PAUSE ────────────────────────────────────────
  it('SYNC_PAUSE sets pauseUntil N minutes in the future', async () => {
    const before = Date.now();
    const res = await dispatch({ action: 'SYNC_PAUSE', payload: { minutes: 60, reason: 'test' } });
    expect(res.success).toBe(true);
    const data = res.data as { pauseUntil?: string; pauseReason?: string };
    expect(data.pauseUntil).toBeTruthy();
    expect(data.pauseReason).toBe('test');
    const ms = Date.parse(data.pauseUntil!) - before;
    expect(ms).toBeGreaterThanOrEqual(55 * 60_000);
    expect(ms).toBeLessThanOrEqual(65 * 60_000);
  });

  it('SYNC_PAUSE clamps a negative minutes value to a safe minimum', async () => {
    const res = await dispatch({ action: 'SYNC_PAUSE', payload: { minutes: -10 } });
    const data = res.data as { pauseUntil?: string };
    expect(data.pauseUntil).toBeTruthy(); // still valid — clamped to >= 1 minute
  });

  it('SYNC_CLEAR_PAUSE wipes pauseUntil and pauseReason', async () => {
    await dispatch({ action: 'SYNC_PAUSE', payload: { minutes: 60 } });
    const res = await dispatch({ action: 'SYNC_CLEAR_PAUSE', payload: {} });
    const data = res.data as { pauseUntil?: string; pauseReason?: string };
    expect(data.pauseUntil).toBeUndefined();
    expect(data.pauseReason).toBeUndefined();
  });

  // ── SYNC_GET_MASS_DELETE_TRIPS ───────────────────────────────────────────
  it('SYNC_GET_MASS_DELETE_TRIPS returns [] when nothing tripped', async () => {
    const res = await dispatch({ action: 'SYNC_GET_MASS_DELETE_TRIPS', payload: {} });
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('SYNC_CLEAR_MASS_DELETE_TRIP removes a specific entity trip', async () => {
    // Seed a trip by writing directly through the store (simulating the engine).
    store['sync_mass_delete_trips'] = {
      sessions: {
        entity: 'sessions',
        tombstoneCount: 50,
        totalCount: 60,
        threshold: 12,
        detectedAt: '2026-04-14T00:00:00.000Z',
      },
      prompts: {
        entity: 'prompts',
        tombstoneCount: 40,
        totalCount: 50,
        threshold: 10,
        detectedAt: '2026-04-14T00:00:00.000Z',
      },
    };
    await dispatch({ action: 'SYNC_CLEAR_MASS_DELETE_TRIP', payload: { entity: 'sessions' } });
    const res = await dispatch({ action: 'SYNC_GET_MASS_DELETE_TRIPS', payload: {} });
    const data = res.data as Array<{ entity: string }>;
    expect(data).toHaveLength(1);
    expect(data[0].entity).toBe('prompts');
  });

  it('SYNC_CLEAR_MASS_DELETE_TRIP rejects unknown entity keys', async () => {
    const res = await dispatch({
      action: 'SYNC_CLEAR_MASS_DELETE_TRIP',
      payload: { entity: 'not_a_real_entity' },
    });
    expect(res.success).toBe(false);
  });

  it('SYNC_CLEAR_ALL_MASS_DELETE_TRIPS wipes every trip', async () => {
    store['sync_mass_delete_trips'] = {
      sessions: {
        entity: 'sessions', tombstoneCount: 10, totalCount: 20, threshold: 4,
        detectedAt: '2026-04-14T00:00:00.000Z',
      },
    };
    await dispatch({ action: 'SYNC_CLEAR_ALL_MASS_DELETE_TRIPS', payload: {} });
    const res = await dispatch({ action: 'SYNC_GET_MASS_DELETE_TRIPS', payload: {} });
    expect(res.data).toEqual([]);
  });

  // ── SYNC_GET_DIRTY_COUNTS ────────────────────────────────────────────────
  it('SYNC_GET_DIRTY_COUNTS delegates to the engine', async () => {
    const res = await dispatch({ action: 'SYNC_GET_DIRTY_COUNTS', payload: {} });
    expect(res.success).toBe(true);
    expect(mockGetDirtyCounts).toHaveBeenCalledOnce();
    const data = res.data as Record<string, { dirty: number; tombstones: number }>;
    expect(data.sessions).toEqual({ dirty: 3, tombstones: 1 });
  });
});
