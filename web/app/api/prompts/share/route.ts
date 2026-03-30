import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Allow cross-origin requests from the Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, content, description, tags, compatibleModels } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('shared_prompts')
      .insert({
        prompt_title: title.trim(),
        prompt_content: content.trim(),
        prompt_description: description?.trim() ?? null,
        tags: Array.isArray(tags) ? tags : [],
        compatible_models: Array.isArray(compatibleModels) ? compatibleModels : [],
      })
      .select('id')
      .single()

    if (error) {
      console.error('[prompts/share] insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create share link' },
        { status: 500, headers: corsHeaders }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const url = `${siteUrl}/p/${data.id}`

    return NextResponse.json({ id: data.id, url }, { headers: corsHeaders })
  } catch (err) {
    console.error('[prompts/share] error:', err)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
