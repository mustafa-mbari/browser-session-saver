'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Crown, Zap, ArrowLeft, Check, Loader2, Lock } from 'lucide-react'

// NOTE: These feature strings must stay in sync with the actual quota values in
// supabase/migrations/002_plans.sql and the billing page's QUOTA_ROWS table.
// If plan limits change, update both places.
const PLAN_INFO: Record<string, {
  label: string
  monthlyPrice: string
  yearlyPrice: string | null
  isOneTime: boolean
  icon: typeof Zap
  color: string
  features: string[]
}> = {
  pro: {
    label: 'Pro',
    monthlyPrice: '€2.99/mo',
    yearlyPrice: '€24.99/yr',
    isOneTime: false,
    icon: Zap,
    color: 'bg-indigo-600',
    features: [
      '10 synced sessions',
      '100 synced folders',
      '100 prompts',
      '20 tracked subscriptions',
      'Cloud sync across devices',
    ],
  },
  lifetime: {
    label: 'Lifetime',
    monthlyPrice: '€59.99 one-time',
    yearlyPrice: null,
    isOneTime: true,
    icon: Crown,
    color: 'bg-purple-600',
    features: [
      'Unlimited synced sessions',
      'Unlimited folders & prompts',
      'Unlimited tracked subscriptions',
      'Priority support',
      'One-time payment — no subscription',
    ],
  },
  free: {
    label: 'Free',
    monthlyPrice: 'Free forever',
    yearlyPrice: null,
    isOneTime: false,
    icon: Zap,
    color: 'bg-stone-500',
    features: ['Local sessions only', '5 folders', '6 prompts', '2 tracked subscriptions'],
  },
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const planId = searchParams.get('plan') ?? ''
  const plan = PLAN_INFO[planId]
  const [loading, setLoading] = useState(false)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    if (!plan) router.replace('/billing')
  }, [plan, router])

  if (!plan) return null

  const Icon = plan.icon
  const displayPrice = plan.isOneTime
    ? plan.monthlyPrice
    : cycle === 'yearly' && plan.yearlyPrice
      ? plan.yearlyPrice
      : plan.monthlyPrice

  // Downgrade to free is a direct action, no Stripe redirect
  const isFreeDowngrade = planId === 'free'

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, billing_cycle: plan.isOneTime ? 'monthly' : cycle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      if (isFreeDowngrade) {
        toast.success('Downgraded to Free plan.')
        router.push('/billing')
        router.refresh()
        return
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg animate-fade-in">
      <Link
        href="/billing"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to billing
      </Link>

      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">
        {isFreeDowngrade ? 'Downgrade to Free' : 'Complete Your Purchase'}
      </h1>

      {/* Billing cycle toggle for recurring plans */}
      {!plan.isOneTime && !isFreeDowngrade && plan.yearlyPrice && (
        <div className="flex items-center gap-2 mb-4 p-1 rounded-xl bg-stone-100 dark:bg-[var(--dark-elevated)] w-fit">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cycle === 'monthly'
                ? 'bg-white dark:bg-[var(--dark-card)] text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle('yearly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              cycle === 'yearly'
                ? 'bg-white dark:bg-[var(--dark-card)] text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            Yearly
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-semibold">
              Save 17%
            </span>
          </button>
        </div>
      )}

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`h-10 w-10 rounded-xl ${plan.color} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-stone-900 dark:text-stone-100">{plan.label} Plan</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{displayPrice}</p>
            </div>
          </div>
          <ul className="space-y-2 mb-6">
            {plan.features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button onClick={handleConfirm} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecting…</>
            ) : isFreeDowngrade ? (
              'Downgrade to Free'
            ) : (
              <><Lock className="h-4 w-4 mr-2" />Pay securely with Stripe</>
            )}
          </Button>
        </CardContent>
      </Card>

      {!isFreeDowngrade && (
        <p className="text-xs text-stone-400 text-center">
          You will be redirected to Stripe's secure checkout. Cancel anytime.
        </p>
      )}
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>}>
      <CheckoutContent />
    </Suspense>
  )
}
