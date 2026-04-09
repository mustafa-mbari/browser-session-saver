/**
 * sync/sync-orchestrator.ts — Cloud sync orchestrator for Browser Hub.
 *
 * Coordinates push/pull cycles across all entity types (sessions, prompts,
 * subscriptions, tab groups, bookmarks, todos) using SyncAdapter instances
 * and direct Supabase calls for multi-table entities.
 *
 * Strategy: push-first "full snapshot"
 *   1. Fetch the user's quota
 *   2. Push all local entities up to their respective limits
 *   3. Store last-sync timestamp in chrome.storage.local
 */

import { supabase } from '@core/supabase/client';
import { getSyncUserId, getSyncEmail } from '@core/services/sync-auth.service';
import { getAllSessions } from '@core/services/session.service';
import { getSessionRepository } from '@core/storage/storage-factory';
import { PromptStorage } from '@core/storage/prompt-storage';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { newtabDB } from '@core/storage/newtab-storage';
import { SyncAdapter } from './sync-adapter';
import { sessionMapper } from './row-mappers/session.mapper';
import { promptMapper, promptFolderMapper } from './row-mappers/prompt.mapper';
import { subscriptionMapper } from './row-mappers/subscription.mapper';
import { tabGroupTemplateRawMapper } from './row-mappers/tab-group.mapper';
import { bookmarkCategoryMapper, bookmarkEntryMapper, bookmarkCategoryFromRowWithContext, bookmarkEntryFromRowWithContext } from './row-mappers/bookmark.mapper';
import { todoListMapper, todoItemMapper } from './row-mappers/todo.mapper';
import { quicklinkMapper } from './row-mappers/quicklink.mapper';
import { isExcludedUrl, collectAllSyncableUrls } from './url-filter';
import { getDeletions, clearDeletions, recordDeletions, type DeletionEntity } from '@core/storage/deletion-log';
import type {
  UserQuota,
  SyncUsage,
  SyncStatus,
  SyncResult,
  PullResult,
  DashboardSyncResult,
} from './types';
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { Subscription } from '@core/types/subscription.types';
import type { BookmarkCategory, BookmarkEntry, TodoList, TodoItem, QuickLink } from '@core/types/newtab.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';

// ─── Internal state ──────────────────────────────────────────────────────────

const SYNC_STATUS_KEY = 'cloud_sync_status';
let _isSyncing = false;
let _quotaCache: { quota: UserQuota; fetchedAt: number } | null = null;
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── SyncAdapter instances ──────────────────────────────────────────────────

const _sessionSyncAdapter = new SyncAdapter<Session>(supabase, sessionMapper, {
  tableName: 'sessions',
  quotaSortField: 'updatedAt',
  preSyncTransform: (s) => ({ ...s, tabs: s.tabs.filter((t) => !isExcludedUrl(t.url)) }),
});

const _promptSyncAdapter = new SyncAdapter<Prompt>(supabase, promptMapper, {
  tableName: 'prompts',
  quotaSortField: 'updatedAt',
});

const _promptFolderSyncAdapter = new SyncAdapter<PromptFolder>(supabase, promptFolderMapper, {
  tableName: 'prompt_folders',
  quotaSortField: 'createdAt',
});

const _subscriptionSyncAdapter = new SyncAdapter<Subscription>(supabase, subscriptionMapper, {
  tableName: 'tracked_subscriptions',
  quotaSortField: 'createdAt',
});

const _tabGroupSyncAdapter = new SyncAdapter<TabGroupTemplate>(
  supabase,
  tabGroupTemplateRawMapper,
  {
    tableName: 'tab_group_templates',
    conflictColumn: 'user_id,key',
    quotaSortField: 'updatedAt',
    preSyncTransform: (tg) => ({
      ...tg,
      tabs: tg.tabs.filter((t) => !isExcludedUrl(t.url)),
    }),
  },
);

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the current sync status including auth info, last sync time, and quota.
 * Reads persisted state from chrome.storage.local.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const userId = await getSyncUserId();
  const email = userId ? await getSyncEmail() : null;

  const persisted = await new Promise<Partial<SyncStatus>>((resolve) =>
    chrome.storage.local.get(SYNC_STATUS_KEY, (r) =>
      resolve((r[SYNC_STATUS_KEY] as Partial<SyncStatus>) ?? {}),
    ),
  );

  if (!userId) {
    return {
      isAuthenticated: false,
      userId: null,
      email: null,
      lastSyncAt: null,
      isSyncing: false,
      quota: null,
      usage: null,
      error: null,
    };
  }

  const quota = await getUserQuota(userId).catch(() => null);

  return {
    isAuthenticated: true,
    userId,
    email,
    lastSyncAt: persisted.lastSyncAt ?? null,
    isSyncing: _isSyncing,
    quota,
    usage: persisted.usage ?? null,
    error: persisted.error ?? null,
  };
}

