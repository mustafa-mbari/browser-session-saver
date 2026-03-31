import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/server'
import SharedPromptClient from '../../shared/SharedPromptClient'
import type { SharedPrompt } from '../../shared/SharedPromptClient'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('shared_prompts')
    .select('prompt_title, prompt_description')
    .eq('source_prompt_id', id)
    .single()

  if (!data) return { title: 'Shared Prompt — Browser Hub' }

  return {
    title: `${data.prompt_title} — Browser Hub`,
    description: data.prompt_description ?? `A shared prompt from Browser Hub`,
  }
}

export default async function SharedPromptPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: prompt, error } = await supabase
    .from('shared_prompts')
    .select('id, prompt_title, prompt_content, prompt_description, tags, compatible_models, shared_by_name, creator_name, view_count, created_at')
    .eq('source_prompt_id', id)
    .single()

  if (error || !prompt) {
    notFound()
  }

  // Increment view count — fire and forget (uses UUID PK)
  void Promise.resolve(
    supabase
      .from('shared_prompts')
      .update({ view_count: (prompt as SharedPrompt).view_count + 1 })
      .eq('id', (prompt as SharedPrompt).id)
  ).catch(() => {})

  return (
    <div className="min-h-screen bg-stone-50 dark:[background:linear-gradient(135deg,#0f0f1a_0%,#1a1030_50%,#0f0f1a_100%)]">
      {/* Top sticky marketing banner */}
      <div
        className="sticky top-0 z-50 text-white"
        style={{ background: 'linear-gradient(90deg, #625fff, #8b5cf6)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <Image
              src="/icons/browser-hub_logo.png"
              width={20}
              height={20}
              alt="Browser Hub"
              className="block shrink-0"
            />
            <span>
              Created with <strong>Browser Hub</strong> — your all-in-one browser productivity tool
            </span>
          </div>
          <a
            href="https://chromewebstore.google.com/detail/browser-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 bg-white text-sm font-semibold px-3 py-1 rounded-lg hover:bg-white/90 transition-colors"
            style={{ color: '#625fff' }}
          >
            Download Free →
          </a>
        </div>
      </div>

      {/* Main content */}
      <div className="px-[5%] py-10">
        <SharedPromptClient prompt={prompt as SharedPrompt} />
      </div>

      {/* Bottom marketing section */}
      <div className="mt-16 py-16 px-4 bg-stone-100 dark:[background:rgba(0,0,0,0.35)]">
        <div className="max-w-4xl mx-auto text-center">
          <Image
            src="/icons/browser-hub_logo.png"
            width={56}
            height={56}
            alt="Browser Hub"
            className="block mx-auto mb-6"
          />
          <h2 className="text-3xl font-bold mb-3 text-stone-900 dark:text-white">Browser Hub</h2>
          <p className="text-lg mb-10 max-w-2xl mx-auto text-stone-600 dark:text-white/50">
            Your all-in-one browser productivity tool. Save sessions, manage prompts, track
            subscriptions, and organize tab groups — all in one place.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 text-left max-w-2xl mx-auto">
            {[
              { icon: '💾', title: 'Session Manager', desc: 'Save and restore browser sessions instantly' },
              { icon: '✨', title: 'Prompt Library', desc: 'Build and share your AI prompt collection' },
              { icon: '💳', title: 'Subscription Tracker', desc: 'Never miss a renewal with smart reminders' },
              { icon: '🗂️', title: 'Tab Groups', desc: 'Save and restore your tab group layouts' },
              { icon: '🖥️', title: 'Smart Start Tab', desc: 'A beautiful, productive new tab experience' },
              { icon: '☁️', title: 'Cloud Sync', desc: 'Access your data across all your devices' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl p-4 flex gap-3 items-start bg-white border border-stone-200 dark:[background:rgba(98,95,255,0.08)] dark:[border-color:rgba(98,95,255,0.2)]"
              >
                <span className="text-xl shrink-0">{feature.icon}</span>
                <div>
                  <div className="font-semibold text-sm text-stone-900 dark:text-white">{feature.title}</div>
                  <div className="text-xs mt-0.5 text-stone-500 dark:text-white/40">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="https://chromewebstore.google.com/detail/browser-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold px-6 py-3 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #625fff, #8b5cf6)' }}
            >
              Download Extension Free
            </a>
            <a
              href="/register"
              className="font-semibold px-6 py-3 rounded-xl transition-colors border text-stone-600 border-stone-300 hover:text-stone-900 hover:border-stone-400 dark:border-white/15 dark:text-white/70 dark:hover:text-white dark:hover:border-white/30"
            >
              Sign Up Free →
            </a>
          </div>

          <p className="text-sm mt-8 text-stone-400 dark:text-white/25">
            Free to use · Chrome Extension · No credit card required
          </p>
        </div>
      </div>
    </div>
  )
}
