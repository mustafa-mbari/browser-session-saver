import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'
import { getSmtpConfig } from '@/lib/email/transporter'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(getSmtpConfig())
}
