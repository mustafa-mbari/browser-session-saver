/**
 * deletion-log.ts — Tombstones for cross-device delete propagation.
 *
 * Why this exists
 * ---------------
 * The sync orchestrator is merge-only: a `pull` never deletes local rows and a
 * `push` never deletes remote rows based on set diffs. That fixed a catastrophic
 * data-loss bug where transient local-vs-remote size differences wiped user
 * data (see `sync-orchestrator.destructive-path.test.ts`). But the merge-only
 * rule on its own means user-initiated deletes stop propagating between devices
 * — delete a bookmark locally, sync, and the next pull re-adds it from remote.
 *
 * The deletion log fixes that without bringing the destructive behaviour back.
 * Every time the user deletes an entity locally we append the id (or composite
 * key) to a pending list in `chrome.storage.local`. On the next sync cycle the
 * orchestrator drains each entity's queue, issues an explicit Supabase DELETE
 * for just those ids, and clears them on success. Pulls additionally filter
 * remote rows whose ids are still in the queue, so pull-then-push flows cannot
 * reintroduce a pending deletion.
 *
 * This is an append-only log — nothing reads deleted ids for anything except
 * sync. It intentionally lives at the storage layer (not inside services) so
 * every code path that mutates an entity can call a single record helper.
 */

export type DeletionEntity =
  | 'sessions'
  | 'prompts'
  | 'prompt_folders'
  | 'tracked_subscriptions'
  | 'bookmark_folders'
  | 'bookmark_entries'
  | 'todo_lists'
  | 'todo_items'
  | 'tab_group_templates' // keyed by `key` (composite with user_id)
  | 'quick_links';

type Log = Partial<Record<DeletionEntity, string[]>>;

const STORAGE_KEY = 'sync_deletion_log';

async function read(): Promise<Log> {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    return (r?.[STORAGE_KEY] as Log) ?? {};
  } catch {
    return {};
  }
}

async function write(log: Log): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: log });
  } catch {
    /* best-effort — never block the calling mutation */
  }
}

/** Append a single deletion to the pending queue (deduped). */
export async function recordDeletion(entity: DeletionEntity, id: string): Promise<void> {
  if (!id) return;
  const log = await read();
  const set = new Set(log[entity] ?? []);
  set.add(id);
  log[entity] = Array.from(set);
  await write(log);
}

/** Append many deletions in one write. */
export async function recordDeletions(entity: DeletionEntity, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const log = await read();
  const set = new Set(log[entity] ?? []);
  for (const id of ids) if (id) set.add(id);
  log[entity] = Array.from(set);
  await write(log);
}

/** Return the pending deletion ids for a given entity (read-only snapshot). */
export async function getDeletions(entity: DeletionEntity): Promise<string[]> {
  const log = await read();
  return [...(log[entity] ?? [])];
}

/** Remove the given ids from the pending queue — called after a successful flush. */
export async function clearDeletions(entity: DeletionEntity, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const log = await read();
  const current = new Set(log[entity] ?? []);
  for (const id of ids) current.delete(id);
  if (current.size === 0) delete log[entity];
  else log[entity] = Array.from(current);
  await write(log);
}

/** Wipe every entity's pending queue — only for tests and account sign-out. */
export async function clearAllDeletions(): Promise<void> {
  await write({});
}
