import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'
import { getDailyEmailCounts, getEmailCountByType, getRecentFailures } from '@/lib/repositories/emailLogs'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [daily, byType, recentFailures] = await Promise.all([
    getDailyEmailCounts(30),
    getEmailCountByType(),
    getRecentFailures(5),
  ])

  return NextResponse.json({ daily, byType, recentFailures })
}
