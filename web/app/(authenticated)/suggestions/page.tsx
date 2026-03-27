'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, ThumbsUp, Lightbulb, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const SUGGESTION_TYPES   = ['feature', 'improvement', 'integration', 'other'] as const
const IMPORTANCE_LEVELS  = ['low', 'medium', 'high'] as const

type Suggestion = {
  id: string
  title: string
  description: string | null
  type: string
  importance: string
  status: string
  votes: number
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  pending:      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  implemented:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rejected:     'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

export default function SuggestionsPage() {
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [type, setType]             = useState('feature')
  const [importance, setImportance] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [votedIds, setVotedIds]     = useState<Set<string>>(new Set())
  const [userId, setUserId]         = useState<string | null>(null)

  const loadSuggestions = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('suggestions')
      .select('id, title, description, type, importance, status, votes, created_at')
      .order('votes', { ascending: false })
    setSuggestions(data ?? [])
    setLoadingSuggestions(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        // Load which suggestions this user already voted for
        const { data: votes } = await supabase
          .from('suggestion_votes')
          .select('suggestion_id')
          .eq('user_id', user.id)
        if (votes) {
          setVotedIds(new Set(votes.map(v => v.suggestion_id)))
        }
      }
      loadSuggestions()
    })
  }, [loadSuggestions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from('suggestions').insert({
      user_id:     userId,
      title:       title.trim(),
      description: description.trim() || null,
      type,
      importance,
      status:      'pending',
    })

    if (error) {
      toast.error('Failed to submit suggestion. Please try again.')
    } else {
      toast.success('Suggestion submitted! Thank you for your feedback.')
      setTitle('')
      setDescription('')
      await loadSuggestions()
    }
    setSubmitting(false)
  }

  async function handleVote(suggestionId: string) {
    if (!userId) { toast.error('Sign in to vote.'); return }
    const supabase = createClient()
    const hasVoted = votedIds.has(suggestionId)

    if (hasVoted) {
      // Remove vote
      await supabase
        .from('suggestion_votes')
        .delete()
        .eq('user_id', userId)
        .eq('suggestion_id', suggestionId)
      // Decrement votes counter
      const s = suggestions.find(s => s.id === suggestionId)
      if (s) {
        await supabase.from('suggestions').update({ votes: Math.max(0, s.votes - 1) }).eq('id', suggestionId)
      }
      setVotedIds(prev => { const next = new Set(prev); next.delete(suggestionId); return next })
    } else {
      // Add vote
      const { error } = await supabase.from('suggestion_votes').insert({ user_id: userId, suggestion_id: suggestionId })
      if (error) { toast.error('Could not register vote.'); return }
      const s = suggestions.find(s => s.id === suggestionId)
      if (s) {
        await supabase.from('suggestions').update({ votes: s.votes + 1 }).eq('id', suggestionId)
      }
      setVotedIds(prev => new Set(prev).add(suggestionId))
    }
    await loadSuggestions()
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Suggestions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Suggestion */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Submit a Suggestion</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                  >
                    {SUGGESTION_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Importance</Label>
                  <select
                    value={importance}
                    onChange={e => setImportance(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200"
                  >
                    {IMPORTANCE_LEVELS.map(i => (
                      <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Brief title for your suggestion"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="text-stone-400 font-normal">(optional)</span></Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200 resize-none"
                  placeholder="Describe your idea in detail…"
                />
              </div>
              <Button type="submit" disabled={submitting || !userId}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</>
                  : 'Submit Suggestion'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* All Suggestions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Community Suggestions</h2>
            </div>
            {loadingSuggestions ? (
              <div className="flex items-center gap-2 text-stone-400 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading suggestions…</span>
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No suggestions yet. Be the first to share an idea!
              </p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {suggestions.map(s => {
                  const colorClass = STATUS_COLOR[s.status] ?? STATUS_COLOR.pending
                  const voted = votedIds.has(s.id)
                  return (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border border-stone-100 dark:border-[var(--dark-border)] bg-stone-50 dark:bg-[var(--dark-elevated)] space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        {/* Vote button */}
                        <button
                          onClick={() => handleVote(s.id)}
                          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg border transition-colors shrink-0 ${
                            voted
                              ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                              : 'border-stone-200 dark:border-[var(--dark-border)] text-stone-400 hover:text-indigo-500 hover:border-indigo-300'
                          }`}
                          title={voted ? 'Remove vote' : 'Upvote'}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">{s.votes}</span>
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-800 dark:text-stone-100 line-clamp-2">
                            {s.title}
                          </p>
                          {s.description && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                              {s.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-xs capitalize">{s.type}</Badge>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
                              {s.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
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
