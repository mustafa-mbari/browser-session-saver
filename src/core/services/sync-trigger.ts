/**
 * sync-trigger.ts — Fire-and-forget "mutation happened" notifier.
 *
 * Called from mutating storage/service functions (save, update, delete) so the
 * background service worker can kick off an immediate (debounced) sync cycle
 * instead of waiting up to 15 minutes for the next cloud-sync alarm.
 *
 * The background handler for `SYNC_MUTATION` debounces bursts so calling this
 * many times in a tight loop (e.g. deleting 30 items at once) only runs one
 * sync after the last mutation settles.
 *
 * Safe to call from any extension context. Errors are swallowed — a failed
 * notification must never block the underlying mutation.
 */
export function notifySyncMutation(): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      // Returns a Promise in MV3 — catch silently if nothing is listening yet.
      const maybePromise = chrome.runtime.sendMessage({
        action: 'SYNC_MUTATION',
        payload: {},
      }) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
        (maybePromise as Promise<unknown>).catch(() => { /* ignore */ });
      }
    }
  } catch {
    /* ignore — not in an extension context, or SW not yet ready */
  }
}
