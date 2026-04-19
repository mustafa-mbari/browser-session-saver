import type { Session } from '@supabase/supabase-js';
import { supabase } from '@core/supabase/client';
import type { PlanTier, ActionUsage } from '@core/types/limits.types';
import { cachePlanTier, setActionUsage } from '@core/services/limits/action-tracker';

export interface SignInResult {
  success: boolean;
  email?: string;
  error?: string;
}

/**
 * Sign in using email + password.
 * On success, fetches the user's plan tier and caches it locally.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: error.message };
  }
  // Cache plan tier and sync server-side usage counts so resets take effect immediately
  void fetchAndCachePlanTier(data.user?.id);
  void syncUsageFromServer(data.user?.id);
  return { success: true, email: data.user?.email ?? email };
}

/**
 * Sign out and clear the persisted auth session from chrome.storage.local.
 * Resets cached plan to 'guest'.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await cachePlanTier('guest');
}

/**
 * Return the current Supabase auth session, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Return the current authenticated user's ID, or null.
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Return true if there is a valid auth session.
 */
export async function isAuthenticated(): Promise<boolean> {
  const userId = await getUserId();
  return userId !== null;
}

/**
 * Return the current user's email address, or null.
 */
export async function getEmail(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.email ?? null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchAndCachePlanTier(userId: string | undefined): Promise<void> {
  if (!userId) {
    await cachePlanTier('guest');
    return;
  }
  try {
    const { data } = await supabase.rpc('get_user_plan_tier', { p_user_id: userId });
    const tier = mapPlanTier(data?.[0]?.tier);
    await cachePlanTier(tier);
  } catch {
    // Non-critical — keep existing cached tier
  }
}

async function syncUsageFromServer(userId: string | undefined): Promise<void> {
  if (!userId) return;
  try {
    const { data, error } = await supabase
      .from('user_action_usage')
      .select('daily_date, daily_count, monthly_month, monthly_count')
      .single();
    if (error || !data) return;
    const usage: ActionUsage = {
      daily:   { date: data.daily_date,     count: data.daily_count },
      monthly: { month: data.monthly_month, count: data.monthly_count },
    };
    await setActionUsage(usage);
  } catch {
    // Non-critical — local counts remain unchanged
  }
}

function mapPlanTier(raw: string | undefined): PlanTier {
  switch (raw) {
    case 'free':     return 'free';
    case 'pro':      return 'pro';
    case 'lifetime': return 'lifetime';
    default:         return 'free'; // signed-in users get free tier minimum
  }
}
