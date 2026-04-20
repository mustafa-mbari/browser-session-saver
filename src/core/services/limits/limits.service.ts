import type { PlanTier } from '@core/types/limits.types';
import { PLAN_LIMITS } from '@core/types/limits.types';
import { supabase } from '@core/supabase/client';

const PLAN_LIMITS_KEY   = 'cached_plan_limits';
const GUEST_LIMITS_KEY  = 'cached_guest_limits';
const TTL               = 5 * 60 * 1000; // 5 minutes

type CachedPlanLimits = {
  daily: number;
  monthly: number;
  updatedAt: number;
};

function isExpired(cache: CachedPlanLimits): boolean {
  return Date.now() - cache.updatedAt > TTL;
}

/**
 * Returns the effective daily/monthly limits for a given tier.
 *
 * Resolution order for authenticated tiers:
 *   1. Valid (non-expired) TTL cache from a prior fetch
 *   2. Fresh fetch from the backend using the current session — result is cached
 *   3. Hardcoded PLAN_LIMITS fallback (offline / RPC error)
 *
 * For the guest tier the cache written by fetchAndCacheGuestLimits() at
 * service-worker startup is used; the TTL mechanism is intentionally skipped
 * because the guest RPC (get_guest_limits) does not require a user session and
 * is already called once at startup.
 */
export async function getLimits(tier: PlanTier): Promise<{ daily: number; monthly: number }> {
  if (tier === 'guest') {
    return resolveGuestLimits();
  }
  return resolveAuthLimits(tier);
}

/**
 * Force-fetches limits from the backend for `userId` and updates the TTL cache.
 * Called by auth.service on sign-in so limits are fresh immediately after login.
 */
export async function refreshLimits(userId: string): Promise<void> {
  await fetchAndStore(userId);
}

/**
 * Removes the cached plan limits entry.
 * Called by auth.service on sign-out so stale limits are not used after
 * switching accounts.
 */
export async function invalidateLimits(): Promise<void> {
  await chrome.storage.local.remove(PLAN_LIMITS_KEY);
}

/**
 * Fetches dynamic guest action limits from the Supabase plans table and caches
 * them under GUEST_LIMITS_KEY. Called once at service-worker startup.
 * Falls back to PLAN_LIMITS.guest if offline or RPC fails.
 */
export async function fetchAndCacheGuestLimits(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('get_guest_limits');
    if (error || !data?.length) return;
    const { daily_action_limit, monthly_action_limit } = data[0] as {
      daily_action_limit: number;
      monthly_action_limit: number;
    };
    await chrome.storage.local.set({
      [GUEST_LIMITS_KEY]: { daily: daily_action_limit, monthly: monthly_action_limit },
    });
  } catch {
    // Non-critical — PLAN_LIMITS.guest is the fallback
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function resolveGuestLimits(): Promise<{ daily: number; monthly: number }> {
  const result  = await chrome.storage.local.get(GUEST_LIMITS_KEY);
  const dynamic = result[GUEST_LIMITS_KEY] as { daily: number; monthly: number } | undefined;
  // Use != null so that an explicit 0 is accepted as a valid limit.
  if (dynamic?.daily != null && dynamic?.monthly != null) return dynamic;
  return PLAN_LIMITS.guest;
}

async function resolveAuthLimits(tier: PlanTier): Promise<{ daily: number; monthly: number }> {
  // 1. Check TTL cache.
  const result = await chrome.storage.local.get(PLAN_LIMITS_KEY);
  const cached = result[PLAN_LIMITS_KEY] as CachedPlanLimits | undefined;

  if (cached != null && !isExpired(cached)) {
    return { daily: cached.daily, monthly: cached.monthly };
  }

  // 2. Cache miss or expired — re-fetch using the current session.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await fetchAndStore(session.user.id);
      // Read what was just written so we return DB values, not the stale tier fallback.
      const fresh       = await chrome.storage.local.get(PLAN_LIMITS_KEY);
      const freshCached = fresh[PLAN_LIMITS_KEY] as CachedPlanLimits | undefined;
      if (freshCached != null) {
        return { daily: freshCached.daily, monthly: freshCached.monthly };
      }
    }
  } catch {
    // Non-critical — fall through to hardcoded fallback.
  }

  // 3. Offline / no session: fall back to compile-time constants.
  return PLAN_LIMITS[tier];
}

async function fetchAndStore(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('get_user_plan_tier', { p_user_id: userId });
    if (error || !data?.length) return;

    const row = data[0] as {
      tier?: string;
      daily_action_limit?: number;
      monthly_action_limit?: number;
    };

    // Use != null so that an admin-set limit of 0 is stored correctly.
    if (row?.daily_action_limit != null && row?.monthly_action_limit != null) {
      const entry: CachedPlanLimits = {
        daily:     row.daily_action_limit,
        monthly:   row.monthly_action_limit,
        updatedAt: Date.now(),
      };
      await chrome.storage.local.set({ [PLAN_LIMITS_KEY]: entry });
    }
  } catch {
    // Non-critical — caller falls back to PLAN_LIMITS[tier]
  }
}