/**
 * Run a full sync cycle: push sessions, prompts, and subscriptions to Supabase.
 * Safe to call concurrently — concurrent calls are no-ops if already syncing.
 */
export async function syncAll(): Promise<SyncResult> {
  const _emptyUsage: SyncUsage = { sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0, todos: 0, quickLinks: 0 };

  if (_isSyncing) {
    return { success: false, synced: _emptyUsage, error: 'Sync already in progress' };
  }

  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, synced: _emptyUsage, error: 'Not authenticated' };
  }

  _isSyncing = true;
  await persistStatus({ isSyncing: true, error: null });

  const synced: SyncUsage = { sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0, todos: 0, quickLinks: 0 };

  try {
    const quota = await getUserQuota(userId);
    if (!quota.sync_enabled) {
      throw new Error('Sync is not enabled on your current plan. Upgrade to Pro or Max to enable cloud sync.');
    }

    // Flush the tombstone queue FIRST — explicit user-initiated deletions must
    // propagate before anything else. On success each queue is cleared; on
    // failure the ids stay in the queue and get retried on the next cycle.
    await flushDeletionLog(userId);

    // Load all local data upfront for global URL dedup check
    const [allSessions, allTemplates] = await Promise.all([
      getAllSessions({ isAutoSave: false }),
      TabGroupTemplateStorage.getAll(),
    ]);
    const db = newtabDB;
    const allBmEntries = await db.getAll<BookmarkEntry>('bookmarkEntries');

    // Enforce global unique-URL limit
    if (quota.total_tabs_limit != null && quota.total_tabs_limit > 0) {
      const uniqueUrls = collectAllSyncableUrls(allSessions, allTemplates, allBmEntries);
      if (uniqueUrls.size > quota.total_tabs_limit) {
        throw new Error(
          `You have ${uniqueUrls.size} unique tab URLs but your plan limit is ${quota.total_tabs_limit}. ` +
          `Remove some saved sessions or upgrade your plan to sync more tabs.`,
        );
      }
      synced.tabs = uniqueUrls.size;
    }

    // Push in parallel — all targets are independent
    const [sessionCount, promptCount, subCount, folderCount, tabGroupCount, todoCount, quickLinkCount] = await Promise.all([
      syncSessions(userId, quota, allSessions),
      syncPrompts(userId, quota),
      syncSubscriptions(userId, quota),
      syncBookmarkFolders(userId, quota, allBmEntries),
      syncTabGroupTemplates(userId, allTemplates, quota),
      syncTodos(userId, quota),
      syncQuickLinks(userId),
    ]);

    synced.sessions   = sessionCount;
    synced.prompts    = promptCount;
    synced.subs       = subCount;
    synced.folders    = folderCount;
    synced.tabGroups  = tabGroupCount;
    synced.todos      = todoCount;
    synced.quickLinks = quickLinkCount;

    const now = new Date().toISOString();
    const actualUsage = await fetchActualUsage(userId).catch(() => null);
    await persistStatus({ lastSyncAt: now, isSyncing: false, usage: actualUsage ?? synced, error: null });

    return { success: true, synced };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await persistStatus({ isSyncing: false, error: errorMsg });
    return { success: false, synced, error: errorMsg };
  } finally {
    _isSyncing = false;
  }
}

/**
 * Push a single session to Supabase (called after save/update mutations).
 * Skips auto-saves and respects sync_enabled from the user's plan quota.
 */
export async function pushSession(session: Session, userId: string): Promise<void> {
  if (session.isAutoSave) return;
  const quota = await getUserQuota(userId).catch(() => null);
  if (quota && !quota.sync_enabled) return;
  try {
    await _sessionSyncAdapter.pushOne(session, userId);
  } catch (e) {
    console.warn('[sync] pushSession error:', (e as Error).message);
  }
}

/**
 * Delete a session from Supabase by its local ID.
 */
