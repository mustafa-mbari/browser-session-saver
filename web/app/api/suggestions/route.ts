import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildFeatureSuggestionEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, type, importance } = await request.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const serviceSupabase = await createServiceClient()

    // Insert the suggestion
    const { data: suggestion, error: insertError } = await serviceSupabase
      .from('suggestions')
      .insert({
        user_id:     user.id,
        title:       title.trim(),
        description: description?.trim() || null,
        type:        type || 'feature',
        importance:  importance || 'medium',
        status:      'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[suggestions] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to submit suggestion' }, { status: 500 })
    }

    // Fetch user profile for personalisation
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const toEmail = process.env.SMTP_FROM_EMAIL || 'info@browserhub.app'

    const { subject, html } = buildFeatureSuggestionEmail({
      userName:       profile?.full_name ?? null,
      userEmail:      user.email!,
      suggestionType: type || 'feature',
      title:          title.trim(),
      description:    description?.trim() || '',
      importance:     importance || 'medium',
    })

    // Fire-and-forget — don't block the API response
    sendEmail({
      to:       toEmail,
      subject,
      html,
      type:     'feature_suggestion',
      metadata: { suggestion_id: suggestion?.id, user_id: user.id },
    }).catch((err) => console.error('[suggestions] sendEmail failed:', err))

    return NextResponse.json({ success: true, suggestionId: suggestion?.id })
  } catch (err) {
    console.error('[suggestions] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
