import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildSupportTicketEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subject, body, issueType, priority } = await request.json()

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()

    // Insert the ticket
    const { data: ticket, error: insertError } = await serviceSupabase
      .from('tickets')
      .insert({
        user_id:    user.id,
        subject:    subject.trim(),
        body:       body.trim(),
        issue_type: issueType || 'other',
        priority:   priority || 'medium',
        status:     'open',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[support] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to submit ticket' }, { status: 500 })
    }

    // Fetch user profile for personalisation
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const supportEmail = process.env.SMTP_SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || 'support@browserhub.app'

    const { subject: emailSubject, html } = buildSupportTicketEmail({
      userName:    profile?.full_name ?? null,
      userEmail:   user.email!,
      issueType:   issueType || 'other',
      subject:     subject.trim(),
      description: body.trim(),
      priority:    priority || 'medium',
    })

    // Fire-and-forget — don't block the API response
    sendEmail({
      to:       supportEmail,
      subject:  emailSubject,
      html,
      type:     'support_ticket',
      metadata: { ticket_id: ticket?.id, user_id: user.id },
    }).catch((err) => console.error('[support] sendEmail failed:', err))

    return NextResponse.json({ success: true, ticketId: ticket?.id })
  } catch (err) {
    console.error('[support] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
