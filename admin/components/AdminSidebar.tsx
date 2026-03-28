'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import { useSidebar } from '@/hooks/use-sidebar'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Ticket,
  CreditCard,
  Activity,
  Mail,
  LifeBuoy,
  Lightbulb,
  Gauge,
  Shield,
  LogOut,
  Sun,
  Moon,
  Menu,
  PanelLeft,
  Check,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/stats', label: 'Statistics', icon: BarChart3 },
  { href: '/promos', label: 'Promo Codes', icon: Ticket },
  { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/webhooks', label: 'Webhooks', icon: Activity },
  { href: '/tickets', label: 'Tickets', icon: LifeBuoy },
  { href: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { href: '/quotas', label: 'Quotas', icon: Gauge },
  { href: '/emails', label: 'Emails', icon: Mail },
]

const MODE_OPTIONS = [
  { value: 'expanded' as const, label: 'Expanded' },
  { value: 'collapsed' as const, label: 'Collapsed' },
  { value: 'hover' as const, label: 'Expand on hover' },
]

interface AdminSidebarProps {
  email: string
  displayName: string | null
}

/* ----------------------------------------------------------------
   NavLink — icon always 32x32, text fades via max-width + opacity
   ---------------------------------------------------------------- */
function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  open,
  onClick,
}: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  isActive: boolean
  open: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      title={!open ? label : undefined}
      className={cn(
        'group/nav flex items-center h-10 rounded-lg mx-2 overflow-hidden transition-colors',
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-950/40'
          : 'hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)]'
      )}
    >
      <span
        className={cn(
          'w-8 h-8 flex items-center justify-center shrink-0 rounded-lg transition-colors',
          isActive
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
            : 'text-stone-500 dark:text-stone-400 group-hover/nav:text-stone-800 dark:group-hover/nav:text-stone-100'
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span
        className={cn(
          'text-[13px] font-medium whitespace-nowrap overflow-hidden',
          isActive
            ? 'text-indigo-700 dark:text-indigo-300'
            : 'text-stone-500 dark:text-stone-400 group-hover/nav:text-stone-800 dark:group-hover/nav:text-stone-100'
        )}
        style={{
          maxWidth: open ? '200px' : '0px',
          opacity: open ? 1 : 0,
          marginLeft: open ? '8px' : '0px',
          transition: 'max-width 300ms ease-in-out, opacity 250ms ease-in-out 50ms, margin-left 300ms ease-in-out',
        }}
      >
        {label}
      </span>
    </Link>
  )
}

/* ----------------------------------------------------------------
   Footer action button — same transition pattern as NavLink
   ---------------------------------------------------------------- */
function FooterButton({
  label,
  icon: Icon,
  open,
  onClick,
  hoverColor = 'hover:text-stone-800 dark:hover:text-stone-100',
}: {
  label: string
  icon: typeof LogOut
  open: boolean
  onClick: () => void
  hoverColor?: string
}) {
  return (
    <button
      onClick={onClick}
      title={!open ? label : undefined}
      className={cn(
        'group/nav flex items-center h-9 w-full mx-2 rounded-lg overflow-hidden text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors',
        hoverColor
      )}
    >
      <span className="w-8 h-8 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <span
        className="text-[13px] whitespace-nowrap overflow-hidden"
        style={{
          maxWidth: open ? '200px' : '0px',
          opacity: open ? 1 : 0,
          marginLeft: open ? '8px' : '0px',
          transition: 'max-width 300ms ease-in-out, opacity 250ms ease-in-out 50ms, margin-left 300ms ease-in-out',
        }}
      >
        {label}
      </span>
    </button>
  )
}

/* ----------------------------------------------------------------
   SidebarInner — shared content for both desktop & mobile
   ---------------------------------------------------------------- */
