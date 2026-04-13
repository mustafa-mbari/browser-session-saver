/**
 * quota-guard.ts — Reject-at-save quota enforcement.
 *
 * Replaces the old silent `enforceQuota()` that sorted-and-sliced records
 * out of each sync cycle. That silent drop was a data-loss vector: the user
 * would hit a hidden limit, half their records would stop syncing, and
 * nothing surfaced in the UI.
 *
 * New contract: the engine consults QuotaGuard BEFORE push. For each entity
 * with a non-null limit, if the projected cloud count (local live rows that
 * would be upserted, minus tombstones) exceeds the limit, the guard:
 *   1. Rejects the push for the overflowing entity (leaves records dirty,
 *      retries next cycle after user frees space).
 *   2. Emits a `quotaWarning` status payload consumed by CloudSyncView.
 *   3. Appends a `quota-reject` sync-log entry.
 *
 * Individual record writes also get a check via `canAddRecord()` so the UI
 * can block save-time instead of silently failing later.
 */

import type { SyncEntityKey } from '../types/syncable';
import type { UserQuota, SyncUsage } from '@core/services/sync/types';

export interface QuotaCheck {
  entity: SyncEntityKey;
  limit: number | null;
  currentCount: number;
  wouldBePushed: number;
  projectedCount: number;
  exceeded: boolean;
}

/**
 * Given a plan quota and the number of live local rows for an entity,
 * decide whether pushing this cycle would exceed the user's limit.
 */
export function checkPushQuota(
  entity: SyncEntityKey,
  limit: number | null,
  currentCloudCount: number,
  liveLocalCount: number,
): QuotaCheck {
  if (limit == null) {
    return {
      entity,
      limit: null,
      currentCount: currentCloudCount,
      wouldBePushed: liveLocalCount,
      projectedCount: liveLocalCount,
      exceeded: false,
    };
  }
  const projectedCount = Math.max(currentCloudCount, liveLocalCount);
  return {
    entity,
    limit,
    currentCount: currentCloudCount,
    wouldBePushed: liveLocalCount,
    projectedCount,
    exceeded: projectedCount > limit,
  };
}

/**
 * Map a SyncEntityKey to the matching `limit` field on the user's plan.
 * Some entities share a plan bucket (e.g. sessions → sessions_limit).
 */
export function limitFor(quota: UserQuota, entity: SyncEntityKey): number | null {
  switch (entity) {
    case 'sessions':
      return quota.sessions_synced_limit;
    case 'prompts':
      return quota.prompts_create_limit;
    case 'prompt_folders':
      return quota.prompts_create_limit;
    case 'subscriptions':
      return quota.subs_synced_limit;
    case 'tab_group_templates':
      return quota.tab_groups_synced_limit;
    case 'bookmark_folders':
      return quota.folders_synced_limit;
    case 'bookmark_entries':
      return quota.entries_per_folder_limit;
    case 'todo_lists':
    case 'todo_items':
      return quota.todos_synced_limit;
    case 'quick_links':
      return quota.quick_links_synced_limit;
  }
}

/**
 * Pull the current cloud count for an entity from the plan-usage response.
 * Returns 0 when the usage payload doesn't include that bucket.
 */
export function usageFor(usage: SyncUsage | null | undefined, entity: SyncEntityKey): number {
  if (!usage) return 0;
  switch (entity) {
    case 'sessions':
      return usage.sessions;
    case 'prompts':
    case 'prompt_folders':
      return usage.prompts;
    case 'subscriptions':
      return usage.subs;
    case 'tab_group_templates':
      return usage.tabGroups;
    case 'bookmark_folders':
    case 'bookmark_entries':
      return usage.folders;
    case 'todo_lists':
    case 'todo_items':
      return usage.todos;
    case 'quick_links':
      return usage.quickLinks;
  }
}

export function canAddRecord(
  entity: SyncEntityKey,
  quota: UserQuota | null,
  usage: SyncUsage | null,
): boolean {
  if (!quota) return true;
  const limit = limitFor(quota, entity);
  if (limit == null) return true;
  const current = usageFor(usage, entity);
  return current < limit;
}
