import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldAllowPush,
  markPullCompleted,
  clearForUser,
} from '@core/sync/state/first-pull-gate';

// chrome.storage.local is mocked as a simple key/value store so all three
// helpers (get/set/remove) operate on the same state.
function setupChromeStorage(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {}),
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve(undefined);
    },
  );
  (chrome.storage.local.remove as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) delete store[k];
      return Promise.resolve(undefined);
    },
  );
  return store;
}

describe('FirstPullGate', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = setupChromeStorage();
  });

  it('returns false for a brand-new user who has never pulled', async () => {
    expect(await shouldAllowPush('user-1')).toBe(false);
  });

  it('returns true after markPullCompleted is called', async () => {
    await markPullCompleted('user-1');
    expect(await shouldAllowPush('user-1')).toBe(true);
  });

  it('is per-user — one user completing does not unlock another', async () => {
    await markPullCompleted('user-1');
    expect(await shouldAllowPush('user-1')).toBe(true);
    expect(await shouldAllowPush('user-2')).toBe(false);
  });

  it('clearForUser resets only the target user', async () => {
    await markPullCompleted('alice');
    await markPullCompleted('bob');
    await clearForUser('alice');
    expect(await shouldAllowPush('alice')).toBe(false);
    expect(await shouldAllowPush('bob')).toBe(true);
  });

  it('returns false for empty userId (defensive)', async () => {
    expect(await shouldAllowPush('')).toBe(false);
  });

  it('markPullCompleted is a no-op for empty userId', async () => {
    await markPullCompleted('');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('treats a storage read failure as "push not allowed"', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('storage unavailable'),
    );
    expect(await shouldAllowPush('user-1')).toBe(false);
  });

  it('persists under a user-scoped storage key', async () => {
    await markPullCompleted('user-7');
    expect(store['sync_pull_completed_at_least_once_user-7']).toBe(true);
  });

  // ── Regression test for the "empty-local wipes cloud" scenario ──────────
  // Simulates the new-device flow: on a fresh install, sync runs, but the
  // gate keeps push disabled until the first pull completes. Verifies the
  // flag transitions exactly once, and that the storage adapter is hit the
  // expected number of times (no spurious writes).
  it('new-device flow: locked → pull completes → unlocked (one write)', async () => {
    // 1. First install, nothing persisted yet — push is blocked
    expect(await shouldAllowPush('new-user')).toBe(false);

    // 2. Pull succeeds — gate flips
    await markPullCompleted('new-user');

    // 3. Subsequent cycle — push is allowed
    expect(await shouldAllowPush('new-user')).toBe(true);

    // Only one `.set` should have fired (the transition write).
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });
});
