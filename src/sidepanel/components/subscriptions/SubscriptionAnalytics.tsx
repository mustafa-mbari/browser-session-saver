import { useMemo, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Subscription } from '@core/types/subscription.types';
import { CATEGORY_LABELS } from '@core/types/subscription.types';
import { SubscriptionService } from '@core/services/subscription.service';

interface Props {
  subscriptions: Subscription[];
  onImport: (subs: Subscription[]) => void;
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const W = 240;
  const H = 90;
  const barW = Math.floor((W - (data.length - 1) * 4) / data.length);
  const currency = 'USD';

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" style={{ maxHeight: 120 }}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.total / max) * H);
        const x = i * (barW + 4);
        const y = H - barH;
        return (
          <g key={d.label}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx={2}
              fill={d.total > 0 ? '#8b5cf6' : '#e5e7eb'}
              opacity={0.85}
            />
            <text
              x={x + barW / 2} y={H + 12}
              textAnchor="middle"
              fontSize={8}
              fill="currentColor"
              opacity={0.5}
            >
              {d.label}
            </text>
            {d.total > 0 && (
              <text
                x={x + barW / 2} y={y - 2}
                textAnchor="middle"
                fontSize={7}
                fill="currentColor"
                opacity={0.7}
              >
                {SubscriptionService.formatCurrency(d.total, currency)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (endAngle - startAngle >= 360) endAngle = startAngle + 359.99;
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end   = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function DonutChart({ data }: { data: { category: string; total: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total === 0) return <p className="text-xs text-center text-[var(--color-text-secondary)] py-4">No data</p>;

  const CX = 60;
  const CY = 60;
  const R  = 45;
  const IR = 28;

  let angle = 0;
  const arcs = data.map((d) => {
    const sweep = (d.total / total) * 360;
    const start = angle;
    angle += sweep;
    return { ...d, startAngle: start, endAngle: angle };
  });

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 120 120" style={{ width: 100, height: 100, flexShrink: 0 }}>
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arcPath(CX, CY, R, arc.startAngle, arc.endAngle)}
            fill="none"
            stroke={arc.color}
            strokeWidth={R - IR}
            opacity={0.85}
          />
        ))}
        <circle cx={CX} cy={CY} r={IR} fill="transparent" />
      </svg>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {arcs.map((arc) => (
          <div key={arc.category} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">
              {CATEGORY_LABELS[arc.category as keyof typeof CATEGORY_LABELS] ?? arc.category}
            </span>
            <span className="text-xs font-medium text-[var(--color-text)] shrink-0">
              {((arc.total / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Analytics ────────────────────────────────────────────────────────────

export default function SubscriptionAnalytics({ subscriptions, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const monthlyTotals = useMemo(
    () => SubscriptionService.getMonthlyTotals(subscriptions, 6),
    [subscriptions],
  );
  const categoryBreakdown = useMemo(
    () => SubscriptionService.getCategoryBreakdown(subscriptions),
    [subscriptions],
  );
  const savings = useMemo(
    () => SubscriptionService.getSavings(subscriptions),
    [subscriptions],
  );
  const canceledSubs = subscriptions.filter((s) => s.status === 'canceled');
  const currency = subscriptions[0]?.currency ?? 'USD';

  const handleExport = () => {
    const csv = SubscriptionService.exportCSV(subscriptions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csv = ev.target?.result as string;
      const imported = SubscriptionService.importCSV(csv);
      if (imported.length > 0) onImport(imported);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-4 px-3 py-3 overflow-y-auto">
      {/* Import/Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-xs text-[var(--color-text)] transition-colors"
        >
          <Download size={12} />
          <span>Export CSV</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-xs text-[var(--color-text)] transition-colors"
        >
          <Upload size={12} />
          <span>Import CSV</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
      </div>

      {/* Monthly spend bar chart */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
        <h4 className="text-xs font-semibold text-[var(--color-text)] mb-2">Monthly Spend (last 6 months)</h4>
        <div className="text-[var(--color-text)]">
          <BarChart data={monthlyTotals} />
        </div>
      </div>

      {/* Category breakdown donut */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
        <h4 className="text-xs font-semibold text-[var(--color-text)] mb-2">Spend by Category</h4>
        <DonutChart data={categoryBreakdown} />
      </div>

      {/* Savings tracker */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
        <h4 className="text-xs font-semibold text-[var(--color-text)] mb-1">Savings Tracker</h4>
        <p className="text-sm font-bold text-green-600 dark:text-green-400 mb-2">
          {SubscriptionService.formatCurrency(savings, currency)}/yr saved
        </p>
        {canceledSubs.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)]">No canceled subscriptions yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {canceledSubs.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)] truncate flex-1">{s.name}</span>
                <span className="text-green-600 dark:text-green-400 font-medium shrink-0 ml-2">
                  +{SubscriptionService.formatCurrency(SubscriptionService.normalizeToMonthly(s) * 12, s.currency)}/yr
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
