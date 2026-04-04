/**
 * sync.service.ts — Cloud sync orchestrator for Browser Hub.
 *
 * Strategy: push-first "full snapshot"
 *   1. Fetch the user's quota
 *   2. Push local sessions (non-auto-save) up to sessions_synced_limit
 *   3. Push local prompts + folders up to prompts_create_limit
 *   4. Push local tracked subscriptions (all)
 *   5. Store last-sync timestamp in chrome.storage.local
 *
 * All data mapping (camelCase ↔ snake_case) lives in this file.
 */

import { supabase } from '@core/supabase/client';
import { getSyncUserId, getSyncEmail } from '@core/services/sync-auth.service';
import { getAllSessions } from '@core/services/session.service';
import { getSessionRepository } from '@core/storage/storage-factory';
import { PromptStorage } from '@core/storage/prompt-storage';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { NewTabDB } from '@core/storage/newtab-storage';
import { SyncAdapter } from '@core/services/sync/sync-adapter';
import { sessionMapper } from '@core/services/sync/row-mappers/session.mapper';
import { promptMapper, promptFolderMapper } from '@core/services/sync/row-mappers/prompt.mapper';
import { subscriptionMapper } from '@core/services/sync/row-mappers/subscription.mapper';
import { tabGroupTemplateRawMapper } from '@core/services/sync/row-mappers/tab-group.mapper';
import { enforceQuota } from '@core/services/sync/quota';
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { Subscription } from '@core/types/subscription.types';
import type { BookmarkCategory, BookmarkEntry, TodoList, TodoItem } from '@core/types/newtab.types';
import type { TabGroupTemplate } from '@core/types/tab-group.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserQuota {
  plan_id: string;
  plan_name: string;
  sessions_synced_limit: number | null;
  tabs_per_session_limit: number | null;
  folders_synced_limit: number | null;
  entries_per_folder_limit: number | null;
  prompts_access_limit: number | null;
  prompts_create_limit: number | null;
  subs_synced_limit: number | null;
  total_tabs_limit: number | null;
  tab_groups_synced_limit: number | null;
  todos_synced_limit: number | null;
  dashboard_syncs_limit: number | null;
  sync_enabled: boolean;
}

export interface SyncUsage {
  sessions: number;
  prompts: number;
  subs: number;
  tabs: number;      // unique non-excluded URLs synced this cycle
  folders: number;   // bookmark folder categories synced
  tabGroups: number; // tab group templates synced
  todos: number;     // todo items synced
}

export interface DashboardSyncResult {
  success: boolean;
  syncsUsedThisMonth: number;
  syncsLimit: number;
  config?: string;
  error?: string;
}

export interface SyncStatus {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  lastSyncAt: string | null;
  isSyncing: boolean;
  quota: UserQuota | null;
  usage: SyncUsage | null;
  error: string | null;
}

export interface SyncResult {
  success: boolean;
  synced: SyncUsage;
  error?: string;
}

export interface PullResult {
  success: boolean;
  pulled: {
    sessions: number;
    prompts: number;
    subs: number;
    tabGroups: number;
    folders: number;
    todos: number;
  };
  error?: string;
}

// ─── Internal state ──────────────────────────────────────────────────────────

