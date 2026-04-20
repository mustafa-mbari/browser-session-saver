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

// ── Mock limits.service so action-tracker tests are fully isolated ────────────
// getLimits returns hardcoded PLAN_LIMITS values — the actual cache/RPC logic
// is tested separately in limits.service.test.ts.
vi.mock('@core/services/limits/limits.service', () => ({
  getLimits: vi.fn(async (tier: string) => {
    const table: Record<string, { daily: number; monthly: number }> = {
      guest:    { daily: 3,  monthly: 20  },
      free:     { daily: 6,  monthly: 30  },
      pro:      { daily: 50, monthly: 500 },
      lifetime: { daily: 90, monthly: 900 },
    };
    return table[tier] ?? { daily: 3, monthly: 20 };
  }),
}));

import {
  getActionUsage,
  incrementAction,
  getCachedPlanTier,
  cachePlanTier,
  getLimitStatus,
  canPerformAction,
} from '@core/services/limits/action-tracker';

const TODAY  = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
const MONTH  = new Date().toISOString().slice(0, 7);  // 'YYYY-MM'
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();
const LAST_MONTH = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();

// ── getActionUsage ────────────────────────────────────────────────────────────

describe('getActionUsage', () => {
  it('returns zero counts when storage is empty', async () => {
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(0);
    expect(usage.daily.date).toBe(TODAY);
    expect(usage.monthly.count).toBe(0);
    expect(usage.monthly.month).toBe(MONTH);
  });

  it('returns stored counts when date/month match', async () => {
    store['action_usage'] = {
      daily:   { date: TODAY, count: 4 },
      monthly: { month: MONTH, count: 12 },
    };
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(4);
    expect(usage.monthly.count).toBe(12);
  });

  it('returns 0 (not NaN) when storage has partial data missing count field', async () => {
    store['action_usage'] = {
      daily:   { date: TODAY },
      monthly: { month: MONTH },
    };
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(0);
    expect(usage.monthly.count).toBe(0);
    await incrementAction();
    const after = await getActionUsage();
    expect(after.daily.count).toBe(1);
    expect(after.monthly.count).toBe(1);
  });

  it('resets daily count when stored date is in the past', async () => {
    store['action_usage'] = {
      daily:   { date: YESTERDAY, count: 5 },
      monthly: { month: MONTH, count: 10 },
    };
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(0);
    expect(usage.daily.date).toBe(TODAY);
    expect(usage.monthly.count).toBe(10);
  });

  it('resets monthly count when stored month is in the past', async () => {
    store['action_usage'] = {
      daily:   { date: TODAY, count: 2 },
      monthly: { month: LAST_MONTH, count: 25 },
    };
    const usage = await getActionUsage();
    expect(usage.monthly.count).toBe(0);
    expect(usage.monthly.month).toBe(MONTH);
    expect(usage.daily.count).toBe(2);
  });
});

// ── incrementAction ───────────────────────────────────────────────────────────

describe('incrementAction', () => {
  it('increments both daily and monthly counts by 1', async () => {
    store['action_usage'] = {
      daily:   { date: TODAY, count: 2 },
      monthly: { month: MONTH, count: 5 },
    };
    await incrementAction();
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(3);
    expect(usage.monthly.count).toBe(6);
  });

  it('starts from zero when storage is empty', async () => {
    await incrementAction();
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(1);
    expect(usage.monthly.count).toBe(1);
  });

  it('increments correctly on consecutive calls', async () => {
    await incrementAction();
    await incrementAction();
    await incrementAction();
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(3);
    expect(usage.monthly.count).toBe(3);
  });
});

// ── getCachedPlanTier / cachePlanTier ─────────────────────────────────────────

describe('getCachedPlanTier', () => {
  it('returns guest when no tier is cached', async () => {
    expect(await getCachedPlanTier()).toBe('guest');
  });

  it('returns the stored tier', async () => {
    store['cached_plan'] = 'pro';
    expect(await getCachedPlanTier()).toBe('pro');
  });
});

