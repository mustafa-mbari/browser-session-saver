import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/services/auth'
import { createClient } from '@/lib/supabase/server'
import AppSidebar from './Sidebar'
import AppHeader from './AppHeader'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { SidebarLockProvider } from '@/hooks/use-sidebar-lock'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const userInfo = {
    email: user.email ?? '',
    displayName: (profile?.display_name ?? user.user_metadata?.display_name ?? user.user_metadata?.name ?? null) as string | null,
  }

  const cookieStore = await cookies()
  const rawMode = cookieStore.get('sidebar_mode')?.value
  const sidebarMode = (['expanded', 'collapsed', 'hover'].includes(rawMode ?? '')
    ? rawMode
    : 'hover') as 'expanded' | 'collapsed' | 'hover'
  const sidebarOpen = sidebarMode === 'expanded'

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <SidebarLockProvider defaultMode={sidebarMode}>
        <AppSidebar userInfo={userInfo} />
        <SidebarInset className="bg-stone-50 dark:bg-[var(--dark)]">
          <AppHeader userInfo={userInfo} />
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[85%] px-8 py-8">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarLockProvider>
    </SidebarProvider>
  )
}
