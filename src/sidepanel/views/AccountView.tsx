import { useState, useEffect } from 'react';
import { LogIn, LogOut, User, Crown, Loader2 } from 'lucide-react';
import { signIn, signOut, getEmail, isAuthenticated } from '@core/services/auth.service';
import { getCachedPlanTier } from '@core/services/limits/action-tracker';
import type { PlanTier } from '@core/types/limits.types';

const TIER_LABELS: Record<PlanTier, string> = {
  guest: 'Guest',
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

const TIER_COLORS: Record<PlanTier, string> = {
  guest: 'text-gray-500',
  free: 'text-blue-500',
  pro: 'text-purple-500',
  lifetime: 'text-amber-500',
};

export default function AccountView() {
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<PlanTier>('guest');
  const [loading, setLoading] = useState(true);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadState();
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.cached_plan || changes['sb-auth']) void loadState();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadState() {
    setLoading(true);
    const [authed, cachedTier] = await Promise.all([isAuthenticated(), getCachedPlanTier()]);
    if (authed) {
      const userEmail = await getEmail();
      setEmail(userEmail);
    } else {
      setEmail(null);
    }
    setTier(cachedTier);
    setLoading(false);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await signIn(formEmail.trim(), formPassword);
    setSubmitting(false);
    if (result.success) {
      setFormEmail('');
      setFormPassword('');
      await loadState();
    } else {
      setError(result.error ?? 'Sign-in failed. Check your credentials.');
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    await signOut();
    setSubmitting(false);
    await loadState();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  if (email) {
    return (
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Signed-in card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">{email}</p>
              <div className={`flex items-center gap-1 text-xs font-medium ${TIER_COLORS[tier]}`}>
                {(tier === 'pro' || tier === 'lifetime') && <Crown size={11} />}
                <span>{TIER_LABELS[tier]} plan</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => void handleSignOut()}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div className="flex items-center gap-2 mb-4">
          <LogIn size={16} className="text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Sign in to Browser Hub</h2>
        </div>

        <form onSubmit={(e) => void handleSignIn(e)} className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Email</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Password</label>
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            Sign in
          </button>
        </form>

        <p className="mt-3 text-[11px] text-[var(--color-text-secondary)] text-center">
          Don&apos;t have an account?{' '}
          <button
            onClick={() => chrome.tabs.create({ url: (import.meta.env.VITE_SITE_URL as string ?? 'https://bh.mbari.de') + '/register' })}
            className="text-primary hover:underline"
          >
            Sign up on the web
          </button>
        </p>
      </div>
    </div>
  );
}
