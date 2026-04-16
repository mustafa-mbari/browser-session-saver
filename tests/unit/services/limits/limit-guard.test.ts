import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock action-tracker so we control limit status ────────────────────────────
const mockLimitStatus = vi.hoisted(() => ({
  tier: 'guest' as const,
  dailyUsed: 0, dailyLimit: 3,
  monthlyUsed: 0, monthlyLimit: 20,
  dailyBlocked: false,
  monthlyBlocked: false,
}));

vi.mock('@core/services/limits/action-tracker', () => ({
  getLimitStatus:  vi.fn(async () => ({ ...mockLimitStatus })),
  incrementAction: vi.fn(async () => undefined),
  getCachedPlanTier: vi.fn(async () => 'guest'),
}));

// ── Mock Supabase so trackAction's fire-and-forget does not throw ─────────────
vi.mock('@core/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
    rpc: vi.fn(async () => ({ error: null })),
  },
}));

import { guardAction, trackAction, ActionLimitError } from '@core/services/limits/limit-guard';
import { getLimitStatus, incrementAction } from '@core/services/limits/action-tracker';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to default "under limit" state
  mockLimitStatus.dailyBlocked   = false;
  mockLimitStatus.monthlyBlocked = false;
  mockLimitStatus.dailyUsed      = 0;
  mockLimitStatus.monthlyUsed    = 0;
  (getLimitStatus as ReturnType<typeof vi.fn>).mockImplementation(
    async () => ({ ...mockLimitStatus }),
  );
});

// ── ActionLimitError ──────────────────────────────────────────────────────────

describe('ActionLimitError', () => {
  it('is an instance of Error', () => {
    const status = { ...mockLimitStatus };
    const err = new ActionLimitError(status);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ActionLimitError);
  });

  it('has the correct message and name', () => {
    const err = new ActionLimitError({ ...mockLimitStatus });
    expect(err.message).toBe('Action limit reached');
    expect(err.name).toBe('ActionLimitError');
  });

  it('attaches the LimitStatus to .status', () => {
    const status = { ...mockLimitStatus, dailyUsed: 3, dailyBlocked: true };
    const err = new ActionLimitError(status);
    expect(err.status.dailyBlocked).toBe(true);
    expect(err.status.dailyUsed).toBe(3);
  });
});

// ── guardAction ───────────────────────────────────────────────────────────────

describe('guardAction', () => {
  it('does not throw when under both limits', async () => {
    await expect(guardAction()).resolves.toBeUndefined();
  });

  it('throws ActionLimitError when daily limit is blocked', async () => {
    mockLimitStatus.dailyBlocked = true;
    mockLimitStatus.dailyUsed = 3;
    (getLimitStatus as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ ...mockLimitStatus }),
    );

    await expect(guardAction()).rejects.toBeInstanceOf(ActionLimitError);
  });

  it('throws ActionLimitError when monthly limit is blocked', async () => {
    mockLimitStatus.monthlyBlocked = true;
    mockLimitStatus.monthlyUsed = 20;
    (getLimitStatus as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ ...mockLimitStatus }),
    );

    await expect(guardAction()).rejects.toBeInstanceOf(ActionLimitError);
  });

  it('attaches the current LimitStatus to the thrown error', async () => {
    mockLimitStatus.dailyBlocked = true;
    mockLimitStatus.dailyUsed    = 3;
    mockLimitStatus.dailyLimit   = 3;
    mockLimitStatus.tier         = 'guest';
    (getLimitStatus as ReturnType<typeof vi.fn>).mockImplementation(
      async () => ({ ...mockLimitStatus }),
    );

    let caught: ActionLimitError | undefined;
    try {
      await guardAction();
    } catch (e) {
      caught = e as ActionLimitError;
    }
    expect(caught).toBeDefined();
    expect(caught!.status.tier).toBe('guest');
    expect(caught!.status.dailyUsed).toBe(3);
    expect(caught!.status.dailyLimit).toBe(3);
  });

  it('calls getLimitStatus exactly once', async () => {
    await guardAction();
    expect(getLimitStatus).toHaveBeenCalledTimes(1);
  });
});

// ── trackAction ───────────────────────────────────────────────────────────────

describe('trackAction', () => {
  it('increments the local counter', async () => {
    await trackAction();
    expect(incrementAction).toHaveBeenCalledTimes(1);
  });

  it('resolves without throwing even when Supabase is unavailable', async () => {
    await expect(trackAction()).resolves.toBeUndefined();
  });

  it('resolves without throwing when not signed in', async () => {
    await expect(trackAction()).resolves.toBeUndefined();
  });
});
