"use client"

import { useState, useEffect, type ReactNode } from "react"
import {
  ThemeContext,
  type Theme,
  getSystemTheme,
  storeTheme,
  applyTheme,
} from "@/lib/theme"

interface ThemeProviderProps {
  children: ReactNode
  initialTheme?: Theme
}

export function ThemeProvider({ children, initialTheme = "system" }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    initialTheme === "system" ? "light" : initialTheme
  )

  function setTheme(next: Theme) {
    setThemeState(next)
    storeTheme(next)
    const resolved = next === "system" ? getSystemTheme() : next
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }

  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    applyTheme(resolved)

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    function handleChange() {
      if (theme === "system") {
        const next = getSystemTheme()
        setResolvedTheme(next)
        applyTheme(next)
      }
    }
    mq.addEventListener("change", handleChange)
    return () => mq.removeEventListener("change", handleChange)
  }, [theme])

  return (
    <ThemeContext value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext>
  )
}
