'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Send, Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react'

const TEMPLATE_OPTIONS = [
  { value: 'welcome',                     label: 'Welcome' },
  { value: 'email_verification',          label: 'Email Verification' },
  { value: 'password_reset',              label: 'Password Reset Link' },
  { value: 'password_reset_confirmation', label: 'Password Changed' },
  { value: 'billing_notification',        label: 'Billing Notification' },
  { value: 'invoice_receipt',             label: 'Invoice Receipt' },
  { value: 'trial_ending',               label: 'Trial Ending' },
  { value: 'ticket_reply',               label: 'Ticket Reply' },
  { value: 'suggestion_reply',           label: 'Suggestion Reply' },
]

type ConnStatus = 'idle' | 'testing' | 'ok' | 'error'

interface SmtpConfig {
  host:       string
  port:       number
  from:       string
  secure:     string
  configured: boolean
}

export default function SendTestTab() {
  const [testTo,       setTestTo]       = useState('')
  const [testTemplate, setTestTemplate] = useState('welcome')
  const [sending,      setSending]      = useState(false)
  const [connStatus,   setConnStatus]   = useState<ConnStatus>('idle')
  const [connError,    setConnError]    = useState<string | null>(null)
  const [smtpConfig,   setSmtpConfig]   = useState<SmtpConfig | null>(null)

  useEffect(() => {
    fetch('/api/emails/config')
      .then(r => r.json())
      .then(setSmtpConfig)
      .catch(() => {})
  }, [])

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/emails/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to: testTo, template: testTemplate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success(`Test email sent to ${testTo}`)
      setTestTo('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send test email')
    } finally {
      setSending(false)
    }
  }

  async function handleTestConnection() {
    setConnStatus('testing')
    setConnError(null)
    try {
      const res  = await fetch('/api/emails/test-connection', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setConnStatus('ok')
        toast.success('SMTP connection successful')
      } else {
        setConnStatus('error')
        setConnError(data.error || 'Connection failed')
        toast.error(data.error || 'SMTP connection failed')
      }
    } catch {
      setConnStatus('error')
      setConnError('Network error')
    }
  }

  const host       = smtpConfig?.host       ?? 'smtp.resend.com'
  const port       = smtpConfig?.port       ?? 465
  const from       = smtpConfig?.from       ?? 'info@browserhub.app'
  const secure     = smtpConfig?.secure     ?? 'SSL/TLS'
  const configured = smtpConfig?.configured ?? true

  return (
    <div className="grid lg:grid-cols-2 gap-6 mt-6">
      {/* SMTP Connection */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            {connStatus === 'ok'
              ? <Wifi className="h-4 w-4 text-emerald-500" />
              : connStatus === 'error'
                ? <WifiOff className="h-4 w-4 text-rose-500" />
                : <Wifi className="h-4 w-4 text-stone-400" />
            }
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">SMTP Connection</h2>
            {connStatus === 'ok'    && <Badge variant="success">Connected</Badge>}
            {connStatus === 'error' && <Badge variant="destructive">Failed</Badge>}
          </div>

          {!configured && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p className="font-medium">SMTP_PASS not configured</p>
                <p className="mt-0.5">Set the <code className="font-mono">SMTP_PASS</code> environment variable (Resend API key) to enable email sending.</p>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-4 text-sm text-stone-600 dark:text-stone-400">
            <div className="flex justify-between">
              <span>Host</span>
              <code className="text-xs bg-stone-100 dark:bg-[var(--dark-elevated)] px-1.5 py-0.5 rounded">
                {host}:{port}
              </code>
            </div>
            <div className="flex justify-between">
              <span>From</span>
              <code className="text-xs bg-stone-100 dark:bg-[var(--dark-elevated)] px-1.5 py-0.5 rounded">
                {from}
              </code>
            </div>
            <div className="flex justify-between">
              <span>Security</span>
              <code className="text-xs bg-stone-100 dark:bg-[var(--dark-elevated)] px-1.5 py-0.5 rounded">
                {secure}
              </code>
            </div>
          </div>

          {connError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mb-3 font-mono break-all">{connError}</p>
          )}

          <Button
            onClick={handleTestConnection}
            disabled={connStatus === 'testing'}
            variant="outline"
            className="w-full"
          >
            {connStatus === 'testing'
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</>
              : 'Test SMTP Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Send Test Email */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Send Test Email</h2>
          </div>
          <form onSubmit={handleSendTest} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="test-email">Recipient</Label>
              <Input
                id="test-email"
                type="email"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                required
                placeholder="test@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={testTemplate} onValueChange={setTestTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? 'Sending...' : 'Send Test Email'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