const SYNC_STATUS_KEY = 'cloud_sync_status';
let _isSyncing = false;
let _quotaCache: { quota: UserQuota; fetchedAt: number } | null = null;
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  const _emptyUsage: SyncUsage = { sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0, todos: 0 };

  if (_isSyncing) {
    return { success: false, synced: _emptyUsage, error: 'Sync already in progress' };
  }

  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, synced: _emptyUsage, error: 'Not authenticated' };
  }

  _isSyncing = true;
  await persistStatus({ isSyncing: true, error: null });

  const synced: SyncUsage = { sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0, todos: 0 };

  try {
    const quota = await getUserQuota(userId);
    if (!quota.sync_enabled) {
      throw new Error('Sync is not enabled on your current plan. Upgrade to Pro or Max to enable cloud sync.');
    }

    // Load all local data upfront for global URL dedup check
    const [allSessions, allTemplates] = await Promise.all([
      getAllSessions({ isAutoSave: false }),
      TabGroupTemplateStorage.getAll(),
    ]);
    const db = new NewTabDB();
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
    const [sessionCount, promptCount, subCount, folderCount, tabGroupCount, todoCount] = await Promise.all([
      syncSessions(userId, quota, allSessions),
      syncPrompts(userId, quota),
      syncSubscriptions(userId, quota),
      syncBookmarkFolders(userId, quota, allBmEntries),
      syncTabGroupTemplates(userId, allTemplates, quota),
      syncTodos(userId, quota),
    ]);

    synced.sessions  = sessionCount;
    synced.prompts   = promptCount;
    synced.subs      = subCount;
    synced.folders   = folderCount;
    synced.tabGroups = tabGroupCount;
    synced.todos     = todoCount;

    const now = new Date().toISOString();
    // Fetch actual DB counts so the extension displays the same numbers as the web dashboard.
    // Falls back to push-time counts if the RPC fails.
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

  // RPC returns a single-row table
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
 * Pull all synced data from Supabase and merge it into local storage.
 * Existing local items are preserved (merge by ID — no overwrites).
 * Safe to call on a new device right after sign-in.
 */
export async function pullAll(): Promise<PullResult> {
  const emptyPulled = { sessions: 0, prompts: 0, subs: 0, tabGroups: 0, folders: 0, todos: 0 };

  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, pulled: emptyPulled, error: 'Not authenticated' };
  }

  try {
    const [sessionCount, promptCount, subCount, tabGroupCount, folderCount, todoCount] = await Promise.all([
      pullSessions(userId),
      pullPrompts(userId),
      pullSubscriptions(userId),
      pullTabGroupTemplates(userId),
      pullBookmarkFolders(userId),
      pullTodos(userId),
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
 *
 * Distinct from `get_user_usage` (the current synced counts, used by the web dashboard).
 * `prompts_access_limit` is intentionally not enforced here — read access to prompts
 * happens locally and is not gated by a network check.
 */
export async function getUserQuota(userId: string): Promise<UserQuota> {
  const now = Date.now();
  if (_quotaCache && now - _quotaCache.fetchedAt < QUOTA_CACHE_TTL_MS) {
    return _quotaCache.quota;
  }

  const { data, error } = await supabase.rpc('get_user_quota', { p_user_id: userId });
  // RPC uses RETURNS TABLE so data is an array — take the first row
  const row = Array.isArray(data) ? (data as UserQuota[])[0] : (data as UserQuota | null);
  if (error || !row) {
    // Fall back to a safe default (sync disabled) so we don't crash
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
      sync_enabled: false,
    };
  }

  const quota = row;
  _quotaCache = { quota, fetchedAt: now };
  return quota;
}

/**
 * Fetch the actual synced counts from the DB via `get_user_usage` RPC.
 * Maps RPC snake_case fields to the SyncUsage camelCase interface.
 * Called after syncAll() so the extension shows the same numbers as the web dashboard.
 */
async function fetchActualUsage(userId: string): Promise<SyncUsage | null> {
  const { data, error } = await supabase.rpc('get_user_usage', { p_user_id: userId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    sessions:  Number((row as Record<string, unknown>).synced_sessions  ?? 0),
    prompts:   Number((row as Record<string, unknown>).synced_prompts   ?? 0),
    subs:      Number((row as Record<string, unknown>).synced_subs      ?? 0),
    folders:   Number((row as Record<string, unknown>).synced_bm_folders ?? 0),
    tabs:      Number((row as Record<string, unknown>).synced_tabs      ?? 0),
    tabGroups: Number((row as Record<string, unknown>).synced_tab_groups ?? 0),
    todos:     Number((row as Record<string, unknown>).synced_todos     ?? 0),
  };
}

// ─── Internal utilities ──────────────────────────────────────────────────────

/** Sort items by `createdAt` descending and take at most `limit` items. */
function topByCreatedAt<T extends { createdAt: string }>(items: T[], limit: number | null): T[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

// ─── Session sync via SyncAdapter ───────────────────────────────────────────

const _sessionSyncAdapter = new SyncAdapter<Session>(supabase, sessionMapper, {
  tableName: 'sessions',
  quotaSortField: 'updatedAt',
  preSyncTransform: (s) => ({ ...s, tabs: s.tabs.filter((t) => !isExcludedUrl(t.url)) }),
});

// ─── Internal sync helpers ───────────────────────────────────────────────────

async function syncSessions(userId: string, quota: UserQuota, allSessions: Session[]): Promise<number> {
  if (allSessions.length === 0) return 0;
  return _sessionSyncAdapter.push(allSessions, userId, quota.sessions_synced_limit);
}

// ─── Prompt sync via SyncAdapter ────────────────────────────────────────────

const _promptSyncAdapter = new SyncAdapter<Prompt>(supabase, promptMapper, {
  tableName: 'prompts',
  quotaSortField: 'updatedAt',
});

const _promptFolderSyncAdapter = new SyncAdapter<PromptFolder>(supabase, promptFolderMapper, {
  tableName: 'prompt_folders',
  quotaSortField: 'createdAt',
});

async function syncPrompts(userId: string, quota: UserQuota): Promise<number> {
  const [allPrompts, allFolders] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
  ]);

  // Sync local folders first (so FK constraints are satisfied)
  const localFolders = allFolders.filter((f) => f.source === 'local');
  if (localFolders.length > 0) {
    await _promptFolderSyncAdapter.push(localFolders, userId, null);
  }

  const localPrompts = allPrompts.filter((p) => p.source === 'local');
  if (localPrompts.length === 0) return 0;
  return _promptSyncAdapter.push(localPrompts, userId, quota.prompts_create_limit);
}

// ─── Subscription sync via SyncAdapter ──────────────────────────────────────

const _subscriptionSyncAdapter = new SyncAdapter<Subscription>(supabase, subscriptionMapper, {
  tableName: 'tracked_subscriptions',
  quotaSortField: 'createdAt',
});

async function syncSubscriptions(userId: string, quota: UserQuota): Promise<number> {
  const allSubs = await SubscriptionStorage.getAll();
  if (allSubs.length === 0) return 0;

  return _subscriptionSyncAdapter.push(allSubs, userId, quota.subs_synced_limit);
}

// ─── URL filtering & deduplication ──────────────────────────────────────────

/** Returns true for URLs that should never be synced or counted toward quota. */
function isExcludedUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('file://') ||
    /^https?:\/\/localhost[:/]/i.test(url) ||
    /^https?:\/\/127\.0\.0\.1[:/]/i.test(url)
  );
}

