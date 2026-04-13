/**
 * sync-cursor.ts — Per-entity delta cursor persisted in chrome.storage.local.
 *
 * Each entity tracks `lastServerSyncAt`: the server `updated_at` value of the
 * most recent row the engine has successfully applied locally. The next pull
 * filters `.gt('updated_at', lastServerSyncAt)` so we only fetch deltas.
 *
 * `lastSyncCompletedAt` is advisory — used by UI to display "last synced X
 * minutes ago". It is updated only after BOTH push and pull succeed for the
 * entity in a given cycle.
 */

import type { SyncEntityKey } from '../types/syncable';

export interface EntityCursor {
  lastServerSyncAt: string;
  lastSyncCompletedAt: string | null;
}

type CursorMap = Partial<Record<SyncEntityKey, EntityCursor>>;

const STORAGE_KEY = 'sync_cursor_v2';
const EPOCH = '1970-01-01T00:00:00.000Z';

export async function getCursor(entity: SyncEntityKey): Promise<EntityCursor> {
  const map = await readAll();
  return map[entity] ?? { lastServerSyncAt: EPOCH, lastSyncCompletedAt: null };
}

export async function setCursor(entity: SyncEntityKey, cursor: EntityCursor): Promise<void> {
  const map = await readAll();
  map[entity] = cursor;
  await writeAll(map);
}

export async function advanceCursor(
  entity: SyncEntityKey,
  lastServerSyncAt: string,
): Promise<void> {
  const existing = await getCursor(entity);
  if (lastServerSyncAt <= existing.lastServerSyncAt) {
    // Cursor may only move forward — silently ignore regressions.
    return;
  }
  await setCursor(entity, {
    lastServerSyncAt,
    lastSyncCompletedAt: new Date().toISOString(),
  });
}

export async function resetCursor(entity: SyncEntityKey): Promise<void> {
  const map = await readAll();
  delete map[entity];
  await writeAll(map);
}

export async function resetAllCursors(): Promise<void> {
  await writeAll({});
}

async function readAll(): Promise<CursorMap> {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    return (r?.[STORAGE_KEY] as CursorMap) ?? {};
  } catch {
    return {};
  }
}

async function writeAll(map: CursorMap): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: map });
  } catch {
    /* best-effort — storage failures are surfaced elsewhere */
  }
}
