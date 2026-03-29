import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'
import { renderTestTemplate } from '@/lib/email/renderTestTemplate'

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = request.nextUrl.searchParams.get('template') || 'welcome'
  const { html } = renderTestTemplate(template)

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