/**
 * Collects all unique, non-excluded URLs across sessions, tab group templates,
 * and bookmark entries to enforce the global total_tabs_limit.
 */
function collectAllSyncableUrls(
  sessions: Session[],
  tabGroups: TabGroupTemplate[],
  bmEntries: BookmarkEntry[],
): Set<string> {
  const urls = new Set<string>();
  for (const s of sessions)  for (const t of s.tabs)   if (!isExcludedUrl(t.url)) urls.add(t.url);
  for (const g of tabGroups) for (const t of g.tabs)   if (!isExcludedUrl(t.url)) urls.add(t.url);
  for (const e of bmEntries) if (!isExcludedUrl(e.url)) urls.add(e.url);
  return urls;
}

async function syncBookmarkFolders(
  userId: string,
  quota: UserQuota,
  allEntries: BookmarkEntry[],
): Promise<number> {
  const db = new NewTabDB();
  const categories = await db.getAll<BookmarkCategory>('bookmarkCategories');
  if (categories.length === 0) return 0;

  const folderLimit = quota.folders_synced_limit ?? Infinity;
  const entryLimit  = quota.entries_per_folder_limit ?? Infinity;

  // Take most-recently-created folders up to quota
  const toSyncFolders = topByCreatedAt(categories, folderLimit === Infinity ? null : folderLimit);

  const folderIds = new Set(toSyncFolders.map((c) => c.id));

  // Upsert folders first (FK constraint for entries)
  const folderRows = toSyncFolders.map((c) => ({
    id: c.id,
    user_id: userId,
    board_id: c.boardId,
    name: c.name,
    icon: c.icon ?? null,
    color: c.color ?? null,
    card_type: c.cardType ?? 'bookmark',
    note_content: c.noteContent ?? null,
    col_span: c.colSpan ?? 3,
    row_span: c.rowSpan ?? 3,
    position: 0,
    parent_folder_id: c.parentCategoryId ?? null,
  }));
  const { error: fErr } = await supabase.from('bookmark_folders').upsert(folderRows, { onConflict: 'id' });
  if (fErr) throw new Error(`Bookmark folders sync failed: ${fErr.message}`);

  // Filter entries: must belong to a synced folder, URL must not be excluded
  const eligible = allEntries.filter((e) => folderIds.has(e.categoryId) && !isExcludedUrl(e.url));

  // Group by folder and enforce per-folder entry limit
  const byFolder = eligible.reduce<Record<string, BookmarkEntry[]>>((acc, e) => {
    (acc[e.categoryId] ??= []).push(e);
    return acc;
  }, {});

  const limitedEntries: BookmarkEntry[] = [];
  for (const folderEntries of Object.values(byFolder)) {
    limitedEntries.push(...folderEntries.slice(0, entryLimit));
  }

  if (limitedEntries.length > 0) {
    const entryRows = limitedEntries.map((e, i) => ({
      id: e.id,
      user_id: userId,
      folder_id: e.categoryId,
      title: e.title,
      url: e.url,
      fav_icon_url: e.favIconUrl ?? null,
      description: e.description ?? null,
      category: e.category ?? null,
      is_native: e.isNative ?? false,
      native_id: e.nativeId ?? null,
      position: i,
    }));
    const { error: eErr } = await supabase.from('bookmark_entries').upsert(entryRows, { onConflict: 'id' });
    if (eErr) throw new Error(`Bookmark entries sync failed: ${eErr.message}`);
  }

  // Reconcile: remove remote folders that no longer exist locally
  // (cascade deletes their entries via FK)
  const localIds = toSyncFolders.map((c) => c.id);
  if (localIds.length > 0) {
    await supabase
      .from('bookmark_folders')
      .delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${localIds.join(',')})`);
  }

  return toSyncFolders.length;
}

async function syncTodos(userId: string, quota: UserQuota): Promise<number> {
  const limit = quota.todos_synced_limit ?? Infinity;
  if (limit === 0) return 0;

  const db = new NewTabDB();
  const [allLists, allItems, allCategories] = await Promise.all([
    db.getAll<TodoList>('todoLists'),
    db.getAll<TodoItem>('todoItems'),
    db.getAll<BookmarkCategory>('bookmarkCategories'),
  ]);

  // Harvest todos from dashboard card widgets (stored as JSON in noteContent).
  // Each todo card becomes a synthetic TodoList (id = category.id) + TodoItems.
  const now = new Date().toISOString();
  const existingListIds = new Set(allLists.map((l) => l.id));
  const existingItemIds = new Set(allItems.map((i) => i.id));
  for (const cat of allCategories) {
    if (cat.cardType !== 'todo' || !cat.noteContent) continue;
    let cardItems: { id: string; text: string; done: boolean }[];
    try { cardItems = JSON.parse(cat.noteContent); } catch { continue; }
    if (!cardItems.length) continue;
    if (!existingListIds.has(cat.id)) {
      allLists.push({ id: cat.id, name: cat.name, icon: cat.icon ?? '✅', position: 0, createdAt: cat.createdAt ?? now });
      existingListIds.add(cat.id);
    }
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

  if (allLists.length === 0 && allItems.length === 0) return 0;

  // Sync all lists first (FK parent for items)
  if (allLists.length > 0) {
    const listRows = allLists.map((l) => todoListToRow(l, userId));
    const { error } = await supabase.from('todo_lists').upsert(listRows, { onConflict: 'id,user_id' });
    if (error) throw new Error(`Todo lists sync failed: ${error.message}`);
  }

  // Take most-recently-created items up to quota
  const toSync = topByCreatedAt(allItems, limit === Infinity ? null : limit);

  if (toSync.length > 0) {
    const itemRows = toSync.map((i) => todoItemToRow(i, userId));
    const { error } = await supabase.from('todo_items').upsert(itemRows, { onConflict: 'id,user_id' });
    if (error) throw new Error(`Todo items sync failed: ${error.message}`);
  }

  // Reconcile: remove remote items/lists no longer present locally.
  // Skip when local is empty — avoids wiping cloud data on a fresh device.
  const localItemIds = allItems.map((i) => i.id);
  if (localItemIds.length > 0) {
    await supabase
      .from('todo_items')
      .delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${localItemIds.join(',')})`);
  }

  const localListIds = allLists.map((l) => l.id);
  if (localListIds.length > 0) {
    await supabase
      .from('todo_lists')
      .delete()
      .eq('user_id', userId)
      .not('id', 'in', `(${localListIds.join(',')})`);
  }

  return toSync.length;
}

