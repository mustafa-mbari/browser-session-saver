'use client'

import { useState } from 'react'
import { Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function CancelPlanButton() {
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: 'free' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel')
      toast.success('Subscription cancelled. You\'ve been moved to the Free plan.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">Cancel your subscription?</p>
        <p className="text-xs text-red-600/80 dark:text-red-400/70">You&apos;ll lose access to premium features immediately.</p>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            Yes, cancel
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-stone-100 dark:bg-[var(--dark-elevated)] hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors"
          >
            Keep plan
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
    >
      Cancel subscription
    </button>
  )
}
