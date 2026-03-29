'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import type { EmailLogRow } from '@/lib/repositories/emailLogs'

const TYPE_BADGE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  welcome:                    { label: 'Welcome',         variant: 'default' },
  email_verification:         { label: 'Verification',    variant: 'secondary' },
  password_reset:             { label: 'Reset',           variant: 'secondary' },
  password_reset_confirmation:{ label: 'Password',        variant: 'outline' },
  billing_notification:       { label: 'Billing',         variant: 'default' },
  invoice_receipt:            { label: 'Invoice',         variant: 'default' },
  trial_ending:               { label: 'Trial',           variant: 'secondary' },
  support_ticket:             { label: 'Support',         variant: 'secondary' },
  feature_suggestion:         { label: 'Suggestion',      variant: 'secondary' },
  ticket_reply:               { label: 'Ticket Reply',    variant: 'outline' },
  suggestion_reply:           { label: 'Suggestion Reply',variant: 'outline' },
  test:                       { label: 'Test',            variant: 'outline' },
}

const PAGE_SIZE = 20

export default function LogsTab() {
  const [logs,       setLogs]       = useState<EmailLogRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [offset,     setOffset]     = useState(0)
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading,    setLoading]    = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const typeParam = typeFilter !== 'all' ? `&type=${typeFilter}` : ''
      const res = await fetch(`/api/emails?limit=${PAGE_SIZE}&offset=${offset}${typeParam}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [offset, typeFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function handleFilterChange(value: string) {
    setTypeFilter(value)
    setOffset(0)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <Card className="mt-6">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Email Log</h2>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_BADGE_MAP).map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-stone-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-stone-400">No emails found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => {
                    const typeKey  = log.type || log.template || ''
                    const typeBadge = TYPE_BADGE_MAP[typeKey] || { label: typeKey || '—', variant: 'outline' as const }
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-sm">{log.to_email}</TableCell>
                        <TableCell>
                          <Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-stone-500 dark:text-stone-400 max-w-[200px] truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'sent' ? 'success' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-stone-400 whitespace-nowrap">
                          {formatDate(log.sent_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-stone-400">
                {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