// ─── Tab Group Template sync via SyncAdapter ───────────────────────────────

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

async function syncTabGroupTemplates(userId: string, allTemplates: TabGroupTemplate[], quota: UserQuota): Promise<number> {
  if (allTemplates.length === 0) return 0;

  const count = await _tabGroupSyncAdapter.push(allTemplates, userId, quota.tab_groups_synced_limit);

  // Reconcile: remove remote templates whose key is no longer in the synced set
  const limit = quota.tab_groups_synced_limit ?? Infinity;
  const toSync = enforceQuota(allTemplates, { limit, sortField: 'updatedAt' });
  const localKeys = toSync.map((t) => t.key);
  if (localKeys.length > 0) {
    await supabase
      .from('tab_group_templates')
      .delete()
      .eq('user_id', userId)
      .not('key', 'in', `(${localKeys.join(',')})`);
  }

  return count;
}

// ─── Row mappers (camelCase → snake_case) ────────────────────────────────────

function todoListToRow(l: TodoList, userId: string): Record<string, unknown> {
  return {
    id: l.id,
    user_id: userId,
    name: l.name,
    icon: l.icon ?? null,
    position: l.position,
    created_at: l.createdAt,
  };
}

function todoItemToRow(i: TodoItem, userId: string): Record<string, unknown> {
  return {
    id: i.id,
    user_id: userId,
    list_id: i.listId,
    text: i.text,
    completed: i.completed,
    priority: i.priority,
    due_date: i.dueDate ?? null,
    position: i.position,
    created_at: i.createdAt,
    completed_at: i.completedAt ?? null,
  };
}

