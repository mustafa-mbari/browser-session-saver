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
import { PromptStorage } from '@core/storage/prompt-storage';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { NewTabDB } from '@core/storage/newtab-storage';
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { Subscription } from '@core/types/subscription.types';
import type { BookmarkCategory, BookmarkEntry } from '@core/types/newtab.types';
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
  sync_enabled: boolean;
}

export interface SyncUsage {
  sessions: number;
  prompts: number;
  subs: number;
  tabs: number;      // unique non-excluded URLs synced this cycle
  folders: number;   // bookmark folder categories synced
  tabGroups: number; // tab group templates synced
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
  const _emptyUsage: SyncUsage = { sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0 };

  if (_isSyncing) {
    return { success: false, synced: _emptyUsage, error: 'Sync already in progress' };
  }

  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, synced: _emptyUsage, error: 'Not authenticated' };
  }

  _isSyncing = true;
  await persistStatus({ isSyncing: true, error: null });

  const synced: SyncUsage = { sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0 };

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

    // Push in parallel — all six targets are independent
    const [sessionCount, promptCount, subCount, folderCount, tabGroupCount] = await Promise.all([
      syncSessions(userId, quota, allSessions),
      syncPrompts(userId, quota),
      syncSubscriptions(userId, quota),
      syncBookmarkFolders(userId, quota, allBmEntries),
      syncTabGroupTemplates(userId, allTemplates, quota),
    ]);

    synced.sessions  = sessionCount;
    synced.prompts   = promptCount;
    synced.subs      = subCount;
    synced.folders   = folderCount;
    synced.tabGroups = tabGroupCount;

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

async function syncTabGroupTemplates(userId: string, allTemplates: TabGroupTemplate[], quota: UserQuota): Promise<number> {
  const limit = quota.tab_groups_synced_limit ?? Infinity;

  // Take most-recently-updated templates up to quota limit
  const toSync = topByUpdatedAt(allTemplates, limit === Infinity ? null : limit);

  if (toSync.length === 0) {
    // Reconcile: if nothing to sync, remove all remote templates for this user
    await supabase.from('tab_group_templates').delete().eq('user_id', userId);
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

  return allTemplates.length;
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