describe('cachePlanTier', () => {
  it('stores the tier in chrome.storage.local', async () => {
    await cachePlanTier('lifetime');
    expect(store['cached_plan']).toBe('lifetime');
  });

  it('can round-trip all valid tiers', async () => {
    for (const tier of ['guest', 'free', 'pro', 'lifetime'] as const) {
      await cachePlanTier(tier);
      expect(await getCachedPlanTier()).toBe(tier);
    }
  });
});

// ── getLimitStatus ────────────────────────────────────────────────────────────

describe('getLimitStatus', () => {
  it('returns correct limits for guest tier', async () => {
    const status = await getLimitStatus();
    expect(status.tier).toBe('guest');
    expect(status.dailyLimit).toBe(3);
    expect(status.monthlyLimit).toBe(20);
    expect(status.dailyUsed).toBe(0);
    expect(status.monthlyUsed).toBe(0);
    expect(status.dailyBlocked).toBe(false);
    expect(status.monthlyBlocked).toBe(false);
  });

  it('returns correct limits for pro tier', async () => {
    await cachePlanTier('pro');
    const status = await getLimitStatus();
    expect(status.dailyLimit).toBe(50);
    expect(status.monthlyLimit).toBe(500);
  });

  it('returns correct limits for lifetime tier', async () => {
    await cachePlanTier('lifetime');
    const status = await getLimitStatus();
    expect(status.dailyLimit).toBe(90);
    expect(status.monthlyLimit).toBe(900);
  });

  it('sets dailyBlocked when count equals daily limit', async () => {
    store['action_usage'] = {
      daily:   { date: TODAY, count: 3 },
      monthly: { month: MONTH, count: 3 },
    };
    const status = await getLimitStatus();
    expect(status.dailyBlocked).toBe(true);
    expect(status.monthlyBlocked).toBe(false);
  });

  it('sets monthlyBlocked when count equals monthly limit', async () => {
    await cachePlanTier('guest');
    store['action_usage'] = {
      daily:   { date: TODAY, count: 2 },
      monthly: { month: MONTH, count: 20 },
    };
    const status = await getLimitStatus();
    expect(status.monthlyBlocked).toBe(true);
    expect(status.dailyBlocked).toBe(false);
  });
});

// ── canPerformAction ──────────────────────────────────────────────────────────

describe('canPerformAction', () => {
  it('returns true when under both limits', async () => {
    expect(await canPerformAction()).toBe(true);
  });

  it('returns false when daily limit reached', async () => {
    store['action_usage'] = {
      daily:   { date: TODAY, count: 3 },
      monthly: { month: MONTH, count: 3 },
    };
    expect(await canPerformAction()).toBe(false);
  });

  it('returns false when monthly limit reached', async () => {
    await cachePlanTier('guest');
    store['action_usage'] = {
      daily:   { date: TODAY, count: 0 },
      monthly: { month: MONTH, count: 20 },
    };
    expect(await canPerformAction()).toBe(false);
  });

  it('free tier allows 6 actions per day', async () => {
    await cachePlanTier('free');
    store['action_usage'] = {
      daily:   { date: TODAY, count: 5 },
      monthly: { month: MONTH, count: 5 },
    };
    expect(await canPerformAction()).toBe(true);

    store['action_usage'] = {
      daily:   { date: TODAY, count: 6 },
      monthly: { month: MONTH, count: 6 },
    };
    expect(await canPerformAction()).toBe(false);
  });
});

// ── Concurrency (regression for storage race) ─────────────────────────────────

describe('incrementAction concurrency', () => {
  it('two concurrent calls each increment by 1 (final count = 2)', async () => {
    await Promise.all([incrementAction(), incrementAction()]);
    const usage = await getActionUsage();
    expect(usage.daily.count).toBe(2);
    expect(usage.monthly.count).toBe(2);
  });
});
