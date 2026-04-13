import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncResult, UserQuota } from '@core/services/sync.service';
import type { Session as BrowserSession } from '@core/types/session.types';

// ── Module-level state isolation ─────────────────────────────────────────────
// sync.service has module-level `_isSyncing` and `_quotaCache`.
// We use vi.resetModules() + vi.doMock() + dynamic import so each test
// starts with a clean module state.

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

const mockAuth = {
  getSyncUserId: vi.fn(),
  getSyncEmail: vi.fn(),
};

const mockGetAllSessions = vi.fn();
const mockPromptStorage = { getAll: vi.fn(), getFolders: vi.fn() };
const mockSubscriptionStorage = { getAll: vi.fn() };
const mockTabGroupTemplateStorage = { getAll: vi.fn() };
const mockNewTabDB = { getAll: vi.fn() };

function setupChromeStorage() {
  const store: Record<string, unknown> = {};
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string, cb: (r: Record<string, unknown>) => void) => { cb({ [key]: store[key] }); },
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, cb?: () => void) => { Object.assign(store, items); cb?.(); },
  );
  return store;
}

function makeQuota(overrides: Partial<UserQuota> = {}): UserQuota {
  return {
    plan_id: 'pro',
    plan_name: 'Pro',
    sessions_synced_limit: 100,
    tabs_per_session_limit: null,
    folders_synced_limit: null,
    entries_per_folder_limit: null,
    prompts_access_limit: null,
    prompts_create_limit: 100,
    subs_synced_limit: 100,
    total_tabs_limit: null,
    tab_groups_synced_limit: null,
    sync_enabled: true,
    ...overrides,
  };
}

