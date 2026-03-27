import { Navbar } from '@/components/Navbar'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[var(--dark)]">
      <Navbar />
      <main>{children}</main>
    </div>
  )
}
