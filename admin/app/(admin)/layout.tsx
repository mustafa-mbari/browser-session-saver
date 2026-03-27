import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/services/auth'
import { AdminSidebar, AdminMobileHeader, AdminMain } from '@/components/AdminSidebar'
import { SidebarProvider, type SidebarMode } from '@/hooks/use-sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  const email = user.email ?? ''
  const displayName = user.user_metadata?.display_name ?? null

  // Read sidebar mode from cookie for SSR (prevents flash)
  const cookieStore = await cookies()
  const sidebarMode = (cookieStore.get('admin_sidebar_mode')?.value || 'expanded') as SidebarMode

  return (
    <SidebarProvider defaultMode={sidebarMode}>
      <div className="min-h-screen bg-stone-50 dark:bg-[var(--dark)]">
        <AdminSidebar email={email} displayName={displayName} />
        <AdminMobileHeader email={email} displayName={displayName} />
        <AdminMain>{children}</AdminMain>
      </div>
    </SidebarProvider>
  )
}
