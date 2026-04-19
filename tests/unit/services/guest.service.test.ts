import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── In-memory chrome.storage.local store ─────────────────────────────────────
const store: Record<string, unknown> = {};

beforeEach(() => {
  // Clear store and mocks between tests
  for (const key of Object.keys(store)) delete store[key];
  vi.clearAllMocks();

  vi.mocked(chrome.storage.local.get).mockImplementation(async (key: string) => ({
    [key]: store[key],
  }));
  vi.mocked(chrome.storage.local.set).mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  });
  vi.mocked(chrome.storage.local.remove).mockImplementation(async (key: string) => {
    delete store[key];
  });
});

// ── Mock uuid so generated values are deterministic ───────────────────────────
vi.mock('@core/utils/uuid', () => ({
  generateId: vi.fn(() => 'test-uuid-1234'),
}));

import {
  getOrCreateGuestId,
  getGuestId,
  clearGuestId,
} from '@core/services/guest.service';
import { generateId } from '@core/utils/uuid';

// ── getOrCreateGuestId ────────────────────────────────────────────────────────

describe('getOrCreateGuestId', () => {
  it('generates and stores a new guest_id when none exists', async () => {
    const id = await getOrCreateGuestId();
    expect(id).toBe('test-uuid-1234');
    expect(store['guest_id']).toBe('test-uuid-1234');
    expect(generateId).toHaveBeenCalledTimes(1);
  });

  it('returns the existing guest_id without generating a new one', async () => {
    store['guest_id'] = 'existing-uuid-5678';
    const id = await getOrCreateGuestId();
    expect(id).toBe('existing-uuid-5678');
    expect(generateId).not.toHaveBeenCalled();
  });

  it('returns the same id on consecutive calls', async () => {
    const first  = await getOrCreateGuestId();
    const second = await getOrCreateGuestId();
    expect(first).toBe(second);
    // generateId only called once — subsequent calls use stored value
    expect(generateId).toHaveBeenCalledTimes(1);
  });
});

// ── getGuestId ────────────────────────────────────────────────────────────────

describe('getGuestId', () => {
  it('returns null when no guest_id exists', async () => {
    expect(await getGuestId()).toBeNull();
  });

  it('returns the stored guest_id', async () => {
    store['guest_id'] = 'stored-uuid';
    expect(await getGuestId()).toBe('stored-uuid');
  });

  it('does not generate a new id', async () => {
    await getGuestId();
    expect(generateId).not.toHaveBeenCalled();
  });
});

// ── clearGuestId ──────────────────────────────────────────────────────────────

describe('clearGuestId', () => {
  it('removes the guest_id from storage', async () => {
    store['guest_id'] = 'uuid-to-clear';
    await clearGuestId();
    expect(store['guest_id']).toBeUndefined();
  });

  it('is safe to call when no guest_id exists', async () => {
    await expect(clearGuestId()).resolves.toBeUndefined();
  });

  it('after clearing, getGuestId returns null', async () => {
    store['guest_id'] = 'uuid-to-clear';
    await clearGuestId();
    expect(await getGuestId()).toBeNull();
  });
});

// ── Concurrency (regression for storage race) ─────────────────────────────────

describe('getOrCreateGuestId concurrency', () => {
  it('two concurrent calls both return the same ID', async () => {
    const [id1, id2] = await Promise.all([getOrCreateGuestId(), getOrCreateGuestId()]);
    expect(id1).toBe('test-uuid-1234');
    expect(id2).toBe('test-uuid-1234');
    expect(id1).toBe(id2);
  });

  it('generateId is called exactly once even when two calls race', async () => {
    await Promise.all([getOrCreateGuestId(), getOrCreateGuestId()]);
    // Without a lock both calls see no existing ID and both call generateId.
    // With a lock the second call finds the ID already written by the first.
    expect(generateId).toHaveBeenCalledTimes(1);
  });
});
