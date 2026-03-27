'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type SidebarMode = 'expanded' | 'collapsed' | 'hover'

interface SidebarContextValue {
  mode: SidebarMode
  open: boolean
  setMode: (mode: SidebarMode) => void
  setOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value};path=/;expires=${expires};SameSite=Lax`
}

export function SidebarProvider({
  children,
  defaultMode = 'expanded',
}: {
  children: ReactNode
  defaultMode?: SidebarMode
}) {
  const [mode, setModeState] = useState<SidebarMode>(defaultMode)
  const [open, setOpen] = useState(defaultMode !== 'collapsed')

  const setMode = useCallback((next: SidebarMode) => {
    setModeState(next)
    setCookie('admin_sidebar_mode', next, 30)
    if (next === 'expanded') setOpen(true)
    if (next === 'collapsed') setOpen(false)
    if (next === 'hover') setOpen(false)
  }, [])

  return (
    <SidebarContext.Provider value={{ mode, open, setMode, setOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
