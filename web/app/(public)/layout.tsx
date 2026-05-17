import Link from 'next/link'
import { Navbar } from '@/components/Navbar'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[var(--dark)] flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-stone-200 dark:border-[var(--dark-border)] py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-stone-400 dark:text-stone-500">
          <span>© {new Date().getFullYear()} Browser Hub. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
