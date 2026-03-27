'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const ISSUE_TYPES = ['bug', 'account', 'billing', 'sync', 'performance', 'other'] as const
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export default function SupportPage() {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [issueType, setIssueType] = useState<string>('bug')
  const [priority, setPriority] = useState<string>('medium')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: Connect to Supabase
    toast.success('Support ticket submitted!')
    setSubject('')
    setDescription('')
    setLoading(false)
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Support</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Ticket */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Submit a Ticket</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Issue Type</Label>
                  <select
                    value={issueType}
                    onChange={e => setIssueType(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} required maxLength={200} placeholder="Brief description of the issue" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  maxLength={5000}
                  rows={5}
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm resize-none"
                  placeholder="Describe the issue in detail..."
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Ticket'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Tickets */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">My Tickets</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No tickets yet. Submit a ticket to get help.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
