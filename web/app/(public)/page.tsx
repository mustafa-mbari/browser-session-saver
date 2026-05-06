import Image from 'next/image'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BookMarked, ShieldCheck, Layers2, LayoutDashboard, Sparkles, CalendarCheck } from 'lucide-react'

// ── Feature bento data ─────────────────────────────────────────────────────

type Feature = {
  icon: LucideIcon
  iconClass: string
  title: string
  description: string
  wide?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: BookMarked,
    iconClass: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    title: 'Session Saving',
    description:
      'Capture all windows, tabs, and groups with one click. Restore any session instantly — exactly as you left it.',
    wide: true,
  },
  {
    icon: ShieldCheck,
    iconClass: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    title: 'Auto-Save Engine',
    description:
      'Saves trigger on shutdown, sleep, idle, and low battery — without lifting a finger.',
  },
  {
    icon: Layers2,
    iconClass: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400',
    title: 'Tab Groups',
    description:
      'Save Chrome tab groups as named templates. Restore your full context in one click.',
  },
  {
    icon: LayoutDashboard,
    iconClass: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
    title: 'Start-Tab Dashboard',
    description:
      'Replace your new tab with a productivity hub — bookmarks, notes, to-dos, and quick links.',
  },
  {
    icon: Sparkles,
    iconClass: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400',
    title: 'Prompt Manager',
    description:
      'Store AI prompts with {{variable}} templates. Search and copy with one click.',
  },
  {
    icon: CalendarCheck,
    iconClass: 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400',
    title: 'Subscription Tracker',
    description:
      'Track recurring bills on your start page with colour-coded urgency alerts before renewals.',
    wide: true,
  },
]

// ── Page ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative isolate flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 text-center overflow-hidden">

        {/* Ambient glow orbs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/25 blur-3xl" />
          <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] rounded-full bg-violet-400/15 dark:bg-violet-500/20 blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] rounded-full bg-purple-400/15 dark:bg-purple-500/20 blur-3xl" />
        </div>

        <div className="animate-fade-in max-w-3xl w-full">

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-8 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
            Chrome Extension &middot; Free to start
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-7">
            <Image
              src="/icons/browser-hub_logo.png"
              width={88}
              height={88}
              alt="Browser Hub logo"
              priority
              className="drop-shadow-2xl"
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            <span className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-600 dark:from-white dark:via-stone-100 dark:to-stone-300 bg-clip-text text-transparent">
              Your tabs,{' '}
            </span>
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
              always safe.
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-xl text-stone-500 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Save sessions in one click. Auto-save protects your work before shutdown, sleep, or low
            battery. Restore everything, exactly where you left off.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-7">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-8 py-3.5 rounded-xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 text-base"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-200 px-8 py-3.5 rounded-xl font-semibold hover:bg-white dark:hover:bg-white/10 transition-all duration-200 text-base"
            >
              Sign In
            </Link>
          </div>

          {/* Trust note */}
          <p className="text-sm text-stone-400 dark:text-stone-500 tracking-wide">
            Free forever &nbsp;&middot;&nbsp; No credit card &nbsp;&middot;&nbsp; All data stays on your device
          </p>
        </div>
      </section>

      {/* ── Feature Highlights ──────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Section heading */}
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-br from-stone-900 to-stone-700 dark:from-white dark:to-stone-300 bg-clip-text text-transparent">
                One extension.{' '}
              </span>
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                Six powerful tools.
              </span>
            </h2>
            <p className="text-stone-500 dark:text-stone-400 text-lg max-w-lg mx-auto">
              Private by design — all your data stays on your device, always.
            </p>
          </div>

          {/* Bento grid: 4-col on lg, 2-col on sm, 1-col on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="relative isolate py-28 px-6 text-center overflow-hidden">
        {/* Gradient background */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 dark:from-indigo-700 dark:via-indigo-800 dark:to-violet-900"
        />
        {/* Glow highlight */}
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-white/10 blur-3xl pointer-events-none -z-10"
        />

        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
          Ready to tame your tabs?
        </h2>
        <p className="text-indigo-200 text-xl mb-10">
          Join free. No credit card required. Your data stays private.
        </p>
        <Link
          href="/register"
          className="inline-block bg-white text-indigo-700 font-bold px-10 py-4 rounded-xl shadow-2xl hover:bg-indigo-50 transition-colors text-lg"
        >
          Get Started Free
        </Link>
      </section>
    </>
  )
}

// ── FeatureCard component ──────────────────────────────────────────────────

function FeatureCard({ icon: Icon, iconClass, title, description, wide }: Feature) {
  return (
    <div
      className={[
        'group rounded-2xl border border-stone-200 dark:border-white/10',
        'bg-white dark:bg-[var(--dark-card)]',
        'p-7 shadow-sm',
        'hover:shadow-xl hover:shadow-stone-200/60 dark:hover:shadow-black/30',
        'hover:border-stone-300 dark:hover:border-white/20',
        'transition-all duration-300',
        wide ? 'lg:col-span-2' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 ${iconClass}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">{title}</h3>
      <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
