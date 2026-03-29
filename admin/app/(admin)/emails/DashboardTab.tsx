'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Mail, MailCheck, CalendarDays, MailX } from 'lucide-react'
import type { EmailLogRow } from '@/lib/repositories/emailLogs'

interface Stats { today: number; week: number; month: number; failed: number }
interface DailyPoint { date: string; sent: number; failed: number }
interface TypePoint  { type: string; count: number }

const TYPE_LABELS: Record<string, string> = {
  welcome:                    'Welcome',
  email_verification:         'Verification',
  password_reset:             'Reset',
  password_reset_confirmation:'Password',
  billing_notification:       'Billing',
  invoice_receipt:            'Invoice',
  trial_ending:               'Trial',
  support_ticket:             'Support',
  feature_suggestion:         'Suggestion',
  ticket_reply:               'Ticket Reply',
  suggestion_reply:           'Suggestion Reply',
  test:                       'Test',
}

function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; iconBg: string; iconColor: string; label: string; value: number; sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-stone-500 dark:text-stone-400 truncate">{label}</p>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</p>
            {sub && <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardTab() {
  const [stats, setStats]       = useState<Stats>({ today: 0, week: 0, month: 0, failed: 0 })
  const [daily, setDaily]       = useState<DailyPoint[]>([])
  const [byType, setByType]     = useState<TypePoint[]>([])
  const [failures, setFailures] = useState<EmailLogRow[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/emails?limit=1&offset=0').then(r => r.json()),
      fetch('/api/emails/analytics').then(r => r.json()),
    ]).then(([emailsData, analyticsData]) => {
      setStats(emailsData.stats)
      setDaily(analyticsData.daily)
      setByType(analyticsData.byType)
      setFailures(analyticsData.recentFailures)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-20 text-center text-stone-400">Loading analytics...</div>
  }

  const successRate = stats.month > 0
    ? (((stats.month - stats.failed) / stats.month) * 100).toFixed(1)
    : '100'

  const chartData = byType.map(d => ({
    ...d,
    label: TYPE_LABELS[d.type] || d.type,
  }))

  return (
    <div className="space-y-6 mt-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Mail} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400"
          label="Sent Today" value={stats.today}
        />
        <StatCard
          icon={MailCheck} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
          label="This Week" value={stats.week}
        />
        <StatCard
          icon={CalendarDays} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
          label="This Month" value={stats.month}
        />
        <StatCard
          icon={MailX} iconBg="bg-rose-100 dark:bg-rose-900/30" iconColor="text-rose-600 dark:text-rose-400"
          label="Failed" value={stats.failed} sub="All time"
        />
      </div>

      {/* Delivery success rate */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Delivery Success Rate (30 days)</p>
            <span className="text-lg font-bold text-stone-900 dark:text-stone-100">{successRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-stone-200 dark:bg-[var(--dark-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${successRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-stone-400">{stats.failed} failed</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {stats.month - stats.failed} delivered
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-4">Emails Sent (last 30 days)</p>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => {
                      const d = new Date(v + 'T00:00:00')
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }}
                    tick={{ fontSize: 11 }}
                    className="fill-stone-400"
                    interval={4}
                  />
                  <YAxis tick={{ fontSize: 11 }} className="fill-stone-400" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e7e5e4' }}
                    labelFormatter={v =>
                      new Date(String(v) + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="sent"   stroke="#6366f1" strokeWidth={2} dot={false} name="Sent" />
                  <Line type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2} dot={false} name="Failed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-4">Volume by Template Type</p>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-stone-400" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-stone-400" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e7e5e4' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Emails" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent failures */}
      {failures.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Recent Failures</p>
              <Badge variant="destructive">{failures.length}</Badge>
            </div>
            <div className="space-y-2">
              {failures.map(f => (
                <div
                  key={f.id}
                  className="flex items-start justify-between gap-4 py-2 border-b border-stone-100 dark:border-[var(--dark-border)] last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">{f.to_email}</p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 truncate">
                      {(f.error_msg || 'Unknown error').slice(0, 100)}
                    </p>
                  </div>
                  <p className="text-xs text-stone-400 whitespace-nowrap shrink-0">
                    {new Date(f.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
