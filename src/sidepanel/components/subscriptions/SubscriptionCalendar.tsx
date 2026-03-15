import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, BarChart3 } from 'lucide-react';
import type { Subscription } from '@core/types/subscription.types';
import { SubscriptionService } from '@core/services/subscription.service';
import { resolveFavIcon, getFaviconInitial } from '@core/utils/favicon';

interface Props {
  subscriptions: Subscription[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const urgencyDot: Record<string, string> = {
  overdue: 'bg-red-500',
  today:   'bg-orange-500',
  urgent:  'bg-orange-400',
  soon:    'bg-yellow-400',
  safe:    'bg-green-400',
};

function SmallFavicon({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = url ? resolveFavIcon('', url) : '';
  if (!faviconUrl || failed) {
    return (
      <span className="w-4 h-4 flex items-center justify-center rounded-sm bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-[8px] shrink-0">
        {getFaviconInitial(name, url ?? '')}
      </span>
    );
  }
  return <img src={faviconUrl} alt={name} className="w-4 h-4 rounded-sm shrink-0" onError={() => setFailed(true)} />;
}

export default function SubscriptionCalendar({ subscriptions }: Props) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Map: YYYY-MM-DD → subscriptions due on that day
  const dateMap = useMemo(() => {
    const map = new Map<string, Subscription[]>();
    for (const s of subscriptions) {
      if (s.status === 'canceled') continue;
      const key = s.nextBillingDate.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [subscriptions]);

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const prevWeek  = () => setCurrentDate((d) => new Date(d.getTime() - 7 * 86400000));
  const nextWeek  = () => setCurrentDate((d) => new Date(d.getTime() + 7 * 86400000));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // ── Month view ──────────────────────────────────────────────────────────────

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentDate]);

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // ── Week strip view ─────────────────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(currentDate.getTime() + i * 86400000);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const weekLabel = (() => {
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    return `${start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  function DayTooltip({ dateStr }: { dateStr: string }) {
    const subs = dateMap.get(dateStr) ?? [];
    if (subs.length === 0) return null;
    const total = subs.reduce((sum, s) => sum + s.price, 0);
    const currency = subs[0]?.currency ?? 'USD';

    return (
      <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 min-w-[140px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg p-2 flex flex-col gap-1.5 pointer-events-none">
        {subs.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <SmallFavicon url={s.url} name={s.name} />
            <span className="text-xs text-[var(--color-text)] truncate flex-1">{s.name}</span>
            <span className="text-xs font-medium text-[var(--color-text)] shrink-0">
              {SubscriptionService.formatCurrency(s.price, s.currency)}
            </span>
          </div>
        ))}
        {subs.length > 1 && (
          <div className="border-t border-[var(--color-border)] pt-1 flex justify-between">
            <span className="text-[10px] text-[var(--color-text-secondary)]">Total</span>
            <span className="text-xs font-semibold text-[var(--color-text)]">
              {SubscriptionService.formatCurrency(total, currency)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              viewMode === 'month' ? 'bg-violet-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            <Calendar size={12} />
            <span>Month</span>
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              viewMode === 'week' ? 'bg-violet-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            <BarChart3 size={12} />
            <span>14 Days</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={viewMode === 'month' ? prevMonth : prevWeek}
            className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-[var(--color-text)] min-w-[120px] text-center">
            {viewMode === 'month' ? monthLabel : weekLabel}
          </span>
          <button
            onClick={viewMode === 'month' ? nextMonth : nextWeek}
            className="p-1 rounded hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {viewMode === 'month' ? (
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-[var(--color-text-secondary)] py-1">
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {monthDays.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = day.toISOString().split('T')[0];
                const daySubs = dateMap.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isPast = day < today;

                return (
                  <div
                    key={dateStr}
                    className={`relative flex flex-col items-center py-1 px-0.5 rounded-md min-h-[40px] cursor-default ${
                      isToday ? 'bg-violet-100 dark:bg-violet-900/30' :
                      isPast ? 'opacity-50' : 'hover:bg-[var(--color-bg-secondary)]'
                    }`}
                    onMouseEnter={() => daySubs.length > 0 && setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    <span className={`text-[11px] font-medium ${isToday ? 'text-violet-700 dark:text-violet-300' : 'text-[var(--color-text-secondary)]'}`}>
                      {day.getDate()}
                    </span>
                    {daySubs.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                        {daySubs.slice(0, 3).map((s) => (
                          <span
                            key={s.id}
                            className={`w-1.5 h-1.5 rounded-full ${urgencyDot[SubscriptionService.getUrgency(s)]}`}
                          />
                        ))}
                        {daySubs.length > 3 && (
                          <span className="text-[8px] text-[var(--color-text-secondary)]">+{daySubs.length - 3}</span>
                        )}
                      </div>
                    )}
                    {hoveredDate === dateStr && <DayTooltip dateStr={dateStr} />}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Week strip (14 days)
          <div className="flex flex-col gap-2">
            {weekDays.map((day) => {
              const dateStr = day.toISOString().split('T')[0];
              const daySubs = dateMap.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const isPast = day < today;

              return (
                <div
                  key={dateStr}
                  className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                    isToday ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' :
                    isPast ? 'opacity-50' :
                    daySubs.length > 0 ? 'bg-[var(--color-bg-secondary)]' : ''
                  }`}
                >
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <span className={`text-[10px] font-medium ${isToday ? 'text-violet-600 dark:text-violet-400' : 'text-[var(--color-text-secondary)]'}`}>
                      {day.toLocaleString('default', { weekday: 'short' })}
                    </span>
                    <span className={`text-lg font-bold leading-none ${isToday ? 'text-violet-700 dark:text-violet-300' : 'text-[var(--color-text)]'}`}>
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    {daySubs.length === 0 ? (
                      <span className="text-xs text-[var(--color-text-secondary)] opacity-50 py-1">No renewals</span>
                    ) : (
                      daySubs.map((s) => {
                        const urgency = SubscriptionService.getUrgency(s);
                        return (
                          <div key={s.id} className="flex items-center gap-1.5">
                            <SmallFavicon url={s.url} name={s.name} />
                            <span className="text-xs text-[var(--color-text)] flex-1 truncate">{s.name}</span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${urgencyDot[urgency]}`} />
                            <span className="text-xs font-medium text-[var(--color-text)] shrink-0">
                              {SubscriptionService.formatCurrency(s.price, s.currency)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