// ─── Internal pull helpers ───────────────────────────────────────────────────

async function pullSessions(userId: string): Promise<number> {
  const remoteSessions = await _sessionSyncAdapter.pull(userId);
  if (remoteSessions.length === 0) return 0;

  const repo = getSessionRepository();
  const existing = await repo.getAll();
  const existingIds = new Set(existing.map((s) => s.id));
  const toWrite = remoteSessions.filter((s) => !existingIds.has(s.id));
  await Promise.all(toWrite.map((s) => repo.save(s)));
  return toWrite.length;
}

async function pullPrompts(userId: string): Promise<number> {
  const [remoteFolders, remotePrompts] = await Promise.all([
    _promptFolderSyncAdapter.pull(userId),
    _promptSyncAdapter.pull(userId),
  ]);

  const [existingPrompts, existingFolders] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
  ]);
  const existingPromptIds = new Set(existingPrompts.map((p) => p.id));
  const existingFolderIds = new Set(existingFolders.map((f) => f.id));

  const newFolders = remoteFolders.filter((f) => !existingFolderIds.has(f.id));
  const newPrompts = remotePrompts.filter((p) => !existingPromptIds.has(p.id));

  await Promise.all([
    ...newFolders.map((f) => PromptStorage.saveFolder(f)),
    ...newPrompts.map((p) => PromptStorage.save(p)),
  ]);

  return newPrompts.length;
}

async function pullSubscriptions(userId: string): Promise<number> {
  const remoteSubs = await _subscriptionSyncAdapter.pull(userId);
  if (remoteSubs.length === 0) return 0;

  await SubscriptionStorage.importMany(remoteSubs);
  return remoteSubs.length;
}

async function pullTabGroupTemplates(userId: string): Promise<number> {
  const remoteTemplates = await _tabGroupSyncAdapter.pull(userId);
  if (remoteTemplates.length === 0) return 0;

  const existing = await TabGroupTemplateStorage.getAll();
  const existingKeys = new Set(existing.map((t) => t.key));
  const toWrite = remoteTemplates.filter((t) => !existingKeys.has(t.key));
  await Promise.all(toWrite.map((t) => TabGroupTemplateStorage.upsert(t)));
  return toWrite.length;
}

