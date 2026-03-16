import { useEffect, useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import type { BookmarkCategory, SpanValue } from '@core/types/newtab.types';
import type { Subscription, CustomCategory } from '@core/types/subscription.types';
import { CATEGORY_LABELS } from '@core/types/subscription.types';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { SubscriptionService } from '@core/services/subscription.service';
import { resolveFavIcon, getFaviconInitial } from '@core/utils/favicon';
import { useNewTabStore } from '@newtab/stores/newtab.store';
import { safeOpenUrl } from '@core/utils/safe-open';

interface Props {
  category: BookmarkCategory;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}


const urgencyBorder: Record<string, string> = {
  overdue: 'border-l-2 border-l-red-500',
  today:   'border-l-2 border-l-orange-500',
  urgent:  'border-l-2 border-l-orange-400',
  soon:    'border-l-2 border-l-yellow-400',
  safe:    '',
};

const urgencyText: Record<string, string> = {
  overdue: 'text-red-400',
  today:   'text-orange-400',
  urgent:  'text-orange-300',
  soon:    'text-yellow-300',
  safe:    'text-white/40',
};

const statusCls: Record<string, string> = {
  active:    'bg-green-500/20 text-green-300',
  trial:     'bg-violet-500/20 text-violet-300',
  canceling: 'bg-orange-500/20 text-orange-300',
  paused:    'bg-white/10 text-white/35',
  canceled:  'bg-white/5 text-white/20',
};

const billingLabel: Record<string, string> = {
  monthly: 'mo', yearly: 'yr', weekly: 'wk', custom: '—',
};

const CATEGORY_EMOJI: Record<string, string> = {
  work: '💼', personal: '👤', saas: '⚡', streaming: '🎬', utility: '🔧', other: '📦',
};

function FaviconSmall({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = url ? resolveFavIcon('', url) : '';

  if (!faviconUrl || failed) {
    return (
      <span
        className="w-4 h-4 flex items-center justify-center rounded-sm bg-white/20 font-bold shrink-0"
        style={{ fontSize: 9, color: 'var(--newtab-text)' }}
      >
        {getFaviconInitial(name, url ?? '')}
      </span>
    );
  }
  return (
    <img
      src={faviconUrl}
      alt={name}
      className="w-4 h-4 rounded-sm shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

export default function SubscriptionCardBody({ colSpan }: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const setActiveView = useNewTabStore((s) => s.setActiveView);

  useEffect(() => {
    void Promise.all([
      SubscriptionStorage.getAll(),
      SubscriptionStorage.getCustomCategories(),
    ]).then(([subs, cats]) => {
      setSubscriptions(subs);
      setCustomCats(cats);
      setLoading(false);
    });
  }, []);

  // colSpan is received as a prop — already clamped by the parent
  const currency = subscriptions.find((s) => s.status === 'active')?.currency
    ?? subscriptions[0]?.currency ?? 'USD';

  const monthlyTotal = SubscriptionService.getMonthlyTotal(subscriptions);
  const overdue = SubscriptionService.getOverdue(subscriptions).length;
  const dueSoon = SubscriptionService.getDueSoon(subscriptions, 7).length;

  const upcoming = [...subscriptions]
    .filter((s) => s.status !== 'canceled')
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate))
    .slice(0, colSpan >= 7 ? 10 : colSpan >= 4 ? 7 : 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col px-3 pb-3 gap-2">
      {/* Summary strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 text-xs font-medium" style={{ color: 'var(--newtab-text)' }}>
          <span>💳</span>
          <span>{SubscriptionService.formatCurrency(monthlyTotal, currency)}/mo</span>
        </div>
        {overdue > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/20 text-xs font-medium text-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>{overdue} overdue</span>
          </div>
        )}
        {dueSoon > 0 && overdue === 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-xs font-medium text-yellow-300">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span>{dueSoon} due soon</span>
          </div>
        )}
        <span className="text-[10px] opacity-40 ml-auto" style={{ color: 'var(--newtab-text-secondary)' }}>
          {subscriptions.filter((s) => s.status === 'active' || s.status === 'trial').length} active
        </span>
      </div>

      {/* Upcoming renewals — table for 6w+, compact rows for smaller */}
      {upcoming.length > 0 && colSpan >= 6 ? (
        <div className="flex flex-col">
          {/* Table header */}
          <div
            className="grid gap-x-2 px-1.5 pb-1 border-b border-white/8 text-[10px] font-semibold uppercase tracking-wider select-none"
            style={{ gridTemplateColumns: '2fr 18px auto auto 1fr auto', justifyItems: 'start', color: 'var(--newtab-text-secondary)', opacity: 0.4 }}
          >
            <span>Name</span>
            <span />
            <span>Cycle</span>
            <span>Status</span>
            <span className="justify-self-end text-right">Next Due</span>
            <span className="justify-self-end text-right">Price</span>
          </div>
          {/* Table rows */}
          {upcoming.map((s) => {
            const urgency = SubscriptionService.getUrgency(s);
            const days = SubscriptionService.getDaysUntil(s.nextBillingDate);
            const daysLabel = days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'Today' : `${days}d`;
            const dateLabel = new Date(s.nextBillingDate).toLocaleDateString('default', { month: 'short', day: 'numeric' });
            return (
              <div
                key={s.id}
                className={`grid gap-x-2 items-center py-1 px-1.5 rounded-md hover:bg-white/8 transition-colors ${urgencyBorder[urgency]}`}
                style={{ gridTemplateColumns: '2fr 18px auto auto 1fr auto', justifyItems: 'start', cursor: s.url ? 'pointer' : 'default' }}
                onClick={() => safeOpenUrl(s.url)}
              >
                {/* Name */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <FaviconSmall url={s.url} name={s.name} />
                  <span className="text-xs truncate" style={{ color: 'var(--newtab-text)' }}>{s.name}</span>
                </div>
                {/* Category emoji */}
                <span className="text-xs text-center shrink-0" title={CATEGORY_LABELS[s.category] ?? customCats.find((c) => c.value === s.category)?.label ?? s.category}>
                  {CATEGORY_EMOJI[s.category] ?? customCats.find((c) => c.value === s.category)?.emoji ?? '📦'}
                </span>
                {/* Billing cycle */}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-center shrink-0" style={{ color: 'var(--newtab-text-secondary)' }}>
                  {billingLabel[s.billingCycle] ?? s.billingCycle}
                </span>
                {/* Status */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize shrink-0 ${statusCls[s.status] ?? statusCls.active}`}>
                  {s.status}
                </span>
                {/* Date + days */}
                <div className="flex flex-col items-end shrink-0 justify-self-end">
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.75 }}>
                    {dateLabel}
                  </span>
                  <span className={`text-[9px] font-medium tabular-nums ${urgencyText[urgency]}`}>
                    {daysLabel}
                  </span>
                </div>
                {/* Price */}
                <span className="text-xs font-medium text-right shrink-0 tabular-nums justify-self-end" style={{ color: 'var(--newtab-text)' }}>
                  {SubscriptionService.formatCurrency(s.price, s.currency)}
                </span>
              </div>
            );
          })}
        </div>
      ) : upcoming.length > 0 ? (
        <div className="flex flex-col gap-1">
          {upcoming.map((s) => {
            const urgency = SubscriptionService.getUrgency(s);
            const days = SubscriptionService.getDaysUntil(s.nextBillingDate);
            const daysLabel = days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'Today' : `${days}d`;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-1.5 py-1 px-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors ${urgencyBorder[urgency]}`}
                onClick={() => safeOpenUrl(s.url)}
                style={{ cursor: s.url ? 'pointer' : 'default' }}
              >
                <FaviconSmall url={s.url} name={s.name} />
                <span className="flex-1 text-xs truncate" style={{ color: 'var(--newtab-text)' }}>
                  {s.name}
                </span>
                <span className={`text-[10px] shrink-0 tabular-nums ${urgencyText[urgency]}`}>
                  {daysLabel}
                </span>
                <span className="text-xs font-medium shrink-0 tabular-nums" style={{ color: 'var(--newtab-text)' }}>
                  {SubscriptionService.formatCurrency(s.price, s.currency)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {subscriptions.length === 0 && (
        <p className="text-xs text-center py-2 opacity-50" style={{ color: 'var(--newtab-text-secondary)' }}>
          No subscriptions yet
        </p>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1 mt-0.5 border-t border-white/8">
        <button
          onClick={() => setActiveView('subscriptions')}
          className="flex items-center gap-1 text-[11px] hover:opacity-80 transition-opacity"
          style={{ color: 'var(--newtab-text-secondary)', opacity: 0.45 }}
        >
          Manage <ArrowRight size={10} />
        </button>
        <button
          onClick={() => setActiveView('subscriptions')}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white transition-colors"
        >
          <Plus size={10} /> Add
        </button>
      </div>
    </div>
  );
}
