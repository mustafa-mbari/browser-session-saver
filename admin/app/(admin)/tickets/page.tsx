import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LifeBuoy, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'

type Ticket = {
  id: string
  subject: string
  issue_type: string | null
  priority: string
  status: string
  created_at: string
  profiles: { email: string | null; display_name: string | null } | null
}

const STATUS_COLOR: Record<string, string> = {
  open:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed:      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
}

const PRIORITY_COLOR: Record<string, string> = {
  low:    'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

async function getTicketData(status?: string, search?: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { tickets: [], counts: { total: 0, open: 0, in_progress: 0, resolved: 0 } }
  const supabase = await createServiceClient()

  const [allRes, ticketsRes] = await Promise.all([
    supabase.from('tickets').select('status'),
    (() => {
      let q = supabase
        .from('tickets')
        .select('id, subject, issue_type, priority, status, created_at, profiles(email, display_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (status) q = q.eq('status', status)
      if (search) q = q.ilike('subject', `%${search}%`)
      return q
    })(),
  ])

  const all = allRes.data ?? []
  return {
    tickets: (ticketsRes.data ?? []) as unknown as Ticket[],
    counts: {
      total:       all.length,
      open:        all.filter(t => t.status === 'open').length,
      in_progress: all.filter(t => t.status === 'in_progress').length,
      resolved:    all.filter(t => t.status === 'resolved').length,
    },
  }
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const statusFilter = params.status
  const search = params.search ?? ''
  const { tickets, counts } = await getTicketData(statusFilter, search)

  const stats = [
    { label: 'Total Tickets', value: counts.total.toString(),       icon: LifeBuoy,      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',   iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Open',          value: counts.open.toString(),        icon: AlertCircle,   iconBg: 'bg-amber-100 dark:bg-amber-900/30',     iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'In Progress',   value: counts.in_progress.toString(), icon: Clock,         iconBg: 'bg-blue-100 dark:bg-blue-900/30',       iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Resolved',      value: counts.resolved.toString(),    icon: CheckCircle2,  iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  ]

  const FILTER_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ]

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Tickets</h1>

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
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Support Tickets</h2>
            <div className="flex gap-2 flex-wrap">
              {FILTER_OPTIONS.map(opt => (
                <a
                  key={opt.value}
                  href={opt.value ? `?status=${opt.value}${search ? `&search=${search}` : ''}` : `?${search ? `search=${search}` : ''}`}
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

          {/* Search */}
          <form className="mb-4">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by subject…"
              className="w-full max-w-sm rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400"
            />
          </form>

          {tickets.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No tickets found.' : 'Connect Supabase to see ticket data.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map(ticket => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <p className="font-medium text-stone-800 dark:text-stone-100 line-clamp-1">{ticket.subject}</p>
                      {ticket.issue_type && (
                        <span className="text-xs text-stone-400 capitalize">{ticket.issue_type}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-stone-700 dark:text-stone-300">{ticket.profiles?.display_name || '—'}</p>
                      <p className="text-xs text-stone-400">{ticket.profiles?.email}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_COLOR[ticket.priority] ?? PRIORITY_COLOR.medium}`}>
                        {ticket.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[ticket.status] ?? STATUS_COLOR.open}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-stone-500 dark:text-stone-400">
                      {new Date(ticket.created_at).toLocaleDateString()}
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
