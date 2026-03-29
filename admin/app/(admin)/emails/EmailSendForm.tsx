'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2 } from 'lucide-react'

export function EmailSendForm() {
  const [to, setTo]           = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:      to.trim(),
          subject: subject.trim(),
          html:    body.trim().replace(/\n/g, '<br>'),
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setResult({ ok: false, message: json.error || 'Failed to send email.' })
      } else {
        setResult({ ok: true, message: `Email sent! Message ID: ${json.messageId ?? '—'}` })
        setTo('')
        setSubject('')
        setBody('')
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Is the SMTP configured?' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Send Email</h2>

        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg mb-4 text-sm ${
            result.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
          }`}>
            {result.ok && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{result.message}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <input
              id="to"
              type="email"
              required
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <input
              id="subject"
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Body</Label>
            <textarea
              id="body"
              rows={8}
              required
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body… (plain text, line breaks become <br>)"
              className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200 resize-none"
            />
          </div>
          <Button type="submit" disabled={sending}>
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
              : 'Send Email'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
