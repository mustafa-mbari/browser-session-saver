import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock cachePlanTier from action-tracker ────────────────────────────────────
vi.mock('@core/services/limits/action-tracker', () => ({
  cachePlanTier:     vi.fn(async () => undefined),
  getCachedPlanTier: vi.fn(async () => 'guest'),
  setActionUsage:    vi.fn(async () => undefined),
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
import { cachePlanTier } from '@core/services/limits/action-tracker';
import { getGuestId, clearGuestId } from '@core/services/guest.service';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to default authenticated state
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
    // cachePlanTier should not be called synchronously on failure
    // (fire-and-forget is only started on success)
    expect(cachePlanTier).not.toHaveBeenCalled();
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
    // Allow fire-and-forget microtasks to settle
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
});

// ── getSession ────────────────────────────────────────────────────────────────

describe('getSession', () => {
  it('returns the active session when signed in', async () => {
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe('user-123');
  });

  it('returns null when no session exists', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
    });
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
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
    });
    expect(await getUserId()).toBeNull();
  });
});

// ── isAuthenticated ───────────────────────────────────────────────────────────

describe('isAuthenticated', () => {
  it('returns true when a session exists', async () => {
    expect(await isAuthenticated()).toBe(true);
  });

  it('returns false when no session exists', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
    });
    expect(await isAuthenticated()).toBe(false);
  });
});

// ── getEmail ──────────────────────────────────────────────────────────────────

describe('getEmail', () => {
  it('returns the user email when authenticated', async () => {
    expect(await getEmail()).toBe('test@example.com');
  });

  it('returns null when not authenticated', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
    });
    expect(await getEmail()).toBeNull();
  });
});
