import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, Calendar, BarChart3, Download, Upload, X, Wand2 } from 'lucide-react';
import type { Subscription, CustomCategory } from '@core/types/subscription.types';
import { CATEGORY_LABELS, SUPPORTED_CURRENCIES, SUBSCRIPTION_TEMPLATES } from '@core/types/subscription.types';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import { SubscriptionService } from '@core/services/subscription.service';
import { resolveFavIcon, getFaviconInitial } from '@core/utils/favicon';
import { safeOpenUrl } from '@core/utils/safe-open';
import { useRef } from 'react';

// ── CSS variable helpers ────────────────────────────────────────────────────

const T  = { color: 'var(--newtab-text)' } as React.CSSProperties;
const TS = { color: 'var(--newtab-text-secondary)' } as React.CSSProperties;

// ── Shared micro-components ─────────────────────────────────────────────────

function Favicon({ url, name, size = 18 }: { url?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = url ? resolveFavIcon('', url) : '';
  if (!src || failed) {
    return (
      <span
        className="flex items-center justify-center rounded-md bg-white/15 font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.5, ...TS }}
      >
        {getFaviconInitial(name, url ?? '')}
      </span>
    );
  }
  return <img src={src} alt="" className="rounded-md shrink-0" style={{ width: size, height: size }} onError={() => setFailed(true)} />;
}

const urgencyBg: Record<string, string> = {
  overdue: 'border-l-2 border-l-red-500',
  today:   'border-l-2 border-l-orange-500',
  urgent:  'border-l-2 border-l-orange-400',
  soon:    'border-l-2 border-l-yellow-400',
  safe:    '',
};

const statusStyle: Record<Subscription['status'], string> = {
  active:    'text-green-400 bg-green-500/15',
  trial:     'text-yellow-400 bg-yellow-500/15',
  canceling: 'text-orange-400 bg-orange-500/15',
  paused:    'text-white/50 bg-white/10',
  canceled:  'text-white/30 bg-white/5',
};

// ── Summary strip ───────────────────────────────────────────────────────────

function SummaryStrip({ subscriptions, onAdd }: { subscriptions: Subscription[]; onAdd: () => void }) {
  const currency = subscriptions.find((s) => s.status === 'active')?.currency ?? subscriptions[0]?.currency ?? 'USD';
  const monthly  = SubscriptionService.getMonthlyTotal(subscriptions);
  const overdue  = SubscriptionService.getOverdue(subscriptions).length;
  const soon     = SubscriptionService.getDueSoon(subscriptions, 7).length;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-white/10">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-sm font-semibold" style={T}>
        💳 {SubscriptionService.formatCurrency(monthly, currency)}<span className="text-xs font-normal opacity-60">/mo</span>
      </div>
      {overdue > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/20 text-xs font-medium text-red-300">
          🔴 {overdue} overdue
        </div>
      )}
      {soon > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/20 text-xs font-medium text-yellow-300">
          ⚠️ {soon} due soon
        </div>
      )}
      <div className="ml-auto">
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

// ── Detail grid helper ───────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40" style={TS}>{label}</span>
      <span className="text-xs font-medium" style={T}>{value}</span>
    </div>
  );
}

// columns: Service | Category · Billing | Next Date | Payment | Price
const LIST_COLS = '2fr 1.5fr 1fr 1fr auto';

// ── Subscription row ────────────────────────────────────────────────────────

