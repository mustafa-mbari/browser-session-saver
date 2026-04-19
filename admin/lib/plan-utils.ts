// Pure plan helpers — safe to import in both Server and Client Components.
// No server-only imports (no next/headers, no supabase/server).

const BADGE_CLASSES: Record<string, string> = {
  guest:    'bg-stone-50 text-stone-500 dark:bg-stone-900/50 dark:text-stone-400',
  free:     'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  pro:      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  lifetime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  max:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

export function planBadgeClass(planId: string): string {
  return BADGE_CLASSES[planId] ?? BADGE_CLASSES.free
}

const BAR_COLORS: Record<string, string> = {
  guest:    'bg-stone-300',
  free:     'bg-stone-400',
  pro:      'bg-indigo-500',
  lifetime: 'bg-purple-500',
  max:      'bg-purple-500',
}

export function planBarColor(planId: string): string {
  return BAR_COLORS[planId] ?? 'bg-stone-400'
}