async function pullBookmarkFolders(userId: string): Promise<number> {
  const [{ data: folderRows, error: fErr }, { data: entryRows, error: eErr }] = await Promise.all([
    supabase.from('bookmark_folders').select('*').eq('user_id', userId),
    supabase.from('bookmark_entries').select('*').eq('user_id', userId),
  ]);
  if (fErr) throw new Error(`Bookmark folder pull failed: ${fErr.message}`);
  if (eErr) throw new Error(`Bookmark entry pull failed: ${eErr.message}`);
  if (!folderRows || folderRows.length === 0) return 0;

  const db = new NewTabDB();
  const [existingFolders, existingEntries] = await Promise.all([
    db.getAll<BookmarkCategory>('bookmarkCategories'),
    db.getAll<BookmarkEntry>('bookmarkEntries'),
  ]);
  const existingFolderIds = new Set(existingFolders.map((c) => c.id));
  const existingEntryIds = new Set(existingEntries.map((e) => e.id));

  const allEntries = (entryRows ?? []) as Record<string, unknown>[];
  // Group entry IDs by folder for bookmarkIds reconstruction
  const entryIdsByFolder = allEntries.reduce<Record<string, string[]>>((acc, r) => {
    const fid = r.folder_id as string;
    (acc[fid] ??= []).push(r.id as string);
    return acc;
  }, {});

  const newFolders = (folderRows as Record<string, unknown>[]).filter((r) => !existingFolderIds.has(r.id as string));
  const newEntries = allEntries.filter((r) => !existingEntryIds.has(r.id as string));

  const now = new Date().toISOString();
  await Promise.all([
    ...newFolders.map((r) =>
      db.put<BookmarkCategory>('bookmarkCategories', rowToBookmarkCategory(r, entryIdsByFolder[r.id as string] ?? [], now)),
    ),
    ...newEntries.map((r) =>
      db.put<BookmarkEntry>('bookmarkEntries', rowToBookmarkEntry(r, now)),
    ),
  ]);

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

  // Upsert all remote rows — IndexedDB put() overwrites existing records so
  // state changes (completed, text edits, position) are reflected locally.
  const db = new NewTabDB();
  await Promise.all([
    ...(listRows ?? []).map((r) => db.put<TodoList>('todoLists', rowToTodoList(r as Record<string, unknown>))),
    ...(itemRows ?? []).map((r) => db.put<TodoItem>('todoItems', rowToTodoItem(r as Record<string, unknown>))),
  ]);

  // For dashboard card todo widgets: write pulled items back into the category's
  // noteContent so the card UI reflects the synced state on reload.
  const allCategories = await db.getAll<BookmarkCategory>('bookmarkCategories');
  const todoCardMap = new Map(allCategories.filter((c) => c.cardType === 'todo').map((c) => [c.id, c]));
  if (todoCardMap.size > 0) {
    const byList: Record<string, Array<{ id: string; text: string; done: boolean; position: number }>> = {};
    for (const r of (itemRows ?? [])) {
      const listId = r.list_id as string;
      if (todoCardMap.has(listId)) {
        (byList[listId] ??= []).push({ id: r.id as string, text: r.text as string, done: r.completed as boolean, position: (r.position as number) ?? 0 });
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

// ─── Row mappers (snake_case → camelCase) ────────────────────────────────────

function rowToBookmarkCategory(r: Record<string, unknown>, bookmarkIds: string[], fallbackDate: string): BookmarkCategory {
  return {
    id: r.id as string,
    boardId: (r.board_id ?? '') as string,
    name: r.name as string,
    icon: (r.icon ?? '') as string,
    color: (r.color ?? '') as string,
    bookmarkIds,
    collapsed: false,
    colSpan: (r.col_span ?? 3) as BookmarkCategory['colSpan'],
    rowSpan: (r.row_span ?? 3) as BookmarkCategory['rowSpan'],
    cardType: (r.card_type ?? 'bookmark') as BookmarkCategory['cardType'],
    noteContent: (r.note_content ?? undefined) as string | undefined,
    parentCategoryId: (r.parent_folder_id ?? undefined) as string | undefined,
    createdAt: fallbackDate,
  };
}

function rowToBookmarkEntry(r: Record<string, unknown>, fallbackDate: string): BookmarkEntry {
  return {
    id: r.id as string,
    categoryId: r.folder_id as string,
    title: r.title as string,
    url: r.url as string,
    favIconUrl: (r.fav_icon_url ?? '') as string,
    addedAt: fallbackDate,
    isNative: (r.is_native ?? false) as boolean,
    nativeId: (r.native_id ?? undefined) as string | undefined,
    category: (r.category ?? undefined) as string | undefined,
    description: (r.description ?? undefined) as string | undefined,
  };
}

function rowToTodoList(r: Record<string, unknown>): TodoList {
  return {
    id: r.id as string,
    name: r.name as string,
    icon: (r.icon ?? '') as string,
    position: (r.position ?? 0) as number,
    createdAt: r.created_at as string,
  };
}

function rowToTodoItem(r: Record<string, unknown>): TodoItem {
  return {
    id: r.id as string,
    listId: r.list_id as string,
    text: r.text as string,
    completed: (r.completed ?? false) as boolean,
    priority: (r.priority ?? 'none') as TodoItem['priority'],
    dueDate: (r.due_date ?? undefined) as string | undefined,
    position: (r.position ?? 0) as number,
    createdAt: r.created_at as string,
    completedAt: (r.completed_at ?? undefined) as string | undefined,
  };
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

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
