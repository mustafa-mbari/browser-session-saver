import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Zap, Layers, Sparkles, UserPlus, LayoutGrid } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { planBadgeClass } from '@/lib/plans'

type Overview = {
  total_users: number
  free_users: number
  pro_users: number
  lifetime_users: number
  total_sessions: number
  total_prompts: number
  total_tab_groups: number
}

type RecentUser = {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
  user_plans: { plan_id: string }[]
}

async function getOverviewData() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { overview: null, recentUsers: [] }
  const supabase = await createServiceClient()
  const [overviewRes, recentRes] = await Promise.all([
    supabase.rpc('get_admin_overview'),
    supabase
      .from('profiles')
      .select('id, email, display_name, created_at, user_plans(plan_id)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  return {
    overview: (overviewRes.data?.[0] ?? null) as Overview | null,
    recentUsers: (recentRes.data ?? []) as RecentUser[],
  }
}

export default async function AdminOverviewPage() {
  const { overview, recentUsers } = await getOverviewData()

  const stats = [
    { label: 'Total Users',   value: overview?.total_users?.toString() ?? '—',   icon: Users,    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',  iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Lifetime Users', value: overview?.lifetime_users?.toString() ?? '—', icon: Crown,    iconBg: 'bg-purple-100 dark:bg-purple-900/30',  iconColor: 'text-purple-600 dark:text-purple-400' },
    { label: 'Pro Users',     value: overview?.pro_users?.toString() ?? '—',     icon: Zap,      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Free Users',    value: overview?.free_users?.toString() ?? '—',    icon: UserPlus, iconBg: 'bg-stone-100 dark:bg-stone-800',         iconColor: 'text-stone-600 dark:text-stone-400' },
    { label: 'Sessions',      value: overview?.total_sessions?.toString()   ?? '—', icon: Layers,      iconBg: 'bg-amber-100 dark:bg-amber-900/30',    iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Prompts',       value: overview?.total_prompts?.toString()    ?? '—', icon: Sparkles,    iconBg: 'bg-rose-100 dark:bg-rose-900/30',      iconColor: 'text-rose-600 dark:text-rose-400' },
    { label: 'Tab Groups',    value: overview?.total_tab_groups?.toString() ?? '—', icon: LayoutGrid,  iconBg: 'bg-sky-100 dark:bg-sky-900/30',        iconColor: 'text-sky-600 dark:text-sky-400' },
  ]

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg} mb-3`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">{stat.label}</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Recent Sign-ups</h2>
            <Badge variant="secondary">Latest 10</Badge>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No users yet.' : 'Connect Supabase to see real data.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUsers.map(user => {
                  const planId = user.user_plans?.[0]?.plan_id ?? 'free'
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium text-stone-800 dark:text-stone-100">{user.display_name || '—'}</p>
                        <p className="text-xs text-stone-400">{user.email}</p>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${planBadgeClass(planId)}`}>
                          {planId}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-stone-500 dark:text-stone-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
