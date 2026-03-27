'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clock, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const ISSUE_TYPES = ['bug', 'account', 'billing', 'sync', 'performance', 'other'] as const
const PRIORITIES  = ['low', 'medium', 'high', 'urgent'] as const

type Ticket = {
  id: string
  subject: string
  issue_type: string | null
  priority: string
  status: string
  created_at: string
}

const STATUS_ICON: Record<string, React.ElementType> = {
  open:        AlertCircle,
  in_progress: Clock,
  resolved:    CheckCircle2,
  closed:      CheckCircle2,
}

const STATUS_COLOR: Record<string, string> = {
  open:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed:      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
}

export default function SupportPage() {
  const [subject, setSubject]     = useState('')
  const [description, setDescription] = useState('')
  const [issueType, setIssueType] = useState('bug')
  const [priority, setPriority]   = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [userId, setUserId]       = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('tickets')
        .select('id, subject, issue_type, priority, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setTickets(data ?? [])
          setLoadingTickets(false)
        })
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('tickets').insert({
      user_id:    userId,
      subject:    subject.trim(),
      body:       description.trim(),
      issue_type: issueType,
      priority,
      status:     'open',
    })

    if (error) {
      toast.error('Failed to submit ticket. Please try again.')
    } else {
      toast.success('Support ticket submitted! We\'ll get back to you soon.')
      setSubject('')
      setDescription('')
      // Refresh tickets
      const { data } = await supabase
        .from('tickets')
        .select('id, subject, issue_type, priority, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setTickets(data ?? [])
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Support</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Ticket */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-indigo-500" />
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Submit a Ticket</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Issue Type</Label>
                  <select
                    value={issueType}
                    onChange={e => setIssueType(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                  >
                    {ISSUE_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Brief description of the issue"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  maxLength={5000}
                  rows={5}
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200 resize-none"
                  placeholder="Describe the issue in detail…"
                />
              </div>
              <Button type="submit" disabled={submitting || !userId}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</>
                  : 'Submit Ticket'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Tickets */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">My Tickets</h2>
            {loadingTickets ? (
              <div className="flex items-center gap-2 text-stone-400 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading tickets…</span>
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No tickets yet. Submit a ticket to get help.
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => {
                  const Icon = STATUS_ICON[ticket.status] ?? Clock
                  const colorClass = STATUS_COLOR[ticket.status] ?? STATUS_COLOR.open
                  return (
                    <div
                      key={ticket.id}
                      className="p-3 rounded-xl border border-stone-100 dark:border-[var(--dark-border)] bg-stone-50 dark:bg-[var(--dark-elevated)] space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-stone-800 dark:text-stone-100 line-clamp-1">
                          {ticket.subject}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${colorClass}`}>
                          <Icon className="h-3 w-3" />
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {ticket.issue_type && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {ticket.issue_type}
                          </Badge>
                        )}
                        <span className="text-xs text-stone-400">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
