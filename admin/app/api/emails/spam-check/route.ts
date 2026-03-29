import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { html, options } = body

  if (!html || typeof html !== 'string' || html.length < 1 || html.length > 200_000) {
    return NextResponse.json({ error: 'Invalid HTML content' }, { status: 400 })
  }

  try {
    const res = await fetch('https://spamcheck.postmarkapp.com/filter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ email: html, options: options || 'long' }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Spamcheck API unavailable' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach spamcheck service' }, { status: 502 })
  }
}
