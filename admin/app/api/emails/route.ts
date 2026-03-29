import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'
import { getEmailLogs, getEmailStats } from '@/lib/repositories/emailLogs'

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit  = Number(searchParams.get('limit'))  || 50
  const offset = Number(searchParams.get('offset')) || 0
  const type   = searchParams.get('type') || undefined

  const [{ logs, total }, stats] = await Promise.all([
    getEmailLogs(limit, offset, type),
    getEmailStats(),
  ])

  return NextResponse.json({ logs, total, stats })
}
