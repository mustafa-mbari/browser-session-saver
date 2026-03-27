import { Suspense } from 'react'
import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: 'Create Account — Browser Hub',
  description: 'Create a Browser Hub account to manage your browser sessions.',
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-stone-500">Loading...</div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
