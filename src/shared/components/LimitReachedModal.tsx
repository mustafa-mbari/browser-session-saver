import { useEffect } from 'react';
import { X, Zap, LogIn } from 'lucide-react';
import type { LimitStatus } from '@core/types/limits.types';

interface Props {
  status: LimitStatus;
  onClose: () => void;
}

const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000';

export default function LimitReachedModal({ status, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isGuest = status.tier === 'guest';
  const isMonthlyBlocked = status.monthlyBlocked;

  const message = isMonthlyBlocked
    ? `You've reached your monthly limit of ${status.monthlyLimit} actions.`
    : `You've reached your daily limit of ${status.dailyLimit} actions.`;

  const subMessage = isMonthlyBlocked
    ? 'Your limit will reset at the start of next month.'
    : 'Your daily limit resets at midnight.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-xl shadow-2xl p-5 mx-4"
        style={{
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <h2 className="text-base font-semibold">Action Limit Reached</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Usage bars */}
        <div className="space-y-3 mb-4">
          <UsageBar label="Daily" used={status.dailyUsed} limit={status.dailyLimit} />
          <UsageBar label="Monthly" used={status.monthlyUsed} limit={status.monthlyLimit} />
        </div>

        {/* Message */}
        <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}>{message}</p>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{subMessage}</p>

        {/* CTA */}
        {isGuest ? (
          <button
            onClick={() => chrome.tabs.create({ url: `${SITE_URL}/login` })}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-[#625fff] text-white hover:bg-[#7c6fff] transition-colors"
          >
            <LogIn size={14} />
            Sign in for more actions
          </button>
        ) : (
          <button
            onClick={() => chrome.tabs.create({ url: `${SITE_URL}/billing` })}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-[#625fff] text-white hover:bg-[#7c6fff] transition-colors"
          >
            <Zap size={14} />
            Upgrade your plan
          </button>
        )}

        <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--color-text-secondary, #9ca3af)' }}>
          Tier: <span className="font-medium capitalize">{status.tier}</span>
        </p>
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const barColor = pct >= 1 ? '#ef4444' : pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#625fff';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{label}</span>
        <span className="font-medium">{used} / {limit}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-secondary, #f3f4f6)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
