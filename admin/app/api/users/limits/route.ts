import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'

async function resolveUserId(serviceSupabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServiceClient>>, email: string) {
  const { data: users, error } = await serviceSupabase.auth.admin.listUsers()
  if (error) return { userId: null, error: error.message }
  const user = users.users.find(u => u.email?.toLowerCase() === email)
  return user ? { userId: user.id, error: null } : { userId: null, error: 'User not found' }
}

// POST — upsert per-user override
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const daily   = body?.daily_action_limit   != null ? Number(body.daily_action_limit)   : null
  const monthly = body?.monthly_action_limit != null ? Number(body.monthly_action_limit) : null
  const reason  = typeof body?.reason === 'string' ? body.reason.trim() : null

  if (daily !== null && (isNaN(daily) || daily < 1)) {
    return NextResponse.json({ error: 'daily_action_limit must be a positive integer' }, { status: 400 })
  }
  if (monthly !== null && (isNaN(monthly) || monthly < 1)) {
    return NextResponse.json({ error: 'monthly_action_limit must be a positive integer' }, { status: 400 })
  }

  const { serviceSupabase, user: adminUser } = auth
  const { userId, error: lookupErr } = await resolveUserId(serviceSupabase, email)
  if (!userId) return NextResponse.json({ error: lookupErr }, { status: 404 })

  const { error } = await serviceSupabase
    .from('user_action_overrides')
    .upsert({
      user_id: userId,
      daily_action_limit: daily,
      monthly_action_limit: monthly,
      reason,
      set_by: adminUser.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE — remove override (revert to plan defaults)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const { serviceSupabase } = auth
  const { userId, error: lookupErr } = await resolveUserId(serviceSupabase, email)
  if (!userId) return NextResponse.json({ error: lookupErr }, { status: 404 })

  const { error } = await serviceSupabase
    .from('user_action_overrides')
    .delete()
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