export async function deleteRemoteSession(sessionId: string): Promise<void> {
  const userId = await getSyncUserId();
  if (!userId) return;
  try {
    await _sessionSyncAdapter.deleteOne(userId, sessionId);
  } catch (e) {
    console.warn('[sync] deleteRemoteSession error:', (e as Error).message);
  }
}

/**
 * Push the dashboard config JSON snapshot to Supabase.
 * Enforces the user's monthly `dashboard_syncs_limit` via the
 * `sync_dashboard_config` SQL RPC (atomic check + upsert + log).
 */
export async function syncDashboard(config: string, userId: string): Promise<DashboardSyncResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    return { success: false, syncsUsedThisMonth: 0, syncsLimit: 0, error: 'Invalid dashboard JSON' };
  }

  const { data, error } = await supabase.rpc('sync_dashboard_config', {
    p_user_id: userId,
    p_config: parsed,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return {
      success: false,
      syncsUsedThisMonth: 0,
      syncsLimit: 0,
      error: error?.message ?? 'Dashboard sync failed',
    };
  }

  return {
    success: row.success as boolean,
    syncsUsedThisMonth: row.syncs_used as number,
    syncsLimit: row.syncs_limit as number,
    error: row.error ?? undefined,
  };
}

/**
 * Fetch the latest dashboard config snapshot from Supabase.
 */
export async function pullDashboard(userId: string): Promise<DashboardSyncResult> {
  const { data, error } = await supabase
    .from('dashboard_configs')
    .select('config')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      success: false,
      syncsUsedThisMonth: 0,
      syncsLimit: 0,
      error: error?.code === 'PGRST116' ? 'No dashboard backup found in the cloud.' : (error?.message ?? 'Failed to fetch dashboard'),
    };
  }

  return {
    success: true,
    syncsUsedThisMonth: 0,
    syncsLimit: 0,
    config: JSON.stringify(data.config),
  };
}

/**
 * Drain the deletion-log tombstone queue: for each entity, issue an explicit
 * Supabase DELETE filtered by `user_id` and the pending ids, then clear the
 * queue on success. Ids stay in the queue on failure and get retried next run.
 *
 * This is how user-initiated deletions propagate to the cloud now that
 * orphan-delete has been removed from the push/pull paths.
 */
async function flushDeletionLog(userId: string): Promise<void> {
  // id-keyed entities — all use `id` as the delete filter column.
  const idEntities: DeletionEntity[] = [
    'sessions',
    'prompts',
    'prompt_folders',
    'tracked_subscriptions',
    'bookmark_folders',
    'bookmark_entries',
    'todo_lists',
    'todo_items',
    'quick_links',
  ];

  for (const entity of idEntities) {
    const ids = await getDeletions(entity);
    if (ids.length === 0) continue;
    const { error } = await supabase.from(entity).delete().eq('user_id', userId).in('id', ids);
    if (error) {
      console.warn(`[sync] tombstone flush failed for ${entity}:`, error.message);
      continue; // leave ids in the queue for next retry
    }
    await clearDeletions(entity, ids);
  }

  // tab_group_templates is keyed by (user_id, key) — the tombstone stores `key`.
  const tabGroupKeys = await getDeletions('tab_group_templates');
  if (tabGroupKeys.length > 0) {
    const { error } = await supabase
      .from('tab_group_templates')
      .delete()
      .eq('user_id', userId)
      .in('key', tabGroupKeys);
    if (error) {
      console.warn('[sync] tombstone flush failed for tab_group_templates:', error.message);
    } else {
      await clearDeletions('tab_group_templates', tabGroupKeys);
    }
  }
}

/**
 * Pull all synced data from Supabase and merge it into local storage.
 * Existing local items are preserved (merge by ID — no overwrites).
 * Safe to call on a new device right after sign-in.
 */
