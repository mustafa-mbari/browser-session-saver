import { createServiceClient } from './supabase/server'
export { planBadgeClass, planBarColor } from './plan-utils'

export type Plan = { id: string; name: string; sort_order: number }

const FALLBACK_PLANS: Plan[] = [
  { id: 'guest',    name: 'Guest',    sort_order: -1 },
  { id: 'free',     name: 'Free',     sort_order: 0  },
  { id: 'pro',      name: 'Pro',      sort_order: 1  },
  { id: 'lifetime', name: 'Lifetime', sort_order: 2  },
]

/** All active plans ordered by sort_order. Falls back to static list when Supabase is not configured. */
export async function getPlans(): Promise<Plan[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return FALLBACK_PLANS
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('plans')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')
  return ((data ?? []) as Plan[]).length > 0 ? (data as Plan[]) : FALLBACK_PLANS
}

/** Plans that can be assigned to users — excludes 'guest' (no-account tier). */
export async function getAssignablePlans(): Promise<Plan[]> {
  const plans = await getPlans()
  return plans.filter(p => p.id !== 'guest')
}

