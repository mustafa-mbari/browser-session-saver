import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { SyncStatus } from '@core/services/sync.service';
import { QUOTA_WARNING_PCT } from '@core/constants/limits';

type SignInResponse = { success: boolean; email?: string; error?: string };

export default function CloudSyncView() {
  const { sendMessage } = useMessaging();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await sendMessage<SyncStatus>({ action: 'SYNC_GET_STATUS', payload: {} });
    if (res.success && res.data) setStatus(res.data);
  }, [sendMessage]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setSignInError(null);
    const res = await sendMessage<SignInResponse>({
      action: 'SYNC_SIGN_IN',
      payload: { email: email.trim(), password },
    });
    setSigningIn(false);
    if (res.success && res.data?.success) {
      setPassword('');
      await loadStatus();
    } else {
      setSignInError(res.data?.error ?? res.error ?? 'Sign in failed');
    }
  };

  const handleSignOut = async () => {
    await sendMessage({ action: 'SYNC_SIGN_OUT', payload: {} });
    setStatus(null);
    await loadStatus();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    const res = await sendMessage<SyncStatus>({ action: 'SYNC_NOW', payload: {} });
    setSyncing(false);
    if (res.success && res.data) setStatus(res.data);
    else await loadStatus();
  };

  // ─── Not signed in ────────────────────────────────────────────────────────
  if (!status?.isAuthenticated) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center gap-2 mb-6">
          <CloudOff size={20} className="text-[var(--color-text-secondary)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Not connected to the cloud</span>
        </div>

        <div className="mb-5">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Sign in with your Browser Hub account to sync sessions, prompts, and subscriptions across devices.
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {signInError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              {signInError}
            </div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {signingIn ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
            {signingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-[var(--color-text-secondary)]">
          No account?{' '}
          <a
            href="https://browserhub.app/register"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Create one at browserhub.app
          </a>
        </p>
      </div>
    );
  }

  // ─── Signed in ────────────────────────────────────────────────────────────
  const { quota, usage, lastSyncAt, error } = status;

  const isAtQuota =
    quota != null &&
    usage != null &&
    ((quota.sessions_synced_limit != null && usage.sessions >= quota.sessions_synced_limit) ||
      (quota.prompts_create_limit != null && usage.prompts >= quota.prompts_create_limit) ||
      (quota.subs_synced_limit != null && usage.subs >= quota.subs_synced_limit));

  const lastSyncLabel = (() => {
    if (!lastSyncAt) return 'Never';
    const diff = Date.now() - new Date(lastSyncAt).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(lastSyncAt).toLocaleDateString();
  })();

  const planColor =
    quota?.plan_id === 'max'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      : quota?.plan_id === 'pro'
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
        : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300';

  return (
    <div className="flex-1 overflow-auto p-4 space-y-5">
      {/* Account header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={18} className="text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">{status.email}</p>
            {quota && (
              <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize mt-0.5 ${planColor}`}>
                {quota.plan_name ?? quota.plan_id}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          title="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {/* Sync Now + last synced */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Last synced</p>
          <p className="text-sm font-medium">{lastSyncLabel}</p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={syncing || (status.isSyncing ?? false)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {syncing || status.isSyncing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Sync Now
        </button>
      </div>

      {/* Sync error */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Quota reached banner */}
      {isAtQuota && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            You've reached your sync quota. New items won't be synced until you upgrade.{' '}
            <a
              href="https://browserhub.app/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold hover:no-underline"
            >
              Upgrade plan →
            </a>
          </span>
        </div>
      )}

      {/* Quota bars */}
      {quota && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Usage</p>

          <QuotaBar
            label="Sessions synced"
            used={usage?.sessions ?? 0}
            limit={quota.sessions_synced_limit}
          />
          <QuotaBar
            label="Prompts synced"
            used={usage?.prompts ?? 0}
            limit={quota.prompts_create_limit}
          />
          <QuotaBar
            label="Subscriptions synced"
            used={usage?.subs ?? 0}
            limit={quota.subs_synced_limit}
          />
          <QuotaBar
            label="Folders synced"
            used={usage?.folders ?? 0}
            limit={quota.folders_synced_limit}
          />
          <QuotaBar
            label="Tab groups synced"
            used={usage?.tabGroups ?? 0}
            limit={quota.tab_groups_synced_limit}
          />
          {quota.total_tabs_limit != null && quota.total_tabs_limit > 0 && (
            <QuotaBar
              label="Unique tabs synced"
              used={usage?.tabs ?? 0}
              limit={quota.total_tabs_limit}
            />
          )}
          <QuotaBar
            label="Todos synced"
            used={usage?.todos ?? 0}
            limit={quota.todos_synced_limit}
          />
        </div>
      )}

      {/* Plan upgrade nudge for Free users */}
      {quota?.plan_id === 'free' && (
        <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/10">
          <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
            Upgrade to <strong>Pro</strong> or <strong>Max</strong> for more sync quota and features.{' '}
            <a
              href="https://browserhub.app/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              View plans →
            </a>
          </p>
        </div>
      )}

      {/* Sync disabled message */}
      {quota && !quota.sync_enabled && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>
            Cloud sync is not included in your current plan. Upgrade to Pro or Max at{' '}
            <a
              href="https://browserhub.app/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              browserhub.app/billing
            </a>
          </span>
        </div>
      )}

      {/* Auto-sync note */}
      {quota?.sync_enabled && (
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Data syncs automatically every 15 minutes when you are active.
        </p>
      )}
    </div>
  );
}

function QuotaBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
}) {
  const pct = limit != null ? Math.min((used / limit) * 100, 100) : 0;
  const isUnlimited = limit == null;
  const isWarning = !isUnlimited && pct >= QUOTA_WARNING_PCT;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs">{label}</span>
        <span className="text-[11px] text-[var(--color-text-secondary)]">
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
