'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const SUGGESTION_TYPES = ['feature', 'improvement', 'integration', 'ui_ux', 'other'] as const
const IMPORTANCE_LEVELS = ['nice_to_have', 'important', 'critical'] as const

export default function SuggestionsPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<string>('feature')
  const [importance, setImportance] = useState<string>('important')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: Connect to Supabase
    toast.success('Suggestion submitted! Thank you for your feedback.')
    setTitle('')
    setDescription('')
    setLoading(false)
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Suggestions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submit Suggestion */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Submit a Suggestion</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm"
                  >
                    {SUGGESTION_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Importance</Label>
                  <select
                    value={importance}
                    onChange={e => setImportance(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm"
                  >
                    {IMPORTANCE_LEVELS.map(i => (
                      <option key={i} value={i}>{i.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} placeholder="Brief title for your suggestion" />
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
                  placeholder="Describe your idea in detail..."
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Suggestion'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Suggestions */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">My Suggestions</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No suggestions yet. Share your ideas to help us improve!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
