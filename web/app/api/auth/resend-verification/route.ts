import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildEmailVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin

  // Always return success — don't reveal whether the email exists.
  try {
    const serviceSupabase = await createServiceClient()

    const { data: linkData, error: linkError } =
      await serviceSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${siteUrl}/auth/confirm`,
        },
      })

    if (linkError || !linkData) {
      console.error('[resend-verification] generateLink failed:', linkError?.message)
      return NextResponse.json({ success: true })
    }

    const hashedToken = linkData.properties?.hashed_token
    if (!hashedToken) {
      console.error('[resend-verification] generateLink did not return hashed_token')
      return NextResponse.json({ success: true })
    }

    const verificationUrl =
      `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent('/dashboard')}`

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', linkData.user.id)
      .single()

    const { subject, html } = buildEmailVerificationEmail({
      verificationUrl,
      displayName: profile?.full_name ?? null,
    })

    sendEmail({
      to: email,
      subject,
      html,
      type: 'email_verification',
      metadata: { trigger: 'resend' },
    }).catch((err) => console.error('[resend-verification] sendEmail failed:', err))
  } catch (err) {
    console.error('[resend-verification] error:', err)
  }

  return NextResponse.json({ success: true })
}