export async function pullAll(): Promise<PullResult> {
  const emptyPulled = { sessions: 0, prompts: 0, subs: 0, tabGroups: 0, folders: 0, todos: 0, quickLinks: 0 };

  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, pulled: emptyPulled, error: 'Not authenticated' };
  }

  try {
    const [sessionCount, promptCount, subCount, tabGroupCount, folderCount, todoCount, quickLinkCount] = await Promise.all([
      pullSessions(userId),
      pullPrompts(userId),
      pullSubscriptions(userId),
      pullTabGroupTemplates(userId),
      pullBookmarkFolders(userId),
      pullTodos(userId),
      pullQuickLinks(userId),
    ]);

    return {
      success: true,
      pulled: {
        sessions: sessionCount,
        prompts: promptCount,
        subs: subCount,
        tabGroups: tabGroupCount,
        folders: folderCount,
        todos: todoCount,
        quickLinks: quickLinkCount,
      },
    };
  } catch (err) {
    return { success: false, pulled: emptyPulled, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetch the user's **plan limits** (what they are allowed to store).
 * Calls the `get_user_quota(p_user_id)` Supabase RPC.
 * Results are cached for 5 minutes to avoid repeated round trips per sync cycle.
 */
export async function getUserQuota(userId: string): Promise<UserQuota> {
  const now = Date.now();
  if (_quotaCache && now - _quotaCache.fetchedAt < QUOTA_CACHE_TTL_MS) {
    return _quotaCache.quota;
  }

  const { data, error } = await supabase.rpc('get_user_quota', { p_user_id: userId });
  const row = Array.isArray(data) ? (data as UserQuota[])[0] : (data as UserQuota | null);
  if (error || !row) {
    return {
      plan_id: 'free',
      plan_name: 'Free',
      sessions_synced_limit: 0,
      tabs_per_session_limit: null,
      folders_synced_limit: 0,
      entries_per_folder_limit: null,
      prompts_access_limit: null,
      prompts_create_limit: 0,
      subs_synced_limit: null,
      total_tabs_limit: 0,
      tab_groups_synced_limit: 0,
      todos_synced_limit: 0,
      dashboard_syncs_limit: 0,
      quick_links_synced_limit: 0,
      sync_enabled: false,
    };
  }

  const quota = row;
  _quotaCache = { quota, fetchedAt: now };
  return quota;
}

// ─── Internal utilities ──────────────────────────────────────────────────────

/** Sort items by `createdAt` descending and take at most `limit` items. */
function topByCreatedAt<T extends { createdAt: string }>(items: T[], limit: number | null): T[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/**
 * Fetch the actual synced counts from the DB via `get_user_usage` RPC.
 * Maps RPC snake_case fields to the SyncUsage camelCase interface.
 */
async function fetchActualUsage(userId: string): Promise<SyncUsage | null> {
  const { data, error } = await supabase.rpc('get_user_usage', { p_user_id: userId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    sessions:   Number((row as Record<string, unknown>).synced_sessions   ?? 0),
    prompts:    Number((row as Record<string, unknown>).synced_prompts    ?? 0),
    subs:       Number((row as Record<string, unknown>).synced_subs       ?? 0),
    folders:    Number((row as Record<string, unknown>).synced_bm_folders ?? 0),
    tabs:       Number((row as Record<string, unknown>).synced_tabs       ?? 0),
    tabGroups:  Number((row as Record<string, unknown>).synced_tab_groups ?? 0),
    todos:      Number((row as Record<string, unknown>).synced_todos      ?? 0),
    quickLinks: Number((row as Record<string, unknown>).synced_quick_links ?? 0),
  };
}

// ─── Internal push helpers ──────────────────────────────────────────────────

async function syncSessions(userId: string, quota: UserQuota, allSessions: Session[]): Promise<number> {
  if (allSessions.length === 0) return 0;
  return _sessionSyncAdapter.push(allSessions, userId, quota.sessions_synced_limit);
}

async function syncPrompts(userId: string, quota: UserQuota): Promise<number> {
  const [allPrompts, allFolders] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
  ]);

  const localFolders = allFolders.filter((f) => f.source === 'local');
  if (localFolders.length > 0) {
    await _promptFolderSyncAdapter.push(localFolders, userId, null);
  }

  const localPrompts = allPrompts.filter((p) => p.source === 'local');
  const count = localPrompts.length === 0 ? 0 : await _promptSyncAdapter.push(localPrompts, userId, quota.prompts_create_limit);

  // NOTE: orphan-delete intentionally removed. Deletions are propagated
  // through the deletion-log tombstone queue flushed at the start of syncAll.

  return count;
}

async function syncSubscriptions(userId: string, quota: UserQuota): Promise<number> {
  const allSubs = await SubscriptionStorage.getAll();
  const count = allSubs.length === 0 ? 0 : await _subscriptionSyncAdapter.push(allSubs, userId, quota.subs_synced_limit);

  // NOTE: orphan-delete intentionally removed. Deletions are propagated
  // through the deletion-log tombstone queue flushed at the start of syncAll.

  return count;
}

async function syncBookmarkFolders(
  userId: string,
  quota: UserQuota,
  allEntries: BookmarkEntry[],
): Promise<number> {
  const db = newtabDB;
  const categories = await db.getAll<BookmarkCategory>('bookmarkCategories');
  if (categories.length === 0) return 0;

  const folderLimit = quota.folders_synced_limit ?? Infinity;
  const entryLimit  = quota.entries_per_folder_limit ?? Infinity;

  const toSyncFolders = topByCreatedAt(categories, folderLimit === Infinity ? null : folderLimit);
  const folderIds = new Set(toSyncFolders.map((c) => c.id));

  const folderRows = toSyncFolders.map((c) => bookmarkCategoryMapper.toRow(c, userId));
  const { error: fErr } = await supabase.from('bookmark_folders').upsert(folderRows, { onConflict: 'id' });
  if (fErr) throw new Error(`Bookmark folders sync failed: ${fErr.message}`);

  const eligible = allEntries.filter((e) => folderIds.has(e.categoryId) && !isExcludedUrl(e.url));

  const byFolder = eligible.reduce<Record<string, BookmarkEntry[]>>((acc, e) => {
    (acc[e.categoryId] ??= []).push(e);
    return acc;
  }, {});

  const limitedEntries: BookmarkEntry[] = [];
  for (const folderEntries of Object.values(byFolder)) {
    limitedEntries.push(...folderEntries.slice(0, entryLimit));
  }

  if (limitedEntries.length > 0) {
    const entryRows = limitedEntries.map((e, i) => ({ ...bookmarkEntryMapper.toRow(e, userId), position: i }));
    const { error: eErr } = await supabase.from('bookmark_entries').upsert(entryRows, { onConflict: 'id' });
    if (eErr) throw new Error(`Bookmark entries sync failed: ${eErr.message}`);
  }

  // NOTE: orphan-delete intentionally removed. A push must NEVER delete remote
  // rows just because they are absent from the current local set — local can
  // legitimately be smaller than remote (fresh install, IDB cleared, quota
  // truncation, multi-device race) and we previously destroyed user data here.
  // Cross-device deletion propagation requires tombstones (`deleted_at`); until
  // that lands, deletions only flow through explicit per-entity delete APIs.

  return toSyncFolders.length;
}

async function syncTabGroupTemplates(userId: string, allTemplates: TabGroupTemplate[], quota: UserQuota): Promise<number> {
  if (allTemplates.length === 0) return 0;

  const count = await _tabGroupSyncAdapter.push(allTemplates, userId, quota.tab_groups_synced_limit);

  // NOTE: orphan-delete intentionally removed (see syncBookmarkFolders for full
  // reasoning). Pushes are upsert-only.

  return count;
}

async function syncTodos(userId: string, quota: UserQuota): Promise<number> {
  const limit = quota.todos_synced_limit ?? Infinity;
  if (limit === 0) return 0;

  const db = newtabDB;
  const [allLists, allItems, allCategories] = await Promise.all([
    db.getAll<TodoList>('todoLists'),
    db.getAll<TodoItem>('todoItems'),
    db.getAll<BookmarkCategory>('bookmarkCategories'),
  ]);

  // Harvest todos from dashboard card widgets (stored as JSON in noteContent).
  // noteContent is authoritative for each card: items present in IDB with that listId
  // but absent from noteContent were deleted via the widget and must be purged.
  const now = new Date().toISOString();
  const existingListIds = new Set(allLists.map((l) => l.id));
  const existingItemIds = new Set(allItems.map((i) => i.id));
  const widgetDeletedIds = new Set<string>(); // IDB items removed only in noteContent

  for (const cat of allCategories) {
    if (cat.cardType !== 'todo' || !cat.noteContent) continue;
    let cardItems: { id: string; text: string; done: boolean }[];
    try { cardItems = JSON.parse(cat.noteContent); } catch { continue; }

    // Ensure the todo list row exists for this card
    if (!existingListIds.has(cat.id)) {
      allLists.push({ id: cat.id, name: cat.name, icon: cat.icon ?? '✅', position: 0, createdAt: cat.createdAt ?? now });
      existingListIds.add(cat.id);
    }

    // Mark IDB items for this card that are absent from noteContent as widget-deleted
    const cardItemIdSet = new Set(cardItems.map((i) => i.id));
    for (const item of allItems) {
      if (item.listId === cat.id && !cardItemIdSet.has(item.id)) {
        widgetDeletedIds.add(item.id);
      }
    }

    // Add/update items from noteContent
    cardItems.forEach((item, idx) => {
      if (!existingItemIds.has(item.id)) {
        allItems.push({ id: item.id, listId: cat.id, text: item.text, completed: item.done, priority: 'none', position: idx, createdAt: now });
        existingItemIds.add(item.id);
      } else {
        const existing = allItems.find((i) => i.id === item.id);
        if (existing) { existing.completed = item.done; existing.text = item.text; existing.position = idx; }
      }
    });
  }

  // Purge widget-deleted items from IDB and exclude them from the sync payload.
  // Also record tombstones so the next tombstone-flush removes the remote rows
  // and subsequent pulls do not rehydrate them via noteContent.
  if (widgetDeletedIds.size > 0) {
    await Promise.all([...widgetDeletedIds].map((id) => db.delete('todoItems', id)));
    for (let i = allItems.length - 1; i >= 0; i--) {
      if (widgetDeletedIds.has(allItems[i].id)) allItems.splice(i, 1);
    }
    await recordDeletions('todo_items', [...widgetDeletedIds]);
  }

  // Push local lists and items (upsert only if there's something to write)
  if (allLists.length > 0) {
    const listRows = allLists.map((l) => todoListMapper.toRow(l, userId));
    const { error } = await supabase.from('todo_lists').upsert(listRows, { onConflict: 'id,user_id' });
    if (error) throw new Error(`Todo lists sync failed: ${error.message}`);
  }

  const toSync = topByCreatedAt(allItems, limit === Infinity ? null : limit);

  if (toSync.length > 0) {
    const itemRows = toSync.map((i) => todoItemMapper.toRow(i, userId));
    const { error } = await supabase.from('todo_items').upsert(itemRows, { onConflict: 'id,user_id' });
    if (error) throw new Error(`Todo items sync failed: ${error.message}`);
  }

  // NOTE: orphan-delete intentionally removed (see syncBookmarkFolders for the
  // full reasoning). Pushes are now upsert-only; deletions only propagate
  // through explicit per-entity delete APIs until tombstones are added.
  // Widget-deleted items are still purged from local IDB above so they will not
  // be re-pushed on the next cycle, but stale remote rows are left in place.

  return toSync.length;
}

// ─── Internal pull helpers ──────────────────────────────────────────────────

async function pullSessions(userId: string): Promise<number> {
  const remoteSessions = await _sessionSyncAdapter.pull(userId);
  if (remoteSessions.length === 0) return 0;

  const pendingDeletes = new Set(await getDeletions('sessions'));
  const repo = getSessionRepository();
  const existing = await repo.getAll();
  const existingIds = new Set(existing.map((s) => s.id));
  const toWrite = remoteSessions.filter((s) => !existingIds.has(s.id) && !pendingDeletes.has(s.id));
  await Promise.all(toWrite.map((s) => repo.save(s)));
  return toWrite.length;
}

async function pullPrompts(userId: string): Promise<number> {
  const [remoteFolders, remotePrompts] = await Promise.all([
    _promptFolderSyncAdapter.pull(userId),
    _promptSyncAdapter.pull(userId),
  ]);

  const [existingPrompts, existingFolders, pendingPromptDeletes, pendingFolderDeletes] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
    getDeletions('prompts'),
    getDeletions('prompt_folders'),
  ]);
  const existingPromptIds = new Set(existingPrompts.map((p) => p.id));
  const existingFolderIds = new Set(existingFolders.map((f) => f.id));
  const pendingPromptSet = new Set(pendingPromptDeletes);
  const pendingFolderSet = new Set(pendingFolderDeletes);

  const newFolders = remoteFolders.filter((f) => !existingFolderIds.has(f.id) && !pendingFolderSet.has(f.id));
  const newPrompts = remotePrompts.filter((p) => !existingPromptIds.has(p.id) && !pendingPromptSet.has(p.id));

  await Promise.all([
    ...newFolders.map((f) => PromptStorage.saveFolder(f)),
    ...newPrompts.map((p) => PromptStorage.save(p)),
  ]);

  // NOTE: local reconciliation-delete intentionally removed. Deletions are
  // propagated through the deletion-log tombstone queue (filtered above).

  return newPrompts.length;
}

