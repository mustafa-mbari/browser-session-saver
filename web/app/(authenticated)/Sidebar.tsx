'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Database,
  CreditCard,
  Settings2,
  LifeBuoy,
  Lightbulb,
  Zap,
  PanelLeft,
  Check,
  type LucideIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebarLock, type SidebarMode } from '@/hooks/use-sidebar-lock'
import { cn } from '@/lib/utils'

interface UserInfo {
  email: string
  displayName: string | null
}

interface Props {
  userInfo?: UserInfo
}

const SIDEBAR_MODES: { value: SidebarMode; label: string }[] = [
  { value: 'expanded', label: 'Expanded' },
  { value: 'collapsed', label: 'Collapsed' },
  { value: 'hover', label: 'Expand on hover' },
]

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  open,
}: {
  href: string
  label: string
  icon: LucideIcon
  isActive: boolean
  open: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className="group/nav flex items-center h-10 rounded-lg mx-2 overflow-hidden transition-colors hover:bg-[#ebebeb] dark:hover:bg-[var(--dark-hover)]"
    >
      <span
        className={cn(
          'w-8 h-8 flex items-center justify-center shrink-0 rounded-lg transition-colors',
          isActive
            ? 'bg-[#e8e6ff] dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
            : 'text-stone-500 dark:text-stone-400 group-hover/nav:text-stone-800 dark:group-hover/nav:text-stone-100',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span
        className={cn(
          'text-[13px] whitespace-nowrap overflow-hidden',
          isActive
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-stone-500 dark:text-stone-400 group-hover/nav:text-stone-800 dark:group-hover/nav:text-stone-100',
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

function SidebarFooterContent() {
  const { state, setOpen } = useSidebar()
  const { mode, setMode } = useSidebarLock()
  const isCollapsed = state === 'collapsed'

  function handleSetMode(next: SidebarMode) {
    setMode(next)
    if (next === 'expanded') setOpen(true)
    if (next === 'collapsed') setOpen(false)
  }

  return (
    <SidebarFooter className="gap-0 pb-2 pt-0">
      <div className={`px-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              <button
                className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
                aria-label="Sidebar control"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors text-xs"
                aria-label="Sidebar control"
              >
                <PanelLeft className="h-4 w-4 shrink-0" />
                <span>Sidebar control</span>
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isCollapsed ? 'right' : 'top'}
            align={isCollapsed ? 'end' : 'start'}
            className="w-48"
          >
            <DropdownMenuLabel className="text-xs text-stone-400 font-medium">
              Sidebar control
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SIDEBAR_MODES.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => handleSetMode(value)}
                className="flex items-center justify-between"
              >
                <span>{label}</span>
                {mode === value && <Check className="h-3.5 w-3.5 text-[#625fff]" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarFooter>
  )
}

export default function AppSidebar({ userInfo }: Props) {
  const pathname = usePathname()
  const { setOpen, isMobile, open } = useSidebar()
  const { mode } = useSidebarLock()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const handleMouseEnter = () => {
    if (!isMobile && mode === 'hover') setOpen(true)
  }
  const handleMouseLeave = () => {
    if (!isMobile && mode === 'hover') setOpen(false)
  }

  const NAV_MAIN = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/my-data', label: 'My Data', icon: Database },
  ]

  const NAV_ACCOUNT = [
    { href: '/billing', label: 'Billing', icon: CreditCard },
    { href: '/settings', label: 'Settings', icon: Settings2 },
    { href: '/support', label: 'Support', icon: LifeBuoy },
    { href: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  ]

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="pt-14"
    >
      <SidebarContent>
        <div className="flex flex-col gap-1 pt-3">
          {NAV_MAIN.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              isActive={isActive(href)}
              open={open}
            />
          ))}
        </div>

        <SidebarSeparator className="my-3" />

        <div className="flex flex-col gap-1">
          {NAV_ACCOUNT.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              isActive={isActive(href)}
              open={open}
            />
          ))}
        </div>
      </SidebarContent>

      <SidebarFooterContent />
    </Sidebar>
  )
}
