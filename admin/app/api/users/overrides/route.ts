import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'

export async function GET() {
  const auth = await requireAdminApi()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { serviceSupabase } = auth

  const { data, error } = await serviceSupabase
    .from('user_action_overrides')
    .select('user_id, daily_action_limit, monthly_action_limit, reason')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) return NextResponse.json([])

  // Resolve emails from auth.admin.listUsers
  const { data: users } = await serviceSupabase.auth.admin.listUsers()
  const emailMap = new Map((users?.users ?? []).map(u => [u.id, u.email ?? '']))

  // Resolve plan for each user
  const userIds = data.map(r => r.user_id)
  const { data: plans } = await serviceSupabase
    .from('user_plans')
    .select('user_id, plan_id')
    .in('user_id', userIds)
    .eq('status', 'active')

  const planMap = new Map((plans ?? []).map(p => [p.user_id, p.plan_id as string]))

  const result = data.map(row => ({
    user_id:          row.user_id,
    email:            emailMap.get(row.user_id) ?? '',
    plan:             planMap.get(row.user_id) ?? 'free',
    override_daily:   row.daily_action_limit   ?? null,
    override_monthly: row.monthly_action_limit ?? null,
    override_reason:  row.reason               ?? null,
  }))

  return NextResponse.json(result)
}