function makeSession(overrides: Partial<BrowserSession> = {}): BrowserSession {
  return {
    id: 'session-1',
    name: 'My Session',
    tabs: [],
    tabGroups: [],
    tabCount: 0,
    isAutoSave: false,
    isPinned: false,
    isStarred: false,
    isLocked: false,
    windowId: 1,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

interface ImportOverrides {
  engine?: { syncAll?: ReturnType<typeof vi.fn>; syncEntity?: ReturnType<typeof vi.fn> };
  sessionRepo?: { markDeleted?: ReturnType<typeof vi.fn> };
}

async function importSyncService(overrides: ImportOverrides = {}) {
  vi.resetModules();
  vi.doMock('@core/supabase/client', () => ({ supabase: mockSupabase }));
  vi.doMock('@core/services/sync-auth.service', () => mockAuth);
  vi.doMock('@core/services/session.service', () => ({ getAllSessions: mockGetAllSessions }));
  vi.doMock('@core/storage/prompt-storage', () => ({ PromptStorage: mockPromptStorage }));
  vi.doMock('@core/storage/subscription-storage', () => ({ SubscriptionStorage: mockSubscriptionStorage }));
  vi.doMock('@core/storage/tab-group-template-storage', () => ({
    TabGroupTemplateStorage: mockTabGroupTemplateStorage,
  }));
  vi.doMock('@core/storage/newtab-storage', () => ({
    newtabDB: mockNewTabDB,
  }));
  vi.doMock('@core/sync/legacy/deletion-log-importer', () => ({
    importLegacyDeletionLog: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('@core/sync/handlers', () => ({
    getSyncEngine: () => ({
      syncAll: overrides.engine?.syncAll ?? vi.fn().mockResolvedValue({ ok: true, entities: [] }),
      syncEntity: overrides.engine?.syncEntity ?? vi.fn().mockResolvedValue({ ok: true }),
    }),
  }));
  if (overrides.sessionRepo) {
    vi.doMock('@core/storage/storage-factory', () => ({
      getSessionRepository: () => overrides.sessionRepo,
    }));
  }
  return await import('@core/services/sync.service');
}

describe('sync.service', () => {
  let chromeStore: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    chromeStore = setupChromeStorage();

    // Default: not authenticated
    mockAuth.getSyncUserId.mockResolvedValue(null);
    mockAuth.getSyncEmail.mockResolvedValue(null);
    mockGetAllSessions.mockResolvedValue([]);
    mockPromptStorage.getAll.mockResolvedValue([]);
    mockPromptStorage.getFolders.mockResolvedValue([]);
    mockSubscriptionStorage.getAll.mockResolvedValue([]);
    mockTabGroupTemplateStorage.getAll.mockResolvedValue([]);
    mockNewTabDB.getAll.mockResolvedValue([]);
  });

  // ── getSyncStatus — unauthenticated ──────────────────────────────────────

  it('getSyncStatus returns unauthenticated defaults when no user', async () => {
    const { getSyncStatus } = await importSyncService();
    const status = await getSyncStatus();
    expect(status.isAuthenticated).toBe(false);
    expect(status.userId).toBeNull();
    expect(status.email).toBeNull();
  });

  // ── syncAll — not authenticated ───────────────────────────────────────────

  it('syncAll returns error when not authenticated', async () => {
    const { syncAll } = await importSyncService();
    const result: SyncResult = await syncAll();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
  });

  // ── syncAll — sync disabled by quota ─────────────────────────────────────

  it('syncAll returns error when sync_enabled is false', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockAuth.getSyncEmail.mockResolvedValue('u@example.com');
    mockSupabase.rpc.mockResolvedValue({
      data: makeQuota({ sync_enabled: false }),
      error: null,
    });

    const { syncAll } = await importSyncService();
    const result = await syncAll();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sync is not enabled/i);
  });

  // ── syncAll — successful sync ─────────────────────────────────────────────
  // The new SyncEngine mediates all entity push/pull. Here we mock the engine
  // factory so the facade's orchestration (quota fetch, persist status, usage
  // aggregation) is exercised without pulling in the full handler graph.

  it('syncAll succeeds with valid quota and engine reports success', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockAuth.getSyncEmail.mockResolvedValue('u@example.com');
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });

    const { syncAll } = await importSyncService({
      engine: {
        syncAll: vi.fn().mockResolvedValue({
          ok: true,
          entities: [{ entity: 'sessions', pushed: 1, pulled: 0 }],
        }),
      },
    });
    const result = await syncAll();
    expect(result.success).toBe(true);
    expect(result.synced.sessions).toBe(1);
  });

  // ── syncAll — sequential guard ────────────────────────────────────────────

  it('second syncAll returns early when first is still in progress', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });

    const { syncAll } = await importSyncService({
      engine: {
        // never resolves — keeps first call in-flight so _isSyncing stays true
        syncAll: vi.fn().mockImplementation(() => new Promise(() => {})),
      },
    });

    syncAll(); // fire-and-forget
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const secondResult = await syncAll();
    expect(secondResult.error).toBe('Sync already in progress');
  });

  // ── pushSession — skips auto-saves ────────────────────────────────────────

  it('pushSession skips sessions where isAutoSave=true', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });

    const engineSyncEntity = vi.fn().mockResolvedValue({ ok: true });
    const { pushSession } = await importSyncService({
      engine: { syncEntity: engineSyncEntity },
    });
    await pushSession(makeSession({ isAutoSave: true }), 'user-1');

    expect(engineSyncEntity).not.toHaveBeenCalled();
  });

  it('pushSession delegates to engine.syncEntity for non-auto-save sessions', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });

    const engineSyncEntity = vi.fn().mockResolvedValue({ ok: true });
    const { pushSession } = await importSyncService({
      engine: { syncEntity: engineSyncEntity },
    });
    await pushSession(makeSession({ isAutoSave: false }), 'user-1');

    expect(engineSyncEntity).toHaveBeenCalledWith('sessions', expect.anything());
  });

  // ── deleteRemoteSession ───────────────────────────────────────────────────
  // In the new system deletes are soft-deletes: the session repo stamps a
  // tombstone and the engine propagates on the next cycle. The facade just
  // routes to repo.markDeleted and never talks to Supabase directly.

  it('deleteRemoteSession calls repo.markDeleted with the given id', async () => {
    const markDeleted = vi.fn().mockResolvedValue(true);
    const { deleteRemoteSession } = await importSyncService({
      sessionRepo: { markDeleted },
    });
    await deleteRemoteSession('session-1');
    expect(markDeleted).toHaveBeenCalledWith('session-1');
  });

  it('deleteRemoteSession swallows errors from the repo', async () => {
    const markDeleted = vi.fn().mockRejectedValue(new Error('boom'));
    const { deleteRemoteSession } = await importSyncService({
      sessionRepo: { markDeleted },
    });
    await expect(deleteRemoteSession('session-1')).resolves.toBeUndefined();
  });

  // ── getUserQuota — caching ────────────────────────────────────────────────

  it('getUserQuota caches result and skips second RPC call within TTL', async () => {
    const quota = makeQuota();
    mockSupabase.rpc.mockResolvedValue({ data: quota, error: null });

    const { getUserQuota } = await importSyncService();
    await getUserQuota('user-1');
    await getUserQuota('user-1'); // should use cache

    expect(mockSupabase.rpc).toHaveBeenCalledOnce();
  });

  // ── getSyncStatus — reads from storage ───────────────────────────────────

  it('getSyncStatus returns persisted lastSyncAt when authenticated', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockAuth.getSyncEmail.mockResolvedValue('u@example.com');
    chromeStore['cloud_sync_status'] = { lastSyncAt: '2026-01-01T00:00:00.000Z', usage: null, error: null };
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });

    const { getSyncStatus } = await importSyncService();
    const status = await getSyncStatus();
    expect(status.isAuthenticated).toBe(true);
    expect(status.lastSyncAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
