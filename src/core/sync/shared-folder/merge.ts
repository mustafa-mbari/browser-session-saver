/**
 * merge.ts — pure merge rules for data shared between browsers.
 *
 * Records: the newest `updatedAt` wins; on a tie a deletion wins, then the
 * stable JSON form decides, so every browser picks the same winner.
 * Lists without per-item timestamps: the newest list wins as a whole.
 * Settings: merged field by field, each field carrying its own timestamp.
 */
import type { SharedList, SharedSettings } from './types';

export interface Versioned {
  updatedAt?: string;
  createdAt?: string;
  savedAt?: string;
  addedAt?: string;
  deletedAt?: string | null;
}

/** JSON with object keys sorted, so equal values always produce equal strings. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(',')}}`;
}

/** Short content fingerprint (FNV-1a plus length) for change detection. */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export function versionOf(record: Versioned): string {
  return record.updatedAt ?? record.createdAt ?? record.savedAt ?? record.addedAt ?? '';
}

/** The winner between two copies of the same record. */
export function pickNewer<T extends Versioned>(a: T, b: T): T {
  const va = versionOf(a);
  const vb = versionOf(b);
  if (va !== vb) return va > vb ? a : b;
  const deletedA = Boolean(a.deletedAt);
  const deletedB = Boolean(b.deletedAt);
  if (deletedA !== deletedB) return deletedA ? a : b;
  return stableStringify(a) >= stableStringify(b) ? a : b;
}

export interface RecordMerge<T> {
  /** Local records plus every remote winner — what this browser shares next. */
  merged: T[];
  /** Winners that differ from the local copy — write these locally. */
  toApply: T[];
}

export function mergeRecords<T extends Versioned>(
  local: readonly T[],
  remotes: readonly (readonly T[] | undefined)[],
  keyOf: (record: T) => string | undefined,
): RecordMerge<T> {
  const localByKey = new Map<string, T>();
  for (const record of local) {
    const key = keyOf(record);
    if (key) localByKey.set(key, record);
  }

  const winners = new Map(localByKey);
  for (const list of remotes) {
    if (!Array.isArray(list)) continue;
    for (const record of list) {
      const key = record && typeof record === 'object' ? keyOf(record) : undefined;
      if (!key) continue;
      const current = winners.get(key);
      winners.set(key, current ? pickNewer(current, record) : record);
    }
  }

  const toApply: T[] = [];
  for (const [key, record] of winners) {
    if (localByKey.get(key) !== record) toApply.push(record);
  }
  return { merged: [...winners.values()], toApply };
}

/**
 * Keys of local records that existed at `lastSyncAt`, have not changed since and
 * are missing from every peer: deleted elsewhere while this browser was away for
 * longer than tombstones are kept.
 */
export function findRemovedWhileAway<T extends Versioned>(
  local: readonly T[],
  remotes: readonly (readonly T[] | undefined)[],
  keyOf: (record: T) => string | undefined,
  lastSyncAt: string,
): string[] {
  const remoteKeys = new Set<string>();
  for (const list of remotes) {
    for (const record of list ?? []) {
      const key = keyOf(record);
      if (key) remoteKeys.add(key);
    }
  }
  const removed: string[] = [];
  for (const record of local) {
    const key = keyOf(record);
    if (key && !remoteKeys.has(key) && versionOf(record) <= lastSyncAt) removed.push(key);
  }
  return removed;
}

export function mergeList<T>(
  local: SharedList<T>,
  remotes: readonly (SharedList<T> | undefined)[],
): SharedList<T> {
  let winner = local;
  for (const remote of remotes) {
    if (!remote || !Array.isArray(remote.items) || typeof remote.updatedAt !== 'string') continue;
    const newer =
      remote.updatedAt > winner.updatedAt ||
      (remote.updatedAt === winner.updatedAt &&
        stableStringify(remote.items) > stableStringify(winner.items));
    if (newer) winner = remote;
  }
  return winner;
}

/** Local items first, then items only peers have (used the first time a browser joins). */
export function unionList<T>(
  local: readonly T[],
  remotes: readonly (SharedList<T> | undefined)[],
  keyOf: (item: T) => string,
): T[] {
  const result = [...local];
  const seen = new Set(local.map(keyOf));
  for (const remote of remotes) {
    for (const item of remote?.items ?? []) {
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export interface SettingsMerge<T> {
  merged: SharedSettings<T>;
  /** Fields whose winning value differs from the local one — write these locally. */
  changed: Partial<T>;
}

export function mergeSettings<T>(
  local: SharedSettings<T>,
  remotes: readonly (SharedSettings<T> | undefined)[],
): SettingsMerge<T> {
  const localValues = local.values as Record<string, unknown>;
  const values: Record<string, unknown> = { ...localValues };
  const times: Record<string, string> = { ...local.fieldUpdatedAt };

  for (const remote of remotes) {
    if (!remote?.values || typeof remote.values !== 'object') continue;
    for (const [field, value] of Object.entries(remote.values as Record<string, unknown>)) {
      if (value === undefined) continue;
      const remoteTime = remote.fieldUpdatedAt?.[field] ?? '';
      const localTime = times[field] ?? '';
      const take =
        !(field in values) ||
        remoteTime > localTime ||
        (remoteTime === localTime && stableStringify(value) > stableStringify(values[field]));
      if (take) {
        values[field] = value;
        times[field] = remoteTime;
      }
    }
  }

  const changed: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    if (stableStringify(value) !== stableStringify(localValues[field])) changed[field] = value;
  }
  return {
    merged: { values: values as Partial<T>, fieldUpdatedAt: times },
    changed: changed as Partial<T>,
  };
}
