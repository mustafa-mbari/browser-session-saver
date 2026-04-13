/**
 * newtab-soft-delete.ts — helper for soft-deleting records in newtab-db.
 *
 * The bookmark/todo/quick-link services reach straight into `newtabDB` rather
 * than through a repository wrapper (for historical reasons). This helper
 * gives them a single line to flip a record into a tombstone without
 * reimplementing the stamp logic at every callsite.
 */

import { newtabDB } from './newtab-storage';

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
