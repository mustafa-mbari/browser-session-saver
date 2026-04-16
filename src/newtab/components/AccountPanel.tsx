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

export default function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<PlanTier>('guest');
  const [loading, setLoading] = useState(true);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadState();
    const listener = () => { void loadState(); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function loadState() {
    setLoading(true);
    const [authed, cachedTier] = await Promise.all([isAuthenticated(), getCachedPlanTier()]);
    setEmail(authed ? await getEmail() : null);
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

  const inputClass = `
    w-full px-3 py-2 text-sm rounded-lg
    bg-white/10 border border-white/20
    placeholder:opacity-40 focus:outline-none focus:ring-1 focus:ring-white/40
  `;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--newtab-text-secondary)' }} />
      </div>
    );
  }

  if (email) {
    return (
      <div className="h-full overflow-y-auto p-[5%]">
        <div className="max-w-sm mx-auto space-y-4">
          {/* Profile card */}
          <div
            className="glass-panel rounded-2xl p-5 space-y-4"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.35)' }}
              >
                <User size={20} style={{ color: '#818cf8' }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--newtab-text)' }}>
                  {email}
                </p>
                <div className="flex items-center gap-1 text-xs font-medium mt-0.5">
                  {(tier === 'pro' || tier === 'lifetime') && (
                    <Crown size={11} style={{ color: tier === 'lifetime' ? '#f59e0b' : '#a78bfa' }} />
                  )}
                  <span style={{ color: tier === 'lifetime' ? '#f59e0b' : tier === 'pro' ? '#a78bfa' : 'var(--newtab-text-secondary)' }}>
                    {TIER_LABELS[tier]} plan
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => void handleSignOut()}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--newtab-text)',
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-[5%]">
      <div className="max-w-sm mx-auto">
        <div
          className="glass-panel rounded-2xl p-6 space-y-5"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <LogIn size={15} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
                Sign in to Browser Hub
              </h2>
              <p className="text-[11px] opacity-50" style={{ color: 'var(--newtab-text)' }}>
                Unlock higher action limits
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleSignIn(e)} className="space-y-3">
            <div>
              <label
                className="block text-xs mb-1 opacity-60"
                style={{ color: 'var(--newtab-text)' }}
              >
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
                style={{ color: 'var(--newtab-text)' }}
              />
            </div>

            <div>
              <label
                className="block text-xs mb-1 opacity-60"
                style={{ color: 'var(--newtab-text)' }}
              >
                Password
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
                style={{ color: 'var(--newtab-text)' }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'rgba(99,102,241,0.75)', color: '#fff' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Sign in
            </button>
          </form>

          <p className="text-[11px] text-center opacity-50" style={{ color: 'var(--newtab-text)' }}>
            Don&apos;t have an account?{' '}
            <button
              onClick={() => chrome.tabs.create({ url: (import.meta.env.VITE_SITE_URL as string ?? 'https://bh.mbari.de') + '/register' })}
              className="underline opacity-100"
              style={{ color: '#818cf8' }}
            >
              Sign up on the web
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
