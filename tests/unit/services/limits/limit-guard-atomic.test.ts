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
});

// ── Use real action-tracker + limit-guard (no mock) ──────────────────────────
// Supabase mock prevents network calls from reportActionToSupabase (via trackAction).
// guardAction itself only touches chrome.storage.local, but the dynamic import chain
// in limit-guard.ts pulls in supabase/client at module load in some builds.
vi.mock('@core/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    rpc: vi.fn(async () => ({ error: null })),
  },
}));

vi.mock('@core/services/guest.service', () => ({
  getOrCreateGuestId: vi.fn(async () => 'guest-test-id'),
}));

import { guardAction, ActionLimitError } from '@core/services/limits/limit-guard';
import { cachePlanTier } from '@core/services/limits/action-tracker';

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH = new Date().toISOString().slice(0, 7);

// ── Atomic guardAction ────────────────────────────────────────────────────────

describe('guardAction atomicity', () => {
  it('at limit−1: exactly one of two concurrent calls succeeds, the other throws ActionLimitError', async () => {
    // Guest daily limit is 3; set count to 2 so there is exactly one action remaining.
    await cachePlanTier('guest');
    store['action_usage'] = {
      daily:   { date: TODAY, count: 2 },
      monthly: { month: MONTH, count: 2 },
    };

    // Without an atomic check+increment both calls read count=2 (not blocked) and
    // both succeed — a TOCTOU bypass. The test therefore FAILS before the fix.
    const results = await Promise.allSettled([guardAction(), guardAction()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected  = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ActionLimitError);
  });

  it('both calls succeed when two slots remain', async () => {
    // count=1, limit=3 → room for 2 more actions → both should pass
    await cachePlanTier('guest');
    store['action_usage'] = {
      daily:   { date: TODAY, count: 1 },
      monthly: { month: MONTH, count: 1 },
    };

    const results = await Promise.allSettled([guardAction(), guardAction()]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(0);
  });

  it('both calls fail when already at the limit', async () => {
    await cachePlanTier('guest');
    store['action_usage'] = {
      daily:   { date: TODAY, count: 3 },
      monthly: { month: MONTH, count: 3 },
    };

    const results = await Promise.allSettled([guardAction(), guardAction()]);

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(2);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ActionLimitError);
    }
  });
});
