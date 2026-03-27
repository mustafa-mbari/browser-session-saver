import { Globe } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
      <div className="text-center max-w-2xl animate-fade-in">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 mx-auto mb-6">
          <Globe className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-stone-900 dark:text-stone-100 mb-4">
          Browser Hub
        </h1>
        <p className="text-lg text-stone-600 dark:text-stone-400 mb-8">
          Save, restore, and manage your browser sessions. Boost your productivity with smart tab management.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="text-stone-600 dark:text-stone-400 px-6 py-3 rounded-xl font-semibold border border-stone-200 dark:border-[var(--dark-border)] hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
