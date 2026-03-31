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
import { getSessionStorage } from '@core/storage/storage-factory';
import { PromptStorage } from '@core/storage/prompt-storage';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { NewTabDB } from '@core/storage/newtab-storage';
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
    await persistStatus({ lastSyncAt: now, isSyncing: false, usage: synced, error: null });

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
  const { error } = await supabase
    .from('sessions')
    .upsert(sessionToRow(session, userId), { onConflict: 'id' });
  if (error) console.warn('[sync] pushSession error:', error.message);
}

/**
 * Delete a session from Supabase by its local ID.
 */
export async function deleteRemoteSession(sessionId: string): Promise<void> {
  const userId = await getSyncUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);
  if (error) console.warn('[sync] deleteRemoteSession error:', error.message);
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

// ─── Internal utilities ──────────────────────────────────────────────────────

/** Sort items by `updatedAt` descending and take at most `limit` items. */
function topByUpdatedAt<T extends { updatedAt: string }>(items: T[], limit: number | null): T[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/** Sort items by `createdAt` descending and take at most `limit` items. */
function topByCreatedAt<T extends { createdAt: string }>(items: T[], limit: number | null): T[] {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return limit != null ? sorted.slice(0, limit) : sorted;
}

// ─── Internal sync helpers ───────────────────────────────────────────────────

async function syncSessions(userId: string, quota: UserQuota, allSessions: Session[]): Promise<number> {
  const limit = quota.sessions_synced_limit ?? Infinity;

  // Take the most recently updated sessions up to the quota limit
  const toSync = topByUpdatedAt(allSessions, limit === Infinity ? null : limit);

  if (toSync.length === 0) return 0;

  // Strip excluded URLs from tabs before pushing to Supabase
  const rows = toSync.map((s) =>
    sessionToRow({ ...s, tabs: s.tabs.filter((t) => !isExcludedUrl(t.url)) }, userId),
  );
  const { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Sessions sync failed: ${error.message}`);

  return toSync.length;
}

async function syncPrompts(userId: string, quota: UserQuota): Promise<number> {
  const [allPrompts, allFolders] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
  ]);

  const localPrompts = allPrompts.filter((p) => p.source === 'local');
  const limit = quota.prompts_create_limit ?? Infinity;
  const toSync = topByUpdatedAt(localPrompts, limit === Infinity ? null : limit);

  // Sync local folders first (so FK constraints are satisfied)
  const localFolders = allFolders.filter((f) => f.source === 'local');
  if (localFolders.length > 0) {
    const { error } = await supabase
      .from('prompt_folders')
      .upsert(localFolders.map((f) => promptFolderToRow(f, userId)), { onConflict: 'id' });
    if (error) throw new Error(`Prompt folders sync failed: ${error.message}`);
  }

  if (toSync.length > 0) {
    const { error } = await supabase
      .from('prompts')
      .upsert(toSync.map((p) => promptToRow(p, userId)), { onConflict: 'id' });
    if (error) throw new Error(`Prompts sync failed: ${error.message}`);
  }

  return toSync.length;
}

async function syncSubscriptions(userId: string, quota: UserQuota): Promise<number> {
  const allSubs = await SubscriptionStorage.getAll();
  if (allSubs.length === 0) return 0;

  const limit = quota.subs_synced_limit ?? Infinity;
  const toSync = topByCreatedAt(allSubs, limit === Infinity ? null : limit);

  if (toSync.length === 0) return 0;

  const rows = toSync.map((s) => subscriptionToRow(s, userId));
  const { error } = await supabase
    .from('tracked_subscriptions')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Subscriptions sync failed: ${error.message}`);

  return toSync.length;
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
  const [allLists, allItems] = await Promise.all([
    db.getAll<TodoList>('todoLists'),
    db.getAll<TodoItem>('todoItems'),
  ]);

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

async function syncTabGroupTemplates(userId: string, allTemplates: TabGroupTemplate[], quota: UserQuota): Promise<number> {
  const limit = quota.tab_groups_synced_limit ?? Infinity;

  // Take most-recently-updated templates up to quota limit
  const toSync = topByUpdatedAt(allTemplates, limit === Infinity ? null : limit);

  if (toSync.length === 0) {
    // Nothing local — skip reconcile to avoid wiping cloud data on a fresh device
    return 0;
  }

  const rows = toSync.map((tg) => ({
    key: tg.key,
    user_id: userId,
    title: tg.title,
    color: tg.color,
    tabs: tg.tabs.filter((t) => !isExcludedUrl(t.url)),
    saved_at: tg.savedAt,
    updated_at: tg.updatedAt,
  }));

  const { error } = await supabase
    .from('tab_group_templates')
    .upsert(rows, { onConflict: 'user_id,key' });
  if (error) throw new Error(`Tab group templates sync failed: ${error.message}`);

  // Reconcile: remove remote templates whose key is no longer in the synced set
  const localKeys = toSync.map((t) => t.key);
  await supabase
    .from('tab_group_templates')
    .delete()
    .eq('user_id', userId)
    .not('key', 'in', `(${localKeys.join(',')})`);

  return toSync.length;
}

// ─── Row mappers (camelCase → snake_case) ────────────────────────────────────

function sessionToRow(s: Session, userId: string): Record<string, unknown> {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    tabs: s.tabs,
    tab_groups: s.tabGroups,
    window_id: s.windowId,
    tags: s.tags,
    is_pinned: s.isPinned,
    is_starred: s.isStarred,
    is_locked: s.isLocked,
    is_auto_save: s.isAutoSave,
    auto_save_trigger: s.autoSaveTrigger,
    notes: s.notes,
    tab_count: s.tabCount,
    version: s.version,
  };
}

function promptToRow(p: Prompt, userId: string): Record<string, unknown> {
  return {
    id: p.id,
    user_id: userId,
    title: p.title,
    content: p.content,
    description: p.description ?? null,
    category_id: p.categoryId ?? null,
    folder_id: p.folderId ?? null,
    source: p.source,
    tags: p.tags,
    is_favorite: p.isFavorite,
    is_pinned: p.isPinned,
    usage_count: p.usageCount,
    last_used_at: p.lastUsedAt ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function promptFolderToRow(f: PromptFolder, userId: string): Record<string, unknown> {
  return {
    id: f.id,
    user_id: userId,
    name: f.name,
    icon: f.icon ?? null,
    color: f.color ?? null,
    source: f.source,
    parent_id: f.parentId ?? null,
    position: f.position,
    created_at: f.createdAt,
  };
}

function subscriptionToRow(s: Subscription, userId: string): Record<string, unknown> {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    logo: s.logo ?? null,
    url: s.url ?? null,
    email: s.email ?? null,
    category: s.category,
    price: s.price,
    currency: s.currency,
    billing_cycle: s.billingCycle,
    next_billing_date: s.nextBillingDate,
    payment_method: s.paymentMethod ?? null,
    status: s.status,
    reminder: s.reminder,
    notes: s.notes ?? null,
    tags: s.tags ?? [],
    created_at: s.createdAt,
  };
}

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
  const { data, error } = await supabase.from('sessions').select('*').eq('user_id', userId);
  if (error) throw new Error(`Session pull failed: ${error.message}`);
  if (!data || data.length === 0) return 0;

  const storage = getSessionStorage();
  const existing = await storage.getAll();
  const existingIds = new Set(Object.keys(existing));
  const toWrite = (data as Record<string, unknown>[]).filter((r) => !existingIds.has(r.id as string));
  await Promise.all(toWrite.map((r) => storage.set(r.id as string, rowToSession(r))));
  return toWrite.length;
}

async function pullPrompts(userId: string): Promise<number> {
  const [{ data: promptRows, error: pErr }, { data: folderRows, error: fErr }] = await Promise.all([
    supabase.from('prompts').select('*').eq('user_id', userId),
    supabase.from('prompt_folders').select('*').eq('user_id', userId),
  ]);
  if (pErr) throw new Error(`Prompt pull failed: ${pErr.message}`);
  if (fErr) throw new Error(`Prompt folder pull failed: ${fErr.message}`);

  const [existingPrompts, existingFolders] = await Promise.all([
    PromptStorage.getAll(),
    PromptStorage.getFolders(),
  ]);
  const existingPromptIds = new Set(existingPrompts.map((p) => p.id));
  const existingFolderIds = new Set(existingFolders.map((f) => f.id));

  const newFolders = (folderRows ?? []).filter((r) => !existingFolderIds.has(r.id as string));
  const newPrompts = (promptRows ?? []).filter((r) => !existingPromptIds.has(r.id as string));

  await Promise.all([
    ...newFolders.map((r) => PromptStorage.saveFolder(rowToPromptFolder(r as Record<string, unknown>))),
    ...newPrompts.map((r) => PromptStorage.save(rowToPrompt(r as Record<string, unknown>))),
  ]);

  return newPrompts.length;
}

async function pullSubscriptions(userId: string): Promise<number> {
  const { data, error } = await supabase.from('tracked_subscriptions').select('*').eq('user_id', userId);
  if (error) throw new Error(`Subscription pull failed: ${error.message}`);
  if (!data || data.length === 0) return 0;

  const subs = (data as Record<string, unknown>[]).map(rowToSubscription);
  await SubscriptionStorage.importMany(subs);
  return subs.length;
}

async function pullTabGroupTemplates(userId: string): Promise<number> {
  const { data, error } = await supabase.from('tab_group_templates').select('*').eq('user_id', userId);
  if (error) throw new Error(`Tab group pull failed: ${error.message}`);
  if (!data || data.length === 0) return 0;

  const existing = await TabGroupTemplateStorage.getAll();
  const existingKeys = new Set(existing.map((t) => t.key));
  const toWrite = (data as Record<string, unknown>[]).filter((r) => !existingKeys.has(r.key as string));
  await Promise.all(toWrite.map((r) => TabGroupTemplateStorage.upsert(rowToTabGroupTemplate(r))));
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

  const db = new NewTabDB();
  const [existingLists, existingItems] = await Promise.all([
    db.getAll<TodoList>('todoLists'),
    db.getAll<TodoItem>('todoItems'),
  ]);
  const existingListIds = new Set(existingLists.map((l) => l.id));
  const existingItemIds = new Set(existingItems.map((i) => i.id));

  const newLists = (listRows ?? []).filter((r) => !existingListIds.has(r.id as string));
  const newItems = (itemRows ?? []).filter((r) => !existingItemIds.has(r.id as string));

  await Promise.all([
    ...newLists.map((r) => db.put<TodoList>('todoLists', rowToTodoList(r as Record<string, unknown>))),
    ...newItems.map((r) => db.put<TodoItem>('todoItems', rowToTodoItem(r as Record<string, unknown>))),
  ]);

  return newItems.length;
}

// ─── Row mappers (snake_case → camelCase) ────────────────────────────────────

function rowToSession(r: Record<string, unknown>): Session {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    tabs: (r.tabs ?? []) as Session['tabs'],
    tabGroups: (r.tab_groups ?? []) as Session['tabGroups'],
    windowId: (r.window_id ?? 0) as number,
    tags: (r.tags ?? []) as string[],
    isPinned: (r.is_pinned ?? false) as boolean,
    isStarred: (r.is_starred ?? false) as boolean,
    isLocked: (r.is_locked ?? false) as boolean,
    isAutoSave: (r.is_auto_save ?? false) as boolean,
    autoSaveTrigger: (r.auto_save_trigger ?? 'manual') as Session['autoSaveTrigger'],
    notes: (r.notes ?? '') as string,
    tabCount: (r.tab_count ?? 0) as number,
    version: (r.version ?? '1') as string,
  };
}

