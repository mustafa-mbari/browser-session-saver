import { useState } from 'react';
import { ExternalLink, Pencil, Pause, Play, XCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Subscription } from '@core/types/subscription.types';
import { SubscriptionService } from '@core/services/subscription.service';
import { resolveFavIcon, getFaviconFallbackUrl, getFaviconInitial } from '@core/utils/favicon';

interface Props {
  subscription: Subscription;
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Subscription['status']) => void;
}

const urgencyBorder: Record<string, string> = {
  overdue: 'border-l-4 border-l-red-500',
  today:   'border-l-4 border-l-orange-500',
  urgent:  'border-l-4 border-l-orange-400',
  soon:    'border-l-4 border-l-yellow-400',
  safe:    'border-l-4 border-l-transparent',
};

const statusBadge: Record<Subscription['status'], { label: string; cls: string }> = {
  active:    { label: '🟢 Active',    cls: 'text-green-600  dark:text-green-400  bg-green-50  dark:bg-green-900/20'  },
  trial:     { label: '🟡 Trial',     cls: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' },
  canceling: { label: '🟠 Canceling', cls: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' },
  paused:    { label: '⏸ Paused',    cls: 'text-gray-500   dark:text-gray-400   bg-gray-50   dark:bg-gray-800/40'   },
  canceled:  { label: '⛔ Canceled',  cls: 'text-gray-400   dark:text-gray-500   bg-gray-50   dark:bg-gray-800/40'   },
};

function FaviconImage({ url, name, size = 16 }: { url?: string; name: string; size?: number }) {
  const [tryIdx, setTryIdx] = useState(0);
  const sources = url
    ? [resolveFavIcon('', url), getFaviconFallbackUrl(url)].filter(Boolean)
    : [];
  const src = sources[tryIdx] ?? '';

  if (!src) {
    return (
      <span
        className="flex items-center justify-center rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
      >
        {getFaviconInitial(name, url ?? '')}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="rounded shrink-0"
      style={{ width: size, height: size }}
      onError={() => setTryIdx((i) => i + 1)}
    />
  );
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBillingCycle(cycle: Subscription['billingCycle']): string {
  return { monthly: 'Monthly', yearly: 'Yearly', weekly: 'Weekly', custom: 'Custom' }[cycle];
}

export default function SubscriptionRow({ subscription: s, onEdit, onDelete, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const urgency = SubscriptionService.getUrgency(s);
  const days = SubscriptionService.getDaysUntil(s.nextBillingDate);
  const badge = statusBadge[s.status];

  const daysLabel = (() => {
    if (s.status === 'canceled' || s.status === 'paused') return null;
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days <= 7) return `${days}d left`;
    return null;
  })();

  return (
    <div className={`rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors ${urgencyBorder[urgency]}`}>
      {/* Main row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <FaviconImage url={s.url} name={s.name} size={18} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[var(--color-text)] truncate">{s.name}</span>
            {daysLabel && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                urgency === 'overdue' || urgency === 'today' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                urgency === 'urgent' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              }`}>
                {daysLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-[var(--color-text-secondary)]">{formatBillingCycle(s.billingCycle)}</span>
            <span className="text-[11px] text-[var(--color-text-secondary)] opacity-50">·</span>
            <span className="text-[11px] text-[var(--color-text-secondary)]">{formatDate(s.nextBillingDate)}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-semibold text-[var(--color-text)]">
            {SubscriptionService.formatCurrency(s.price, s.currency)}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {expanded
          ? <ChevronDown size={14} className="shrink-0 text-[var(--color-text-secondary)]" />
          : <ChevronRight size={14} className="shrink-0 text-[var(--color-text-secondary)]" />
        }
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-[var(--color-border)]">
          {/* Info rows */}
          {(s.paymentMethod || s.notes || (s.tags && s.tags.length > 0)) && (
            <div className="pt-2 flex flex-col gap-1">
              {s.paymentMethod && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text)]">Payment:</span>
                  <span>{s.paymentMethod}</span>
                </div>
              )}
              {s.notes && (
                <div className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text)] shrink-0">Notes:</span>
                  <span>{s.notes}</span>
                </div>
              )}
              {s.tags && s.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {s.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            {s.url && (
              <button
                onClick={(e) => { e.stopPropagation(); chrome.tabs.create({ url: s.url }); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                aria-label="Open site"
              >
                <ExternalLink size={12} />
                <span>Open</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(s); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              aria-label="Edit"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
            {s.status !== 'paused' ? (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(s.id, 'paused'); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                aria-label="Pause"
              >
                <Pause size={12} />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(s.id, 'active'); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                aria-label="Resume"
              >
                <Play size={12} />
                <span>Resume</span>
              </button>
            )}
            {s.status !== 'canceled' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(s.id, 'canceled'); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                aria-label="Cancel"
              >
                <XCircle size={12} />
                <span>Cancel</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
              aria-label="Delete"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
