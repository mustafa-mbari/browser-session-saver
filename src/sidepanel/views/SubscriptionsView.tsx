import { useState, useEffect, useCallback } from 'react';
import type { Subscription } from '@core/types/subscription.types';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import SubscriptionSummaryStrip from '../components/subscriptions/SubscriptionSummaryStrip';
import SubscriptionList from '../components/subscriptions/SubscriptionList';
import SubscriptionForm from '../components/subscriptions/SubscriptionForm';
import SubscriptionCalendar from '../components/subscriptions/SubscriptionCalendar';
import SubscriptionAnalytics from '../components/subscriptions/SubscriptionAnalytics';

type SubView = 'list' | 'calendar' | 'analytics';

export default function SubscriptionsView() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeTab, setActiveTab] = useState<SubView>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void SubscriptionStorage.getAll().then((subs) => {
      setSubscriptions(subs);
      setIsLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (sub: Subscription) => {
    await SubscriptionStorage.save(sub);
    setSubscriptions((prev) => {
      const idx = prev.findIndex((s) => s.id === sub.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = sub;
        return next;
      }
      return [...prev, sub];
    });
    setFormOpen(false);
    setEditSub(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await SubscriptionStorage.delete(id);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: Subscription['status']) => {
    await SubscriptionStorage.update(id, { status });
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const handleEdit = useCallback((sub: Subscription) => {
    setEditSub(sub);
    setFormOpen(true);
  }, []);

  const handleImport = useCallback(async (imported: Subscription[]) => {
    await SubscriptionStorage.importMany(imported);
    const all = await SubscriptionStorage.getAll();
    setSubscriptions(all);
  }, []);

  const openAddForm = () => { setEditSub(null); setFormOpen(true); };
  const closeForm   = () => { setFormOpen(false); setEditSub(null); };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Show form overlay
  if (formOpen) {
    return (
      <div className="flex flex-col h-full">
        <SubscriptionForm
          initial={editSub}
          onSave={handleSave}
          onClose={closeForm}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubscriptionSummaryStrip subscriptions={subscriptions} onAdd={openAddForm} />

      {/* Sub-view tabs */}
      <div className="flex items-center border-b border-[var(--color-border)] px-3">
        {(['list', 'calendar', 'analytics'] as SubView[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-violet-600 dark:text-violet-400 border-violet-500'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text)]'
            }`}
          >
            {tab === 'list' ? '📋 List' : tab === 'calendar' ? '📅 Calendar' : '📊 Analytics'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'list' && (
          <SubscriptionList
            subscriptions={subscriptions}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        )}
        {activeTab === 'calendar' && (
          <SubscriptionCalendar subscriptions={subscriptions} />
        )}
        {activeTab === 'analytics' && (
          <SubscriptionAnalytics subscriptions={subscriptions} onImport={handleImport} />
        )}
      </div>
    </div>
  );
}
