import { Suspense } from 'react'
import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign In — Browser Hub',
  description: 'Sign in to Browser Hub to manage your browser sessions.',
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-stone-500">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
