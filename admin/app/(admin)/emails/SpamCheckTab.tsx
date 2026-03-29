'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'

interface SpamRule   { score: string; description: string }
interface SpamResult { success: boolean; score: string; rules: SpamRule[] }

const TEMPLATE_OPTIONS = [
  { value: 'welcome',                     label: 'Welcome' },
  { value: 'password_reset_confirmation', label: 'Password Reset' },
  { value: 'billing_notification',        label: 'Billing' },
  { value: 'invoice_receipt',             label: 'Invoice' },
  { value: 'trial_ending',               label: 'Trial Ending' },
  { value: 'ticket_reply',               label: 'Ticket Reply' },
]

export default function SpamCheckTab() {
  const [html,             setHtml]             = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [checking,         setChecking]         = useState(false)
  const [loadingTemplate,  setLoadingTemplate]  = useState(false)
  const [result,           setResult]           = useState<SpamResult | null>(null)
  const [error,            setError]            = useState<string | null>(null)

  async function loadTemplate(templateValue: string) {
    if (!templateValue) return
    setLoadingTemplate(true)
    try {
      const res  = await fetch(`/api/emails/preview?template=${templateValue}`)
      const text = await res.text()
      setHtml(text)
      setSelectedTemplate(templateValue)
      setResult(null)
    } finally {
      setLoadingTemplate(false)
    }
  }

  async function handleCheck() {
    if (!html.trim()) return
    setChecking(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/emails/spam-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ html, options: 'long' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Spam check failed')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run spam check')
    } finally {
      setChecking(false)
    }
  }

  const score      = result ? parseFloat(result.score) : 0
  const scoreColor = result
    ? score < 1 ? 'text-emerald-600 dark:text-emerald-400'
      : score < 3 ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400'
    : ''

  return (
    <div className="grid lg:grid-cols-2 gap-6 mt-6">
      {/* Input panel */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Spam Score Checker</h2>

          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">Load from template:</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => loadTemplate(opt.value)}
                  disabled={loadingTemplate}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    selectedTemplate === opt.value
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300'
                      : 'border-stone-200 dark:border-[var(--dark-border)] text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-[var(--dark-hover)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-1.5">Or paste HTML:</p>
            <textarea
              value={html}
              onChange={e => { setHtml(e.target.value); setSelectedTemplate('') }}
              rows={12}
              placeholder="Paste email HTML here..."
              className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] text-sm text-stone-800 dark:text-stone-200 px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Button onClick={handleCheck} disabled={checking || !html.trim()} className="w-full">
            {checking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...</> : 'Check Spam Score'}
          </Button>
        </CardContent>
      </Card>

      {/* Results panel */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">Results</h2>

          {!result && !error && (
            <div className="py-12 flex flex-col items-center gap-2 text-stone-400">
              <ShieldCheck className="h-10 w-10 opacity-30" />
              <p className="text-sm">Run a check to see the spam score</p>
            </div>
          )}

          {error && <p className="text-sm text-rose-500">{error}</p>}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {score < 1
                  ? <ShieldCheck className="h-8 w-8 text-emerald-500" />
                  : <ShieldAlert className="h-8 w-8 text-rose-500" />
                }
                <div>
                  <p className={`text-3xl font-bold ${scoreColor}`}>{score.toFixed(1)}</p>
                  <p className="text-xs text-stone-400">
                    {score < 1 ? 'Excellent — unlikely to be flagged as spam'
                      : score < 3 ? 'Moderate — some spam filters may flag this'
                        : 'High — likely to be flagged as spam'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 text-[10px]">
                <Badge variant="success"     className="text-[10px]">&lt;1 Safe</Badge>
                <Badge variant="warning"     className="text-[10px]">1–3 Moderate</Badge>
                <Badge variant="destructive" className="text-[10px]">&gt;3 Risky</Badge>
              </div>

              {result.rules && result.rules.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">
                    Triggered Rules
                  </p>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {result.rules
                      .filter(r => parseFloat(r.score) !== 0)
                      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
                      .map((rule, i) => {
                        const ruleScore = parseFloat(rule.score)
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className={`font-mono font-medium shrink-0 ${ruleScore > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {ruleScore > 0 ? '+' : ''}{ruleScore.toFixed(1)}
                            </span>
                            <span className="text-stone-600 dark:text-stone-400">{rule.description}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-stone-400">
                Powered by Postmark Spamcheck (SpamAssassin rules)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
