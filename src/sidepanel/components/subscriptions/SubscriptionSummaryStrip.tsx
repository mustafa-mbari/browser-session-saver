import { Plus } from 'lucide-react';
import type { Subscription } from '@core/types/subscription.types';
import { SubscriptionService } from '@core/services/subscription.service';

interface Props {
  subscriptions: Subscription[];
  onAdd: () => void;
}

export default function SubscriptionSummaryStrip({ subscriptions, onAdd }: Props) {
  const monthlyTotal = SubscriptionService.getMonthlyTotal(subscriptions);
  const dueSoon = SubscriptionService.getDueSoon(subscriptions, 7).length;
  const overdue = SubscriptionService.getOverdue(subscriptions).length;
  const currency = subscriptions.find((s) => s.status === 'active')?.currency ?? subscriptions[0]?.currency ?? 'USD';

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] flex-wrap">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-medium shrink-0">
        <span>💳</span>
        <span>{SubscriptionService.formatCurrency(monthlyTotal, currency)}/mo</span>
      </div>

      {dueSoon > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs font-medium shrink-0">
          <span>⚠️</span>
          <span>Next 7 days: {dueSoon}</span>
        </div>
      )}

      {overdue > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-medium shrink-0">
          <span>🔴</span>
          <span>Overdue: {overdue}</span>
        </div>
      )}

      <div className="ml-auto">
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
          aria-label="Add subscription"
        >
          <Plus size={12} />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}