async function pullSubscriptions(userId: string): Promise<number> {
  const remoteSubs = await _subscriptionSyncAdapter.pull(userId);

  if (remoteSubs.length > 0) {
    const pendingDeletes = new Set(await getDeletions('tracked_subscriptions'));
    const toImport = remoteSubs.filter((s) => !pendingDeletes.has(s.id));
    if (toImport.length > 0) await SubscriptionStorage.importMany(toImport);
  }

  // NOTE: local reconciliation-delete intentionally removed. Deletions are
  // propagated through the deletion-log tombstone queue (filtered above).

  return remoteSubs.length;
}

async function pullTabGroupTemplates(userId: string): Promise<number> {
  const remoteTemplates = await _tabGroupSyncAdapter.pull(userId);

  if (remoteTemplates.length > 0) {
    const [existing, pendingDeletes] = await Promise.all([
      TabGroupTemplateStorage.getAll(),
      getDeletions('tab_group_templates'),
    ]);
    const existingKeys = new Set(existing.map((t) => t.key));
    const pendingKeySet = new Set(pendingDeletes);
    const toWrite = remoteTemplates.filter((t) => !existingKeys.has(t.key) && !pendingKeySet.has(t.key));
    await Promise.all(toWrite.map((t) => TabGroupTemplateStorage.upsert(t)));
  }

  // NOTE: local reconciliation-delete intentionally removed. Deletions are
  // propagated through the deletion-log tombstone queue (filtered above).

  return remoteTemplates.length;
}

