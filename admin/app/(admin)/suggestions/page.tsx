import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Lightbulb, ThumbsUp, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Suggestion = {
  id: string
  title: string
  type: string
  importance: string
  status: string
  votes: number
  admin_notes: string | null
  created_at: string
  profiles: { email: string | null; display_name: string | null } | null
}

const STATUS_COLOR: Record<string, string> = {
  pending:      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  implemented:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rejected:     'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

async function getSuggestionData(status?: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { suggestions: [], counts: { total: 0, under_review: 0, approved: 0, implemented: 0 } }
  const supabase = await createServiceClient()

  const [allRes, suggestionsRes] = await Promise.all([
    supabase.from('suggestions').select('status'),
    (() => {
      let q = supabase
        .from('suggestions')
        .select('id, title, type, importance, status, votes, admin_notes, created_at, profiles(email, display_name)')
        .order('votes', { ascending: false })
        .limit(50)
      if (status) q = q.eq('status', status)
      return q
    })(),
  ])

  const all = allRes.data ?? []
  return {
    suggestions: (suggestionsRes.data ?? []) as unknown as Suggestion[],
    counts: {
      total:       all.length,
      under_review: all.filter(s => s.status === 'under_review').length,
      approved:    all.filter(s => s.status === 'approved').length,
      implemented: all.filter(s => s.status === 'implemented').length,
    },
  }
}

async function updateStatus(formData: FormData) {
  'use server'
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  const notes = formData.get('notes') as string | null
  const supabase = await createServiceClient()
  try {
    const { error } = await supabase.from('suggestions').update({ status, admin_notes: notes || null }).eq('id', id)
    if (error) throw error
    revalidatePath('/suggestions')
  } catch (err) {
    console.error('[updateStatus]:', err)
  }
}

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const statusFilter = params.status
  const { suggestions, counts } = await getSuggestionData(statusFilter)

  const stats = [
    { label: 'Total',       value: counts.total.toString(),        icon: Lightbulb,    iconBg: 'bg-amber-100 dark:bg-amber-900/30',     iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Under Review', value: counts.under_review.toString(), icon: Clock,        iconBg: 'bg-blue-100 dark:bg-blue-900/30',       iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Approved',    value: counts.approved.toString(),     icon: ThumbsUp,     iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Implemented', value: counts.implemented.toString(),  icon: CheckCircle2, iconBg: 'bg-purple-100 dark:bg-purple-900/30',   iconColor: 'text-purple-600 dark:text-purple-400' },
  ]

  const FILTER_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'implemented', label: 'Implemented' },
    { value: 'rejected', label: 'Rejected' },
  ]

  const NEXT_STATUS: Record<string, string> = {
    pending:      'under_review',
    under_review: 'approved',
    approved:     'implemented',
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Suggestions</h1>

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
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">All Suggestions</h2>
            <div className="flex gap-2 flex-wrap">
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

          {suggestions.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No suggestions found.' : 'Connect Supabase to see suggestion data.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Votes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium text-stone-800 dark:text-stone-100 line-clamp-1">{s.title}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {s.profiles?.display_name || s.profiles?.email || '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{s.type}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-stone-700 dark:text-stone-300">
                      {s.votes}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[s.status] ?? STATUS_COLOR.pending}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {NEXT_STATUS[s.status] && (
                        <form action={updateStatus} className="inline">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value={NEXT_STATUS[s.status]} />
                          <button
                            type="submit"
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mr-3"
                          >
                            → {NEXT_STATUS[s.status].replace('_', ' ')}
                          </button>
                        </form>
                      )}
                      {s.status !== 'rejected' && s.status !== 'implemented' && (
                        <form action={updateStatus} className="inline">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button type="submit" className="text-xs text-rose-500 hover:underline">
                            Reject
                          </button>
                        </form>
                      )}
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
