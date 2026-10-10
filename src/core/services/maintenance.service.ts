import { getSessionRepository } from '@core/storage/storage-factory';
import { getPromptRepository, getPromptFolderRepository } from '@core/storage/prompt-storage';
import { getSubscriptionRepository } from '@core/storage/subscription-storage';
import { TabGroupTemplateStorage } from '@core/storage/tab-group-template-storage';
import { purgeNewTabTombstones } from '@core/storage/newtab-soft-delete';
import { TOMBSTONE_RETENTION_MS } from '@core/constants/timings';

/**
 * Permanently remove records that were soft-deleted more than TOMBSTONE_RETENTION_MS ago.
 * Tombstones are kept for a while so a delete can reach other browsers sharing the data.
 * Returns the number of records purged.
 */
export async function purgeOldTombstones(now = Date.now()): Promise<number> {
  const beforeTs = new Date(now - TOMBSTONE_RETENTION_MS).toISOString();
  const counts = await Promise.all([
    getSessionRepository().purgeDeleted(beforeTs),
    getPromptRepository().purgeDeleted(beforeTs),
    getPromptFolderRepository().purgeDeleted(beforeTs),
    getSubscriptionRepository().purgeDeleted(beforeTs),
    TabGroupTemplateStorage.purgeDeleted(beforeTs),
    purgeNewTabTombstones(beforeTs),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Soft-delete sessions not updated in the last `days` days. Pinned, locked and starred
 * sessions are always kept (the rolling auto-save is pinned and locked).
 * Returns the number of sessions deleted.
 */
export async function deleteSessionsOlderThan(days: number, now = Date.now()): Promise<number> {
  const cutoff = now - days * DAY_MS;
  const repo = getSessionRepository();
  let deleted = 0;
  for (const session of await repo.getAll()) {
    if (session.isPinned || session.isLocked || session.isStarred) continue;
    const lastUpdated = Date.parse(session.updatedAt ?? session.createdAt);
    if (Number.isNaN(lastUpdated) || lastUpdated >= cutoff) continue;
    if (await repo.markDeleted(session.id)) deleted++;
  }
  return deleted;
}