function SubRow({
  s, customCats, onEdit, onDelete, onStatusChange,
}: {
  s: Subscription;
  customCats: CustomCategory[];
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Subscription['status']) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const urgency = SubscriptionService.getUrgency(s);
  const days = SubscriptionService.getDaysUntil(s.nextBillingDate);
  const daysLabel = s.status === 'canceled' || s.status === 'paused' ? null
    : days < 0 ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Today' : `${days}d`;
  const catEmoji = CATEGORY_ICONS[s.category] ?? customCats.find((c) => c.value === s.category)?.emoji ?? '📦';
  const catLabel = CATEGORY_LABELS[s.category] ?? customCats.find((c) => c.value === s.category)?.label ?? s.category;

  return (
    <div className={`rounded-lg bg-white/5 hover:bg-white/8 transition-colors ${urgencyBg[urgency]}`}>
      <div
        className="grid items-center gap-x-4 px-3 py-2.5 cursor-pointer"
        style={{ gridTemplateColumns: LIST_COLS, justifyItems: 'start' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* 1 · Service: favicon + name + urgency */}
        <div className="flex items-center gap-2 min-w-0">
          <Favicon url={s.url} name={s.name} size={18} />
          <span className="text-sm font-medium truncate" style={T}>{s.name}</span>
          {daysLabel && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
              urgency === 'overdue' || urgency === 'today' ? 'bg-red-500/20 text-red-400' :
              urgency === 'urgent' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>{daysLabel}</span>
          )}
        </div>
        {/* 2 · Category + billing cycle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs">{catEmoji}</span>
          <span className="text-xs" style={TS}>{catLabel}</span>
          <span className="text-[10px] opacity-25" style={TS}>·</span>
          <span className="text-xs capitalize" style={TS}>{s.billingCycle}</span>
        </div>
        {/* 3 · Next billing date */}
        <span className="text-xs tabular-nums shrink-0" style={TS}>
          {new Date(s.nextBillingDate).toLocaleDateString('default', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
        {/* 4 · Payment method */}
        <span
          className="text-xs shrink-0 max-w-[110px] truncate"
          style={{ color: 'var(--newtab-text-secondary)', opacity: s.paymentMethod ? 0.7 : 0.25 }}
        >
          {s.paymentMethod || '—'}
        </span>
        {/* 5 · Price + status */}
        <div className="flex flex-col items-end gap-0.5 shrink-0 justify-self-end">
          <span className="text-sm font-semibold tabular-nums" style={T}>{SubscriptionService.formatCurrency(s.price, s.currency)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusStyle[s.status]}`}>{s.status}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2.5 border-t border-white/10 flex flex-col gap-3">
          {/* Detail grid */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <DetailItem
              label="Next billing"
              value={new Date(s.nextBillingDate).toLocaleDateString('default', { year: 'numeric', month: 'short', day: 'numeric' })}
            />
            <DetailItem
              label="Billing cycle"
              value={s.billingCycle.charAt(0).toUpperCase() + s.billingCycle.slice(1)}
            />
            <DetailItem
              label="Category"
              value={catLabel}
            />
            <DetailItem
              label="Status"
              value={s.status.charAt(0).toUpperCase() + s.status.slice(1)}
            />
            <DetailItem
              label="Reminder"
              value={`${s.reminder}d before renewal`}
            />
            <DetailItem label="Payment" value={s.paymentMethod || '—'} />
            {s.email && <DetailItem label="Email" value={s.email} />}
          </div>

          {/* Notes */}
          {s.notes && (
            <div className="px-2.5 py-2 rounded-lg bg-white/5">
              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-40 block mb-0.5" style={TS}>Notes</span>
              <p className="text-xs leading-relaxed" style={{ ...T, opacity: 0.75 }}>{s.notes}</p>
            </div>
          )}

          {/* Tags */}
          {s.tags && s.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {s.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-medium" style={TS}>{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/8">
            {s.url && (
              <button onClick={() => safeOpenUrl(s.url)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors" style={T}>
                Open site
              </button>
            )}
            <button onClick={() => onEdit(s)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors" style={T}>
              Edit
            </button>
            <button
              onClick={() => onStatusChange(s.id, s.status !== 'paused' ? 'paused' : 'active')}
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              style={T}
            >
              {s.status !== 'paused' ? 'Pause' : 'Resume'}
            </button>
            {s.status !== 'canceled' && (
              <button onClick={() => onStatusChange(s.id, 'canceled')} className="text-xs px-2 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 transition-colors">
                Cancel
              </button>
            )}
            <button onClick={() => onDelete(s.id)} className="text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors ml-auto">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── List tab ─────────────────────────────────────────────────────────────────

function ListTab({
  subs, customCats, onEdit, onDelete, onStatusChange,
}: {
  subs: Subscription[];
  customCats: CustomCategory[];
  onEdit: (s: Subscription) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Subscription['status']) => void;
}) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Subscription['status'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'name'>('date');

  const filtered = useMemo(() => {
    let r = subs;
    if (search) r = r.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'all') r = r.filter((s) => s.status === filterStatus);
    return [...r].sort((a, b) => {
      if (sortBy === 'date')  return a.nextBillingDate.localeCompare(b.nextBillingDate);
      if (sortBy === 'price') return SubscriptionService.normalizeToMonthly(b) - SubscriptionService.normalizeToMonthly(a);
      return a.name.localeCompare(b.name);
    });
  }, [subs, search, filterStatus, sortBy]);

  return (
    <div className="flex flex-col h-full">
      {/* Search + filter bar */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
          <Search size={13} style={TS} className="shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={T}
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-violet-600' : 'bg-white/10 hover:bg-white/20'}`}
        >
          <SlidersHorizontal size={13} style={showFilters ? { color: 'white' } : TS} />
        </button>
      </div>

      {showFilters && (
        <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
          {(['all', 'active', 'trial', 'paused', 'canceled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${filterStatus === s ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
              style={filterStatus === s ? {} : TS}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1">
            {(['date', 'price', 'name'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${sortBy === k ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                style={sortBy === k ? {} : TS}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-1">
        {filtered.length > 0 && (
          <div
            className="grid gap-x-4 px-3 py-1.5 mb-0.5 border-b border-white/8 text-[10px] font-semibold uppercase tracking-wider select-none sticky top-0 z-10 shrink-0"
            style={{
              gridTemplateColumns: LIST_COLS,
              justifyItems: 'start',
              color: 'var(--newtab-text-secondary)',
              opacity: 0.4,
              backgroundColor: 'rgba(14,14,28,0.88)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span>Service</span>
            <span>Category · Billing</span>
            <span>Next Date</span>
            <span>Payment</span>
            <span className="justify-self-end">Price</span>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">💳</span>
            <p className="text-sm opacity-50" style={TS}>{search ? 'No matches' : 'No subscriptions yet'}</p>
          </div>
        ) : (
          filtered.map((s) => (
            <SubRow key={s.id} s={s} customCats={customCats} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Calendar tab ─────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarTab({ subs }: { subs: Subscription[] }) {
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [hovered, setHovered] = useState<string | null>(null);

  const dateMap = useMemo(() => {
    const m = new Map<string, Subscription[]>();
    for (const s of subs) {
      if (s.status === 'canceled') continue;
      const k = s.nextBillingDate.split('T')[0];
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return m;
  }, [subs]);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().split('T')[0];

  const monthDays = useMemo(() => {
    const y = date.getFullYear(), mo = date.getMonth();
    const firstDay = new Date(y, mo, 1).getDay();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, mo, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [date]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(date.getTime() + i * 86400000); d.setHours(0,0,0,0); return d;
    });
  }, [date]);

  const prev = () => mode === 'month'
    ? setDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    : setDate((d) => new Date(d.getTime() - 7 * 86400000));
  const next = () => mode === 'month'
    ? setDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    : setDate((d) => new Date(d.getTime() + 7 * 86400000));

  const label = mode === 'month'
    ? date.toLocaleString('default', { month: 'long', year: 'numeric' })
    : `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${weekDays[13].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  function HoverCard({ dateStr }: { dateStr: string }) {
    const items = dateMap.get(dateStr) ?? [];
    if (!items.length) return null;
    const total = items.reduce((s, sub) => s + sub.price, 0);
    return (
      <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 w-40 rounded-xl border border-white/20 bg-[#1a1a2e]/95 backdrop-blur-xl shadow-xl p-2 flex flex-col gap-1 pointer-events-none">
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs">
            <Favicon url={s.url} name={s.name} size={13} />
            <span className="flex-1 truncate" style={T}>{s.name}</span>
            <span className="font-medium shrink-0" style={T}>{SubscriptionService.formatCurrency(s.price, s.currency)}</span>
          </div>
        ))}
        {items.length > 1 && (
          <div className="border-t border-white/10 pt-1 flex justify-between text-xs">
            <span style={TS}>Total</span>
            <span className="font-semibold" style={T}>{SubscriptionService.formatCurrency(total, items[0]?.currency ?? 'USD')}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-1">
          {[['month', Calendar, '月'], ['week', BarChart3, '14d']] .map(([key, Icon, lbl]) => (
            <button
              key={key as string}
              onClick={() => setMode(key as 'month' | 'week')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${mode === key ? 'bg-violet-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
              style={mode === key ? {} : TS}
            >
              <Icon size={12} /> {lbl as string}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1 rounded hover:bg-white/10 transition-colors" style={TS}><ChevronLeft size={14} /></button>
          <span className="text-xs font-medium min-w-[130px] text-center" style={T}>{label}</span>
          <button onClick={next} className="p-1 rounded hover:bg-white/10 transition-colors" style={TS}><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {mode === 'month' ? (
          <div>
            <div className="grid grid-cols-7 mb-2">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium opacity-40" style={TS}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, i) => {
                if (!day) return <div key={i} />;
                const ds = day.toISOString().split('T')[0];
                const items = dateMap.get(ds) ?? [];
                const isToday = ds === todayStr;
                const isPast = day < today;
                return (
                  <div
                    key={ds}
                    className={`relative flex flex-col items-center py-1 rounded-lg min-h-[42px] cursor-default ${isToday ? 'bg-violet-500/20' : isPast ? 'opacity-40' : 'hover:bg-white/5'}`}
                    onMouseEnter={() => items.length > 0 && setHovered(ds)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className={`text-[11px] font-medium ${isToday ? 'text-violet-300' : ''}`} style={isToday ? {} : TS}>{day.getDate()}</span>
                    {items.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                        {items.slice(0, 2).map((s) => <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${['overdue','today'].includes(SubscriptionService.getUrgency(s)) ? 'bg-red-500' : SubscriptionService.getUrgency(s) === 'soon' ? 'bg-yellow-400' : 'bg-violet-400'}`} />)}
                        {items.length > 2 && <span className="text-[8px] opacity-60" style={TS}>+{items.length - 2}</span>}
                      </div>
                    )}
                    {hovered === ds && <HoverCard dateStr={ds} />}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {weekDays.map((day) => {
              const ds = day.toISOString().split('T')[0];
              const items = dateMap.get(ds) ?? [];
              const isToday = ds === todayStr;
              return (
                <div key={ds} className={`flex items-start gap-3 p-2.5 rounded-xl ${isToday ? 'bg-violet-500/15 border border-violet-500/25' : items.length > 0 ? 'bg-white/5' : ''}`}>
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <span className={`text-[10px] font-medium ${isToday ? 'text-violet-400' : ''}`} style={isToday ? {} : TS}>{day.toLocaleString('default', { weekday: 'short' })}</span>
                    <span className={`text-xl font-bold leading-none ${isToday ? 'text-violet-300' : ''}`} style={isToday ? {} : T}>{day.getDate()}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {items.length === 0 ? (
                      <span className="text-xs opacity-30 py-1" style={TS}>—</span>
                    ) : items.map((s) => (
                      <div key={s.id} className="flex items-center gap-1.5">
                        <Favicon url={s.url} name={s.name} size={14} />
                        <span className="text-xs flex-1 truncate" style={T}>{s.name}</span>
                        <span className="text-xs font-medium shrink-0" style={T}>{SubscriptionService.formatCurrency(s.price, s.currency)}</span>
                      </div>
                    ))}
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

// ── Analytics tab ─────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  if (end - start >= 360) end = start + 359.99;
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

function AnalyticsTab({ subs, onImport }: { subs: Subscription[]; onImport: (s: Subscription[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const monthly = useMemo(() => SubscriptionService.getMonthlyTotals(subs, 6), [subs]);
  const breakdown = useMemo(() => SubscriptionService.getCategoryBreakdown(subs), [subs]);
  const savings = useMemo(() => SubscriptionService.getSavings(subs), [subs]);
  const canceledSubs = subs.filter((s) => s.status === 'canceled');
  const currency = subs[0]?.currency ?? 'USD';

  const handleExport = () => {
    const csv = SubscriptionService.exportCSV(subs);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const maxBar = Math.max(...monthly.map((d) => d.total), 1);

  const total = breakdown.reduce((s, d) => s + d.total, 0);
  let angle = 0;
  const arcs = breakdown.map((d) => {
    const sweep = (d.total / Math.max(total, 1)) * 360;
    const start = angle; angle += sweep;
    return { ...d, start, end: angle };
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors" style={T}>
          <Download size={12} /> Export CSV
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors" style={T}>
          <Upload size={12} /> Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const reader = new FileReader();
          reader.onload = (ev) => { const imported = SubscriptionService.importCSV(ev.target?.result as string); if (imported.length) onImport(imported); };
          reader.readAsText(f); e.target.value = '';
        }} />
      </div>

      {/* Bar chart */}
      <div className="glass-panel rounded-xl p-4">
        <p className="text-xs font-semibold mb-3" style={T}>Monthly Spend (last 6 months)</p>
        <svg viewBox="0 0 260 80" className="w-full" style={{ maxHeight: 100 }}>
          {monthly.map((d, i) => {
            const bw = 30, gap = 10, x = i * (bw + gap), bh = Math.max(2, (d.total / maxBar) * 64), y = 64 - bh;
            return (
              <g key={d.label}>
                <rect x={x} y={y} width={bw} height={bh} rx={3} fill="#8b5cf6" opacity={0.8} />
                <text x={x + bw / 2} y={78} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>{d.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Donut chart */}
      <div className="glass-panel rounded-xl p-4">
        <p className="text-xs font-semibold mb-3" style={T}>Spend by Category</p>
        {breakdown.length === 0 ? (
          <p className="text-xs opacity-40" style={TS}>No data</p>
        ) : (
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 120 120" style={{ width: 90, height: 90, flexShrink: 0 }}>
              {arcs.map((arc, i) => (
                <path key={i} d={arcPath(60, 60, 42, arc.start, arc.end)} fill="none" stroke={arc.color} strokeWidth={16} opacity={0.85} />
              ))}
            </svg>
            <div className="flex flex-col gap-1">
              {breakdown.map((d) => (
                <div key={d.category} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="opacity-70 flex-1" style={T}>{CATEGORY_LABELS[d.category as keyof typeof CATEGORY_LABELS] ?? d.category}</span>
                  <span className="font-medium shrink-0" style={T}>{SubscriptionService.formatCurrency(d.total, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Savings */}
      <div className="glass-panel rounded-xl p-4">
        <p className="text-xs font-semibold mb-1" style={T}>Savings Tracker</p>
        <p className="text-lg font-bold text-green-400 mb-2">{SubscriptionService.formatCurrency(savings, currency)}<span className="text-xs font-normal text-green-500/70">/yr saved</span></p>
        {canceledSubs.length === 0 ? (
          <p className="text-xs opacity-40" style={TS}>No canceled subscriptions yet.</p>
        ) : canceledSubs.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
            <span className="truncate flex-1 opacity-60" style={T}>{s.name}</span>
            <span className="text-green-400 font-medium shrink-0 ml-2">+{SubscriptionService.formatCurrency(SubscriptionService.normalizeToMonthly(s) * 12, s.currency)}/yr</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline Add/Edit form ──────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  work: '💼', personal: '👤', saas: '⚡', streaming: '🎬', utility: '🔧', other: '📦',
};

const CUSTOM_CAT_COLORS = [
  '#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#f97316', '#6b7280',
];

const BILLING_CYCLES: { key: Subscription['billingCycle']; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS: { key: Subscription['status']; label: string; activeStyle: React.CSSProperties }[] = [
  { key: 'active',    label: 'Active',    activeStyle: { backgroundColor: 'rgba(34,197,94,0.18)',  color: '#86efac', borderColor: 'rgba(34,197,94,0.4)'  } },
  { key: 'trial',     label: 'Trial',     activeStyle: { backgroundColor: 'rgba(234,179,8,0.18)', color: '#fde047', borderColor: 'rgba(234,179,8,0.4)'  } },
  { key: 'canceling', label: 'Canceling', activeStyle: { backgroundColor: 'rgba(249,115,22,0.18)',color: '#fdba74', borderColor: 'rgba(249,115,22,0.4)' } },
  { key: 'paused',    label: 'Paused',    activeStyle: { backgroundColor: 'rgba(255,255,255,0.12)',color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.2)' } },
  { key: 'canceled',  label: 'Canceled',  activeStyle: { backgroundColor: 'rgba(239,68,68,0.18)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)' } },
];

// ── Custom currency picker (replaces native <select> to avoid OS white popup) ──

function CurrencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative w-24 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-white/10 rounded-xl px-3 py-2.5 text-sm transition-all focus:border-violet-400/60"
        style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--newtab-text)' }}
      >
        <span>{value}</span>
        <ChevronDown size={11} style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5, flexShrink: 0 }} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/15 overflow-y-auto z-50 shadow-2xl"
          style={{ backgroundColor: '#1e1b3a', maxHeight: 220 }}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${
                c === value ? 'bg-violet-500/25 text-violet-200' : 'hover:bg-white/10'
              }`}
              style={c === value ? {} : { color: 'var(--newtab-text)' }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.4 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function SubForm({
  initial, onSave, onClose, customCats, onCustomCatsChange,
}: {
  initial?: Subscription | null;
  onSave: (s: Subscription) => void;
  onClose: () => void;
  customCats: CustomCategory[];
  onCustomCatsChange: (cats: CustomCategory[]) => void;
}) {
  // Open with templates by default when adding new (not editing)
  const [showTemplates, setShowTemplates] = useState(!initial);
  const [nameError, setNameError] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState(CUSTOM_CAT_COLORS[0]);
  const [form, setForm] = useState<Partial<Subscription>>(initial ?? {
    name: '', url: '', email: '', category: 'personal', price: 0, currency: 'USD',
    billingCycle: 'monthly', nextBillingDate: SubscriptionService.computeNextBillingDate('monthly'),
    status: 'active', reminder: 3, notes: '', tags: [],
  });

  const set = <K extends keyof Subscription>(k: K, v: Subscription[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleAddCustomCat = async () => {
    if (!newCatLabel.trim()) return;
    const slug = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `cat_${Date.now()}`;
    const cat: CustomCategory = { value: slug, label: newCatLabel.trim(), emoji: newCatEmoji.trim() || '📦', color: newCatColor };
    await SubscriptionStorage.addCustomCategory(cat);
    onCustomCatsChange([...customCats, cat]);
    set('category', cat.value);
    setShowAddCategory(false);
    setNewCatEmoji(''); setNewCatLabel(''); setNewCatColor(CUSTOM_CAT_COLORS[0]);
  };

  const handleSave = () => {
    if (!form.name?.trim()) { setNameError(true); return; }
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? SubscriptionService.generateId(),
      name: form.name!.trim(),
      url: form.url?.trim() || undefined,
      email: form.email?.trim() || undefined,
      category: form.category ?? 'personal',
      price: form.price ?? 0,
      currency: form.currency ?? 'USD',
      billingCycle: form.billingCycle ?? 'monthly',
      nextBillingDate: form.nextBillingDate ?? SubscriptionService.computeNextBillingDate('monthly'),
      paymentMethod: form.paymentMethod?.trim() || undefined,
      status: form.status ?? 'active',
      reminder: form.reminder ?? 3,
      notes: form.notes?.trim() || undefined,
      tags: form.tags ?? [],
      createdAt: initial?.createdAt ?? now,
    });
  };

  // inline style wins over browser UA stylesheet (which forces white bg on inputs/selects)
  const inputBase = 'w-full border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400/60 transition-all';
  const inputStyle: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--newtab-text)' };

  if (showTemplates) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-sm font-semibold" style={T}>Add Subscription</h3>
            <p className="text-[11px] opacity-40 mt-0.5" style={TS}>Pick a template or start from scratch</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={TS}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Prominent "start from scratch" CTA */}
          <button
            onClick={() => setShowTemplates(false)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-violet-500/40 hover:border-violet-400/70 bg-violet-500/5 hover:bg-violet-500/10 text-violet-300 text-sm font-medium transition-all"
          >
            <Plus size={16} /> Add new subscription manually
          </button>

          {/* Templates grid */}
          <div>
            <p className="text-[11px] font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.4 }}>
              Popular services
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUBSCRIPTION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => {
                    setForm((p) => ({
                      ...p,
                      name: tpl.name,
                      url: tpl.url ?? '',
                      category: tpl.category,
                      price: tpl.defaultPrice,
                      currency: tpl.currency,
                      billingCycle: tpl.billingCycle,
                      nextBillingDate: SubscriptionService.computeNextBillingDate(tpl.billingCycle),
                    }));
                    setShowTemplates(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 hover:bg-white/12 border border-white/8 hover:border-violet-400/40 transition-all text-left"
                >
                  <Favicon url={tpl.url} name={tpl.name} size={30} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={T}>{tpl.name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}>
                      {tpl.currency} {tpl.defaultPrice}/{tpl.billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10 shrink-0">
        <Favicon url={form.url} name={form.name || 'New'} size={32} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold" style={T}>{initial ? 'Edit Subscription' : 'New Subscription'}</h3>
          {form.name ? (
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}>{form.name}</p>
          ) : (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.35 }}>Fill in the details below</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!initial && (
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs transition-colors"
              style={TS}
            >
              <Wand2 size={11} /> Templates
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={TS}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* Service */}
          <FormSection label="Service">
            <div className="flex flex-col gap-2">
              <div>
                <input
                  className={`${inputBase} text-sm font-medium ${nameError ? 'border-red-400/60' : ''}`}
                  style={{ ...inputStyle, ...(nameError ? { backgroundColor: 'rgba(239,68,68,0.08)' } : {}) }}
                  value={form.name ?? ''}
                  onChange={(e) => { set('name', e.target.value); setNameError(false); }}
                  placeholder="Service name *"
                  autoFocus
                />
                {nameError && (
                  <p className="text-[11px] text-red-400 mt-1.5 ml-1">Name is required</p>
                )}
              </div>
              <input
                className={inputBase}
                style={inputStyle}
                value={form.url ?? ''}
                onChange={(e) => set('url', e.target.value)}
                placeholder="Website URL (optional)"
              />
              <input
                type="email"
                className={inputBase}
                style={inputStyle}
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                placeholder="Account email (optional)"
              />
            </div>
          </FormSection>

          {/* Pricing */}
          <FormSection label="Pricing">
            {/* Amount + currency */}
            <div className="flex gap-2">
              <div
                className="flex-1 flex items-center border border-white/10 rounded-xl overflow-hidden focus-within:border-violet-400/60 transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <span className="pl-3.5 text-sm font-medium shrink-0" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.45 }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="flex-1 bg-transparent px-2 py-2.5 text-sm outline-none"
                  style={{ color: 'var(--newtab-text)', colorScheme: 'dark' }}
                  value={form.price || ''}
                  onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <CurrencyPicker
                value={form.currency ?? 'USD'}
                onChange={(v) => set('currency', v)}
              />
            </div>

            {/* Billing cycle pills */}
            <div className="grid grid-cols-4 gap-1.5">
              {BILLING_CYCLES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    set('billingCycle', key);
                    set('nextBillingDate', SubscriptionService.computeNextBillingDate(key));
                  }}
                  className="py-2 rounded-xl text-xs font-medium border transition-all"
                  style={form.billingCycle === key
                    ? { backgroundColor: 'rgb(124,58,237)', color: 'white', borderColor: 'rgba(139,92,246,0.6)' }
                    : { ...TS, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Next billing date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] ml-1" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}>Next billing date</label>
              <input
                type="date"
                className={inputBase}
                style={{ ...inputStyle, colorScheme: 'dark' }}
                value={form.nextBillingDate ?? ''}
                onChange={(e) => set('nextBillingDate', e.target.value)}
              />
            </div>
          </FormSection>

          {/* Category */}
          <FormSection label="Category">
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => set('category', k)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all"
                  style={form.category === k
                    ? { backgroundColor: 'rgba(124,58,237,0.65)', color: 'white', borderColor: 'rgba(139,92,246,0.5)' }
                    : { ...TS, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
                  }
                >
                  <span className="text-sm">{CATEGORY_ICONS[k] ?? '📦'}</span>
                  <span className="truncate">{v}</span>
                </button>
              ))}
              {customCats.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => set('category', cat.value)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all"
                  style={form.category === cat.value
                    ? { backgroundColor: `${cat.color}44`, color: 'white', borderColor: `${cat.color}88` }
                    : { ...TS, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
                  }
                >
                  <span className="text-sm">{cat.emoji}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
              {!showAddCategory && (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs border border-dashed border-white/20 hover:border-violet-400/50 hover:bg-white/5 transition-all"
                  style={TS}
                >
                  <Plus size={11} /> Custom
                </button>
              )}
            </div>
            {showAddCategory && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/10 mt-0.5">
                <div className="flex gap-2">
                  <input
                    className="w-14 text-center text-xl border border-white/10 rounded-xl py-2 outline-none focus:border-violet-400/60 transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--newtab-text)' }}
                    value={newCatEmoji}
                    onChange={(e) => setNewCatEmoji(e.target.value)}
                    placeholder="🎮"
                    maxLength={2}
                  />
                  <input
                    className="flex-1 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400/60 transition-all"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--newtab-text)' }}
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleAddCustomCat(); }}
                    placeholder="Category name"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={TS}>Color:</span>
                  <div className="flex gap-1.5">
                    {CUSTOM_CAT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, outline: newCatColor === c ? '2px solid white' : '2px solid transparent', outlineOffset: '1px' }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleAddCustomCat()}
                    disabled={!newCatLabel.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    Add Category
                  </button>
                  <button
                    onClick={() => { setShowAddCategory(false); setNewCatEmoji(''); setNewCatLabel(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/10"
                    style={TS}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </FormSection>

          {/* Status */}
          <FormSection label="Status">
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map(({ key, label, activeStyle }) => (
                <button
                  key={key}
                  onClick={() => set('status', key)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                  style={form.status === key
                    ? activeStyle
                    : { ...TS, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </FormSection>

          {/* Optional */}
          <FormSection label="Optional">
            <div className="flex gap-2">
              <input
                className={`${inputBase} flex-1`}
                style={inputStyle}
                value={form.paymentMethod ?? ''}
                onChange={(e) => set('paymentMethod', e.target.value)}
                placeholder="Payment method (Visa, PayPal…)"
              />
              <div
                className="flex items-center gap-0.5 border border-white/10 rounded-xl px-3 focus-within:border-violet-400/60 transition-all w-24 shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <span className="text-xs shrink-0" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.4 }}>🔔</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  className="w-full bg-transparent px-1.5 py-2.5 text-sm outline-none"
                  style={{ color: 'var(--newtab-text)', colorScheme: 'dark' }}
                  value={form.reminder ?? 3}
                  onChange={(e) => set('reminder', parseInt(e.target.value) || 0)}
                  title="Reminder days before renewal"
                />
                <span className="text-[10px] shrink-0" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.4 }}>d</span>
              </div>
            </div>
            <textarea
              className={`${inputBase} resize-none`}
              style={inputStyle}
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Notes (optional)"
            />
          </FormSection>

        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm transition-colors hover:bg-white/10"
          style={TS}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-lg shadow-violet-900/30 transition-colors"
        >
          {initial ? 'Save Changes' : <><Plus size={14} /> Add Subscription</>}
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type SubTab = 'list' | 'calendar' | 'analytics';

export default function SubscriptionsPanel() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [tab, setTab] = useState<SubTab>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      SubscriptionStorage.getAll(),
      SubscriptionStorage.getCustomCategories(),
    ]).then(([s, cats]) => { setSubs(s); setCustomCats(cats); setLoading(false); });
  }, []);

  const handleSave = useCallback(async (sub: Subscription) => {
    await SubscriptionStorage.save(sub);
    setSubs((prev) => {
      const idx = prev.findIndex((s) => s.id === sub.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = sub; return n; }
      return [...prev, sub];
    });
    setFormOpen(false); setEditSub(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await SubscriptionStorage.delete(id);
    setSubs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleStatus = useCallback(async (id: string, status: Subscription['status']) => {
    await SubscriptionStorage.update(id, { status });
    setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  }, []);

  const handleImport = useCallback(async (imported: Subscription[]) => {
    await SubscriptionStorage.importMany(imported);
    setSubs(await SubscriptionStorage.getAll());
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></div>;

  if (formOpen) return (
    <div className="pt-4 w-full flex flex-col h-full gap-3">
      <h2 className="text-xl font-semibold shrink-0" style={{ color: 'var(--newtab-text)' }}>Manage Subscriptions</h2>
      <div className="glass-panel rounded-2xl flex flex-col flex-1 overflow-hidden">
        <SubForm initial={editSub} onSave={handleSave} onClose={() => { setFormOpen(false); setEditSub(null); }} customCats={customCats} onCustomCatsChange={setCustomCats} />
      </div>
    </div>
  );

  return (
    <div className="pt-4 w-full flex flex-col h-full gap-3">
      <h2 className="text-xl font-semibold shrink-0" style={{ color: 'var(--newtab-text)' }}>Manage Subscriptions</h2>
      <div className="glass-panel rounded-2xl flex flex-col flex-1 overflow-hidden">
        <SummaryStrip subscriptions={subs} onAdd={() => { setEditSub(null); setFormOpen(true); }} />

        {/* Tab bar */}
        <div className="flex items-center border-b border-white/10 px-4">
          {(['list', 'calendar', 'analytics'] as SubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${tab === t ? 'text-violet-400 border-violet-500' : 'border-transparent hover:text-white/80'}`}
              style={tab === t ? {} : TS}
            >
              {t === 'list' ? '📋 List' : t === 'calendar' ? '📅 Calendar' : '📊 Analytics'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'list'      && <ListTab subs={subs} customCats={customCats} onEdit={(s) => { setEditSub(s); setFormOpen(true); }} onDelete={handleDelete} onStatusChange={handleStatus} />}
          {tab === 'calendar'  && <CalendarTab subs={subs} />}
          {tab === 'analytics' && <AnalyticsTab subs={subs} onImport={handleImport} />}
        </div>
      </div>
    </div>
  );
}
