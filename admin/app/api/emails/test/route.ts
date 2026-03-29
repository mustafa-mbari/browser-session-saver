import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/services/auth'
import { sendEmail } from '@/lib/email'
import { renderTestTemplate } from '@/lib/email/renderTestTemplate'

const VALID_TEMPLATES = [
  'welcome', 'email_verification', 'password_reset', 'password_reset_confirmation',
  'billing_notification', 'invoice_receipt', 'trial_ending', 'ticket_reply', 'suggestion_reply',
]

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { to, template } = body

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 })
  }
  if (!template || !VALID_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
  }

  const { subject, html } = renderTestTemplate(template)

  const result = await sendEmail({
    to,
    subject: `[TEST] ${subject}`,
    html,
    type:     'test',
    metadata: { template },
    sentBy:   admin.user.id,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: result.messageId })
}
