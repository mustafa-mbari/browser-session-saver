import type { PlanTier, ActionUsage, LimitStatus } from '@core/types/limits.types';
import { PLAN_LIMITS } from '@core/types/limits.types';

const USAGE_KEY = 'action_usage';
const PLAN_KEY = 'cached_plan';

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

export async function incrementAction(count = 1): Promise<void> {
  const usage = await getActionUsage();
  const updated: ActionUsage = {
    daily:   { ...usage.daily,   count: usage.daily.count + count },
    monthly: { ...usage.monthly, count: usage.monthly.count + count },
  };
  await chrome.storage.local.set({ [USAGE_KEY]: updated });
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
  const limits = PLAN_LIMITS[tier];
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
