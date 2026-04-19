import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const { serviceSupabase } = auth

  // Resolve auth user by email
  const { data: users, error: listErr } = await serviceSupabase.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const authUser = users.users.find(u => u.email?.toLowerCase() === email)
  if (!authUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const userId = authUser.id

  // Fetch plan, override, and usage in parallel
  const [planRes, overrideRes, usageRes] = await Promise.all([
    serviceSupabase
      .from('user_plans')
      .select('plan_id, plans(daily_action_limit, monthly_action_limit)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    serviceSupabase
      .from('user_action_overrides')
      .select('daily_action_limit, monthly_action_limit, reason')
      .eq('user_id', userId)
      .maybeSingle(),
    serviceSupabase
      .from('user_action_usage')
      .select('daily_date, daily_count, monthly_month, monthly_count')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const plan = (planRes.data?.plan_id as string | null) ?? 'free'
  const planLimits = (planRes.data as { plans?: { daily_action_limit?: number; monthly_action_limit?: number } | null })?.plans
  const planDaily   = planLimits?.daily_action_limit   ?? 6
  const planMonthly = planLimits?.monthly_action_limit ?? 30

  const override = overrideRes.data
  const effectiveDaily   = override?.daily_action_limit   ?? planDaily
  const effectiveMonthly = override?.monthly_action_limit ?? planMonthly

  const today = new Date().toISOString().slice(0, 10)
  const month = new Date().toISOString().slice(0, 7)
  const usage = usageRes.data
  const dailyUsed   = usage?.daily_date   === today ? (usage.daily_count   ?? 0) : 0
  const monthlyUsed = usage?.monthly_month === month ? (usage.monthly_count ?? 0) : 0

  return NextResponse.json({
    user_id:          userId,
    email:            authUser.email ?? email,
    plan,
    effective_daily:   effectiveDaily,
    effective_monthly: effectiveMonthly,
    daily_used:        dailyUsed,
    monthly_used:      monthlyUsed,
    override_daily:    override?.daily_action_limit   ?? null,
    override_monthly:  override?.monthly_action_limit ?? null,
    override_reason:   override?.reason               ?? null,
  })
}
