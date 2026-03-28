import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_PLANS = ['free', 'pro', 'max'] as const
type PlanId = typeof VALID_PLANS[number]

export async function POST(request: Request) {
  const { plan_id } = await request.json() as { plan_id: PlanId }

  if (!VALID_PLANS.includes(plan_id)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('user_plans')
    .update({
      plan_id,
      status: 'active',
      source: 'admin_manual',
      billing_cycle: plan_id === 'free' ? null : 'monthly',
      current_period_start: new Date().toISOString(),
      current_period_end: plan_id === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
