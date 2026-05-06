import Image from 'next/image'
import Link from 'next/link'
import { BookMarked, ShieldCheck, Layers2, LayoutDashboard, Sparkles, CalendarCheck } from 'lucide-react'

const FEATURES = [
  {
    icon: BookMarked,
    iconClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    title: 'Session Saving',
    description:
      'Capture all windows, tabs, and groups with one click. Restore any session instantly, any time.',
  },
  {
    icon: ShieldCheck,
    iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    title: 'Auto-Save Engine',
    description:
      'Never lose tabs again. Auto-saves trigger on shutdown, sleep, idle, and low battery — without lifting a finger.',
  },
  {
    icon: Layers2,
    iconClass: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    title: 'Tab Groups',
    description:
      'Save Chrome tab groups as named templates and restore your full workflow in a single click.',
  },
  {
    icon: LayoutDashboard,
    iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    title: 'Start-Tab Dashboard',
    description:
      'Replace your new tab page with a productivity hub — bookmarks, notes, to-dos, and quick links.',
  },
  {
    icon: Sparkles,
    iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    title: 'Prompt Manager',
    description:
      'Store and search AI prompts with {{variable}} templates. Copy to clipboard in one click.',
  },
  {
    icon: CalendarCheck,
    iconClass: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    title: 'Subscription Tracker',
    description:
      'Track recurring bills right on your start page with colour-coded renewal urgency alerts.',
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 text-center animate-fade-in">
        <Image
          src="/icons/browser-hub_logo.png"
          width={72}
          height={72}
          alt="Browser Hub"
          className="mb-6"
          priority
        />
        <h1 className="text-5xl font-bold text-stone-900 dark:text-stone-100 mb-4 leading-tight">
          Your tabs, always safe.
        </h1>
        <p className="text-lg text-stone-500 dark:text-stone-400 max-w-xl mb-8 leading-relaxed">
          Save sessions in one click. Auto-save protects your work before shutdown, sleep, or low
          battery. Restore everything, exactly where you left off.
        </p>
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/register"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="text-stone-600 dark:text-stone-400 px-6 py-3 rounded-xl font-semibold border border-stone-200 dark:border-[var(--dark-border)] hover:bg-stone-100 dark:hover:bg-[var(--dark-hover)] transition-colors"
          >
            Sign In
          </Link>
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Free to start&nbsp;·&nbsp;No credit card required&nbsp;·&nbsp;All data stored locally on your device
        </p>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 px-6 bg-stone-50 dark:bg-[var(--dark-elevated)]/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-900 dark:text-stone-100 text-center mb-3">
            Everything you need to manage your browser
          </h2>
          <p className="text-stone-500 dark:text-stone-400 text-center mb-12">
            One extension. Six powerful tools. All your data stays on your device.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, iconClass, title, description }) => (
              <div
                key={title}
                className="bg-white dark:bg-[var(--dark-card)] rounded-2xl border border-stone-200 dark:border-[var(--dark-border)] p-6 shadow-sm"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 mt-4 mb-2">
                  {title}
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Strip */}
      <section className="bg-indigo-600 dark:bg-indigo-700 py-16 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">
          Ready to take control of your browser?
        </h2>
        <p className="text-indigo-200 mb-8">Join free. No credit card required.</p>
        <Link
          href="/register"
          className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
        >
          Get Started Free
        </Link>
      </section>
    </>
  )
}
