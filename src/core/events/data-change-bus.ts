/**
 * data-change-bus.ts — "stored data changed" notifications between the pages of
 * this extension and its service worker (BroadcastChannel, same profile only).
 *
 * Writers call notifyDataChanged(); pages subscribe with onDataChanged() (or the
 * useDataChanged hook) and reload what they show. Bursts are coalesced.
 */

export type DataModule =
  | 'sessions'
  | 'prompts'
  | 'subscriptions'
  | 'tabGroups'
  | 'dashboard'
  | 'settings';

export interface DataChangeInfo {
  /** Announced by this page (as opposed to another page or the service worker). */
  local: boolean;
  /** Written by a shared-folder sync rather than a user edit. */
  fromSync: boolean;
}

interface DataChangeMessage {
  modules: DataModule[];
  fromSync?: boolean;
}

type Listener = (modules: ReadonlySet<DataModule>, info: DataChangeInfo) => void;

const CHANNEL_NAME = 'browser-hub-data';
const COALESCE_MS = 50;

let channel: BroadcastChannel | null | undefined;
const localListeners = new Set<Listener>();
const pending = { edit: null as Set<DataModule> | null, sync: null as Set<DataModule> | null };

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

function queue(kind: 'edit' | 'sync', modules: DataModule[]): void {
  const existing = pending[kind];
  if (existing) {
    for (const m of modules) existing.add(m);
    return;
  }
  pending[kind] = new Set(modules);
  setTimeout(() => flush(kind), COALESCE_MS);
}

function flush(kind: 'edit' | 'sync'): void {
  const modules = pending[kind];
  pending[kind] = null;
  if (!modules || modules.size === 0) return;

  const fromSync = kind === 'sync';
  getChannel()?.postMessage({ modules: [...modules], fromSync } satisfies DataChangeMessage);
  // A BroadcastChannel does not deliver to itself; notify this context's listeners directly.
  for (const listener of localListeners) listener(modules, { local: true, fromSync });
}

/** Announce that the user changed stored data. */
export function notifyDataChanged(...modules: DataModule[]): void {
  queue('edit', modules);
}

/** Announce that a shared-folder sync wrote data received from another browser. */
export function notifySyncApplied(...modules: DataModule[]): void {
  queue('sync', modules);
}

/** Subscribe to data changes from any page or the service worker. Returns an unsubscribe. */
export function onDataChanged(listener: Listener): () => void {
  const ch = getChannel();
  const handler = (event: MessageEvent<DataChangeMessage>) => {
    const modules = event.data?.modules;
    if (Array.isArray(modules)) {
      listener(new Set(modules), { local: false, fromSync: Boolean(event.data.fromSync) });
    }
  };
  ch?.addEventListener('message', handler);
  localListeners.add(listener);
  return () => {
    ch?.removeEventListener('message', handler);
    localListeners.delete(listener);
  };
}
