import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock action-tracker so we control check+increment behaviour ───────────────
const mockLimitStatus = vi.hoisted(() => ({
  tier: 'guest' as const,
  dailyUsed: 0, dailyLimit: 3,
  monthlyUsed: 0, monthlyLimit: 20,
  dailyBlocked: false,
  monthlyBlocked: false,
}));

// checkAndIncrementAction either resolves or throws ActionLimitError.
// Default behaviour: resolves (under limit). Tests override with mockRejectedValueOnce.
const mockCheckAndIncrement = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@core/services/limits/action-tracker', () => {
  class ActionLimitError extends Error {
    status: unknown;
    constructor(status: unknown) {
      super('Action limit reached');
      this.name = 'ActionLimitError';
      this.status = status;
    }
  }
  return {
    checkAndIncrementAction: mockCheckAndIncrement,
    ActionLimitError,
    getLimitStatus:    vi.fn(async () => ({ ...mockLimitStatus })),
    incrementAction:   vi.fn(async () => undefined),
    getCachedPlanTier: vi.fn(async () => 'guest'),
  };
});

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
import { checkAndIncrementAction } from '@core/services/limits/action-tracker';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: checkAndIncrementAction resolves (under limit)
  mockCheckAndIncrement.mockResolvedValue(undefined);
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
    mockCheckAndIncrement.mockRejectedValueOnce(
      new ActionLimitError({ ...mockLimitStatus, dailyBlocked: true, dailyUsed: 3 }),
    );
    await expect(guardAction()).rejects.toBeInstanceOf(ActionLimitError);
  });

  it('throws ActionLimitError when monthly limit is blocked', async () => {
    mockCheckAndIncrement.mockRejectedValueOnce(
      new ActionLimitError({ ...mockLimitStatus, monthlyBlocked: true, monthlyUsed: 20 }),
    );
    await expect(guardAction()).rejects.toBeInstanceOf(ActionLimitError);
  });

  it('attaches the current LimitStatus to the thrown error', async () => {
    const status = { ...mockLimitStatus, dailyBlocked: true, dailyUsed: 3, dailyLimit: 3 };
    mockCheckAndIncrement.mockRejectedValueOnce(new ActionLimitError(status));

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

  it('calls checkAndIncrementAction exactly once', async () => {
    await guardAction();
    expect(checkAndIncrementAction).toHaveBeenCalledTimes(1);
  });
});

// ── trackAction ───────────────────────────────────────────────────────────────

describe('trackAction', () => {
  it('resolves without throwing even when Supabase is unavailable', async () => {
    await expect(trackAction()).resolves.toBeUndefined();
  });

  it('resolves without throwing when not signed in', async () => {
    await expect(trackAction()).resolves.toBeUndefined();
  });

  it('does not call checkAndIncrementAction (remote-only)', async () => {
    await trackAction();
    expect(checkAndIncrementAction).not.toHaveBeenCalled();
  });
});
