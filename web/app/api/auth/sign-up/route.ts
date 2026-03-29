import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildEmailVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const { email, password, displayName } = await request.json()
  const origin = request.nextUrl.origin

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookiesToSet: any[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll: (cookies: any[]) => { cookiesToSet.push(...cookies) },
      },
    }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin
  if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === 'production') {
    console.error('[sign-up] NEXT_PUBLIC_SITE_URL is not set — auth redirect will break in production')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (data.user && data.user.identities?.length === 0) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please sign in instead.' },
      { status: 409 }
    )
  }

  // Send verification email via our own SMTP instead of Supabase's built-in email.
  // Fire-and-forget so we don't block the signup response.
  sendVerificationEmail(email, displayName || null, siteUrl).catch(
    (err) => console.error('[sign-up] Failed to send verification email:', err)
  )

  const response = NextResponse.json({ success: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cookiesToSet.forEach(({ name, value, options }: any) => response.cookies.set(name, value, options))
  return response
}

async function sendVerificationEmail(
  email: string,
  displayName: string | null,
  siteUrl: string
): Promise<void> {
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
    throw new Error(
      `generateLink failed: ${linkError?.message ?? 'no data returned'}`
    )
  }

  const hashedToken = linkData.properties?.hashed_token
  if (!hashedToken) {
    throw new Error('generateLink did not return hashed_token')
  }

  const verificationUrl =
    `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent('/dashboard')}`

  const { subject, html } = buildEmailVerificationEmail({
    verificationUrl,
    displayName,
  })

  const result = await sendEmail({
    to: email,
    subject,
    html,
    type: 'email_verification',
    metadata: { trigger: 'signup' },
  })

  if (!result.success) {
    throw new Error(`sendEmail failed: ${result.error}`)
  }
}
