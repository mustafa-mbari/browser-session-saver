import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAssignablePlans, planBadgeClass } from '@/lib/plans'

type PromoCode = {
  id: string
  code: string
  plan_id: string
  max_uses: number | null
  used_count: number
  is_active: boolean
  valid_until: string | null
  created_at: string
}

async function getPromos() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { promos: [] }
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('promo_codes')
    .select('id, code, plan_id, max_uses, used_count, is_active, valid_until, created_at')
    .order('created_at', { ascending: false })
  return { promos: (data ?? []) as PromoCode[] }
}

async function createPromo(formData: FormData) {
  'use server'
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  const supabase = await createServiceClient()
  const code = (formData.get('code') as string).trim().toUpperCase()
  const planId = formData.get('plan_id') as string
  const maxUsesRaw = formData.get('max_uses') as string
  const validUntil = formData.get('valid_until') as string

  try {
    const { error } = await supabase.from('promo_codes').insert({
      code,
      plan_id:     planId,
      max_uses:    maxUsesRaw ? parseInt(maxUsesRaw) : null,
      valid_until: validUntil || null,
      is_active:   true,
      used_count:  0,
    })
    if (error) throw error
    revalidatePath('/promos')
  } catch (err) {
    console.error('[createPromo]:', err)
  }
}

async function deactivatePromo(formData: FormData) {
  'use server'
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  const supabase = await createServiceClient()
  const id = formData.get('id') as string
  try {
    const { error } = await supabase.from('promo_codes').update({ is_active: false }).eq('id', id)
    if (error) throw error
    revalidatePath('/promos')
  } catch (err) {
    console.error('[deactivatePromo]:', err)
  }
}

export default async function PromosPage() {
  const [{ promos }, assignablePlans] = await Promise.all([getPromos(), getAssignablePlans()])
  // Promos are only useful for paid plans — exclude 'free' and 'guest'
  const promoPlanOptions = assignablePlans.filter(p => p.id !== 'free')
  const activeCount = promos.filter(p => p.is_active).length

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Promo Codes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Create Promo Code</h2>
            <form action={createPromo} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <input
                  id="code"
                  name="code"
                  required
                  placeholder="BROWSERHUB2026"
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200 uppercase font-mono"
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
                  {promoPlanOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_uses">Max Uses <span className="text-stone-400 font-normal">(blank = unlimited)</span></Label>
                <input
                  id="max_uses"
                  name="max_uses"
                  type="number"
                  min="1"
                  placeholder="100"
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valid_until">Valid Until <span className="text-stone-400 font-normal">(blank = never expires)</span></Label>
                <input
                  id="valid_until"
                  name="valid_until"
                  type="date"
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                />
              </div>
              <Button type="submit">Create Code</Button>
            </form>
          </CardContent>
        </Card>

        {/* Promo Codes List */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Promo Codes</h2>
                <Badge variant="secondary">{activeCount} active</Badge>
              </div>

              {promos.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No promo codes yet.' : 'Connect Supabase to see promo codes.'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map(promo => (
                      <TableRow key={promo.id}>
                        <TableCell className="font-mono font-semibold text-stone-800 dark:text-stone-100">
                          {promo.code}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${planBadgeClass(promo.plan_id)}`}>
                            {promo.plan_id}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-stone-600 dark:text-stone-400">
                          {promo.used_count}{promo.max_uses != null ? ` / ${promo.max_uses}` : ''}
                        </TableCell>
                        <TableCell className="text-sm text-stone-500 dark:text-stone-400">
                          {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : '∞'}
                        </TableCell>
                        <TableCell>
                          {promo.is_active ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                              Inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {promo.is_active && (
                            <form action={deactivatePromo}>
                              <input type="hidden" name="id" value={promo.id} />
                              <button type="submit" className="text-xs text-rose-500 hover:underline">
                                Deactivate
                              </button>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
