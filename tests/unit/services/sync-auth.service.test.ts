import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';

// vi.mock factories are hoisted — use vi.hoisted() so mockAuth is initialized before the factory runs
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock('@core/supabase/client', () => ({
  supabase: { auth: mockAuth },
}));

import {
  syncSignIn,
  syncSignOut,
  getSyncSession,
  getSyncUserId,
  getSyncEmail,
  isSyncAuthenticated,
} from '@core/services/sync-auth.service';

function makeSession(overrides: Partial<User> = {}): Session {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      ...overrides,
    },
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 9999999999,
  } as unknown as Session;
}

describe('sync-auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── syncSignIn ────────────────────────────────────────────────────────────

  describe('syncSignIn', () => {
    it('returns success with email on successful sign-in', async () => {
      const session = makeSession();
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { user: session.user, session },
        error: null,
      });

      const result = await syncSignIn('test@example.com', 'password');
      expect(result.success).toBe(true);
      expect(result.email).toBe('test@example.com');
      expect(result.error).toBeUndefined();
    });

    it('returns failure with error message on failed sign-in', async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      const result = await syncSignIn('bad@email.com', 'wrong');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('falls back to the provided email if user.email is undefined', async () => {
      const session = makeSession({ email: undefined });
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { ...session.user, email: undefined }, session },
        error: null,
      });

      const result = await syncSignIn('fallback@example.com', 'pass');
      expect(result.success).toBe(true);
      expect(result.email).toBe('fallback@example.com');
    });
  });

  // ── syncSignOut ───────────────────────────────────────────────────────────

  describe('syncSignOut', () => {
    it('calls supabase.auth.signOut', async () => {
      mockAuth.signOut.mockResolvedValueOnce({ error: null });
      await syncSignOut();
      expect(mockAuth.signOut).toHaveBeenCalledOnce();
    });
  });

  // ── getSyncSession ────────────────────────────────────────────────────────

  describe('getSyncSession', () => {
    it('returns null when no session exists', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
      const result = await getSyncSession();
      expect(result).toBeNull();
    });

    it('returns the active session when authenticated', async () => {
      const session = makeSession();
      mockAuth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
      const result = await getSyncSession();
      expect(result?.user.id).toBe('user-123');
    });
  });

  // ── getSyncUserId ─────────────────────────────────────────────────────────

  describe('getSyncUserId', () => {
    it('returns null when not authenticated', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
      expect(await getSyncUserId()).toBeNull();
    });

    it('returns user id when authenticated', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: makeSession() }, error: null });
      expect(await getSyncUserId()).toBe('user-123');
    });
  });

  // ── getSyncEmail ──────────────────────────────────────────────────────────

  describe('getSyncEmail', () => {
    it('returns null when not authenticated', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
      expect(await getSyncEmail()).toBeNull();
    });

    it('returns email when authenticated', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: makeSession() }, error: null });
      expect(await getSyncEmail()).toBe('test@example.com');
    });
  });

  // ── isSyncAuthenticated ───────────────────────────────────────────────────

  describe('isSyncAuthenticated', () => {
    it('returns false when no session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
      expect(await isSyncAuthenticated()).toBe(false);
    });

    it('returns true when there is an active session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: makeSession() }, error: null });
      expect(await isSyncAuthenticated()).toBe(true);
    });
  });
});
