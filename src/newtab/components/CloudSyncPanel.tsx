import { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CloudOff,
  CloudDownload,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { SyncStatus } from '@core/services/sync.service';
import { QUOTA_WARNING_PCT } from '@core/constants/limits';

type SignInResponse = { success: boolean; email?: string; error?: string };

export default function CloudSyncPanel() {
  const { sendMessage } = useMessaging();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ ok: boolean; msg: string } | null>(null);
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

  const handlePullAll = async () => {
    setPulling(true);
    setPullResult(null);
    const res = await sendMessage<{ success: boolean; pulled: Record<string, number>; error?: string }>({
      action: 'SYNC_PULL_ALL',
      payload: {},
    });
    setPulling(false);
    if (res.success && res.data?.success) {
      const total = Object.values(res.data.pulled).reduce((s, n) => s + n, 0);
      setPullResult({ ok: true, msg: `Restored ${total} item(s) from the cloud.` });
    } else {
      setPullResult({ ok: false, msg: res.data?.error ?? res.error ?? 'Restore failed' });
    }
  };

  // ─── Not signed in ────────────────────────────────────────────────────────
  if (!status?.isAuthenticated) {
    return (
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <CloudOff size={20} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>Not connected</p>
            <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>Sign in to sync across devices</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--newtab-text-secondary)' }}>
          Sign in with your Browser Hub account to sync sessions, prompts, and subscriptions to the cloud.
        </p>

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--newtab-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--newtab-text)',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--newtab-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--newtab-text)',
              }}
            />
          </div>

          {signInError && (
            <div
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              <AlertCircle size={14} className="shrink-0" />
              {signInError}
            </div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50"
            style={{ background: 'rgba(99,102,241,0.8)', color: '#fff' }}
          >
            {signingIn ? <Loader2 size={15} className="animate-spin" /> : <Cloud size={15} />}
            {signingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-center" style={{ color: 'var(--newtab-text-secondary)' }}>
          No account?{' '}
          <a
            href="https://browserhub.app/register"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#818cf8' }}
            className="hover:underline"
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
      ? { bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.3)', text: '#d8b4fe' }
      : quota?.plan_id === 'pro'
        ? { bg: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.3)', text: '#a5b4fc' }
        : { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', text: 'var(--newtab-text-secondary)' };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Account header */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <Cloud size={18} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
              {status.email}
            </p>
            {quota && (
              <span
                className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full capitalize mt-0.5"
                style={{ background: planColor.bg, border: `1px solid ${planColor.border}`, color: planColor.text }}
              >
                {quota.plan_name ?? quota.plan_id}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--newtab-text-secondary)',
          }}
          title="Sign out"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {/* Last synced + Sync Now */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>Last synced</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--newtab-text)' }}>
            {lastSyncLabel}
          </p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={syncing || (status.isSyncing ?? false)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50"
          style={{ background: 'rgba(99,102,241,0.8)', color: '#fff' }}
        >
          {syncing || status.isSyncing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Sync Now
        </button>
      </div>

      {/* Restore from Cloud */}
      <div
        className="p-4 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-start gap-3">
          <CloudDownload size={16} style={{ color: 'var(--newtab-text-secondary)' }} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--newtab-text)' }}>Restore from Cloud</p>
            <p className="text-[11px] leading-snug mb-2" style={{ color: 'var(--newtab-text-secondary)' }}>
              Download your synced data to this device. Existing local items are kept.
            </p>
            <button
              onClick={handlePullAll}
              disabled={pulling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity disabled:opacity-50"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--newtab-text)',
              }}
            >
              {pulling ? <Loader2 size={12} className="animate-spin" /> : <CloudDownload size={12} />}
              {pulling ? 'Restoring…' : 'Restore Now'}
            </button>
            {pullResult && (
              <div
                className="mt-2 flex items-start gap-1.5 text-[11px]"
                style={{ color: pullResult.ok ? '#4ade80' : '#f87171' }}
              >
                {pullResult.ok
                  ? <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                  : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
                {pullResult.msg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync error */}
      {error && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Quota reached banner */}
      {isAtQuota && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
        >
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
        <div
          className="p-4 rounded-2xl space-y-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.7 }}>
            Usage
          </p>
          <QuotaBar label="Sessions synced"       used={usage?.sessions  ?? 0} limit={quota.sessions_synced_limit} />
          <QuotaBar label="Prompts synced"         used={usage?.prompts   ?? 0} limit={quota.prompts_create_limit} />
          <QuotaBar label="Subscriptions synced"   used={usage?.subs      ?? 0} limit={quota.subs_synced_limit} />
          <QuotaBar label="Bookmark folders"        used={usage?.folders   ?? 0} limit={quota.folders_synced_limit} />
          <QuotaBar label="Tab groups synced"      used={usage?.tabGroups ?? 0} limit={quota.tab_groups_synced_limit} />
          {quota.total_tabs_limit != null && quota.total_tabs_limit > 0 && (
            <QuotaBar label="Unique tabs synced"   used={usage?.tabs      ?? 0} limit={quota.total_tabs_limit} />
          )}
          <QuotaBar label="Todos synced"           used={usage?.todos     ?? 0} limit={quota.todos_synced_limit} />
        </div>
      )}

      {/* Plan upgrade nudge */}
      {quota?.plan_id === 'free' && (
        <div
          className="p-4 rounded-2xl text-xs leading-relaxed"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
        >
          Upgrade to <strong>Pro</strong> or <strong>Max</strong> for more sync quota.{' '}
          <a
            href="https://browserhub.app/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            View plans →
          </a>
        </div>
      )}

      {/* Sync disabled */}
      {quota && !quota.sync_enabled && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}
        >
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>
            Cloud sync is not included in your current plan.{' '}
            <a
              href="https://browserhub.app/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Upgrade at browserhub.app/billing
            </a>
          </span>
        </div>
      )}

      {/* Auto-sync note */}
      {quota?.sync_enabled && (
        <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.6 }}>
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
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>{label}</span>
        <span className="text-[11px]" style={{ color: 'var(--newtab-text-secondary)' }}>
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: isWarning ? '#f59e0b' : 'rgba(99,102,241,0.8)',
            }}
          />
        </div>
      )}
    </div>
  );
}
