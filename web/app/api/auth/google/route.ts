import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === 'production') {
    console.error('[google-oauth] NEXT_PUBLIC_SITE_URL is not set — auth redirect will break in production')
  }

  let data: { url: string | null } | undefined
  let error: { message: string } | null = null
  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback` },
    })
    data = result.data
    error = result.error
  } catch (err) {
    console.error('[google-oauth] signInWithOAuth threw:', err)
    return NextResponse.redirect(new URL('/login?error=oauth_failed', siteUrl))
  }

  if (error || !data?.url) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', siteUrl))
  }

  return NextResponse.redirect(data.url)
}
