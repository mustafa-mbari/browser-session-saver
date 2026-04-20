import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withStorageLock } from '@core/storage/storage-mutex';

// ── Mock limits.service — auth.service delegates limits caching here ──────────
const mockRefreshLimits    = vi.hoisted(() => vi.fn(async () => undefined));
const mockInvalidateLimits = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@core/services/limits/limits.service', () => ({
  refreshLimits:    mockRefreshLimits,
  invalidateLimits: mockInvalidateLimits,
}));

// ── Mock action-tracker ───────────────────────────────────────────────────────
vi.mock('@core/services/limits/action-tracker', () => ({
  cachePlanTier:     vi.fn(async () => undefined),
  getCachedPlanTier: vi.fn(async () => 'guest'),
  setActionUsage:    vi.fn(async () => undefined),
  getActionUsage:    vi.fn(async () => ({
    daily:   { date: new Date().toISOString().slice(0, 10), count: 0 },
    monthly: { month: new Date().toISOString().slice(0, 7), count: 0 },
  })),
  USAGE_KEY: 'action_usage',
}));

// ── Mock guest.service ────────────────────────────────────────────────────────
vi.mock('@core/services/guest.service', () => ({
  getGuestId:   vi.fn(async () => null),
  clearGuestId: vi.fn(async () => undefined),
}));

// ── Mock Supabase client ──────────────────────────────────────────────────────
const mockSession = vi.hoisted(() => ({
  user: { id: 'user-123', email: 'test@example.com' },
}));

const mockSupabase = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => ({})),
    getSession: vi.fn(async () => ({ data: { session: mockSession } })),
  },
  rpc: vi.fn(async () => ({ data: [{ tier: 'pro' }], error: null })),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: null, error: { message: 'no row' } })),
    })),
  })),
}));

vi.mock('@core/supabase/client', () => ({ supabase: mockSupabase }));

import {
  signIn,
  signOut,
  getSession,
  getUserId,
  isAuthenticated,
  getEmail,
} from '@core/services/auth.service';
import { cachePlanTier, setActionUsage, getActionUsage } from '@core/services/limits/action-tracker';
import { refreshLimits, invalidateLimits } from '@core/services/limits/limits.service';
import { getGuestId, clearGuestId } from '@core/services/guest.service';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: mockSession },
  });
  mockSupabase.auth.signOut.mockResolvedValue({});
  mockSupabase.rpc.mockResolvedValue({ data: [{ tier: 'pro' }], error: null });
});

// ── signIn ────────────────────────────────────────────────────────────────────

describe('signIn', () => {
  it('returns success=true with email on valid credentials', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    const result = await signIn('test@example.com', 'password123');
    expect(result.success).toBe(true);
    expect(result.email).toBe('test@example.com');
    expect(result.error).toBeUndefined();
  });

  it('returns success=false with error message on failure', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await signIn('bad@example.com', 'wrong');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid login credentials');
    expect(result.email).toBeUndefined();
  });

  it('does not cache plan tier on sign-in failure', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'error' },
    });

    await signIn('bad@example.com', 'wrong');
    expect(cachePlanTier).not.toHaveBeenCalled();
  });

  it('does not call refreshLimits on sign-in failure', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'error' },
    });

    await signIn('bad@example.com', 'wrong');
    expect(refreshLimits).not.toHaveBeenCalled();
  });

  it('calls refreshLimits with the user id on successful sign-in', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    // Allow fire-and-forget microtasks to settle
    await Promise.resolve();
    await Promise.resolve();

    expect(refreshLimits).toHaveBeenCalledWith('user-123');
  });

  it('calls merge-guest when session has access_token and a guest_id exists', async () => {
    vi.mocked(getGuestId).mockResolvedValueOnce('some-guest-uuid');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user:    { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'jwt-abc123' },
      },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/merge-guest'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not call merge-guest when there is no guest_id', async () => {
    vi.mocked(getGuestId).mockResolvedValueOnce(null);
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user:    { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'jwt-abc123' },
      },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears guest_id after successful merge', async () => {
    vi.mocked(getGuestId).mockResolvedValueOnce('some-guest-uuid');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user:    { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'jwt-abc123' },
      },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();

    expect(clearGuestId).toHaveBeenCalledTimes(1);
  });
});

// ── signOut ───────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    await signOut();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('caches plan tier as guest after sign-out', async () => {
    await signOut();
    expect(cachePlanTier).toHaveBeenCalledWith('guest');
  });

  it('calls invalidateLimits after sign-out', async () => {
    await signOut();
    expect(invalidateLimits).toHaveBeenCalledTimes(1);
  });

  it('invalidates limits so stale limits are not used after signing out', async () => {
    await signOut();
    // invalidateLimits must be called on every sign-out, regardless of prior state.
    expect(invalidateLimits).toHaveBeenCalled();
  });
});

// ── getSession ────────────────────────────────────────────────────────────────

