import type { PlanTier, ActionUsage, LimitStatus } from '@core/types/limits.types';
import { PLAN_LIMITS } from '@core/types/limits.types';
import { withStorageLock } from '@core/storage/storage-mutex';
import { supabase } from '@core/supabase/client';

export class ActionLimitError extends Error {
  readonly status: LimitStatus;

  constructor(status: LimitStatus) {
    super('Action limit reached');
    this.name = 'ActionLimitError';
    this.status = status;
  }
}

export const USAGE_KEY = 'action_usage';
const PLAN_KEY = 'cached_plan';
const GUEST_LIMITS_KEY = 'cached_guest_limits';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

export async function getActionUsage(): Promise<ActionUsage> {
  const result = await chrome.storage.local.get(USAGE_KEY);
  const raw = result[USAGE_KEY] as ActionUsage | undefined;
  const today = todayDate();
  const month = currentMonth();

  const daily = raw?.daily?.date === today
    ? { date: today, count: raw.daily.count ?? 0 }
    : { date: today, count: 0 };

  const monthly = raw?.monthly?.month === month
    ? { month, count: raw.monthly.count ?? 0 }
    : { month, count: 0 };

  return { daily, monthly };
}

export function incrementAction(count = 1): Promise<void> {
  return withStorageLock(USAGE_KEY, async () => {
    const usage = await getActionUsage();
    const updated: ActionUsage = {
      daily:   { ...usage.daily,   count: usage.daily.count + count },
      monthly: { ...usage.monthly, count: usage.monthly.count + count },
    };
    await chrome.storage.local.set({ [USAGE_KEY]: updated });
  });
}

/**
 * Atomically checks the limit and increments the counter in a single lock.
 * Throws ActionLimitError if incrementing by `count` would exceed the daily
 * or monthly limit. Called by guardAction — do NOT call incrementAction separately.
 */
export function checkAndIncrementAction(count = 1): Promise<void> {
  return withStorageLock(USAGE_KEY, async () => {
    const usage = await getActionUsage();
    const tier = await getCachedPlanTier();
    let limits = PLAN_LIMITS[tier];

    if (tier === 'guest') {
      const cached = await chrome.storage.local.get(GUEST_LIMITS_KEY);
      const dynamic = cached[GUEST_LIMITS_KEY] as { daily: number; monthly: number } | undefined;
      if (dynamic?.daily && dynamic?.monthly) limits = dynamic;
    }

    const dailyBlocked   = usage.daily.count + count > limits.daily;
    const monthlyBlocked = usage.monthly.count + count > limits.monthly;

    if (dailyBlocked || monthlyBlocked) {
      throw new ActionLimitError({
        tier,
        dailyUsed:    usage.daily.count,
        dailyLimit:   limits.daily,
        monthlyUsed:  usage.monthly.count,
        monthlyLimit: limits.monthly,
        dailyBlocked,
        monthlyBlocked,
      });
    }

    const updated: ActionUsage = {
      daily:   { ...usage.daily,   count: usage.daily.count + count },
      monthly: { ...usage.monthly, count: usage.monthly.count + count },
    };
    await chrome.storage.local.set({ [USAGE_KEY]: updated });
  });
}

export async function setActionUsage(usage: ActionUsage): Promise<void> {
  await chrome.storage.local.set({ [USAGE_KEY]: usage });
}

export async function getCachedPlanTier(): Promise<PlanTier> {
  const result = await chrome.storage.local.get(PLAN_KEY);
  const tier = result[PLAN_KEY] as PlanTier | undefined;
  return tier ?? 'guest';
}

export async function cachePlanTier(tier: PlanTier): Promise<void> {
  await chrome.storage.local.set({ [PLAN_KEY]: tier });
}

export async function getLimitStatus(): Promise<LimitStatus> {
  const [usage, tier] = await Promise.all([getActionUsage(), getCachedPlanTier()]);
  let limits = PLAN_LIMITS[tier];

  // For the guest tier, prefer dynamically cached limits fetched from Supabase at startup.
  // This allows the admin to adjust guest limits without a new extension release.
  if (tier === 'guest') {
    const cached = await chrome.storage.local.get(GUEST_LIMITS_KEY);
    const dynamic = cached[GUEST_LIMITS_KEY] as { daily: number; monthly: number } | undefined;
    if (dynamic?.daily && dynamic?.monthly) limits = dynamic;
  }

  return {
    tier,
    dailyUsed:      usage.daily.count,
    dailyLimit:     limits.daily,
    monthlyUsed:    usage.monthly.count,
    monthlyLimit:   limits.monthly,
    dailyBlocked:   usage.daily.count   >= limits.daily,
    monthlyBlocked: usage.monthly.count >= limits.monthly,
  };
}

/**
 * Fetches dynamic guest action limits from the Supabase plans table and caches them.
 * Called once at service worker startup. Falls back to PLAN_LIMITS.guest if offline.
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

export async function canPerformAction(): Promise<boolean> {
  const status = await getLimitStatus();
  return !status.dailyBlocked && !status.monthlyBlocked;
}
