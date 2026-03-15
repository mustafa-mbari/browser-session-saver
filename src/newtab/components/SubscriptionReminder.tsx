import { useState, useEffect } from 'react';
import { X, CreditCard, Clock } from 'lucide-react';
import type { Subscription } from '@core/types/subscription.types';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { SubscriptionService } from '@core/services/subscription.service';

const SNOOZE_KEY = 'subscription_reminder_snooze';
const SNOOZE_HOURS = 24;

interface SnoozeRecord {
  snoozedUntil: number; // timestamp
}

async function getSnoozedUntil(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SNOOZE_KEY, (result) => {
      const record = result[SNOOZE_KEY] as SnoozeRecord | undefined;
      resolve(record?.snoozedUntil ?? 0);
    });
  });
}

async function setSnoozed(): Promise<void> {
  const snoozedUntil = Date.now() + SNOOZE_HOURS * 60 * 60 * 1000;
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SNOOZE_KEY]: { snoozedUntil } }, resolve);
  });
}

const urgencyStyle: Record<string, { bg: string; border: string; dot: string }> = {
  overdue: { bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-500'    },
  today:   { bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  urgent:  { bg: 'bg-orange-400/10', border: 'border-orange-400/30', dot: 'bg-orange-400' },
  soon:    { bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', dot: 'bg-yellow-400' },
  safe:    { bg: 'bg-white/5',       border: 'border-white/10',      dot: 'bg-green-400'  },
};

export default function SubscriptionReminder() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      const snoozedUntil = await getSnoozedUntil();
      if (Date.now() < snoozedUntil) return;

      const all = await SubscriptionStorage.getAll();
      const overdue = SubscriptionService.getOverdue(all);
      const upcoming = SubscriptionService.getDueSoon(all, 7);

      // Merge unique, overdue first
      const seen = new Set<string>();
      const relevant: Subscription[] = [];
      for (const s of [...overdue, ...upcoming]) {
        if (!seen.has(s.id)) { seen.add(s.id); relevant.push(s); }
      }

      if (relevant.length > 0) setSubs(relevant);
    }
    void check();
  }, []);

  const handleSnooze = async () => {
    await setSnoozed();
    setDismissed(true);
  };

  if (dismissed || subs.length === 0) return null;

  const worstUrgency = subs.reduce<string>((worst, s) => {
    const u = SubscriptionService.getUrgency(s);
    const order = ['overdue', 'today', 'urgent', 'soon', 'safe'];
    return order.indexOf(u) < order.indexOf(worst) ? u : worst;
  }, 'safe');

  const style = urgencyStyle[worstUrgency];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-xs w-full rounded-xl border backdrop-blur-xl shadow-2xl ${style.bg} ${style.border}`}
      style={{ background: 'rgba(10,10,20,0.75)' }}
      role="alert"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <CreditCard size={14} className="text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-white flex-1">
          {subs.length === 1
            ? '1 subscription renewal'
            : `${subs.length} subscription renewals`}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white/90"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Subscription list */}
      <div className="px-3 py-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {subs.map((s) => {
          const urgency = SubscriptionService.getUrgency(s);
          const days = SubscriptionService.getDaysUntil(s.nextBillingDate);
          const daysLabel = days < 0
            ? `${Math.abs(days)}d overdue`
            : days === 0 ? 'Due today' : `in ${days}d`;

          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${urgencyStyle[urgency].dot}`} />
              <span className="text-sm text-white flex-1 truncate">{s.name}</span>
              <span className="text-xs text-white/50 shrink-0">{daysLabel}</span>
              <span className="text-xs font-medium text-white/80 shrink-0">
                {SubscriptionService.formatCurrency(s.price, s.currency)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Snooze */}
      <div className="px-3 py-2 border-t border-white/10">
        <button
          onClick={handleSnooze}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          <Clock size={11} />
          <span>Remind me again in {SNOOZE_HOURS}h</span>
        </button>
      </div>
    </div>
  );
}
