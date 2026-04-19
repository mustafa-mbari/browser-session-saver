import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlans, planBarColor } from '@/lib/plans'

async function getStats() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  const supabase = await createServiceClient()

  const [totalRes, planRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_plans').select('plan_id').eq('status', 'active'),
  ])

  const planCounts: Record<string, number> = {}
  for (const row of planRes.data ?? []) {
    planCounts[row.plan_id] = (planCounts[row.plan_id] ?? 0) + 1
  }

  return { totalUsers: totalRes.count ?? 0, planCounts }
}

export default async function StatsPage() {
  const [stats, plans] = await Promise.all([getStats(), getPlans()])

  const metrics = [
    { label: 'Total Users', value: stats?.totalUsers?.toString() ?? '—', icon: Users, iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
  ]

  const totalPlanUsers = Object.values(stats?.planCounts ?? {}).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Statistics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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
              {plans.filter(p => p.id !== 'guest').map(p => {
                const count = stats.planCounts[p.id] ?? 0
                const pct = Math.round((count / totalPlanUsers) * 100)
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-stone-700 dark:text-stone-300">{p.name}</span>
                      <span className="text-stone-500 dark:text-stone-400">{count} users ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 dark:bg-[var(--dark-elevated)] overflow-hidden">
                      <div className={`h-full rounded-full ${planBarColor(p.id)} transition-all`} style={{ width: `${pct}%` }} />
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