async function pullBookmarkFolders(userId: string): Promise<number> {
  const [{ data: folderRows, error: fErr }, { data: entryRows, error: eErr }] = await Promise.all([
    supabase.from('bookmark_folders').select('*').eq('user_id', userId),
    supabase.from('bookmark_entries').select('*').eq('user_id', userId),
  ]);
  if (fErr) throw new Error(`Bookmark folder pull failed: ${fErr.message}`);
  if (eErr) throw new Error(`Bookmark entry pull failed: ${eErr.message}`);
  if (!folderRows || folderRows.length === 0) return 0;

  const db = newtabDB;
  const [existingFolders, existingEntries, pendingFolderDeletes, pendingEntryDeletes] = await Promise.all([
    db.getAll<BookmarkCategory>('bookmarkCategories'),
    db.getAll<BookmarkEntry>('bookmarkEntries'),
    getDeletions('bookmark_folders'),
    getDeletions('bookmark_entries'),
  ]);
  const existingFolderIds = new Set(existingFolders.map((c) => c.id));
  const existingEntryIds = new Set(existingEntries.map((e) => e.id));
  const pendingFolderSet = new Set(pendingFolderDeletes);
  const pendingEntrySet = new Set(pendingEntryDeletes);

  const allEntries = (entryRows ?? []) as Record<string, unknown>[];
  const entryIdsByFolder = allEntries.reduce<Record<string, string[]>>((acc, r) => {
    const fid = r.folder_id as string;
    (acc[fid] ??= []).push(r.id as string);
    return acc;
  }, {});

  const newFolders = (folderRows as Record<string, unknown>[]).filter(
    (r) => !existingFolderIds.has(r.id as string) && !pendingFolderSet.has(r.id as string),
  );
  const newEntries = allEntries.filter(
    (r) => !existingEntryIds.has(r.id as string) && !pendingEntrySet.has(r.id as string),
  );

  const now = new Date().toISOString();
  await Promise.all([
    ...newFolders.map((r) =>
      db.put<BookmarkCategory>('bookmarkCategories', bookmarkCategoryFromRowWithContext(r, entryIdsByFolder[r.id as string] ?? [], now)),
    ),
    ...newEntries.map((r) =>
      db.put<BookmarkEntry>('bookmarkEntries', bookmarkEntryFromRowWithContext(r, now)),
    ),
  ]);

  // NOTE: local reconciliation-delete intentionally removed. Deletions are
  // propagated through the deletion-log tombstone queue (filtered above).

  return newFolders.length;
}

