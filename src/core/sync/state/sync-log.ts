/**
 * sync-log.ts — Rolling ring buffer of sync events in chrome.storage.local.
 *
 * Purpose: observability. The Cloud Sync Debug tab reads the last N entries
 * to surface what the engine has been doing. Also invaluable for support —
 * a user can export their log and we can trace a sync regression without
 * adding loggers ad-hoc.
 *
 * The buffer is capped to MAX_ENTRIES so it can't grow unbounded. Oldest
 * entries are dropped first.
 */

import type { SyncEntityKey } from '../types/syncable';

export type SyncLogEventType =
  | 'cycle-start'
  | 'cycle-end'
  | 'entity-start'
  | 'entity-end'
  | 'push-ok'
  | 'push-skip'
  | 'push-conflict'
  | 'pull-ok'
  | 'pull-skip'
  | 'gate-trip'
  | 'quota-reject'
  | 'error';

export interface SyncLogEntry {
  at: string;
  type: SyncLogEventType;
  entity?: SyncEntityKey;
  /** Free-form message for humans. */
  msg?: string;
  /** Structured payload — keep small; stringified length is capped. */
  data?: Record<string, unknown>;
}

const STORAGE_KEY = 'sync_log';
const MAX_ENTRIES = 500;
const MAX_DATA_STRING = 2000;

export async function appendLog(entry: Omit<SyncLogEntry, 'at'>): Promise<void> {
  const full: SyncLogEntry = { at: new Date().toISOString(), ...entry };
  if (full.data) {
    const asJson = safeStringify(full.data);
    if (asJson.length > MAX_DATA_STRING) {
      full.data = { truncated: true, preview: asJson.slice(0, MAX_DATA_STRING) };
    }
  }
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    const buffer = (r?.[STORAGE_KEY] as SyncLogEntry[]) ?? [];
    buffer.push(full);
    if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
    await chrome.storage.local.set({ [STORAGE_KEY]: buffer });
  } catch {
    /* logging must never break sync */
  }
}

export async function readLog(limit = MAX_ENTRIES): Promise<SyncLogEntry[]> {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEY);
    const buffer = (r?.[STORAGE_KEY] as SyncLogEntry[]) ?? [];
    return buffer.slice(-limit);
  } catch {
    return [];
  }
}

export async function clearLog(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '[unserializable]';
  }
}
