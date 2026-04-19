import { generateId } from '@core/utils/uuid';
import { withStorageLock } from '@core/storage/storage-mutex';

const GUEST_ID_KEY = 'guest_id';

/**
 * Returns the persistent guest UUID from chrome.storage.local,
 * creating and persisting a new one if none exists.
 * Safe to call multiple times — always returns the same ID until clearGuestId() is called.
 */
export function getOrCreateGuestId(): Promise<string> {
  return withStorageLock(GUEST_ID_KEY, async () => {
    const result = await chrome.storage.local.get(GUEST_ID_KEY);
    const existing = result[GUEST_ID_KEY] as string | undefined;
    if (existing) return existing;
    const id = generateId();
    await chrome.storage.local.set({ [GUEST_ID_KEY]: id });
    return id;
  });
}

/**
 * Returns the current guest_id, or null if none has been created.
 * Does NOT create a new one — use getOrCreateGuestId() for that.
 */
export async function getGuestId(): Promise<string | null> {
  const result = await chrome.storage.local.get(GUEST_ID_KEY);
  return (result[GUEST_ID_KEY] as string | undefined) ?? null;
}

/**
 * Removes the guest_id from chrome.storage.local.
 * Called after a successful merge so the user is no longer treated as a guest.
 */
export async function clearGuestId(): Promise<void> {
  await chrome.storage.local.remove(GUEST_ID_KEY);
}