describe('getSession', () => {
  it('returns the active session when signed in', async () => {
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe('user-123');
  });

  it('returns null when no session exists', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce(
      { data: { session: null } } as any,
    );
    const session = await getSession();
    expect(session).toBeNull();
  });
});

// ── getUserId ─────────────────────────────────────────────────────────────────

describe('getUserId', () => {
  it('returns the user ID when authenticated', async () => {
    expect(await getUserId()).toBe('user-123');
  });

  it('returns null when not authenticated', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce(
      { data: { session: null } } as any,
    );
    expect(await getUserId()).toBeNull();
  });
});

// ── isAuthenticated ───────────────────────────────────────────────────────────

describe('isAuthenticated', () => {
  it('returns true when a session exists', async () => {
    expect(await isAuthenticated()).toBe(true);
  });

  it('returns false when no session exists', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce(
      { data: { session: null } } as any,
    );
    expect(await isAuthenticated()).toBe(false);
  });
});

// ── getEmail ──────────────────────────────────────────────────────────────────

describe('getEmail', () => {
  it('returns the user email when authenticated', async () => {
    expect(await getEmail()).toBe('test@example.com');
  });

  it('returns null when not authenticated', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce(
      { data: { session: null } } as any,
    );
    expect(await getEmail()).toBeNull();
  });
});

// ── syncUsageFromServer local-wins ────────────────────────────────────────────

describe('syncUsageFromServer local-wins', () => {
  const TODAY = new Date().toISOString().slice(0, 10);
  const MONTH = new Date().toISOString().slice(0, 7);

  it('preserves local counts when they are higher than the server counts', async () => {
    vi.mocked(getActionUsage).mockResolvedValueOnce({
      daily:   { date: TODAY, count: 10 },
      monthly: { month: MONTH, count: 50 },
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_date:    TODAY,
            daily_count:   3,
            monthly_month: MONTH,
            monthly_count: 15,
          },
          error: null,
        }),
      }),
    });

    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' }, session: null },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setActionUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        daily:   expect.objectContaining({ count: 10 }),
        monthly: expect.objectContaining({ count: 50 }),
      }),
    );
  });

  it('uses server counts when they are higher than local counts', async () => {
    vi.mocked(getActionUsage).mockResolvedValueOnce({
      daily:   { date: TODAY, count: 0 },
      monthly: { month: MONTH, count: 0 },
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_date:    TODAY,
            daily_count:   15,
            monthly_month: MONTH,
            monthly_count: 100,
          },
          error: null,
        }),
      }),
    });

    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' }, session: null },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setActionUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        daily:   expect.objectContaining({ count: 15 }),
        monthly: expect.objectContaining({ count: 100 }),
      }),
    );
  });

  it('uses local daily count when higher but server monthly count when higher (independent)', async () => {
    vi.mocked(getActionUsage).mockResolvedValueOnce({
      daily:   { date: TODAY, count: 8 },
      monthly: { month: MONTH, count: 2 },
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_date:    TODAY,
            daily_count:   3,
            monthly_month: MONTH,
            monthly_count: 40,
          },
          error: null,
        }),
      }),
    });

    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' }, session: null },
      error: null,
    });

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setActionUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        daily:   expect.objectContaining({ count: 8 }),
        monthly: expect.objectContaining({ count: 40 }),
      }),
    );
  });
});

// ── syncUsageFromServer — lock compliance ─────────────────────────────────────

describe('syncUsageFromServer — lock compliance', () => {
  const TODAY = new Date().toISOString().slice(0, 10);
  const MONTH = new Date().toISOString().slice(0, 7);

  it('waits for in-flight locked operations on action_usage', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            daily_date:    TODAY,
            daily_count:   5,
            monthly_month: MONTH,
            monthly_count: 20,
          },
          error: null,
        }),
      }),
    });

    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' }, session: null },
      error: null,
    });

    let releaseLock!: () => void;
    const lockBarrier = new Promise<void>((res) => { releaseLock = res; });

    const lockHolder = withStorageLock('action_usage', async () => {
      await lockBarrier;
    });

    await Promise.resolve();
    await Promise.resolve();

    await signIn('test@example.com', 'password123');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setActionUsage).not.toHaveBeenCalled();

    releaseLock();
    await lockHolder;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setActionUsage).toHaveBeenCalledTimes(1);
  });
});

// ── mergeGuestOnSignIn clearGuestId failure ───────────────────────────────────

describe('mergeGuestOnSignIn clearGuestId safety', () => {
  it('does not throw when clearGuestId fails after a successful merge', async () => {
    vi.mocked(getGuestId).mockResolvedValueOnce('some-guest-uuid');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.mocked(clearGuestId).mockRejectedValueOnce(new Error('storage error'));
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user:    { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'jwt-abc123' },
      },
      error: null,
    });

    await expect(signIn('test@example.com', 'password123')).resolves.toMatchObject({ success: true });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(clearGuestId).toHaveBeenCalledTimes(1);
  });
});
