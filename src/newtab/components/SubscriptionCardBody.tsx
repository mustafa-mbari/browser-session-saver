import { useEffect, useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import type { BookmarkCategory } from '@core/types/newtab.types';
import type { Subscription } from '@core/types/subscription.types';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { SubscriptionService } from '@core/services/subscription.service';
import { resolveFavIcon, getFaviconInitial } from '@core/utils/favicon';
import { useNewTabStore } from '@newtab/stores/newtab.store';

interface Props {
  category: BookmarkCategory;
}

const urgencyDot: Record<string, string> = {
  overdue: 'bg-red-500',
  today:   'bg-orange-500',
  urgent:  'bg-orange-400',
  soon:    'bg-yellow-400',
  safe:    'bg-green-400',
};

const urgencyBorder: Record<string, string> = {
  overdue: 'border-l-2 border-l-red-500',
  today:   'border-l-2 border-l-orange-500',
  urgent:  'border-l-2 border-l-orange-400',
  soon:    'border-l-2 border-l-yellow-400',
  safe:    '',
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

export default function SubscriptionCardBody({ category }: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const setActiveView = useNewTabStore((s) => s.setActiveView);

  useEffect(() => {
    void SubscriptionStorage.getAll().then((subs) => {
      setSubscriptions(subs);
      setLoading(false);
    });
  }, []);

  const colSpan = category.colSpan ?? 1;
  const currency = subscriptions.find((s) => s.status === 'active')?.currency
    ?? subscriptions[0]?.currency ?? 'USD';

  const monthlyTotal = SubscriptionService.getMonthlyTotal(subscriptions);
  const overdue = SubscriptionService.getOverdue(subscriptions).length;
  const dueSoon = SubscriptionService.getDueSoon(subscriptions, 7).length;

  const upcoming = [...subscriptions]
    .filter((s) => s.status !== 'canceled')
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate))
    .slice(0, colSpan === 3 ? 8 : colSpan === 2 ? 5 : 0);

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

      {/* Upcoming renewals list */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-1">
          {upcoming.map((s) => {
            const urgency = SubscriptionService.getUrgency(s);
            const days = SubscriptionService.getDaysUntil(s.nextBillingDate);
            const daysLabel = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-1.5 py-1 px-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors ${urgencyBorder[urgency]}`}
                onClick={() => s.url && window.open(s.url, '_blank')}
                style={{ cursor: s.url ? 'pointer' : 'default' }}
              >
                <FaviconSmall url={s.url} name={s.name} />
                <span className="flex-1 text-xs truncate" style={{ color: 'var(--newtab-text)' }}>
                  {s.name}
                </span>
                <span className={`text-[10px] shrink-0 ${urgencyDot[urgency].replace('bg-', 'text-')}`}>
                  {daysLabel}
                </span>
                <span className="text-xs font-medium shrink-0" style={{ color: 'var(--newtab-text)' }}>
                  {SubscriptionService.formatCurrency(s.price, s.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

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
