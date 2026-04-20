import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── In-memory chrome.storage.local mock ──────────────────────────────────────
const store: Record<string, unknown> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks();

  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    async (key: string) => ({ [key]: store[key] }),
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    async (items: Record<string, unknown>) => { Object.assign(store, items); },
  );
  (chrome.storage.local.remove as ReturnType<typeof vi.fn>).mockImplementation(
    async (key: string) => { delete store[key]; },
  );
});

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockRpc    = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@core/supabase/client', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    rpc:  mockRpc,
  },
}));

import { PLAN_LIMITS } from '@core/types/limits.types';
import {
  getLimits,
  refreshLimits,
  invalidateLimits,
  fetchAndCacheGuestLimits,
} from '@core/services/limits/limits.service';

const PLAN_LIMITS_KEY  = 'cached_plan_limits';
const GUEST_LIMITS_KEY = 'cached_guest_limits';

// Helper: insert a fresh (non-expired) cached entry for authenticated tiers.
function seedAuthCache(daily: number, monthly: number, ageMs = 0) {
  store[PLAN_LIMITS_KEY] = { daily, monthly, updatedAt: Date.now() - ageMs };
}

// Helper: seed guest limits cache.
function seedGuestCache(daily: number, monthly: number) {
  store[GUEST_LIMITS_KEY] = { daily, monthly };
}

// ── getLimits — guest tier ────────────────────────────────────────────────────

describe('getLimits — guest', () => {
  it('returns PLAN_LIMITS.guest when no guest cache exists', async () => {
    const limits = await getLimits('guest');
    expect(limits).toEqual(PLAN_LIMITS.guest);
  });

  it('returns cached guest limits when present', async () => {
    seedGuestCache(10, 100);
    const limits = await getLimits('guest');
    expect(limits).toEqual({ daily: 10, monthly: 100 });
  });

  it('accepts 0 as a valid guest limit (null-check, not truthy)', async () => {
    seedGuestCache(0, 0);
    const limits = await getLimits('guest');
    expect(limits).toEqual({ daily: 0, monthly: 0 });
  });

  it('does NOT call supabase.rpc for guest tier', async () => {
    await getLimits('guest');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ── getLimits — authenticated tiers (cache hit) ───────────────────────────────

describe('getLimits — auth tier cache hit (not expired)', () => {
  it('returns cached values without calling the RPC', async () => {
    seedAuthCache(99, 999);
    const limits = await getLimits('pro');
    expect(limits).toEqual({ daily: 99, monthly: 999 });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('cache is shared across tiers — tier arg does not affect which cache is read', async () => {
    seedAuthCache(15, 150);
    const limitsAsLife = await getLimits('lifetime');
    const limitsAsFree = await getLimits('free');
    expect(limitsAsLife).toEqual({ daily: 15, monthly: 150 });
    expect(limitsAsFree).toEqual({ daily: 15, monthly: 150 });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ── getLimits — authenticated tiers (cache expired) ───────────────────────────

describe('getLimits — auth tier cache expired', () => {
  const SIX_MINUTES = 6 * 60 * 1000;

  it('calls the RPC when cache is older than 5 minutes', async () => {
    seedAuthCache(50, 500, SIX_MINUTES); // expired
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 75, monthly_action_limit: 750 }],
      error: null,
    });

    const limits = await getLimits('pro');
    expect(mockRpc).toHaveBeenCalledWith('get_user_plan_tier', { p_user_id: 'u1' });
    expect(limits).toEqual({ daily: 75, monthly: 750 });
  });

  it('updates the cache after a successful re-fetch', async () => {
    seedAuthCache(50, 500, SIX_MINUTES);
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 75, monthly_action_limit: 750 }],
      error: null,
    });

    await getLimits('pro');
    const cached = store[PLAN_LIMITS_KEY] as { daily: number; monthly: number; updatedAt: number };
    expect(cached.daily).toBe(75);
    expect(cached.monthly).toBe(750);
    expect(cached.updatedAt).toBeGreaterThan(0);
  });

  it('falls back to PLAN_LIMITS when no session exists', async () => {
    seedAuthCache(50, 500, SIX_MINUTES);
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const limits = await getLimits('pro');
    expect(limits).toEqual(PLAN_LIMITS.pro);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('falls back to PLAN_LIMITS when RPC errors', async () => {
    seedAuthCache(50, 500, SIX_MINUTES);
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const limits = await getLimits('pro');
    expect(limits).toEqual(PLAN_LIMITS.pro);
  });

  it('falls back to PLAN_LIMITS when getSession throws', async () => {
    seedAuthCache(50, 500, SIX_MINUTES);
    mockGetSession.mockRejectedValue(new Error('network error'));

    const limits = await getLimits('pro');
    expect(limits).toEqual(PLAN_LIMITS.pro);
  });
});

// ── getLimits — no cache at all ───────────────────────────────────────────────

describe('getLimits — no cache', () => {
  it('fetches from RPC when cache is absent', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u2' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'free', daily_action_limit: 8, monthly_action_limit: 60 }],
      error: null,
    });

    const limits = await getLimits('free');
    expect(limits).toEqual({ daily: 8, monthly: 60 });
  });

  it('accepts daily_action_limit = 0 (null check, not truthy check)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u3' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'free', daily_action_limit: 0, monthly_action_limit: 0 }],
      error: null,
    });

    const limits = await getLimits('free');
    expect(limits).toEqual({ daily: 0, monthly: 0 });
  });

  it('falls back to PLAN_LIMITS when no session and no cache', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const limits = await getLimits('lifetime');
    expect(limits).toEqual(PLAN_LIMITS.lifetime);
  });
});

