export type PlanTier = 'guest' | 'free' | 'pro' | 'lifetime';

export const PLAN_LIMITS: Record<PlanTier, { daily: number; monthly: number }> = {
  guest:    { daily: 3,  monthly: 20  },
  free:     { daily: 6,  monthly: 30  },
  pro:      { daily: 50, monthly: 500 },
  lifetime: { daily: 90, monthly: 900 },
};

export interface ActionUsage {
  /** ISO date string 'YYYY-MM-DD' */
  daily: { date: string; count: number };
  /** ISO month string 'YYYY-MM' */
  monthly: { month: string; count: number };
}

export interface LimitStatus {
  tier: PlanTier;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  dailyBlocked: boolean;
  monthlyBlocked: boolean;
}
