/**
 * first-pull-gate.ts — Prevents a new device from wiping cloud data.
 *
 * Scenario: user signs in on a brand-new install. Local stores are empty.
 * Without this gate, the engine would see zero local records, push nothing,
 * then the next pull pulls the cloud data — but in the meantime a naive
 * implementation could have concluded "local is empty, cloud must be stale"
 * and marked remote rows deleted. This gate enforces the invariant:
 *
 *   PUSH is a no-op until we have successfully completed at least one pull
 *   for the current user on the current device.
 *
 * The flag is keyed per-userId so shared devices work: Alice signs out,
 * Bob signs in, Bob's flag starts fresh.
 *
 * Called from:
 *   - SyncEngine.syncAll() — checks `shouldAllowPush(userId)` before push
 *   - SyncEngine.pullAll()  — calls `markPullCompleted(userId)` on success
 *   - Sign-out path       — calls `clearForUser(userId)` to reset
 */

const KEY_PREFIX = 'sync_pull_completed_at_least_once_';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

/** True if the given user has successfully completed at least one pull. */
export async function shouldAllowPush(userId: string): Promise<boolean> {
  if (!userId) return false;
  const k = keyFor(userId);
  try {
    const r = await chrome.storage.local.get(k);
    return r?.[k] === true;
  } catch {
    return false;
  }
}

/** Record that a pull has successfully completed for this user. */
export async function markPullCompleted(userId: string): Promise<void> {
  if (!userId) return;
  await chrome.storage.local.set({ [keyFor(userId)]: true });
}

/** Clear the flag for a specific user (on sign-out). */
export async function clearForUser(userId: string): Promise<void> {
  if (!userId) return;
  await chrome.storage.local.remove(keyFor(userId));
}
