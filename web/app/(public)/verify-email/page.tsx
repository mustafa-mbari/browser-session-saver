'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Globe, Mail } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    if (!email) return
    setLoading(true)

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed to resend')
      toast.success('Verification email resent!')
    } catch {
      toast.error('Failed to resend. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 mb-4">
          <Globe className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">Check your email</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          We sent a verification link to{' '}
          {email && <span className="font-medium text-stone-700 dark:text-stone-300">{email}</span>}
        </p>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Mail className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Click the link in the email to verify your account. Check your spam folder if you don&apos;t see it.
            </p>
            <Button variant="outline" onClick={handleResend} disabled={loading || !email}>
              {loading ? 'Sending…' : 'Resend verification email'}
            </Button>
          </CardContent>
        </Card>

        <p className="text-sm text-stone-500 dark:text-stone-400 mt-4">
          Wrong email?{' '}
          <Link href="/register" className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium">
            Start over
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center"><div className="text-stone-500">Loading...</div></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
