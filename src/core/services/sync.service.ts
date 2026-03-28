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
import type { Session } from '@core/types/session.types';
import type { Prompt, PromptFolder } from '@core/types/prompt.types';
import type { Subscription } from '@core/types/subscription.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserQuota {
  plan_id: string;
  plan_name: string;
  sessions_synced_limit: number | null;
  tabs_per_session_limit: number | null;
  prompts_access_limit: number | null;
  prompts_create_limit: number | null;
  subs_synced_limit: number | null;
  sync_enabled: boolean;
}

export interface SyncUsage {
  sessions: number;
  prompts: number;
  subs: number;
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
  if (_isSyncing) {
    return { success: false, synced: { sessions: 0, prompts: 0, subs: 0 }, error: 'Sync already in progress' };
  }

  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, synced: { sessions: 0, prompts: 0, subs: 0 }, error: 'Not authenticated' };
  }

  _isSyncing = true;
  await persistStatus({ isSyncing: true, error: null });

  const synced: SyncUsage = { sessions: 0, prompts: 0, subs: 0 };

  try {
    const quota = await getUserQuota(userId);
    if (!quota.sync_enabled) {
      throw new Error('Sync is not enabled on your current plan. Upgrade to Pro or Max to enable cloud sync.');
    }

    // Push in parallel where safe — sessions, prompts, and subs are independent
    const [sessionCount, promptCount, subCount] = await Promise.all([
      syncSessions(userId, quota),
      syncPrompts(userId, quota),
      syncSubscriptions(userId, quota),
    ]);

    synced.sessions = sessionCount;
    synced.prompts = promptCount;
    synced.subs = subCount;

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
 * Fetch the user's plan quota. Results are cached for 5 minutes.
 */
export async function getUserQuota(userId: string): Promise<UserQuota> {
  const now = Date.now();
  if (_quotaCache && now - _quotaCache.fetchedAt < QUOTA_CACHE_TTL_MS) {
    return _quotaCache.quota;
  }

  const { data, error } = await supabase.rpc('get_user_quota', { p_user_id: userId });
  if (error || !data) {
    // Fall back to a safe default (sync disabled) so we don't crash
    return {
      plan_id: 'free',
      plan_name: 'Free',
      sessions_synced_limit: 0,
      tabs_per_session_limit: null,
      prompts_access_limit: null,
      prompts_create_limit: 0,
      subs_synced_limit: null,
      sync_enabled: false,
    };
  }

  const quota = data as UserQuota;
  _quotaCache = { quota, fetchedAt: now };
  return quota;
}

// ─── Internal sync helpers ───────────────────────────────────────────────────

async function syncSessions(userId: string, quota: UserQuota): Promise<number> {
  const allSessions = await getAllSessions({ isAutoSave: false });
  const limit = quota.sessions_synced_limit ?? Infinity;

  // Take the most recently updated sessions up to the quota limit
  const toSync = allSessions
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);

  if (toSync.length === 0) return 0;

  const rows = toSync.map((s) => sessionToRow(s, userId));
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
  const toSync = localPrompts
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);

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
  const toSync = allSubs
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  if (toSync.length === 0) return 0;

  const rows = toSync.map((s) => subscriptionToRow(s, userId));
  const { error } = await supabase
    .from('tracked_subscriptions')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Subscriptions sync failed: ${error.message}`);

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