// ── refreshLimits ─────────────────────────────────────────────────────────────

describe('refreshLimits', () => {
  it('force-fetches from RPC and stores new limits with updatedAt', async () => {
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 120, monthly_action_limit: 1200 }],
      error: null,
    });

    await refreshLimits('user-abc');

    expect(mockRpc).toHaveBeenCalledWith('get_user_plan_tier', { p_user_id: 'user-abc' });
    const cached = store[PLAN_LIMITS_KEY] as { daily: number; monthly: number; updatedAt: number };
    expect(cached.daily).toBe(120);
    expect(cached.monthly).toBe(1200);
    expect(cached.updatedAt).toBeGreaterThan(0);
  });

  it('overwrites stale cached entry (simulates admin changing limits)', async () => {
    seedAuthCache(50, 500, 10 * 60 * 1000); // stale
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 200, monthly_action_limit: 2000 }],
      error: null,
    });

    await refreshLimits('user-abc');

    const cached = store[PLAN_LIMITS_KEY] as { daily: number; monthly: number };
    expect(cached.daily).toBe(200);
    expect(cached.monthly).toBe(2000);
  });

  it('does not throw when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await expect(refreshLimits('user-abc')).resolves.toBeUndefined();
  });

  it('does not throw when RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network'));
    await expect(refreshLimits('user-abc')).resolves.toBeUndefined();
  });

  it('after refresh, getLimits returns fresh limits without another RPC call', async () => {
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 77, monthly_action_limit: 777 }],
      error: null,
    });
    await refreshLimits('user-abc');
    vi.clearAllMocks(); // reset call count

    const limits = await getLimits('pro');
    expect(limits).toEqual({ daily: 77, monthly: 777 });
    expect(mockRpc).not.toHaveBeenCalled(); // served from cache
  });
});

// ── invalidateLimits ──────────────────────────────────────────────────────────

describe('invalidateLimits', () => {
  it('removes the cached_plan_limits key from storage', async () => {
    seedAuthCache(50, 500);
    expect(store[PLAN_LIMITS_KEY]).toBeDefined();

    await invalidateLimits();

    expect(store[PLAN_LIMITS_KEY]).toBeUndefined();
  });

  it('does not affect the guest limits cache', async () => {
    seedGuestCache(5, 40);
    await invalidateLimits();
    expect(store[GUEST_LIMITS_KEY]).toBeDefined();
  });

  it('after invalidation, getLimits re-fetches from backend on next call', async () => {
    seedAuthCache(50, 500);
    await invalidateLimits();

    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 60, monthly_action_limit: 600 }],
      error: null,
    });

    const limits = await getLimits('pro');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(limits).toEqual({ daily: 60, monthly: 600 });
  });

  it('does not throw when nothing is cached', async () => {
    await expect(invalidateLimits()).resolves.toBeUndefined();
  });
});