async function pullTodos(userId: string): Promise<number> {
  const [{ data: listRows, error: lErr }, { data: itemRows, error: iErr }] = await Promise.all([
    supabase.from('todo_lists').select('*').eq('user_id', userId),
    supabase.from('todo_items').select('*').eq('user_id', userId),
  ]);
  if (lErr) throw new Error(`Todo list pull failed: ${lErr.message}`);
  if (iErr) throw new Error(`Todo item pull failed: ${iErr.message}`);
  if (!listRows && !itemRows) return 0;

  const db = newtabDB;

  const [pendingListDeletes, pendingItemDeletes] = await Promise.all([
    getDeletions('todo_lists'),
    getDeletions('todo_items'),
  ]);
  const pendingListSet = new Set(pendingListDeletes);
  const pendingItemSet = new Set(pendingItemDeletes);

  // Upsert pulled items into IDB — tombstoned ids are skipped so deleted todos
  // do not re-appear from the cloud before the next flush.
  await Promise.all([
    ...(listRows ?? [])
      .filter((r) => !pendingListSet.has(r.id as string))
      .map((r) => db.put<TodoList>('todoLists', todoListMapper.fromRow(r as Record<string, unknown>))),
    ...(itemRows ?? [])
      .filter((r) => !pendingItemSet.has(r.id as string))
      .map((r) => db.put<TodoItem>('todoItems', todoItemMapper.fromRow(r as Record<string, unknown>))),
  ]);

  // NOTE: local reconciliation-delete intentionally removed. Deletions are
  // propagated through the deletion-log tombstone queue (filtered above).

  // For dashboard card todo widgets: write pulled items back into the category's
  // noteContent so the card UI reflects the synced state on reload.
  const allCategories = await db.getAll<BookmarkCategory>('bookmarkCategories');
  const todoCardMap = new Map(allCategories.filter((c) => c.cardType === 'todo').map((c) => [c.id, c]));
  if (todoCardMap.size > 0) {
    const byList: Record<string, Array<{ id: string; text: string; done: boolean; position: number }>> = {};
    for (const r of (itemRows ?? [])) {
      const listId = r.list_id as string;
      const itemId = r.id as string;
      if (pendingItemSet.has(itemId)) continue; // don't re-hydrate tombstoned items
      if (todoCardMap.has(listId)) {
        (byList[listId] ??= []).push({ id: itemId, text: r.text as string, done: r.completed as boolean, position: (r.position as number) ?? 0 });
      }
    }
    await Promise.all(
      Object.entries(byList).map(([listId, items]) => {
        const cat = todoCardMap.get(listId)!;
        const sorted = [...items].sort((a, b) => a.position - b.position);
        const noteContent = JSON.stringify(sorted.map(({ id, text, done }) => ({ id, text, done })));
        return db.put<BookmarkCategory>('bookmarkCategories', { ...cat, noteContent });
      }),
    );
  }

  return (itemRows ?? []).length;
}

