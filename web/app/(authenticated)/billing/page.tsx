export const dynamic = 'force-dynamic'

import { Crown, Zap, Check, X, Calendar, CreditCard, CheckCircle2, ArrowRight } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/services/auth'

type Plan = {
  id: string
  name: string
  price_monthly: number
  sync_enabled: boolean
  sessions_synced_limit: number | null
  tabs_per_session_limit: number | null
  total_tabs_limit: number | null
  folders_synced_limit: number | null
  tab_groups_synced_limit: number | null
  entries_per_folder_limit: number | null
  prompts_access_limit: number | null
  prompts_create_limit: number | null
  subs_synced_limit: number | null
  notes_limit: number | null
  todos_limit: number | null
  [key: string]: string | number | boolean | null
}

async function getBillingData(userId: string) {
  const supabase = await createServiceClient()
  const [userPlanRes, plansRes] = await Promise.all([
    supabase
      .from('user_plans')
      .select('plan_id, status, billing_cycle, current_period_end, stripe_subscription_id')
      .eq('user_id', userId)
      .single(),
    supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
  ])
  return {
    userPlan: userPlanRes.data,
    plans: (plansRes.data ?? []) as Plan[],
  }
}

function fmt(val: number | null) {
  if (val === null) return '∞'
  if (val === 0) return '—'
  return `${val}`
}

const QUOTA_ROWS = [
  { label: 'Sync across devices',      field: 'sync_enabled',             boolean: true },
  { label: 'Synced sessions',          field: 'sessions_synced_limit' },
  { label: 'Tabs per session',         field: 'tabs_per_session_limit' },
  { label: 'Unique tabs (global)',     field: 'total_tabs_limit' },
  { label: 'Synced folders',           field: 'folders_synced_limit' },
  { label: 'Tab group templates',      field: 'tab_groups_synced_limit' },
  { label: 'Entries per folder',       field: 'entries_per_folder_limit' },
  { label: 'Prompt library access',    field: 'prompts_access_limit' },
  { label: 'Create prompts',           field: 'prompts_create_limit' },
  { label: 'Tracked subscriptions',    field: 'subs_synced_limit' },
  { label: 'Notes widgets',            field: 'notes_limit' },
  { label: 'Todo items',               field: 'todos_limit' },
]

export default async function BillingPage() {
  const user = await requireAuth()
  const { userPlan, plans } = await getBillingData(user.id)

  const currentPlanId = userPlan?.plan_id ?? 'free'
  const currentPlan = plans.find(p => p.id === currentPlanId)

  const headerBg =
    currentPlanId === 'max' ? 'bg-purple-600' :
    currentPlanId === 'pro' ? 'bg-indigo-600' : 'bg-stone-600'

  return (
    <div className="max-w-6xl animate-fade-in pb-12">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Billing &amp; Plans</h1>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Current Plan Card */}
        <div className="flex-1">
          <div className="rounded-2xl border border-stone-200 dark:border-[var(--dark-border)] overflow-hidden shadow-sm">
            <div className={`p-6 text-white ${headerBg}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {currentPlanId === 'max'
                      ? <Crown className="h-4 w-4 opacity-80" />
                      : <Zap className="h-4 w-4 opacity-80" />}
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Current Plan</span>
                  </div>
                  <h2 className="text-2xl font-bold">{currentPlan?.name ?? 'Free'}</h2>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-white capitalize">
                  {(userPlan?.status ?? 'active').replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2 opacity-80 text-sm">
                <Calendar className="h-4 w-4" />
                {userPlan?.current_period_end
                  ? <span>Renews {new Date(userPlan.current_period_end).toLocaleDateString()}</span>
                  : <span>No credit card required</span>}
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-[var(--dark-card)] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[var(--dark-elevated)] border border-stone-100 dark:border-[var(--dark-border)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Status</div>
                  <div className="flex items-center gap-1.5 font-semibold text-stone-800 dark:text-stone-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Good Standing
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[var(--dark-elevated)] border border-stone-100 dark:border-[var(--dark-border)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Billing Cycle</div>
                  <div className="font-semibold text-stone-800 dark:text-stone-100 capitalize">
                    {userPlan?.billing_cycle ?? 'N/A'}
                  </div>
                </div>
              </div>
              {currentPlanId === 'free' && (
                <a
                  href="#plans"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                >
                  Upgrade Plan <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="flex-1">
          <div className="bg-white dark:bg-[var(--dark-card)] rounded-2xl border border-stone-200 dark:border-[var(--dark-border)] p-6 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-stone-800 dark:text-stone-100">Payment Method</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Default billing method</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-stone-100 dark:border-[var(--dark-border)] rounded-xl">
              {userPlan?.stripe_subscription_id
                ? <p className="text-sm text-stone-600 dark:text-stone-400">Managed via Stripe</p>
                : <p className="text-sm text-stone-400">No payment method set</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison Table */}
      <div id="plans">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4">Available Plans</h2>
        <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-card)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 dark:border-[var(--dark-border)]">
                <th className="text-left p-4 font-semibold text-stone-500 dark:text-stone-400 w-2/5">Feature</th>
                {plans.map(plan => (
                  <th key={plan.id} className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-bold ${plan.id === currentPlanId ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-800 dark:text-stone-100'}`}>
                        {plan.name}
                      </span>
                      <span className="text-xs font-normal text-stone-400">
                        {plan.price_monthly === 0 ? 'Free forever' : `$${plan.price_monthly}/mo`}
                      </span>
                      {plan.id === currentPlanId && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUOTA_ROWS.map((row, i) => (
                <tr key={row.field} className={i % 2 === 0 ? 'bg-stone-50/60 dark:bg-[var(--dark-elevated)]/40' : ''}>
                  <td className="p-4 text-stone-600 dark:text-stone-400">{row.label}</td>
                  {plans.map(plan => {
                    const val = (plan as Plan)[row.field]
                    return (
                      <td key={plan.id} className="p-4 text-center font-medium text-stone-800 dark:text-stone-200">
                        {row.boolean
                          ? (val
                            ? <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                            : <X className="h-4 w-4 text-stone-300 dark:text-stone-600 mx-auto" />)
                          : fmt(val as number | null)}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* CTA Row */}
              <tr className="border-t border-stone-100 dark:border-[var(--dark-border)]">
                <td className="p-4" />
                {plans.map(plan => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.id === currentPlanId ? (
                      <span className="text-xs text-stone-400">Current plan</span>
                    ) : (
                      <a
                        href={`/checkout?plan=${plan.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                      >
                        {plan.price_monthly === 0 ? 'Downgrade' : 'Upgrade'}
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400 text-center">
          Yearly billing saves up to 20%. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
