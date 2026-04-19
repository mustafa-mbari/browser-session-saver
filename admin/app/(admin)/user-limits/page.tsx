'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Trash2, RotateCcw, Save } from 'lucide-react'

type UserLimitInfo = {
  user_id: string
  email: string
  plan: string
  // Effective limits (override if present, else plan default)
  effective_daily: number
  effective_monthly: number
  // Current usage
  daily_used: number
  monthly_used: number
  // Override (null = plan default)
  override_daily: number | null
  override_monthly: number | null
  override_reason: string | null
}

type OverrideRow = {
  user_id: string
  email: string
  plan: string
  override_daily: number | null
  override_monthly: number | null
  override_reason: string | null
}

export default function UserLimitsPage() {
  const [searchEmail, setSearchEmail]     = useState('')
  const [lookupResult, setLookupResult]   = useState<UserLimitInfo | null>(null)
  const [lookupError, setLookupError]     = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const [overrideDaily, setOverrideDaily]     = useState('')
  const [overrideMonthly, setOverrideMonthly] = useState('')
  const [overrideReason, setOverrideReason]   = useState('')
  const [showOverrideForm, setShowOverrideForm] = useState(false)

  const [actionMsg, setActionMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [allOverrides, setAllOverrides]         = useState<OverrideRow[] | null>(null)
  const [overridesLoading, setOverridesLoading] = useState(false)

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!searchEmail.trim()) return
    setLookupLoading(true)
    setLookupResult(null)
    setLookupError(null)
    setActionMsg(null)
    setShowOverrideForm(false)

    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(searchEmail.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error ?? 'Lookup failed')
      } else {
        setLookupResult(data)
        setOverrideDaily(data.override_daily != null ? String(data.override_daily) : '')
        setOverrideMonthly(data.override_monthly != null ? String(data.override_monthly) : '')
        setOverrideReason(data.override_reason ?? '')
      }
    } catch {
      setLookupError('Network error')
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleSetOverride() {
    if (!lookupResult) return
    setActionLoading(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/users/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lookupResult.email,
          daily_action_limit:   overrideDaily   !== '' ? Number(overrideDaily)   : null,
          monthly_action_limit: overrideMonthly !== '' ? Number(overrideMonthly) : null,
          reason: overrideReason || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg({ type: 'error', text: data.error ?? 'Failed to save override' })
      } else {
        setActionMsg({ type: 'success', text: 'Override saved.' })
        setShowOverrideForm(false)
        refreshLookup(lookupResult.email)
        refreshAllOverrides()
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Network error' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClearOverride() {
    if (!lookupResult) return
    setActionLoading(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/users/limits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lookupResult.email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg({ type: 'error', text: data.error ?? 'Failed to clear override' })
      } else {
        setActionMsg({ type: 'success', text: 'Override cleared. User is back on plan defaults.' })
        setShowOverrideForm(false)
        refreshLookup(lookupResult.email)
        refreshAllOverrides()
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Network error' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetUsage() {
    if (!lookupResult) return
    if (!confirm(`Reset all action usage counters for ${lookupResult.email}? This cannot be undone.`)) return
    setActionLoading(true)
    setActionMsg(null)
    try {
      const res = await fetch('/api/users/reset-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lookupResult.email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionMsg({ type: 'error', text: data.error ?? 'Failed to reset usage' })
      } else {
        setActionMsg({ type: 'success', text: 'Usage counters reset to zero.' })
        refreshLookup(lookupResult.email)
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Network error' })
    } finally {
      setActionLoading(false)
    }
  }

  async function refreshLookup(email: string) {
    try {
      const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(email)}`)
      if (res.ok) setLookupResult(await res.json())
    } catch {}
  }

  async function refreshAllOverrides() {
    setOverridesLoading(true)
    try {
      const res = await fetch('/api/users/overrides')
      if (res.ok) setAllOverrides(await res.json())
    } catch {}
    setOverridesLoading(false)
  }

  async function handleLoadAllOverrides() {
    if (allOverrides !== null) return
    refreshAllOverrides()
  }

  const planBadgeColor: Record<string, string> = {
    free:     'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
    pro:      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    lifetime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">User Limits</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
        Look up any user by email to view their action limits, set a custom override, or reset their usage counters.
      </p>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleLookup} className="flex gap-3">
            <Input
              type="email"
              placeholder="user@example.com"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              className="max-w-sm"
              required
            />
            <Button type="submit" disabled={lookupLoading}>
              <Search className="h-4 w-4 mr-2" />
              {lookupLoading ? 'Looking up…' : 'Look Up'}
            </Button>
          </form>

          {lookupError && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{lookupError}</p>
          )}
        </CardContent>
      </Card>

      {/* Result card */}
      {lookupResult && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-stone-900 dark:text-stone-100">{lookupResult.email}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planBadgeColor[lookupResult.plan] ?? planBadgeColor.free}`}>
                {lookupResult.plan}
              </span>
              {(lookupResult.override_daily != null || lookupResult.override_monthly != null) && (
                <Badge variant="outline" className="text-amber-600 border-amber-400 dark:text-amber-400">
                  Override active
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Daily limit"   value={lookupResult.effective_daily}   sub={lookupResult.override_daily   != null ? '(override)' : '(plan default)'} />
              <Stat label="Used today"    value={lookupResult.daily_used}         sub={`of ${lookupResult.effective_daily}`} />
              <Stat label="Monthly limit" value={lookupResult.effective_monthly}  sub={lookupResult.override_monthly != null ? '(override)' : '(plan default)'} />
              <Stat label="Used this month" value={lookupResult.monthly_used}     sub={`of ${lookupResult.effective_monthly}`} />
            </div>

            {lookupResult.override_reason && (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Override reason: <span className="italic">{lookupResult.override_reason}</span>
              </p>
            )}

            {/* Action feedback */}
            {actionMsg && (
              <p className={`text-sm ${actionMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {actionMsg.text}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowOverrideForm(v => !v); setActionMsg(null) }}
              >
                Set Override
              </Button>
              {(lookupResult.override_daily != null || lookupResult.override_monthly != null) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={handleClearOverride}
                  className="text-stone-600 dark:text-stone-400"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Clear Override
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={handleResetUsage}
                className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset Usage
              </Button>
            </div>

            {/* Override form */}
            {showOverrideForm && (
              <div className="border border-stone-200 dark:border-[var(--dark-border)] rounded-lg p-4 space-y-3 bg-stone-50 dark:bg-[var(--dark-elevated)]">
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Set custom limits for this user</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Daily limit</label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 100"
                      value={overrideDaily}
                      onChange={e => setOverrideDaily(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Monthly limit</label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 1000"
                      value={overrideMonthly}
                      onChange={e => setOverrideMonthly(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Reason (optional)</label>
                    <Input
                      type="text"
                      placeholder="e.g. VIP user"
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={actionLoading} onClick={handleSetOverride}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {actionLoading ? 'Saving…' : 'Save Override'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowOverrideForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All active overrides table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Active Overrides</h2>
            <Button variant="outline" size="sm" onClick={handleLoadAllOverrides} disabled={overridesLoading}>
              {overridesLoading ? 'Loading…' : allOverrides === null ? 'Load' : 'Loaded'}
            </Button>
          </div>

          {allOverrides === null && (
            <p className="text-sm text-stone-400 dark:text-stone-500">Click &ldquo;Load&rdquo; to fetch all users with active overrides.</p>
          )}

          {allOverrides !== null && allOverrides.length === 0 && (
            <p className="text-sm text-stone-400 dark:text-stone-500">No active overrides.</p>
          )}

          {allOverrides !== null && allOverrides.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Daily override</TableHead>
                    <TableHead className="text-center">Monthly override</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOverrides.map(row => (
                    <TableRow key={row.user_id}>
                      <TableCell className="text-sm font-medium">{row.email}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planBadgeColor[row.plan] ?? planBadgeColor.free}`}>
                          {row.plan}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{row.override_daily ?? '—'}</TableCell>
                      <TableCell className="text-center">{row.override_monthly ?? '—'}</TableCell>
                      <TableCell className="text-sm text-stone-500 dark:text-stone-400 max-w-[160px] truncate">
                        {row.override_reason ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchEmail(row.email)
                            refreshLookup(row.email).then(() => {
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            })
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-stone-200 dark:border-[var(--dark-border)] p-3">
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-stone-900 dark:text-stone-100">{value}</p>
      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{sub}</p>
    </div>
  )
}
