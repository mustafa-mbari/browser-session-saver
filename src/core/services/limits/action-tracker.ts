import type { PlanTier, ActionUsage, LimitStatus } from '@core/types/limits.types';
import { withStorageLock } from '@core/storage/storage-mutex';
import { getLimits } from './limits.service';

export class ActionLimitError extends Error {
  readonly status: LimitStatus;

  constructor(status: LimitStatus) {
    super('Action limit reached');
    this.name = 'ActionLimitError';
    this.status = status;
  }
}

export const USAGE_KEY = 'action_usage';
const PLAN_KEY         = 'cached_plan';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function getActionUsage(): Promise<ActionUsage> {
  const result = await chrome.storage.local.get(USAGE_KEY);
  const raw    = result[USAGE_KEY] as ActionUsage | undefined;
  const today  = todayDate();
  const month  = currentMonth();

  const daily   = raw?.daily?.date    === today ? { date: today, count: raw.daily.count ?? 0 }  : { date: today, count: 0 };
  const monthly = raw?.monthly?.month === month  ? { month,       count: raw.monthly.count ?? 0 } : { month,       count: 0 };

  return { daily, monthly };
}

export function incrementAction(count = 1): Promise<void> {
  return withStorageLock(USAGE_KEY, async () => {
    const usage   = await getActionUsage();
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
 *
 * Limits are resolved outside the storage lock to avoid blocking concurrent
 * increment calls during a potential network re-fetch (TTL cache miss).
 */
export async function checkAndIncrementAction(count = 1): Promise<void> {
  const tier   = await getCachedPlanTier();
  const limits = await getLimits(tier); // resolved outside the lock — may re-fetch from backend

  return withStorageLock(USAGE_KEY, async () => {
    const usage = await getActionUsage();

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
  const tier   = result[PLAN_KEY] as PlanTier | undefined;
  return tier ?? 'guest';
}

export async function cachePlanTier(tier: PlanTier): Promise<void> {
  await chrome.storage.local.set({ [PLAN_KEY]: tier });
}

export async function getLimitStatus(): Promise<LimitStatus> {
  const [usage, tier] = await Promise.all([getActionUsage(), getCachedPlanTier()]);
  const limits        = await getLimits(tier);

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

export async function canPerformAction(): Promise<boolean> {
  const status = await getLimitStatus();
  return !status.dailyBlocked && !status.monthlyBlocked;
}

export function isPremiumTier(tier: PlanTier): boolean {
  return tier === 'pro' || tier === 'lifetime';
}
