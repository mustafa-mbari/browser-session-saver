/**
 * mass-delete-guard.ts — Circuit breaker for unexpected bulk deletes.
 *
 * Replaces the implicit blast-radius limit of the old deletion-log:
 * before pushing any cycle that includes tombstones, verify that the number
 * of tombstones does not exceed a configurable fraction of the total record
 * count for that entity. If it does, PAUSE sync and surface a confirmation
 * banner in the Cloud Sync UI. The user either confirms the deletions or
 * restores from cloud.
 *
 * Rationale: a corruption bug, a runaway script, or a mis-use of the clear
 * API could tombstone thousands of records in one cycle. Those tombstones
 * would push to cloud, and the 30-day compaction window is the only safety
 * net — too slow. This gate is a hard stop at the push site.
 *
 * Threshold math:
 *   threshold = max(MIN_ABSOLUTE, ceil(total * FRACTION))
 *
 * So tiny stores (3 records) don't trip on a legitimate "delete 1 of 3"
 * and large stores (1000 records) trip early at ~200 tombstones in a single
 * push cycle.
 */

import type { SyncEntityKey } from '../types/syncable';

/** Minimum tombstone count below which the guard never trips. */
export const MIN_ABSOLUTE_TOMBSTONES = 10;

/** Fraction of total records that can be tombstoned in one cycle. */
export const DEFAULT_TOMBSTONE_FRACTION = 0.2;

export interface MassDeleteCheck {
  entity: SyncEntityKey;
  tombstoneCount: number;
  totalCount: number;
  threshold: number;
  tripped: boolean;
}

export function evaluateMassDelete(
  entity: SyncEntityKey,
  tombstoneCount: number,
  totalCount: number,
  fraction = DEFAULT_TOMBSTONE_FRACTION,
): MassDeleteCheck {
  const threshold = Math.max(
    MIN_ABSOLUTE_TOMBSTONES,
    Math.ceil(totalCount * fraction),
  );
  return {
    entity,
    tombstoneCount,
    totalCount,
    threshold,
    tripped: tombstoneCount > threshold,
  };
}

// ─── Persisted trip state ────────────────────────────────────────────────────
//
// When the guard trips we persist the offending entity + counts so the UI
// can render a banner "Unusual deletion detected — 73 of 120 subscriptions".
// Cleared on user confirmation or explicit cancel-and-restore.

export interface MassDeleteTrip {
  entity: SyncEntityKey;
  tombstoneCount: number;
  totalCount: number;
  threshold: number;
  detectedAt: string;
}

const STORAGE_KEY = 'sync_mass_delete_trips';

type TripMap = Partial<Record<SyncEntityKey, MassDeleteTrip>>;

export async function recordTrip(check: MassDeleteCheck): Promise<void> {
  const map = await readTrips();
  map[check.entity] = {
    entity: check.entity,
    tombstoneCount: check.tombstoneCount,
    totalCount: check.totalCount,
    threshold: check.threshold,
    detectedAt: new Date().toISOString(),
  };
  await writeTrips(map);
}

export async function getTrips(): Promise<MassDeleteTrip[]> {
  const map = await readTrips();
  return Object.values(map).filter((t): t is MassDeleteTrip => t != null);
}

export async function clearTrip(entity: SyncEntityKey): Promise<void> {
  const map = await readTrips();
  delete map[entity];
  await writeTrips(map);
}

export async function clearAllTrips(): Promise<void> {
  await writeTrips({});
}

async function readTrips(): Promise<TripMap> {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    return (r?.[STORAGE_KEY] as TripMap) ?? {};
  } catch {
    return {};
  }
}

async function writeTrips(map: TripMap): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: map });
  } catch {
    /* best-effort */
  }
}
