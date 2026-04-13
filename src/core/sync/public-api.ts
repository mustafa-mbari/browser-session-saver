/**
 * public-api.ts — Facade that preserves the legacy sync barrel contract.
 *
 * External callers (background, service worker, UI) import from
 * `@core/services/sync.service`. That barrel now re-exports from here, so we
 * keep the same function surface (`syncAll`, `pullAll`, `getSyncStatus`,
 * `getUserQuota`, `pushSession`, `deleteRemoteSession`) while routing every
 * mutation through the new SyncEngine.
 */

import { supabase } from '@core/supabase/client';
import { getSyncUserId, getSyncEmail } from '@core/services/sync-auth.service';
import { getSessionRepository } from '@core/storage/storage-factory';
import type { Session } from '@core/types/session.types';
import type {
  UserQuota,
  SyncUsage,
  SyncStatus,
  SyncResult,
  PullResult,
} from '@core/services/sync/types';

import { getSyncEngine } from './handlers';
import { importLegacyDeletionLog } from './legacy/deletion-log-importer';
import type { SyncEntityKey } from './types/syncable';

const SYNC_STATUS_KEY = 'cloud_sync_status';
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_USAGE: SyncUsage = {
  sessions: 0, prompts: 0, subs: 0, tabs: 0, folders: 0, tabGroups: 0, todos: 0, quickLinks: 0,
};

const EMPTY_PULLED: PullResult['pulled'] = {
  sessions: 0, prompts: 0, subs: 0, tabGroups: 0, folders: 0, todos: 0, quickLinks: 0,
};

let _quotaCache: { quota: UserQuota; fetchedAt: number } | null = null;
let _legacyImported = false;
let _isSyncing = false;

// ─── Quota ──────────────────────────────────────────────────────────────────

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

  _quotaCache = { quota: row, fetchedAt: now };
  return row;
}

async function fetchActualUsage(userId: string): Promise<SyncUsage | null> {
  const { data, error } = await supabase.rpc('get_user_usage', { p_user_id: userId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const r = row as Record<string, unknown>;
  return {
    sessions:   Number(r.synced_sessions   ?? 0),
    prompts:    Number(r.synced_prompts    ?? 0),
    subs:       Number(r.synced_subs       ?? 0),
    folders:    Number(r.synced_bm_folders ?? 0),
    tabs:       Number(r.synced_tabs       ?? 0),
    tabGroups:  Number(r.synced_tab_groups ?? 0),
    todos:      Number(r.synced_todos      ?? 0),
    quickLinks: Number(r.synced_quick_links ?? 0),
  };
}

// ─── Status ─────────────────────────────────────────────────────────────────

async function persistStatus(patch: Partial<SyncStatus>): Promise<void> {
  const current = await new Promise<Partial<SyncStatus>>((resolve) =>
    chrome.storage.local.get(SYNC_STATUS_KEY, (r) =>
      resolve((r[SYNC_STATUS_KEY] as Partial<SyncStatus>) ?? {}),
    ),
  );
  await new Promise<void>((resolve) =>
    chrome.storage.local.set({ [SYNC_STATUS_KEY]: { ...current, ...patch } }, () => resolve()),
  );
}

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
    isSyncing: persisted.isSyncing ?? false,
    quota,
    usage: persisted.usage ?? null,
    error: persisted.error ?? null,
  };
}

// ─── Engine-backed sync ─────────────────────────────────────────────────────

/**
 * Translate the engine's per-entity result list into the legacy SyncUsage
 * shape the UI expects (count of successfully pushed records per bucket).
 */
function toSyncUsage(results: Array<{ entity: SyncEntityKey; pushed: number }>): SyncUsage {
  const usage: SyncUsage = { ...EMPTY_USAGE };
  for (const r of results) {
    switch (r.entity) {
      case 'sessions':           usage.sessions   += r.pushed; break;
      case 'prompts':            usage.prompts    += r.pushed; break;
      case 'prompt_folders':     /* folded into folders below */ break;
      case 'subscriptions':      usage.subs       += r.pushed; break;
      case 'tab_group_templates':usage.tabGroups  += r.pushed; break;
      case 'bookmark_folders':   usage.folders    += r.pushed; break;
      case 'bookmark_entries':   /* counted inside folders bucket */ break;
      case 'todo_lists':
      case 'todo_items':         usage.todos      += r.pushed; break;
      case 'quick_links':        usage.quickLinks += r.pushed; break;
    }
  }
  return usage;
}

