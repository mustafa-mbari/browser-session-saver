import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, EmailType } from '@/lib/email'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const supabase = await createServiceClient()
    // Admin API routes are protected by middleware — no extra check needed here,
    // but we validate the request body before sending.

    const { to, subject, html } = await request.json()

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 })
    }

    const result = await sendEmail({
      to,
      subject,
      html,
      type: 'test' as EmailType,
      metadata: { source: 'admin_panel' },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (err) {
    console.error('[admin/emails/send]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
