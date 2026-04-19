import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const { serviceSupabase } = auth

  // Resolve user id from email
  const { data: users, error: listErr } = await serviceSupabase.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const user = users.users.find(u => u.email?.toLowerCase() === email)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { error } = await serviceSupabase
    .from('user_action_usage')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
