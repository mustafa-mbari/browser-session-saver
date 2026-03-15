import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { Subscription, SubscriptionCategory, SubscriptionStatus, BillingCycle } from '@core/types/subscription.types';
import { CATEGORY_LABELS } from '@core/types/subscription.types';
import { SubscriptionService } from '@core/services/subscription.service';
import SubscriptionRow from './SubscriptionRow';

type SortKey = 'nextBillingDate' | 'price' | 'name';
type FilterStatus = SubscriptionStatus | 'all';
type FilterCategory = SubscriptionCategory | 'all';

interface Props {
  subscriptions: Subscription[];
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Subscription['status']) => void;
}

export default function SubscriptionList({ subscriptions, onEdit, onDelete, onStatusChange }: Props) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterCycle, setFilterCycle] = useState<BillingCycle | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('nextBillingDate');
  const [showFilters, setShowFilters] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = subscriptions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.url?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') result = result.filter((s) => s.status === filterStatus);
    if (filterCategory !== 'all') result = result.filter((s) => s.category === filterCategory);
    if (filterCycle !== 'all') result = result.filter((s) => s.billingCycle === filterCycle);
    return result;
  }, [subscriptions, search, filterStatus, filterCategory, filterCycle]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'nextBillingDate') return a.nextBillingDate.localeCompare(b.nextBillingDate);
      if (sortBy === 'price') return SubscriptionService.normalizeToMonthly(b) - SubscriptionService.normalizeToMonthly(a);
      return a.name.localeCompare(b.name);
    });
  }, [filtered, sortBy]);

  const groups = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, Subscription[]>();
    for (const s of sorted) {
      const cat = s.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return map;
  }, [sorted, groupByCategory]);

  const toggleGroup = (cat: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const renderRow = (s: Subscription) => (
    <SubscriptionRow
      key={s.id}
      subscription={s}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
    />
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] rounded-lg px-3 py-1.5">
          <Search size={14} className="text-[var(--color-text-secondary)] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subscriptions…"
            className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)]"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-0.5 rounded transition-colors ${showFilters ? 'text-violet-500' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-3 pb-2 flex flex-col gap-1.5 border-b border-[var(--color-border)]">
          {/* Status */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-secondary)] w-14 shrink-0">Status:</span>
            {(['all', 'active', 'trial', 'paused', 'canceled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                  filterStatus === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Category */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-secondary)] w-14 shrink-0">Category:</span>
            {(['all', 'work', 'personal', 'saas', 'streaming', 'utility', 'other'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                  filterCategory === c
                    ? 'bg-violet-600 text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          {/* Billing cycle */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-secondary)] w-14 shrink-0">Cycle:</span>
            {(['all', 'monthly', 'yearly', 'weekly', 'custom'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCycle(c)}
                className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                  filterCycle === c
                    ? 'bg-violet-600 text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort + group */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[var(--color-text-secondary)] w-14 shrink-0">Sort:</span>
            {([['nextBillingDate', 'Date'], ['price', 'Price'], ['name', 'Name']] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                  sortBy === key
                    ? 'bg-violet-600 text-white'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setGroupByCategory((v) => !v)}
              className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ml-2 ${
                groupByCategory
                  ? 'bg-violet-600 text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              Group by category
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">💳</span>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {search || filterStatus !== 'all' ? 'No matching subscriptions' : 'No subscriptions yet'}
            </p>
          </div>
        ) : groupByCategory && groups ? (
          Array.from(groups.entries()).map(([category, items]) => {
            const isCollapsed = collapsedGroups.has(category);
            const catTotal = items.reduce((sum, s) => sum + SubscriptionService.normalizeToMonthly(s), 0);
            const currency = items[0]?.currency ?? 'USD';
            return (
              <div key={category} className="flex flex-col gap-1">
                <button
                  onClick={() => toggleGroup(category)}
                  className="flex items-center gap-2 px-1 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                  <span>{CATEGORY_LABELS[category as SubscriptionCategory] ?? category}</span>
                  <span className="opacity-60 text-[10px]">
                    ({items.length}) · {SubscriptionService.formatCurrency(catTotal, currency)}/mo
                  </span>
                  <span className="ml-auto opacity-50">{isCollapsed ? '▶' : '▼'}</span>
                </button>
                {!isCollapsed && items.map(renderRow)}
              </div>
            );
          })
        ) : (
          sorted.map(renderRow)
        )}
      </div>
    </div>
  );
}
