'use client'

import * as React from 'react'

export type SidebarMode = 'expanded' | 'collapsed' | 'hover'

const COOKIE_NAME = 'sidebar_mode'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

interface SidebarLockContextValue {
  mode: SidebarMode
  setMode: (mode: SidebarMode) => void
  locked: boolean
  toggleLock: () => void
}

const SidebarLockContext = React.createContext<SidebarLockContextValue>({
  mode: 'hover',
  setMode: () => {},
  locked: false,
  toggleLock: () => {},
})

export function SidebarLockProvider({
  children,
  defaultMode = 'hover',
}: {
  children: React.ReactNode
  defaultMode?: SidebarMode
}) {
  const [mode, setModeState] = React.useState<SidebarMode>(defaultMode)

  const setMode = React.useCallback((next: SidebarMode) => {
    setModeState(next)
    document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${COOKIE_MAX_AGE}`
  }, [])

  const toggleLock = React.useCallback(() => {
    setModeState((prev) => {
      const next: SidebarMode = prev === 'expanded' ? 'hover' : 'expanded'
      document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${COOKIE_MAX_AGE}`
      return next
    })
  }, [])

  return (
    <SidebarLockContext.Provider
      value={{ mode, setMode, locked: mode === 'expanded', toggleLock }}
    >
      {children}
    </SidebarLockContext.Provider>
  )
}

export function useSidebarLock() {
  return React.useContext(SidebarLockContext)
}
