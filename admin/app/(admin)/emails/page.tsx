'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const TABS = ['Dashboard', 'Send', 'Templates', 'Logs'] as const

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<string>('Dashboard')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: Connect to email service
    toast.success('Email sent!')
    setTo('')
    setSubject('')
    setBody('')
    setLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Emails</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200 dark:border-[var(--dark-border)]">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'Dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-stone-500 dark:text-stone-400">Sent Today</p>
              <p className="text-3xl font-bold text-stone-900 dark:text-stone-100 mt-1">—</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-stone-500 dark:text-stone-400">Sent This Week</p>
              <p className="text-3xl font-bold text-stone-900 dark:text-stone-100 mt-1">—</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-stone-500 dark:text-stone-400">Bounce Rate</p>
              <p className="text-3xl font-bold text-stone-900 dark:text-stone-100 mt-1">—</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Tab */}
      {activeTab === 'Send' && (
        <Card className="max-w-2xl">
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Send Email</h2>
            <form onSubmit={handleSend} className="space-y-3">
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input type="email" value={to} onChange={e => setTo(e.target.value)} required placeholder="user@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Email subject" />
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  required
                  rows={8}
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm resize-none"
                  placeholder="Email body..."
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Email'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Templates Tab */}
      {activeTab === 'Templates' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Email Templates</h2>
              <Badge variant="secondary">0 templates</Badge>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No email templates yet. Templates will be available once connected to the email service.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Logs Tab */}
      {activeTab === 'Logs' && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Email Logs</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-stone-500 dark:text-stone-400 py-8">
                    No email logs yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
