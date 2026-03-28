import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import type { Theme } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Browser Hub',
  description: 'Browser session management and productivity tools',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '128x128' },
    ],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('theme')?.value
  const initialTheme: Theme = (themeCookie === 'light' || themeCookie === 'dark' || themeCookie === 'system')
    ? themeCookie
    : 'system'

  // Apply the known theme class server-side to prevent FOUC.
  // ThemeProvider's useEffect handles the 'system' case client-side.
  const htmlClass = initialTheme === 'dark' ? 'dark' : undefined

  return (
    <html lang="en" suppressHydrationWarning className={htmlClass}>
      <body className="min-h-screen dark:bg-[var(--dark)] dark:text-stone-200">
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
