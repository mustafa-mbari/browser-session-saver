'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

function isRateLimitError(message: string) {
  return (
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('too many') ||
    message.includes('429')
  )
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasLength = password.length >= 8

  if (!password) return null

  const checks = [
    { label: '8+ characters', met: hasLength },
    { label: 'Uppercase letter', met: hasUpper },
    { label: 'Lowercase letter', met: hasLower },
    { label: 'Number', met: hasNumber },
  ]

  return (
    <div className="space-y-1 mt-1.5">
      {checks.map(check => (
        <div key={check.label} className="flex items-center gap-1.5 text-xs">
          <div className={`w-1.5 h-1.5 rounded-full ${check.met ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'}`} />
          <span className={check.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}>
            {check.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function RegisterForm() {
  const router = useRouter()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)

    if (!hasUpper || !hasLower || !hasNumber) {
      toast.error('Password must contain uppercase, lowercase, and a number')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Registration failed')

      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      toast.error(isRateLimitError(msg) ? 'Too many attempts. Please try again later.' : msg)
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleOAuth() {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex">
      {/* Left panel - branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center px-12 py-16 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/30 dark:via-[var(--dark)] dark:to-violet-950/20 border-r border-stone-200 dark:border-[var(--dark-border)]">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Image src="/icons/icon-128.png" alt="Browser Hub" width={40} height={40} className="rounded-xl" />
              <span className="text-xl font-bold text-stone-900 dark:text-stone-100">Browser Hub</span>
            </div>
            <h2 className="text-3xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
              Start managing your browser sessions
            </h2>
            <p className="mt-2 text-base text-stone-500 dark:text-stone-400">
              Create an account to save, sync, and restore your browser sessions across devices.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Privacy First</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Your session data stays secure and private</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Cloud Backup</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Never lose your sessions again with automatic cloud sync</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-6">
            <Image src="/icons/icon-128.png" alt="Browser Hub" width={48} height={48} className="rounded-xl mb-3 mx-auto" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Create an account</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Get started with Browser Hub for free
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="displayName">Display name</Label>
                    <span className="text-xs text-stone-400 dark:text-stone-500">Optional</span>
                  </div>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    autoComplete="name"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>

              <div className="relative my-4">
                <Separator />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-white dark:bg-[var(--dark-card)] px-2 text-xs text-stone-500 dark:text-stone-400">
                    or continue with
                  </span>
                </div>
              </div>

              <Button variant="outline" onClick={handleGoogleOAuth} className="w-full">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-stone-500 dark:text-stone-400 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