// ── fetchAndCacheGuestLimits ──────────────────────────────────────────────────

describe('fetchAndCacheGuestLimits', () => {
  it('fetches get_guest_limits RPC and stores result under GUEST_LIMITS_KEY', async () => {
    mockRpc.mockResolvedValue({
      data: [{ daily_action_limit: 5, monthly_action_limit: 40 }],
      error: null,
    });

    await fetchAndCacheGuestLimits();

    expect(mockRpc).toHaveBeenCalledWith('get_guest_limits');
    expect(store[GUEST_LIMITS_KEY]).toEqual({ daily: 5, monthly: 40 });
  });

  it('does not write anything when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    await fetchAndCacheGuestLimits();
    expect(store[GUEST_LIMITS_KEY]).toBeUndefined();
  });

  it('does not throw when RPC throws', async () => {
    mockRpc.mockRejectedValue(new Error('network'));
    await expect(fetchAndCacheGuestLimits()).resolves.toBeUndefined();
  });

  it('after fetchAndCacheGuestLimits, getLimits("guest") uses new values', async () => {
    mockRpc.mockResolvedValue({
      data: [{ daily_action_limit: 7, monthly_action_limit: 70 }],
      error: null,
    });
    await fetchAndCacheGuestLimits();

    const limits = await getLimits('guest');
    expect(limits).toEqual({ daily: 7, monthly: 70 });
  });
});

// ── TTL boundary tests ────────────────────────────────────────────────────────

describe('TTL boundary', () => {
  it('treats a 4 min 59 sec old cache as valid (no RPC)', async () => {
    const justUnderTTL = 4 * 60 * 1000 + 59 * 1000; // 299 s
    seedAuthCache(50, 500, justUnderTTL);

    const limits = await getLimits('pro');
    expect(limits).toEqual({ daily: 50, monthly: 500 });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('treats a 5 min 1 sec old cache as expired (RPC called)', async () => {
    const justOverTTL = 5 * 60 * 1000 + 1000; // 301 s
    seedAuthCache(50, 500, justOverTTL);

    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 55, monthly_action_limit: 550 }],
      error: null,
    });

    const limits = await getLimits('pro');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(limits).toEqual({ daily: 55, monthly: 550 });
  });
});

// ── Admin-change scenario (end-to-end cache flow) ────────────────────────────

describe('Admin changes limits scenario', () => {
  it('reflects new limits after sign-in (refreshLimits) even when stale cache exists', async () => {
    // 1. Old limits cached (stale — simulating pre-admin-change state).
    seedAuthCache(50, 500, 10 * 60 * 1000);

    // 2. Admin changes pro limit in DB to 200/2000.
    // 3. User logs out → invalidateLimits() clears cache.
    await invalidateLimits();
    expect(store[PLAN_LIMITS_KEY]).toBeUndefined();

    // 4. User logs back in → auth.service calls refreshLimits(userId).
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 200, monthly_action_limit: 2000 }],
      error: null,
    });
    await refreshLimits('user-pro');

    // 5. Next getLimits call returns the new values immediately (no extra RPC).
    vi.clearAllMocks();
    const limits = await getLimits('pro');
    expect(limits).toEqual({ daily: 200, monthly: 2000 });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reflects new limits after TTL expiry even without re-login', async () => {
    // Cache from before admin change.
    seedAuthCache(50, 500); // fresh

    // First call: served from cache (no RPC).
    let limits = await getLimits('pro');
    expect(limits).toEqual({ daily: 50, monthly: 500 });
    expect(mockRpc).not.toHaveBeenCalled();

    // Simulate TTL expiry (cache now 6 minutes old).
    const cached = store[PLAN_LIMITS_KEY] as { daily: number; monthly: number; updatedAt: number };
    store[PLAN_LIMITS_KEY] = { ...cached, updatedAt: Date.now() - 6 * 60 * 1000 };

    // Admin changed limit in DB.
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockRpc.mockResolvedValue({
      data: [{ tier: 'pro', daily_action_limit: 75, monthly_action_limit: 750 }],
      error: null,
    });

    // Second call: cache expired → re-fetches → returns new value.
    limits = await getLimits('pro');
    expect(limits).toEqual({ daily: 75, monthly: 750 });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
