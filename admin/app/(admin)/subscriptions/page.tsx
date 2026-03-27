import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type UserPlanRow = {
  id: string
  plan_id: string
  status: string
  billing_cycle: string | null
  current_period_end: string | null
  source: string
  updated_at: string
  profiles: { email: string | null; display_name: string | null } | null
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  pro:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  max:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  canceled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

async function getSubscriptions(planFilter?: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { rows: [], counts: { total: 0, pro: 0, max: 0, free: 0 } }
  const supabase = await createServiceClient()

  const [allRes, rowsRes] = await Promise.all([
    supabase.from('user_plans').select('plan_id').eq('status', 'active'),
    (() => {
      let q = supabase
        .from('user_plans')
        .select('id, plan_id, status, billing_cycle, current_period_end, source, updated_at, profiles(email, display_name)')
        .order('updated_at', { ascending: false })
        .limit(50)
      if (planFilter) q = q.eq('plan_id', planFilter)
      return q
    })(),
  ])

  const all = allRes.data ?? []
  return {
    rows: (rowsRes.data ?? []) as unknown as UserPlanRow[],
    counts: {
      total: all.length,
      free:  all.filter(r => r.plan_id === 'free').length,
      pro:   all.filter(r => r.plan_id === 'pro').length,
      max:   all.filter(r => r.plan_id === 'max').length,
    },
  }
}

async function grantSubscription(formData: FormData) {
  'use server'
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  const email  = (formData.get('email') as string).trim().toLowerCase()
  const planId = formData.get('plan_id') as string
  const supabase = await createServiceClient()

  // Look up user by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) return // User not found

  await supabase.from('user_plans')
    .update({ plan_id: planId, status: 'active', source: 'admin_manual' })
    .eq('user_id', profile.id)

  revalidatePath('/subscriptions')
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const planFilter = params.plan
  const { rows, counts } = await getSubscriptions(planFilter)

  const FILTER_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'max', label: 'Max' },
  ]

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Subscriptions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grant Form */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Grant Plan</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
              Override a user&apos;s plan without requiring Stripe payment.
            </p>
            <form action={grantSubscription} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">User Email</Label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan_id">Plan</Label>
                <select
                  id="plan_id"
                  name="plan_id"
                  required
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                >
                  <option value="pro">Pro</option>
                  <option value="max">Max</option>
                  <option value="free">Free (downgrade)</option>
                </select>
              </div>
              <Button type="submit">Grant Access</Button>
            </form>

            {/* Summary */}
            <div className="mt-6 space-y-2 pt-5 border-t border-stone-100 dark:border-[var(--dark-border)]">
              <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Plan Summary</h3>
              {[
                { label: 'Free users', count: counts.free, color: 'bg-stone-400' },
                { label: 'Pro users',  count: counts.pro,  color: 'bg-indigo-500' },
                { label: 'Max users',  count: counts.max,  color: 'bg-purple-500' },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">{item.label}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-100">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">User Plans</h2>
                <div className="flex gap-2">
                  {FILTER_OPTIONS.map(opt => (
                    <a
                      key={opt.value}
                      href={opt.value ? `?plan=${opt.value}` : '?'}
                      className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                        (planFilter ?? '') === opt.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {opt.label}
                    </a>
                  ))}
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No subscriptions found.' : 'Connect Supabase to see subscription data.'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium text-stone-800 dark:text-stone-100">{row.profiles?.display_name || '—'}</p>
                          <p className="text-xs text-stone-400">{row.profiles?.email}</p>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_COLOR[row.plan_id] ?? PLAN_COLOR.free}`}>
                            {row.plan_id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[row.status] ?? STATUS_COLOR.active}`}>
                            {row.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-stone-500 dark:text-stone-400 capitalize">
                          {row.source?.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-right text-sm text-stone-500 dark:text-stone-400">
                          {row.current_period_end ? new Date(row.current_period_end).toLocaleDateString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {counts.total > 50 && (
                <p className="mt-3 text-xs text-stone-400 text-center">Showing first 50 of {counts.total} records.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
