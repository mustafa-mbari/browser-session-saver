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

interface DataChangeMessage {
  modules: DataModule[];
}

type Listener = (modules: ReadonlySet<DataModule>) => void;

const CHANNEL_NAME = 'browser-hub-data';
const COALESCE_MS = 50;

let channel: BroadcastChannel | null | undefined;
const localListeners = new Set<Listener>();
let pending: Set<DataModule> | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function notifyDataChanged(...modules: DataModule[]): void {
  if (pending) {
    for (const m of modules) pending.add(m);
    return;
  }
  pending = new Set(modules);
  setTimeout(flush, COALESCE_MS);
}

function flush(): void {
  const modules = pending;
  pending = null;
  if (!modules || modules.size === 0) return;

  getChannel()?.postMessage({ modules: [...modules] } satisfies DataChangeMessage);
  // A BroadcastChannel does not deliver to itself; notify this context's listeners directly.
  for (const listener of localListeners) listener(modules);
}

/** Subscribe to data changes from any page or the service worker. Returns an unsubscribe. */
export function onDataChanged(listener: Listener): () => void {
  const ch = getChannel();
  const handler = (event: MessageEvent<DataChangeMessage>) => {
    const modules = event.data?.modules;
    if (Array.isArray(modules)) listener(new Set(modules));
  };
  ch?.addEventListener('message', handler);
  localListeners.add(listener);
  return () => {
    ch?.removeEventListener('message', handler);
    localListeners.delete(listener);
  };
}
