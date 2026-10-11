/**
 * newtab-soft-delete.ts — write helpers for records in newtab-db.
 *
 * The bookmark/todo/quick-link services reach straight into `newtabDB` rather
 * than through a repository wrapper (for historical reasons). These helpers
 * stamp `updatedAt` on edits and turn deletes into tombstones, which is what
 * lets changes and deletions merge correctly across browsers sharing data.
 */

import { newtabDB } from './newtab-storage';
import { notifyDataChanged } from '@core/events/data-change-bus';

/** Write a record the user changed: stamps updatedAt = now. */
export async function putStamped<T extends { id: string }>(storeName: string, record: T): Promise<void> {
  await newtabDB.put(storeName, { ...record, updatedAt: new Date().toISOString() });
  notifyDataChanged('dashboard');
}

/**
 * Mark a record in `storeName` as soft-deleted: sets deletedAt = updatedAt =
 * now and dirty = true so the sync engine picks it up on the next cycle.
 * Returns true when the record existed, false if already gone.
 */
export async function softDeleteNewTab(
  storeName: string,
  id: string,
): Promise<boolean> {
  const existing = await newtabDB.get<Record<string, unknown> & { id: string }>(
    storeName,
    id,
  );
  if (!existing) return false;
  const now = new Date().toISOString();
  const updated: Record<string, unknown> & { id: string } = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    dirty: true,
  };
  await newtabDB.put(storeName, updated);
  notifyDataChanged('dashboard');
  return true;
}

/** Bulk variant. */
export async function softDeleteNewTabMany(
  storeName: string,
  ids: Iterable<string>,
): Promise<number> {
  let count = 0;
  for (const id of ids) {
    if (await softDeleteNewTab(storeName, id)) count++;
  }
  return count;
}

/** newtab-db stores whose deletes are soft (tombstoned). */
export const NEWTAB_SOFT_DELETE_STORES = [
  'boards',
  'bookmarkCategories',
  'bookmarkEntries',
  'quickLinks',
  'todoLists',
  'todoItems',
] as const;

/** Hard-delete tombstones deleted before `beforeTs` (ISO). Returns the count purged. */
export async function purgeNewTabTombstones(beforeTs: string): Promise<number> {
  let purged = 0;
  for (const storeName of NEWTAB_SOFT_DELETE_STORES) {
    const all = await newtabDB.getAll<{ id: string; deletedAt?: string | null }>(storeName);
    for (const record of all) {
      if (record.deletedAt != null && record.deletedAt < beforeTs) {
        await newtabDB.delete(storeName, record.id);
        purged++;
      }
    }
  }
  return purged;
}