async function syncQuickLinks(userId: string): Promise<number> {
  const db = newtabDB;
  const allLinks = await db.getAll<QuickLink>('quickLinks');
  const manualLinks = allLinks.filter((l) => !l.isAutoGenerated);

  if (manualLinks.length > 0) {
    const rows = manualLinks.map((l) => quicklinkMapper.toRow(l, userId));
    const { error } = await supabase.from('quick_links').upsert(rows, { onConflict: 'id,user_id' });
    if (error) throw new Error(`Quick links sync failed: ${error.message}`);
  }

  // NOTE: orphan-delete intentionally removed (see syncBookmarkFolders for full
  // reasoning). Pushes are upsert-only.

  return manualLinks.length;
}

async function pullQuickLinks(userId: string): Promise<number> {
  const { data: remoteRows, error } = await supabase
    .from('quick_links').select('*').eq('user_id', userId);
  if (error) throw new Error(`Quick links pull failed: ${error.message}`);
  if (!remoteRows || remoteRows.length === 0) return 0;

  const db = newtabDB;
  const remoteLinks = (remoteRows as Record<string, unknown>[]).map((r) => quicklinkMapper.fromRow(r));
  const pendingDeletes = new Set(await getDeletions('quick_links'));

  // Upsert all remote links into local IDB, skipping any that are tombstoned.
  const toWrite = remoteLinks.filter((l) => !pendingDeletes.has(l.id));
  await Promise.all(toWrite.map((l) => db.put<QuickLink>('quickLinks', l)));

  // NOTE: local reconciliation-delete intentionally removed. Deletions are
  // propagated through the deletion-log tombstone queue (filtered above).

  return toWrite.length;
}

// ─── Persistence helpers ────────────────────────────────────────────────────

async function persistStatus(updates: Partial<SyncStatus>): Promise<void> {
  const current = await new Promise<Partial<SyncStatus>>((resolve) =>
    chrome.storage.local.get(SYNC_STATUS_KEY, (r) =>
      resolve((r[SYNC_STATUS_KEY] as Partial<SyncStatus>) ?? {}),
    ),
  );
  await new Promise<void>((resolve) =>
    chrome.storage.local.set({ [SYNC_STATUS_KEY]: { ...current, ...updates } }, resolve),
  );
}
