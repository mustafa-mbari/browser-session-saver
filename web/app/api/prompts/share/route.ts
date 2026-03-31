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
    const {
      title,
      content,
      description,
      tags,
      compatibleModels,
      creatorName,
      sharedByName,
      sourcePromptId,
    } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabase = await createServiceClient()

    const row = {
      prompt_title: title.trim(),
      prompt_content: content.trim(),
      prompt_description: description?.trim() ?? null,
      tags: Array.isArray(tags) ? tags : [],
      compatible_models: Array.isArray(compatibleModels) ? compatibleModels : [],
      shared_by_name:
        typeof sharedByName === 'string' && sharedByName.trim()
          ? sharedByName.trim()
          : null,
      creator_name:
        typeof creatorName === 'string' && creatorName.trim()
          ? creatorName.trim()
          : null,
      ...(sourcePromptId ? { source_prompt_id: String(sourcePromptId) } : {}),
    }

    let data: { id: string } | null
    let error: { message: string } | null

    if (sourcePromptId) {
      // Upsert on source_prompt_id so resharing the same prompt returns the same URL
      // view_count is not in the row so it is preserved on conflict-update
      const result = await supabase
        .from('shared_prompts')
        .upsert(row, { onConflict: 'source_prompt_id' })
        .select('id')
        .single()
      data = result.data as { id: string } | null
      error = result.error as { message: string } | null
    } else {
      // Legacy path — no sourcePromptId provided (old extension versions)
      const result = await supabase
        .from('shared_prompts')
        .insert(row)
        .select('id')
        .single()
      data = result.data as { id: string } | null
      error = result.error as { message: string } | null
    }

    if (error || !data) {
      console.error('[prompts/share] upsert/insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create share link' },
        { status: 500, headers: corsHeaders }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const url = sourcePromptId
      ? `${siteUrl}/prompts/${sourcePromptId}`
      : `${siteUrl}/p/${data.id}`

    return NextResponse.json({ id: data.id, url }, { headers: corsHeaders })
  } catch (err) {
    console.error('[prompts/share] error:', err)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
