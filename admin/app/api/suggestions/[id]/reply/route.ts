import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildSuggestionReplyEmail } from '@/lib/email'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: suggestionId } = await params
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

    // Update suggestion with admin notes and status
    const updateData: Record<string, string> = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    updateData.admin_notes = message.trim()

    const { error: updateError } = await serviceSupabase
      .from('suggestions')
      .update(updateData)
      .eq('id', suggestionId)

    if (updateError) {
      console.error('[suggestions/reply] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
    }

    // Fetch suggestion + user for notification
    const { data: suggestion } = await serviceSupabase
      .from('suggestions')
      .select('title, status, user_id, profiles:user_id(full_name)')
      .eq('id', suggestionId)
      .single()

    if (suggestion?.user_id) {
      const { data: userData } = await serviceSupabase.auth.admin.getUserById(suggestion.user_id)
      const userEmail = userData?.user?.email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userName  = (suggestion.profiles as any)?.full_name ?? null

      if (userEmail) {
        const { subject, html } = buildSuggestionReplyEmail({
          userName,
          suggestionTitle: suggestion.title,
          message: message.trim(),
          status: status || suggestion.status,
        })

        sendEmail({
          to:       userEmail,
          subject,
          html,
          type:     'suggestion_reply',
          metadata: { suggestion_id: suggestionId, sent_by: user.id },
          sentBy:   user.id,
        }).catch((err) => console.error('[suggestions/reply] sendEmail failed:', err))
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[suggestions/reply] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
