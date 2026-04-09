/**
 * sync-orchestrator.destructive-path.test.ts
 *
 * Regression tests for the bookmark-folder data-loss incident: a push must
 * NEVER delete remote rows that happen to be missing from local, and a pull
 * must NEVER delete local rows that happen to be missing from remote. The
 * previous "orphan-delete" reconciliation cascaded a single transient
 * mismatch into total data loss on both sides. These tests pin the new
 * merge-only semantics in place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserQuota } from '@core/services/sync.service';
import type { BookmarkCategory, BookmarkEntry, TodoList, TodoItem, QuickLink } from '@core/types/newtab.types';

// ── Shared mock harness (mirrors sync.service.test.ts) ──────────────────────

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

const mockAuth = {
  getSyncUserId: vi.fn(),
  getSyncEmail: vi.fn(),
};

const mockGetAllSessions = vi.fn();
const mockSessionRepo = { getAll: vi.fn(), save: vi.fn() };
const mockPromptStorage = { getAll: vi.fn(), getFolders: vi.fn(), save: vi.fn(), saveFolder: vi.fn(), delete: vi.fn(), deleteFolder: vi.fn() };
const mockSubscriptionStorage = { getAll: vi.fn(), importMany: vi.fn(), delete: vi.fn() };
const mockTabGroupTemplateStorage = { getAll: vi.fn(), upsert: vi.fn(), delete: vi.fn() };
const mockNewTabDB = { getAll: vi.fn(), put: vi.fn(), delete: vi.fn() };

function setupChromeStorage() {
  const store: Record<string, unknown> = {};
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string, cb: (r: Record<string, unknown>) => void) => { cb({ [key]: store[key] }); },
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, cb?: () => void) => { Object.assign(store, items); cb?.(); },
  );
}

function makeQuota(overrides: Partial<UserQuota> = {}): UserQuota {
  return {
    plan_id: 'pro',
    plan_name: 'Pro',
    sessions_synced_limit: 1000,
    tabs_per_session_limit: null,
    folders_synced_limit: null,
    entries_per_folder_limit: null,
    prompts_access_limit: null,
    prompts_create_limit: 1000,
    subs_synced_limit: 1000,
    total_tabs_limit: null,
    tab_groups_synced_limit: 1000,
    todos_synced_limit: 1000,
    dashboard_syncs_limit: 1000,
    quick_links_synced_limit: 1000,
    sync_enabled: true,
    ...overrides,
  };
}

function makeFolder(id: string, name = id): BookmarkCategory {
  return {
    id,
    boardId: 'board-1',
    name,
    icon: '',
    color: '',
    bookmarkIds: [],
    collapsed: false,
    colSpan: 3,
    rowSpan: 3,
    cardType: 'bookmark',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeFolderRow(id: string): Record<string, unknown> {
  return {
    id,
    user_id: 'user-1',
    board_id: 'board-1',
    name: id,
    icon: null,
    color: null,
    card_type: 'bookmark',
    note_content: null,
    col_span: 3,
    row_span: 3,
    position: 0,
    parent_folder_id: null,
  };
}

function makeEntry(id: string, categoryId: string): BookmarkEntry {
  return {
    id,
    categoryId,
    title: id,
    url: `https://example.com/${id}`,
    favIconUrl: '',
    isNative: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

async function importSyncService() {
  vi.resetModules();
  vi.doMock('@core/supabase/client', () => ({ supabase: mockSupabase }));
  vi.doMock('@core/services/sync-auth.service', () => mockAuth);
  vi.doMock('@core/services/session.service', () => ({ getAllSessions: mockGetAllSessions }));
  vi.doMock('@core/storage/storage-factory', () => ({
    getSessionRepository: () => mockSessionRepo,
  }));
  vi.doMock('@core/storage/prompt-storage', () => ({ PromptStorage: mockPromptStorage }));
  vi.doMock('@core/storage/subscription-storage', () => ({ SubscriptionStorage: mockSubscriptionStorage }));
  vi.doMock('@core/storage/tab-group-template-storage', () => ({
    TabGroupTemplateStorage: mockTabGroupTemplateStorage,
  }));
  vi.doMock('@core/storage/newtab-storage', () => ({ newtabDB: mockNewTabDB }));
  return await import('@core/services/sync.service');
}

/**
 * Builds a Supabase from() mock that records every call to upsert/delete/select
 * across all tables, so tests can assert that no DELETE was issued anywhere.
 */
