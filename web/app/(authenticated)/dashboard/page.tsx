export const dynamic = 'force-dynamic'

import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, CalendarClock, Crown, Zap, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/services/auth'

async function getUserData(userId: string) {
  const supabase = await createClient()

  const [tierRes, usageRes] = await Promise.all([
    supabase.rpc('get_user_plan_tier', { p_user_id: userId }),
    supabase.from('user_action_usage').select('*').eq('user_id', userId).maybeSingle(),
  ])

  return {
    tier: tierRes.data?.[0] ?? null,
    usage: usageRes.data ?? null,
  }
}

const PLAN_BADGE: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  guest:    { label: 'Guest',    color: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300',          icon: Zap },
  free:     { label: 'Free',     color: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300',          icon: Zap },
  pro:      { label: 'Pro',      color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',   icon: Zap },
  lifetime: { label: 'Lifetime', color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',   icon: Crown },
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const { tier, usage } = await getUserData(user.id)

  const planId: string  = tier?.tier ?? 'free'
  const dailyLimit: number   = tier?.daily_action_limit  ?? 6
  const monthlyLimit: number = tier?.monthly_action_limit ?? 30

  // Determine whether the stored date/month is still current; reset to 0 if stale
  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const dailyUsed: number   = (usage?.daily_date   === today     ? usage.daily_count   : 0) ?? 0
  const monthlyUsed: number = (usage?.monthly_month === thisMonth ? usage.monthly_count : 0) ?? 0

  const badge = PLAN_BADGE[planId] ?? PLAN_BADGE.free
  const BadgeIcon = badge.icon

  const dailyPct   = dailyLimit   > 0 ? Math.min(100, Math.round((dailyUsed   / dailyLimit)   * 100)) : 0
  const monthlyPct = monthlyLimit > 0 ? Math.min(100, Math.round((monthlyUsed / monthlyLimit) * 100)) : 0

  function barColor(pct: number) {
    if (pct >= 90) return 'bg-rose-500'
    if (pct >= 70) return 'bg-amber-500'
    return 'bg-indigo-500'
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Dashboard</h1>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
          <BadgeIcon className="h-3 w-3" />
          {badge.label} Plan
        </span>
      </div>

      {/* Plan Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Action Limits</p>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
            An action is any create, edit, or delete on a session, bookmark, todo, prompt,
            subscription, tab group, or quick link. Limits reset at midnight.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Daily */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                <span className="text-sm text-stone-600 dark:text-stone-400">Today</span>
                <span className="ml-auto text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {dailyUsed} <span className="font-normal text-stone-400">/ {dailyLimit}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 dark:bg-[var(--dark-elevated)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(dailyPct)}`}
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
              {dailyPct >= 90 && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Daily limit almost reached</p>
              )}
            </div>
            {/* Monthly */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                <span className="text-sm text-stone-600 dark:text-stone-400">This month</span>
                <span className="ml-auto text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {monthlyUsed} <span className="font-normal text-stone-400">/ {monthlyLimit}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 dark:bg-[var(--dark-elevated)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(monthlyPct)}`}
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
              {monthlyPct >= 90 && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Monthly limit almost reached</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA for free users */}
      {(planId === 'free' || planId === 'guest') && (
        <Card className="border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Crown className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                  Get more actions with Pro or Lifetime
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                  Pro: 50/day, 500/month · Lifetime: 90/day, 900/month
                </p>
                <a
                  href="/billing"
                  className="inline-block mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View plans →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
