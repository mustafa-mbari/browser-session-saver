'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckoutSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.push('/billing'), 4000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
      <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">Payment Successful!</h1>
      <p className="text-stone-500 dark:text-stone-400 mb-1 max-w-sm">
        Your plan is being activated. This usually takes a few seconds.
      </p>
      <p className="text-xs text-stone-400 mb-8">You&apos;ll be redirected to billing shortly…</p>
      <Button onClick={() => router.push('/billing')} variant="outline">
        Go to Billing
      </Button>
    </div>
  )
}
