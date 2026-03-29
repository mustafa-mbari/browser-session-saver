import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildPasswordResetConfirmationEmail } from '@/lib/email'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const { subject, html } = buildPasswordResetConfirmationEmail({
      displayName: profile?.full_name ?? null,
    })

    sendEmail({
      to: user.email!,
      subject,
      html,
      type: 'password_reset_confirmation',
      metadata: { user_id: user.id },
    }).catch((err) => console.error('[password-changed] sendEmail failed:', err))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[password-changed] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
