import { Card, CardContent } from '@/components/ui/card'
import { Users, Layers, Sparkles, Folder, CreditCard, BarChart3 } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'

type PlanCount = { plan_id: string; count: number }

async function getStats() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  const supabase = await createServiceClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [totalRes, planRes, sessionsRes, sessionsToday, promptsRes, foldersRes, subsRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_plans').select('plan_id').eq('status', 'active'),
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('prompts').select('*', { count: 'exact', head: true }),
    supabase.from('bookmark_folders').select('*', { count: 'exact', head: true }),
    supabase.from('tracked_subscriptions').select('*', { count: 'exact', head: true }),
  ])

  // Group plans
  const planCounts: Record<string, number> = {}
  for (const row of planRes.data ?? []) {
    planCounts[row.plan_id] = (planCounts[row.plan_id] ?? 0) + 1
  }

  return {
    totalUsers: totalRes.count ?? 0,
    planCounts,
    totalSessions: sessionsRes.count ?? 0,
    sessionsToday: sessionsToday.count ?? 0,
    totalPrompts: promptsRes.count ?? 0,
    totalFolders: foldersRes.count ?? 0,
    totalSubs: subsRes.count ?? 0,
  }
}

export default async function StatsPage() {
  const stats = await getStats()

  const metrics = [
    { label: 'Total Users',           value: stats?.totalUsers?.toString() ?? '—',       icon: Users,       iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',   iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Sessions Saved',  value: stats?.totalSessions?.toString() ?? '—',    icon: Layers,      iconBg: 'bg-amber-100 dark:bg-amber-900/30',     iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Sessions Today',        value: stats?.sessionsToday?.toString() ?? '—',    icon: BarChart3,   iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Total Prompts',         value: stats?.totalPrompts?.toString() ?? '—',     icon: Sparkles,    iconBg: 'bg-rose-100 dark:bg-rose-900/30',       iconColor: 'text-rose-600 dark:text-rose-400' },
    { label: 'Bookmark Folders',        value: stats?.totalFolders?.toString() ?? '—',     icon: Folder,      iconBg: 'bg-blue-100 dark:bg-blue-900/30',       iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Tracked Subscriptions', value: stats?.totalSubs?.toString() ?? '—',        icon: CreditCard,  iconBg: 'bg-purple-100 dark:bg-purple-900/30',   iconColor: 'text-purple-600 dark:text-purple-400' },
  ]

  const PLAN_BAR: Record<string, { label: string; color: string }> = {
    free: { label: 'Free',  color: 'bg-stone-400' },
    pro:  { label: 'Pro',   color: 'bg-indigo-500' },
    max:  { label: 'Max',   color: 'bg-purple-500' },
  }

  const totalPlanUsers = Object.values(stats?.planCounts ?? {}).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Statistics</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {metrics.map(m => (
          <Card key={m.label}>
            <CardContent className="pt-5 pb-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.iconBg} mb-3`}>
                <m.icon className={`h-4 w-4 ${m.iconColor}`} />
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">{m.label}</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Plan Distribution</h2>
          {!stats ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Connect Supabase to see real data.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(PLAN_BAR).map(([planId, { label, color }]) => {
                const count = stats.planCounts[planId] ?? 0
                const pct = Math.round((count / totalPlanUsers) * 100)
                return (
                  <div key={planId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-stone-700 dark:text-stone-300">{label}</span>
                      <span className="text-stone-500 dark:text-stone-400">{count} users ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 dark:bg-[var(--dark-elevated)] overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
