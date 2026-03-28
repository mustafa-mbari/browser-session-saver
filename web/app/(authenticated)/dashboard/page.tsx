export const dynamic = 'force-dynamic'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Layers, Sparkles, FolderOpen, CreditCard, Crown, Zap, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/services/auth'

async function getUserData(userId: string) {
  const supabase = await createClient()

  const [quotaRes, usageRes] = await Promise.all([
    supabase.rpc('get_user_quota', { p_user_id: userId }),
    supabase.rpc('get_user_usage', { p_user_id: userId }),
  ])

  return {
    quota: quotaRes.data?.[0] ?? null,
    usage: usageRes.data?.[0] ?? null,
  }
}

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  free:  { label: 'Free',  color: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300' },
  pro:   { label: 'Pro',   color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' },
  max:   { label: 'Max',   color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const { quota, usage } = await getUserData(user.id)

  const planBadge = PLAN_BADGE[quota?.plan_id ?? 'free']

  const stats = [
    {
      label: 'Synced Sessions',
      value: usage?.synced_sessions?.toString() ?? '0',
      limit: quota?.sessions_synced_limit,
      icon: Layers,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Synced Prompts',
      value: usage?.synced_prompts?.toString() ?? '0',
      limit: quota?.prompts_create_limit,
      icon: Sparkles,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Synced Folders',
      value: usage?.synced_folders?.toString() ?? '0',
      limit: quota?.folders_synced_limit,
      icon: FolderOpen,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Tracked Subscriptions',
      value: usage?.synced_subs?.toString() ?? '0',
      limit: quota?.subs_synced_limit,
      icon: CreditCard,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Dashboard</h1>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${planBadge.color}`}>
          {quota?.plan_id === 'max' ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
          {planBadge.label} Plan
        </span>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => {
          const pct = stat.limit != null && Number(stat.value) > 0
            ? Math.min(100, Math.round((Number(stat.value) / stat.limit) * 100))
            : null

          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                      {stat.value}
                      {stat.limit != null && (
                        <span className="text-sm font-normal text-stone-400 dark:text-stone-500 ml-1">
                          / {stat.limit}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Progress bar when near limit */}
                {pct !== null && (
                  <div className="h-1.5 rounded-full bg-stone-100 dark:bg-[var(--dark-elevated)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Sync Status */}
      {!quota?.sync_enabled && (
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Sync is disabled on the Free plan</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Upgrade to Pro or Max to sync sessions, prompts, folders, and subscriptions across devices.
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
