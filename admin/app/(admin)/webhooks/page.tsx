import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Activity, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'

type WebhookEvent = {
  id: string
  source: string
  event_type: string
  status: string
  error_msg: string | null
  processed_at: string | null
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  processed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed:    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

async function getWebhookData(status?: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { events: [], counts: { total: 0, processed: 0, failed: 0, pending: 0 } }
  const supabase = await createServiceClient()

  const [allRes, eventsRes] = await Promise.all([
    supabase.from('webhook_events').select('status'),
    (() => {
      let q = supabase
        .from('webhook_events')
        .select('id, source, event_type, status, error_msg, processed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (status) q = q.eq('status', status)
      return q
    })(),
  ])

  const all = allRes.data ?? []
  return {
    events: (eventsRes.data ?? []) as WebhookEvent[],
    counts: {
      total:     all.length,
      processed: all.filter(e => e.status === 'processed').length,
      failed:    all.filter(e => e.status === 'failed').length,
      pending:   all.filter(e => e.status === 'pending').length,
    },
  }
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const statusFilter = params.status
  const { events, counts } = await getWebhookData(statusFilter)

  const stats = [
    { label: 'Total Events', value: counts.total.toString(),     icon: Activity,      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',   iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Processed',    value: counts.processed.toString(), icon: CheckCircle2,  iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Failed',       value: counts.failed.toString(),    icon: XCircle,       iconBg: 'bg-rose-100 dark:bg-rose-900/30',       iconColor: 'text-rose-600 dark:text-rose-400' },
    { label: 'Pending',      value: counts.pending.toString(),   icon: Clock,         iconBg: 'bg-amber-100 dark:bg-amber-900/30',     iconColor: 'text-amber-600 dark:text-amber-400' },
  ]

  const FILTER_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'processed', label: 'Processed' },
    { value: 'failed', label: 'Failed' },
  ]

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Webhooks</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Webhook Log</h2>
            <div className="flex gap-2">
              {FILTER_OPTIONS.map(opt => (
                <a
                  key={opt.value}
                  href={opt.value ? `?status=${opt.value}` : '?'}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                    (statusFilter ?? '') === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {opt.label}
                </a>
              ))}
            </div>
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No webhook events found.' : 'Connect Supabase to see webhook data.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(event => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs text-stone-700 dark:text-stone-300">
                      {event.event_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{event.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[event.status] ?? STATUS_COLOR.pending}`}>
                        {event.status}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-rose-500">
                      {event.error_msg ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-xs text-stone-400">
                      {new Date(event.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
