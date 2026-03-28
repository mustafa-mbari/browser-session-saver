'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useTheme } from '@/lib/theme'
import { useSidebar } from '@/components/ui/sidebar'
import { Sun, Moon, LogOut, Menu } from 'lucide-react'

interface Props {
  userInfo: {
    email: string
    displayName: string | null
  }
}

export default function AppHeader({ userInfo }: Props) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { toggleSidebar, isMobile } = useSidebar()

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-card)] shrink-0">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={toggleSidebar}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Image
          src="/icons/browser-hub_logo.png"
          alt="Browser Hub"
          width={28}
          height={28}
          className="rounded-lg"
          priority
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="hidden sm:flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400 mr-1">
          <span>{userInfo.displayName || userInfo.email.split('@')[0]}</span>
        </div>

        <button
          onClick={handleSignOut}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
