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

async function importSyncService() {
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

  it('syncAll succeeds with valid quota and data', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockAuth.getSyncEmail.mockResolvedValue('u@example.com');

    const quota = makeQuota();
    mockSupabase.rpc.mockResolvedValue({ data: quota, error: null });
    mockGetAllSessions.mockResolvedValue([makeSession()]);

    // Supabase from() mock: supports upsert, delete, and select chains.
    // delete/select chains are kept as no-ops because the explicit per-entity
    // delete API (deleteRemoteSession) still calls them; sync push paths no
    // longer issue orphan-deletes.
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockDeleteChain = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };
    const mockSelectChain = {
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockSupabase.from.mockReturnValue({
      upsert: mockUpsert,
      delete: vi.fn().mockReturnValue(mockDeleteChain),
      select: vi.fn().mockReturnValue(mockSelectChain),
    });

    const { syncAll } = await importSyncService();
    const result = await syncAll();
    expect(result.success).toBe(true);
    expect(result.synced.sessions).toBe(1);
  });

  // ── syncAll — sequential guard ────────────────────────────────────────────
  // The `_isSyncing` flag is set AFTER the first `await` (getSyncUserId).
  // A second call made AFTER the first's getSyncUserId resolves will see the flag.

  it('second syncAll returns early when first is still in progress', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');

    // Make rpc hang so the first call stays in-flight after _isSyncing=true is set
    mockSupabase.rpc.mockImplementation(() => new Promise(() => {})); // never resolves
    mockGetAllSessions.mockResolvedValue([]);

    const { syncAll } = await importSyncService();

    // Start the first call (won't complete — rpc hangs)
    syncAll(); // fire-and-forget — not awaited

    // Yield microtasks so getSyncUserId() resolves and _isSyncing=true is set
    await Promise.resolve();
    await Promise.resolve();

    // Second call should now see _isSyncing=true
    const secondResult = await syncAll();
    expect(secondResult.error).toBe('Sync already in progress');
  });

  // ── pushSession — skips auto-saves ────────────────────────────────────────

  it('pushSession skips sessions where isAutoSave=true', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

    const { pushSession } = await importSyncService();
    await pushSession(makeSession({ isAutoSave: true }), 'user-1');

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('pushSession upserts non-auto-save sessions', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

    const { pushSession } = await importSyncService();
    await pushSession(makeSession({ isAutoSave: false }), 'user-1');

    expect(mockUpsert).toHaveBeenCalled();
  });

  // ── deleteRemoteSession ───────────────────────────────────────────────────

  it('deleteRemoteSession calls supabase delete with correct filters', async () => {
    mockAuth.getSyncUserId.mockResolvedValue('user-1');

    const mockEq2 = vi.fn().mockResolvedValue({ error: null });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });

    const { deleteRemoteSession } = await importSyncService();
    await deleteRemoteSession('session-1');

    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq1).toHaveBeenCalledWith('id', 'session-1');
    expect(mockEq2).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('deleteRemoteSession is a no-op when not authenticated', async () => {
    // mockAuth.getSyncUserId already returns null
    const mockDelete = vi.fn();
    mockSupabase.from.mockReturnValue({ delete: mockDelete });

    const { deleteRemoteSession } = await importSyncService();
    await deleteRemoteSession('session-1');

    expect(mockDelete).not.toHaveBeenCalled();
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
