import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'
import { verifyConnection } from '@/lib/email/transporter'

export async function POST() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await verifyConnection()
  if (result.ok) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
}