function toPulled(
  results: Array<{ entity: SyncEntityKey; pulled: number }>,
): PullResult['pulled'] {
  const pulled: PullResult['pulled'] = { ...EMPTY_PULLED };
  for (const r of results) {
    switch (r.entity) {
      case 'sessions':           pulled.sessions   += r.pulled; break;
      case 'prompts':            pulled.prompts    += r.pulled; break;
      case 'subscriptions':      pulled.subs       += r.pulled; break;
      case 'tab_group_templates':pulled.tabGroups  += r.pulled; break;
      case 'bookmark_folders':   pulled.folders    += r.pulled; break;
      case 'todo_lists':
      case 'todo_items':         pulled.todos      += r.pulled; break;
      case 'quick_links':        pulled.quickLinks += r.pulled; break;
      default: break;
    }
  }
  return pulled;
}

async function ensureLegacyImport(): Promise<void> {
  if (_legacyImported) return;
  _legacyImported = true;
  try {
    await importLegacyDeletionLog();
  } catch {
    // Non-fatal. Next startup will retry.
    _legacyImported = false;
  }
}

/**
 * Full bidirectional sync cycle — pulls remote deltas, then pushes local dirty.
 * The SyncEngine handles the per-entity ordering, gates, and conflict merge.
 */
export async function syncAll(): Promise<SyncResult> {
  await ensureLegacyImport();

  const userId = await getSyncUserId();
  if (!userId) return { success: false, synced: EMPTY_USAGE, error: 'Not authenticated' };

  if (_isSyncing) {
    return { success: false, synced: EMPTY_USAGE, error: 'Sync already in progress' };
  }
  _isSyncing = true;

  await persistStatus({ isSyncing: true, error: null });

  try {
    const quota = await getUserQuota(userId).catch(() => null);
    if (quota && !quota.sync_enabled) {
      throw new Error(
        'Sync is not enabled on your current plan. Upgrade to Pro or Max to enable cloud sync.',
      );
    }

    const usageBeforePush = await fetchActualUsage(userId).catch(() => null);

    const engine = getSyncEngine();
    const result = await engine.syncAll({
      supabase,
      userId,
      quota,
      usage: usageBeforePush,
    });

    if (!result.ok) {
      const errMsg = result.error ?? 'Sync failed';
      await persistStatus({ isSyncing: false, error: errMsg });
      return { success: false, synced: EMPTY_USAGE, error: errMsg };
    }

    const synced = toSyncUsage(result.entities);
    const actualUsage = await fetchActualUsage(userId).catch(() => null);
    await persistStatus({
      lastSyncAt: new Date().toISOString(),
      isSyncing: false,
      usage: actualUsage ?? synced,
      error: null,
    });
    return { success: true, synced };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await persistStatus({ isSyncing: false, error: errorMsg });
    return { success: false, synced: EMPTY_USAGE, error: errorMsg };
  } finally {
    _isSyncing = false;
  }
}

/**
 * Pull-only convenience. The engine already runs pull before push on every
 * cycle, so this delegates to syncAll and extracts the pulled counts.
 */
export async function pullAll(): Promise<PullResult> {
  await ensureLegacyImport();

  const userId = await getSyncUserId();
  if (!userId) return { success: false, pulled: EMPTY_PULLED, error: 'Not authenticated' };

  const quota = await getUserQuota(userId).catch(() => null);
  const usage = await fetchActualUsage(userId).catch(() => null);

  const engine = getSyncEngine();
  const result = await engine.syncAll({ supabase, userId, quota, usage });
  if (!result.ok) {
    return { success: false, pulled: EMPTY_PULLED, error: result.error };
  }

  return { success: true, pulled: toPulled(result.entities) };
}

// ─── Legacy compatibility shims ─────────────────────────────────────────────

/**
 * Legacy helper: called after a session save/update so the newly-mutated row
 * reaches Supabase without waiting for the 15-min alarm. The repository has
 * already stamped the row dirty on save, so all we need is to nudge the engine.
 *
 * Fire-and-forget. Any auth/network failure is logged but not propagated.
 */
export async function pushSession(session: Session, _userId: string): Promise<void> {
  if (session.isAutoSave) return;
  try {
    // The session repo stamped dirty=true on the recent save, so syncEntity
    // for the sessions key will pick it up.
    const engine = getSyncEngine();
    const quota = await getUserQuota(_userId).catch(() => null);
    const usage = await fetchActualUsage(_userId).catch(() => null);
    await engine.syncEntity('sessions', {
      supabase,
      userId: _userId,
      quota,
      usage,
    });
  } catch (e) {
    console.warn('[sync] pushSession error:', (e as Error).message);
  }
}

/**
 * Legacy helper: called after a session hard-delete. In the new system the
 * session repository performs a soft-delete via markDeleted() and the engine
 * propagates the tombstone on the next cycle, so this shim only needs to
 * ensure the tombstone gets flagged on the right row.
 *
 * Safe to call with an id that no longer exists — markDeleted returns false
 * and we exit quietly.
 */
export async function deleteRemoteSession(sessionId: string): Promise<void> {
  try {
    const repo = getSessionRepository();
    await repo.markDeleted(sessionId);
  } catch (e) {
    console.warn('[sync] deleteRemoteSession error:', (e as Error).message);
  }
}
