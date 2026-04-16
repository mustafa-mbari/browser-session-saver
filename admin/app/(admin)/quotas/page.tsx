import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type Plan = {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  daily_action_limit: number | null
  monthly_action_limit: number | null
}

const QUOTA_FIELDS: { key: keyof Plan; label: string; type: 'number' | 'price' }[] = [
  { key: 'price_monthly',          label: 'Price (monthly $)',      type: 'price' },
  { key: 'price_yearly',           label: 'Price (yearly $)',       type: 'price' },
  { key: 'daily_action_limit',     label: 'Actions per day',        type: 'number' },
  { key: 'monthly_action_limit',   label: 'Actions per month',      type: 'number' },
]

async function getPlans() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return []
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('plans')
    .select('id, name, price_monthly, price_yearly, daily_action_limit, monthly_action_limit')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as Plan[]
}

async function savePlan(formData: FormData) {
  'use server'
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  const supabase = await createServiceClient()
  const planId = formData.get('plan_id') as string

  function parseField(key: string, type: string) {
    const val = formData.get(`${planId}_${key}`) as string
    if (type === 'price') return parseFloat(val) || 0
    if (!val || val === '') return null
    const n = parseInt(val, 10)
    return isNaN(n) ? null : n
  }

  const updates: Record<string, unknown> = {}
  for (const field of QUOTA_FIELDS) {
    updates[field.key as string] = parseField(field.key as string, field.type)
  }

  try {
    const { error } = await supabase.from('plans').update(updates).eq('id', planId)
    if (error) throw error
    revalidatePath('/quotas')
  } catch (err) {
    console.error('[savePlan]:', err)
    redirect(`/quotas?error=${encodeURIComponent(String(err))}`)
  }
  redirect('/quotas?saved=1')
}

export default async function QuotasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const plans = await getPlans()

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">Quotas</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
        Edit per-plan action limits. Changes apply immediately to the extension.
        Blank = unlimited.
      </p>

      {params.saved && (
        <Card className="mb-4 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Plan limits saved successfully.</p>
          </CardContent>
        </Card>
      )}
      {params.error && (
        <Card className="mb-4 border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-rose-700 dark:text-rose-400">Save failed: {params.error}</p>
          </CardContent>
        </Card>
      )}

      {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
        <Card className="mb-4 border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Supabase not configured — showing placeholder. Connect Supabase to edit real plan quotas.
            </p>
          </CardContent>
        </Card>
      )}

      {plans.length === 0 && process.env.NEXT_PUBLIC_SUPABASE_URL && (
        <p className="text-sm text-stone-500 dark:text-stone-400">No active plans found.</p>
      )}

      {(plans.length > 0 || !process.env.NEXT_PUBLIC_SUPABASE_URL) && (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Setting</TableHead>
                  {plans.map(p => (
                    <TableHead key={p.id} className="text-center min-w-[140px] font-bold">
                      {p.name}
                    </TableHead>
                  ))}
                  {plans.length === 0 && (
                    <>
                      <TableHead className="text-center min-w-[140px]">Free</TableHead>
                      <TableHead className="text-center min-w-[140px]">Pro</TableHead>
                      <TableHead className="text-center min-w-[140px]">Lifetime</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {QUOTA_FIELDS.map((field, i) => (
                  <TableRow key={field.key} className={i % 2 === 0 ? 'bg-stone-50/60 dark:bg-[var(--dark-elevated)]/30' : ''}>
                    <TableCell className="font-medium text-stone-700 dark:text-stone-300 text-sm">
                      {field.label}
                    </TableCell>
                    {plans.map(plan => {
                      const val = plan[field.key]
                      return (
                        <TableCell key={plan.id} className="text-center">
                          <input
                            form={`form-${plan.id}`}
                            name={`${plan.id}_${field.key}`}
                            type="number"
                            step={field.type === 'price' ? '0.01' : '1'}
                            min="0"
                            defaultValue={val != null ? String(val) : ''}
                            placeholder="∞"
                            className="w-24 text-center rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-2 py-1 text-sm text-stone-800 dark:text-stone-200"
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
                {/* Save buttons row */}
                <TableRow>
                  <TableCell />
                  {plans.map(plan => (
                    <TableCell key={plan.id} className="text-center py-3">
                      <form id={`form-${plan.id}`} action={savePlan}>
                        <input type="hidden" name="plan_id" value={plan.id} />
                        <Button type="submit" size="sm">Save {plan.name}</Button>
                      </form>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
