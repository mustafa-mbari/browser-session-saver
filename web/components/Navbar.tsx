'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/lib/theme'
import { Sun, Moon } from 'lucide-react'

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <nav className="flex items-center justify-between px-6 h-16 border-b border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-card)]">
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/icons/browser-hub_logo.png" width={32} height={32} alt="Browser Hub" />
        <span className="font-semibold text-stone-900 dark:text-stone-100">Browser Hub</span>
      </Link>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link
          href="/login"
          className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </nav>
  )
}
