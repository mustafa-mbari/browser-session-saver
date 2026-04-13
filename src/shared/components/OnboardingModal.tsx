import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Keyboard,
  LayoutDashboard,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';

type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

export const ONBOARDING_STORAGE_KEY = 'browser_hub_onboarding_complete';

interface Props {
  isOpen: boolean;
  /** Called when the user completes or dismisses onboarding. Parent writes the flag. */
  onClose: () => void;
}

interface Step {
  title: string;
  body: string;
  hint?: string;
  icon: IconComponent;
  accent: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to Browser Hub',
    body:
      'Save any set of open tabs in one click, restore them later in a single new window, and keep everything organized with tags and auto-save.',
    hint: 'Open the side panel any time from the toolbar icon.',
    icon: BookmarkPlus,
    accent: 'from-indigo-500 to-purple-500',
  },
  {
    title: 'Save your first session',
    body:
      'Click the floppy-disk button in the side panel header, or press Ctrl+Shift+S anywhere in the browser. All open tabs in the current window are captured and named automatically.',
    hint: 'Tip: hold the button to save every open window at once.',
    icon: BookmarkPlus,
    accent: 'from-sky-500 to-indigo-500',
  },
  {
    title: 'Auto-save has your back',
    body:
      'Browser Hub snapshots your tabs every few minutes and on important events (startup, idle, browser close). Your work is never lost — find snapshots under the Auto-saves tab.',
    hint: 'You can tune the interval and triggers in Settings.',
    icon: Timer,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'Your personal start-tab',
    body:
      'Open a new tab to see the glassmorphism dashboard: bookmarks, notes, todos, subscriptions, clock, and tab-group widgets. Drag widgets to reorder; resize them in place.',
    hint: 'Press Ctrl+Shift+L to cycle through Minimal / Focus / Dashboard layouts.',
    icon: LayoutDashboard,
    accent: 'from-pink-500 to-rose-500',
  },
  {
    title: 'Prompts & subscriptions',
    body:
      'Store reusable AI prompts with {{variables}} and track recurring subscriptions with renewal reminders — both live in the side panel and in start-tab widgets.',
    hint: 'Ctrl+Shift+P opens prompts; the 💳 button opens subscriptions.',
    icon: Sparkles,
    accent: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Cloud sync (optional)',
    body:
      'Sign in to sync sessions, prompts, subscriptions, and dashboard widgets across devices. Your data is tied to your Browser Hub account — sync is entirely off until you enable it.',
    hint: 'Click the ☁️ button in the header to sign in.',
    icon: Cloud,
    accent: 'from-cyan-500 to-sky-500',
  },
  {
    title: 'Keyboard shortcuts',
    body:
      'Ctrl+Shift+S save · Ctrl+Shift+R reset view · Ctrl+Shift+F focus search · Ctrl+Shift+E export · Ctrl+Shift+P prompts · Ctrl+Shift+B subscriptions · Ctrl+Shift+L cycle layout.',
    icon: Keyboard,
    accent: 'from-violet-500 to-fuchsia-500',
  },
];

export default function OnboardingModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;

  useEffect(() => {
    if (!isOpen) setStep(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, total - 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, total]);

  const next = useCallback(() => {
    if (step === total - 1) onClose();
    else setStep((s) => s + 1);
  }, [step, total, onClose]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  if (!isOpen) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === total - 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--color-bg, #ffffff)', color: 'var(--color-text, #111827)' }}
      >
        {/* Accent header */}
        <div
          className={`bg-gradient-to-br ${current.accent} px-5 pt-5 pb-6 text-white relative`}
        >
          <button
            onClick={onClose}
            aria-label="Skip onboarding"
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
              <Icon size={22} className="text-white" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
              Step {step + 1} of {total}
            </span>
          </div>
          <h2 id="onboarding-title" className="text-lg font-bold leading-tight">
            {current.title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text, #111827)' }}>
            {current.body}
          </p>
          {current.hint && (
            <p
              className="mt-3 text-xs italic leading-relaxed"
              style={{ color: 'var(--color-text-secondary, #6b7280)' }}
            >
              {current.hint}
            </p>
          )}

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  background:
                    i === step
                      ? 'var(--color-text, #111827)'
                      : 'var(--color-border, #d1d5db)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between gap-2 px-5 py-4 border-t"
          style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
        >
          <button
            onClick={onClose}
            className="text-xs font-medium px-2 py-1.5 rounded-md transition-colors"
            style={{ color: 'var(--color-text-secondary, #6b7280)' }}
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
            >
              <ChevronLeft size={13} /> Back
            </button>
            <button
              onClick={next}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md text-white transition-opacity hover:opacity-90 bg-gradient-to-br ${current.accent}`}
            >
              {isLast ? 'Get started' : 'Next'}
              {!isLast && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hook: tracks whether onboarding has been completed ────────────────────

/** Imperatively re-open the onboarding tour. Clears the persisted flag so every
 *  surface (sidepanel + start-tab) re-shows it via chrome.storage.onChanged. */
export async function resetOnboarding(): Promise<void> {
  await new Promise<void>((resolve) =>
    chrome.storage.local.remove(ONBOARDING_STORAGE_KEY, () => resolve()),
  );
}

export function useOnboardingFlag(): {
  needsOnboarding: boolean | null;
  markComplete: () => Promise<void>;
  reset: () => Promise<void>;
} {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(ONBOARDING_STORAGE_KEY, (r) => {
      if (cancelled) return;
      setNeedsOnboarding(r[ONBOARDING_STORAGE_KEY] !== true);
    });

    // Keep other surfaces in sync when one completes onboarding so the user
    // doesn't see the tour twice (e.g. in both side panel and start-tab).
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (ONBOARDING_STORAGE_KEY in changes) {
        setNeedsOnboarding(changes[ONBOARDING_STORAGE_KEY].newValue !== true);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const markComplete = useCallback(async () => {
    setNeedsOnboarding(false);
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: true }, () => resolve()),
    );
  }, []);

  const reset = useCallback(async () => {
    await resetOnboarding();
    setNeedsOnboarding(true);
  }, []);

  return { needsOnboarding, markComplete, reset };
}