function buildSupabaseRecorder(opts: {
  selectData?: Record<string, unknown[]>;
} = {}) {
  const calls: { table: string; op: 'upsert' | 'delete' | 'select'; payload?: unknown }[] = [];
  const deleteFiltersByTable: Record<string, string[][]> = {};

  mockSupabase.from.mockImplementation((table: string) => {
    return {
      upsert: vi.fn().mockImplementation((payload: unknown) => {
        calls.push({ table, op: 'upsert', payload });
        return Promise.resolve({ error: null });
      }),
      delete: vi.fn().mockImplementation(() => {
        calls.push({ table, op: 'delete' });
        return {
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
            (deleteFiltersByTable[table] ??= []).push(ids);
            return Promise.resolve({ error: null });
          }),
        };
      }),
      select: vi.fn().mockImplementation((cols?: string) => {
        calls.push({ table, op: 'select', payload: cols });
        const data = opts.selectData?.[table] ?? [];
        return {
          eq: vi.fn().mockReturnValue(
            // The orchestrator destructures `{ data, error }` directly from the
            // result of `.eq(...)` for selects, so it must resolve to that shape.
            Promise.resolve({ data, error: null }),
          ),
        };
      }),
    };
  });

  return {
    calls,
    deleteFiltersByTable,
    deleteCallsForTable(table: string) {
      return calls.filter((c) => c.table === table && c.op === 'delete');
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sync-orchestrator destructive-path regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChromeStorage();

    mockAuth.getSyncUserId.mockResolvedValue('user-1');
    mockAuth.getSyncEmail.mockResolvedValue('u@example.com');
    mockGetAllSessions.mockResolvedValue([]);
    mockSessionRepo.getAll.mockResolvedValue([]);
    mockPromptStorage.getAll.mockResolvedValue([]);
    mockPromptStorage.getFolders.mockResolvedValue([]);
    mockSubscriptionStorage.getAll.mockResolvedValue([]);
    mockTabGroupTemplateStorage.getAll.mockResolvedValue([]);
    mockNewTabDB.getAll.mockResolvedValue([]);

    mockSupabase.rpc.mockResolvedValue({ data: makeQuota(), error: null });
  });

  // ── PUSH path: bookmark folders ──────────────────────────────────────────

  it('syncAll never DELETEs bookmark_folders rows when local has fewer than remote', async () => {
    // Local has only the 2 seed-like folders…
    const localFolders: BookmarkCategory[] = [makeFolder('local-1'), makeFolder('local-2')];

    mockNewTabDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'bookmarkCategories') return localFolders;
      if (store === 'bookmarkEntries') return [];
      return [];
    });

    // …while remote has 50 folders (irrelevant to assertion — test passes
    // regardless because we no longer issue any DELETE).
    const recorder = buildSupabaseRecorder();

    const { syncAll } = await importSyncService();
    const result = await syncAll();

    expect(result.success).toBe(true);
    expect(recorder.deleteCallsForTable('bookmark_folders')).toHaveLength(0);
    expect(recorder.deleteCallsForTable('bookmark_entries')).toHaveLength(0);

    // And the upsert was still issued for the 2 local folders
    const folderUpserts = recorder.calls.filter((c) => c.table === 'bookmark_folders' && c.op === 'upsert');
    expect(folderUpserts).toHaveLength(1);
    expect(Array.isArray(folderUpserts[0].payload)).toBe(true);
    expect((folderUpserts[0].payload as unknown[]).length).toBe(2);
  });

  // ── PULL path: bookmark folders ──────────────────────────────────────────

  it('pullAll never deletes local bookmark folders when remote has fewer than local', async () => {
    // Local has 5 folders (with entries) — none of which exist in remote.
    const localFolders: BookmarkCategory[] = [
      makeFolder('local-1'), makeFolder('local-2'), makeFolder('local-3'),
      makeFolder('local-4'), makeFolder('local-5'),
    ];
    const localEntries: BookmarkEntry[] = [
      makeEntry('e-1', 'local-1'),
      makeEntry('e-2', 'local-2'),
    ];

    mockNewTabDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'bookmarkCategories') return localFolders;
      if (store === 'bookmarkEntries') return localEntries;
      return [];
    });

    // Remote has just 1 folder, 0 entries.
    buildSupabaseRecorder({
      selectData: {
        bookmark_folders: [makeFolderRow('remote-only-1')],
        bookmark_entries: [],
        sessions: [],
        prompts: [],
        prompt_folders: [],
        tracked_subscriptions: [],
        tab_group_templates: [],
        todo_lists: [],
        todo_items: [],
        quick_links: [],
      },
    });

    const { pullAll } = await importSyncService();
    const result = await pullAll();

    expect(result.success).toBe(true);

    // CRITICAL: no local folder/entry was deleted by the pull reconciliation.
    const deleteCalls = mockNewTabDB.delete.mock.calls;
    const folderDeletes = deleteCalls.filter((c) => c[0] === 'bookmarkCategories');
    const entryDeletes = deleteCalls.filter((c) => c[0] === 'bookmarkEntries');
    expect(folderDeletes).toHaveLength(0);
    expect(entryDeletes).toHaveLength(0);
  });

  // ── PUSH path: todos ─────────────────────────────────────────────────────

  it('syncAll never DELETEs todo_items or todo_lists rows when local has fewer than remote', async () => {
    const localList: TodoList = { id: 'list-1', name: 'L1', icon: '✅', position: 0, createdAt: '2026-01-01T00:00:00.000Z' };
    const localItem: TodoItem = { id: 'item-1', listId: 'list-1', text: 'task', completed: false, priority: 'none', position: 0, createdAt: '2026-01-01T00:00:00.000Z' };

    mockNewTabDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'todoLists') return [localList];
      if (store === 'todoItems') return [localItem];
      if (store === 'bookmarkCategories') return [];
      if (store === 'bookmarkEntries') return [];
      return [];
    });

    const recorder = buildSupabaseRecorder();

    const { syncAll } = await importSyncService();
    const result = await syncAll();

    expect(result.success).toBe(true);
    expect(recorder.deleteCallsForTable('todo_items')).toHaveLength(0);
    expect(recorder.deleteCallsForTable('todo_lists')).toHaveLength(0);
  });

  // ── PULL path: todos ─────────────────────────────────────────────────────

  it('pullAll never deletes local todo lists/items when remote has fewer than local', async () => {
    const localLists: TodoList[] = [
      { id: 'list-A', name: 'A', icon: '✅', position: 0, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'list-B', name: 'B', icon: '✅', position: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const localItems: TodoItem[] = [
      { id: 'item-A1', listId: 'list-A', text: 'a1', completed: false, priority: 'none', position: 0, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'item-A2', listId: 'list-A', text: 'a2', completed: false, priority: 'none', position: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'item-B1', listId: 'list-B', text: 'b1', completed: false, priority: 'none', position: 0, createdAt: '2026-01-01T00:00:00.000Z' },
    ];

    mockNewTabDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'todoLists') return localLists;
      if (store === 'todoItems') return localItems;
      if (store === 'bookmarkCategories') return [];
      if (store === 'bookmarkEntries') return [];
      return [];
    });

    // Remote has 1 todo list, 0 items.
    buildSupabaseRecorder({
      selectData: {
        todo_lists: [{ id: 'list-remote', user_id: 'user-1', name: 'remote', icon: null, position: 0, created_at: '2026-01-01T00:00:00.000Z' }],
        todo_items: [],
        bookmark_folders: [],
        bookmark_entries: [],
        sessions: [],
        prompts: [],
        prompt_folders: [],
        tracked_subscriptions: [],
        tab_group_templates: [],
        quick_links: [],
      },
    });

    const { pullAll } = await importSyncService();
    const result = await pullAll();

    expect(result.success).toBe(true);

    const listDeletes = mockNewTabDB.delete.mock.calls.filter((c) => c[0] === 'todoLists');
    const itemDeletes = mockNewTabDB.delete.mock.calls.filter((c) => c[0] === 'todoItems');
    expect(listDeletes).toHaveLength(0);
    expect(itemDeletes).toHaveLength(0);
  });

  // ── PULL path: subscriptions ─────────────────────────────────────────────

  it('pullAll never deletes local subscriptions when remote is empty', async () => {
    mockSubscriptionStorage.getAll.mockResolvedValue([
      { id: 'sub-1', name: 'Netflix', amount: 10, currency: 'USD', billingCycle: 'monthly', renewalDate: '2026-05-01', categoryId: 'streaming', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'sub-2', name: 'Spotify',  amount: 5,  currency: 'USD', billingCycle: 'monthly', renewalDate: '2026-05-15', categoryId: 'streaming', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);

    buildSupabaseRecorder({
      selectData: {
        tracked_subscriptions: [],
        bookmark_folders: [],
        bookmark_entries: [],
        sessions: [],
        prompts: [],
        prompt_folders: [],
        tab_group_templates: [],
        todo_lists: [],
        todo_items: [],
        quick_links: [],
      },
    });

    const { pullAll } = await importSyncService();
    await pullAll();

    expect(mockSubscriptionStorage.delete).not.toHaveBeenCalled();
  });

  // ── PULL path: prompts ───────────────────────────────────────────────────

  it('pullAll never deletes local prompts/folders when remote is empty', async () => {
    mockPromptStorage.getAll.mockResolvedValue([
      { id: 'p-1', source: 'local', title: 'Prompt 1', body: '', tagIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'p-2', source: 'local', title: 'Prompt 2', body: '', tagIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    mockPromptStorage.getFolders.mockResolvedValue([
      { id: 'f-1', source: 'local', name: 'Folder 1', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);

    buildSupabaseRecorder({
      selectData: {
        prompts: [],
        prompt_folders: [],
        bookmark_folders: [],
        bookmark_entries: [],
        sessions: [],
        tracked_subscriptions: [],
        tab_group_templates: [],
        todo_lists: [],
        todo_items: [],
        quick_links: [],
      },
    });

    const { pullAll } = await importSyncService();
    await pullAll();

    expect(mockPromptStorage.delete).not.toHaveBeenCalled();
    expect(mockPromptStorage.deleteFolder).not.toHaveBeenCalled();
  });

  // ── PULL path: tab group templates ───────────────────────────────────────

  it('pullAll never deletes local tab-group templates when remote is empty', async () => {
    mockTabGroupTemplateStorage.getAll.mockResolvedValue([
      { key: 'tg-1', title: 'Work', color: 'blue', tabs: [], updatedAt: '2026-01-01T00:00:00.000Z' },
      { key: 'tg-2', title: 'Personal', color: 'green', tabs: [], updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);

    buildSupabaseRecorder({
      selectData: {
        tab_group_templates: [],
        bookmark_folders: [],
        bookmark_entries: [],
        sessions: [],
        prompts: [],
        prompt_folders: [],
        tracked_subscriptions: [],
        todo_lists: [],
        todo_items: [],
        quick_links: [],
      },
    });

    const { pullAll } = await importSyncService();
    await pullAll();

    expect(mockTabGroupTemplateStorage.delete).not.toHaveBeenCalled();
  });

  // ── PUSH path: quick links ───────────────────────────────────────────────

  it('syncAll never DELETEs quick_links rows when local is smaller than remote', async () => {
    const localLink: QuickLink = { id: 'ql-1', title: 'Local', url: 'https://x.test', favIconUrl: '', position: 0, isAutoGenerated: false };

    mockNewTabDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'quickLinks') return [localLink];
      if (store === 'bookmarkCategories') return [];
      if (store === 'bookmarkEntries') return [];
      return [];
    });

    const recorder = buildSupabaseRecorder();

    const { syncAll } = await importSyncService();
    const result = await syncAll();

    expect(result.success).toBe(true);
    expect(recorder.deleteCallsForTable('quick_links')).toHaveLength(0);
  });
});