function SidebarInner({
  email,
  displayName,
  open,
  onNavClick,
}: AdminSidebarProps & { open: boolean; onNavClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { mode, setMode } = useSidebar()
  const [modeMenuOpen, setModeMenuOpen] = useState(false)

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')

  async function handleSignOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Branding */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0 overflow-hidden">
        <div className="flex items-center justify-center h-8 w-8 shrink-0 rounded-lg bg-indigo-600">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div
          className="flex flex-col overflow-hidden"
          style={{
            maxWidth: open ? '200px' : '0px',
            opacity: open ? 1 : 0,
            transition: 'max-width 300ms ease-in-out, opacity 250ms ease-in-out 50ms',
          }}
        >
          <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 leading-tight whitespace-nowrap">
            Browser Hub
          </span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 leading-tight whitespace-nowrap">
            Admin Panel
          </span>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isActive(item)}
            open={open}
            onClick={onNavClick}
          />
        ))}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="py-3 space-y-1 shrink-0">
        <FooterButton
          label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          icon={resolvedTheme === 'dark' ? Sun : Moon}
          open={open}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        />

        <FooterButton
          label="Sign out"
          icon={LogOut}
          open={open}
          onClick={handleSignOut}
          hoverColor="hover:text-rose-600 dark:hover:text-rose-400"
        />

        {/* Sidebar mode control */}
        <div className="relative">
          <FooterButton
            label="Sidebar control"
            icon={PanelLeft}
            open={open}
            onClick={() => setModeMenuOpen(!modeMenuOpen)}
          />

          {/* Mode dropdown */}
          {modeMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModeMenuOpen(false)} />
              <div className="absolute bottom-0 left-full ml-2 z-50 w-48 py-1 rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-card)] shadow-lg">
                <p className="px-3 py-1.5 text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                  Sidebar control
                </p>
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setMode(opt.value)
                      setModeMenuOpen(false)
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-[13px] text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
                  >
                    <span>{opt.label}</span>
                    {mode === opt.value && <Check className="h-3.5 w-3.5 text-indigo-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Separator className="!my-2 mx-2" />

        {/* User info — hidden when collapsed */}
        <div
          className="px-4 overflow-hidden"
          style={{
            maxHeight: open ? '40px' : '0px',
            opacity: open ? 1 : 0,
            transition: 'max-height 300ms ease-in-out, opacity 250ms ease-in-out 50ms',
          }}
        >
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
            {displayName || 'Admin'}
          </p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">
            {email}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------
   Desktop sidebar — collapsible with smooth transition
   ---------------------------------------------------------------- */
export function AdminSidebar({ email, displayName }: AdminSidebarProps) {
  const { mode, open, setOpen } = useSidebar()

  const handleMouseEnter = () => {
    if (mode === 'hover') setOpen(true)
  }
  const handleMouseLeave = () => {
    if (mode === 'hover') setOpen(false)
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 border-r border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-card)] z-30"
      style={{
        width: open ? '240px' : '48px',
        transition: 'width 300ms ease-in-out',
      }}
    >
      <SidebarInner email={email} displayName={displayName} open={open} />
    </aside>
  )
}

/* ----------------------------------------------------------------
   Mobile header + sheet sidebar
   ---------------------------------------------------------------- */
export function AdminMobileHeader({ email, displayName }: AdminSidebarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <header className="lg:hidden flex items-center gap-3 h-14 px-4 border-b border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-card)] shrink-0">
        <button
          onClick={() => setSheetOpen(true)}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-600">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
            Browser Hub Admin
          </span>
        </div>
      </header>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarInner
            email={email}
            displayName={displayName}
            open={true}
            onNavClick={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ----------------------------------------------------------------
   Dynamic main content wrapper — adjusts padding to sidebar width
   ---------------------------------------------------------------- */
export function AdminMain({ children }: { children: React.ReactNode }) {
  const { open } = useSidebar()

  return (
    <main
      style={{
        paddingLeft: undefined,
      }}
    >
      <div className="mx-auto w-full max-w-[95%] lg:max-w-[85%] px-6 py-8">
        {children}
      </div>
      {/* Dynamic padding synced with sidebar width on desktop */}
      <style>{`
        @media (min-width: 1024px) {
          main {
            padding-left: ${open ? '240px' : '48px'};
            transition: padding-left 300ms ease-in-out;
          }
        }
      `}</style>
    </main>
  )
}
