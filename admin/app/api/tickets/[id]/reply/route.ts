import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildTicketReplyEmail } from '@/lib/email'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const { message, status } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Verify admin session
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceSupabase = await createServiceClient()

    // Insert reply
    const { error: replyError } = await serviceSupabase
      .from('ticket_replies')
      .insert({
        ticket_id: ticketId,
        author_id: user.id,
        body:      message.trim(),
        is_internal: false,
      })

    if (replyError) {
      console.error('[tickets/reply] Insert error:', replyError)
      return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
    }

    // Update ticket status if provided
    if (status) {
      await serviceSupabase
        .from('tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
    }

    // Fetch ticket + user email for notification
    const { data: ticket } = await serviceSupabase
      .from('tickets')
      .select('subject, status, user_id, profiles:user_id(full_name), auth_users:user_id(email)')
      .eq('id', ticketId)
      .single()

    if (ticket) {
      // Get user email via auth admin API
      const { data: userData } = await serviceSupabase.auth.admin.getUserById(ticket.user_id)
      const userEmail = userData?.user?.email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userName  = (ticket.profiles as any)?.full_name ?? null

      if (userEmail) {
        const { subject: emailSubject, html } = buildTicketReplyEmail({
          userName,
          ticketSubject: ticket.subject,
          message: message.trim(),
          status: status || ticket.status,
        })

        sendEmail({
          to:       userEmail,
          subject:  emailSubject,
          html,
          type:     'ticket_reply',
          metadata: { ticket_id: ticketId, sent_by: user.id },
          sentBy:   user.id,
        }).catch((err) => console.error('[tickets/reply] sendEmail failed:', err))
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tickets/reply] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