function rowToPrompt(r: Record<string, unknown>): Prompt {
  return {
    id: r.id as string,
    title: r.title as string,
    content: r.content as string,
    description: (r.description ?? undefined) as string | undefined,
    categoryId: (r.category_id ?? undefined) as string | undefined,
    folderId: (r.folder_id ?? undefined) as string | undefined,
    source: (r.source ?? 'local') as Prompt['source'],
    tags: (r.tags ?? []) as string[],
    isFavorite: (r.is_favorite ?? false) as boolean,
    isPinned: (r.is_pinned ?? false) as boolean,
    usageCount: (r.usage_count ?? 0) as number,
    lastUsedAt: (r.last_used_at ?? undefined) as string | undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToPromptFolder(r: Record<string, unknown>): PromptFolder {
  return {
    id: r.id as string,
    name: r.name as string,
    icon: (r.icon ?? undefined) as string | undefined,
    color: (r.color ?? undefined) as string | undefined,
    source: (r.source ?? 'local') as PromptFolder['source'],
    parentId: (r.parent_id ?? undefined) as string | undefined,
    position: (r.position ?? 0) as number,
    createdAt: r.created_at as string,
  };
}

function rowToSubscription(r: Record<string, unknown>): Subscription {
  return {
    id: r.id as string,
    name: r.name as string,
    logo: (r.logo ?? undefined) as string | undefined,
    url: (r.url ?? undefined) as string | undefined,
    email: (r.email ?? undefined) as string | undefined,
    category: r.category as string,
    price: r.price as number,
    currency: r.currency as string,
    billingCycle: r.billing_cycle as Subscription['billingCycle'],
    nextBillingDate: r.next_billing_date as string,
    paymentMethod: (r.payment_method ?? undefined) as string | undefined,
    status: r.status as Subscription['status'],
    reminder: r.reminder as number,
    notes: (r.notes ?? undefined) as string | undefined,
    tags: (r.tags ?? []) as string[],
    createdAt: r.created_at as string,
  };
}

function rowToTabGroupTemplate(r: Record<string, unknown>): TabGroupTemplate {
  return {
    key: r.key as string,
    title: r.title as string,
    color: r.color as TabGroupTemplate['color'],
    tabs: (r.tabs ?? []) as TabGroupTemplate['tabs'],
    savedAt: r.saved_at as string,
    updatedAt: r.updated_at as string,
  };
}

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
