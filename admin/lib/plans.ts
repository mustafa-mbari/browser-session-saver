import { createServiceClient } from './supabase/server'

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

// ── Badge styling ─────────────────────────────────────────────────────────────

const BADGE_CLASSES: Record<string, string> = {
  guest:    'bg-stone-50 text-stone-500 dark:bg-stone-900/50 dark:text-stone-400',
  free:     'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  pro:      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  lifetime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  max:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', // legacy fallback
}

/** Returns Tailwind badge classes for a plan ID. */
export function planBadgeClass(planId: string): string {
  return BADGE_CLASSES[planId] ?? BADGE_CLASSES.free
}

// ── Bar chart colors ──────────────────────────────────────────────────────────

const BAR_COLORS: Record<string, string> = {
  guest:    'bg-stone-300',
  free:     'bg-stone-400',
  pro:      'bg-indigo-500',
  lifetime: 'bg-purple-500',
  max:      'bg-purple-500', // legacy fallback
}

/** Returns a Tailwind bg-* class for use in plan distribution bar charts. */
export function planBarColor(planId: string): string {
  return BAR_COLORS[planId] ?? 'bg-stone-400'
}
