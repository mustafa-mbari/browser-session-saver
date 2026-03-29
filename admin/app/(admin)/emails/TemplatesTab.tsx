'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Monitor, Smartphone } from 'lucide-react'

const TEMPLATE_OPTIONS = [
  { value: 'welcome',                     label: 'Welcome' },
  { value: 'email_verification',          label: 'Verification' },
  { value: 'password_reset',              label: 'Reset Link' },
  { value: 'password_reset_confirmation', label: 'Password Changed' },
  { value: 'billing_notification',        label: 'Billing' },
  { value: 'invoice_receipt',             label: 'Invoice' },
  { value: 'trial_ending',               label: 'Trial Ending' },
  { value: 'ticket_reply',               label: 'Ticket Reply' },
  { value: 'suggestion_reply',           label: 'Suggestion Reply' },
]

type Viewport = 'desktop' | 'mobile'

export default function TemplatesTab() {
  const [activeTemplate, setActiveTemplate] = useState('welcome')
  const [viewport,       setViewport]       = useState<Viewport>('desktop')

  const iframeWidth = viewport === 'mobile' ? '375px' : '100%'

  return (
    <Card className="mt-6">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Template Preview</h2>
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-[var(--dark-elevated)] rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewport('desktop')}
              className={`h-7 px-2.5 ${viewport === 'desktop'
                ? 'bg-white dark:bg-[var(--dark-card)] shadow-sm text-stone-900 dark:text-stone-100'
                : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <Monitor className="h-3.5 w-3.5 mr-1" /> Desktop
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewport('mobile')}
              className={`h-7 px-2.5 ${viewport === 'mobile'
                ? 'bg-white dark:bg-[var(--dark-card)] shadow-sm text-stone-900 dark:text-stone-100'
                : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 mr-1" /> Mobile
            </Button>
          </div>
        </div>

        {/* Template selector */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TEMPLATE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setActiveTemplate(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeTemplate === opt.value
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300'
                  : 'border-stone-200 dark:border-[var(--dark-border)] text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-[var(--dark-hover)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Preview iframe */}
        <div className="border border-stone-200 dark:border-[var(--dark-border)] rounded-lg overflow-hidden bg-stone-100 dark:bg-[var(--dark-elevated)] flex justify-center">
          <div style={{ width: iframeWidth, transition: 'width 0.2s ease' }}>
            <iframe
              src={`/api/emails/preview?template=${activeTemplate}`}
              className="w-full border-0 bg-white"
              style={{ height: '500px' }}
              sandbox="allow-same-origin"
              title={`${activeTemplate} preview`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
