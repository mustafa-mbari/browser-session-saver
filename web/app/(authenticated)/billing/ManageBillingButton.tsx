'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    // Portal route returns a redirect — follow it
    window.location.href = '/api/billing/portal'
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-[var(--dark-elevated)] hover:bg-stone-200 dark:hover:bg-[var(--dark-hover)] text-stone-700 dark:text-stone-300 transition-colors disabled:opacity-50"
    >
      {loading
        ? <><Loader2 className="h-3 w-3 animate-spin" />Opening…</>
        : <><ExternalLink className="h-3 w-3" />Manage Billing</>}
    </button>
  )
}
