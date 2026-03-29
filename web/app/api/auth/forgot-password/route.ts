import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin

  if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === 'production') {
    console.error('[forgot-password] NEXT_PUBLIC_SITE_URL is not set — auth redirect will break in production')
  }

  // Always return success — don't reveal whether the email exists.
  try {
    const serviceSupabase = await createServiceClient()

    const { data: linkData, error: linkError } =
      await serviceSupabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${siteUrl}/auth/confirm?type=recovery`,
        },
      })

    if (linkError || !linkData) {
      console.error('[forgot-password] generateLink failed:', linkError?.message)
      return NextResponse.json({ success: true })
    }

    const hashedToken = linkData.properties?.hashed_token
    if (!hashedToken) {
      console.error('[forgot-password] generateLink did not return hashed_token')
      return NextResponse.json({ success: true })
    }

    const resetUrl =
      `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent('/reset-password')}`

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', linkData.user.id)
      .single()

    const { subject, html } = buildPasswordResetEmail({
      resetUrl,
      displayName: profile?.full_name ?? null,
    })

    sendEmail({
      to: email,
      subject,
      html,
      type: 'password_reset',
      metadata: { trigger: 'forgot_password' },
    }).catch((err) => console.error('[forgot-password] sendEmail failed:', err))
  } catch (err) {
    console.error('[forgot-password] error:', err)
  }

  return NextResponse.json({ success: true })
}
