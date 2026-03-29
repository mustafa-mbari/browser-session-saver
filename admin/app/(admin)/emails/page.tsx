import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Mail, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { EmailSendForm } from './EmailSendForm'

type EmailLog = {
  id: string
  to_email: string
  subject: string
  template: string | null
  status: string
  error_msg: string | null
  sent_at: string
}

type EmailStats = {
  sentToday: number
  sentWeek: number
  failed: number
  bounced: number
}

const STATUS_COLOR: Record<string, string> = {
  sent:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed:  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  bounced: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

async function getEmailData() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { logs: [], stats: { sentToday: 0, sentWeek: 0, failed: 0, bounced: 0 } }
  }
  const supabase = await createServiceClient()

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7)

  const [logsRes, allRes] = await Promise.all([
    supabase
      .from('email_log')
      .select('id, to_email, subject, template, status, error_msg, sent_at')
      .order('sent_at', { ascending: false })
      .limit(100),
    supabase.from('email_log').select('status, sent_at'),
  ])

  const all = allRes.data ?? []
  const stats: EmailStats = {
    sentToday: all.filter(e => e.status === 'sent' && new Date(e.sent_at) >= todayStart).length,
    sentWeek:  all.filter(e => e.status === 'sent' && new Date(e.sent_at) >= weekStart).length,
    failed:    all.filter(e => e.status === 'failed').length,
    bounced:   all.filter(e => e.status === 'bounced').length,
  }

  return { logs: (logsRes.data ?? []) as EmailLog[], stats }
}

const TABS = ['Dashboard', 'Send', 'Logs'] as const

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const activeTab = (params.tab ?? 'Dashboard') as typeof TABS[number]
  const { logs, stats } = await getEmailData()

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Emails</h1>

      {/* Tab navigation using URL params */}
      <div className="flex gap-1 mb-6 border-b border-stone-200 dark:border-[var(--dark-border)]">
        {TABS.map(tab => (
          <a
            key={tab}
            href={`?tab=${tab}`}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            )}
          >
            {tab}
          </a>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'Dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Sent Today',  value: stats?.sentToday ?? 0, icon: Mail,          iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',   iconColor: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Sent (7d)',   value: stats?.sentWeek ?? 0,  icon: CheckCircle2,  iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Failed',      value: stats?.failed ?? 0,    icon: XCircle,       iconBg: 'bg-rose-100 dark:bg-rose-900/30',       iconColor: 'text-rose-600 dark:text-rose-400' },
              { label: 'Bounced',     value: stats?.bounced ?? 0,   icon: AlertTriangle, iconBg: 'bg-amber-100 dark:bg-amber-900/30',     iconColor: 'text-amber-600 dark:text-amber-400' },
            ].map(m => (
              <Card key={m.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.iconBg}`}>
                      <m.icon className={`h-5 w-5 ${m.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{m.label}</p>
                      <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{m.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Send Tab */}
      {activeTab === 'Send' && <EmailSendForm />}

      {/* Logs Tab */}
      {activeTab === 'Logs' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Email Logs</h2>
              <Badge variant="secondary">{logs.length} entries</Badge>
            </div>
            {logs.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No email logs yet.' : 'Connect Supabase to see email logs.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-stone-700 dark:text-stone-300">{log.to_email}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{log.subject}</TableCell>
                      <TableCell className="text-xs text-stone-400">{log.template ?? '—'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[log.status] ?? STATUS_COLOR.sent}`}>
                          {log.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-stone-400">
                        {new Date(log.sent_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
