import type { Subscription, DueUrgency, BillingCycle } from '@core/types/subscription.types';
import { generateId } from '@core/utils/uuid';

function getDaysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(isoDate);
  next.setHours(0, 0, 0, 0);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const SubscriptionService = {
  getDaysUntil,

  getUrgency(sub: Subscription): DueUrgency {
    if (sub.status === 'canceled' || sub.status === 'paused') return 'safe';
    const days = getDaysUntil(sub.nextBillingDate);
    if (days < 0) return 'overdue';
    if (days === 0) return 'today';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'soon';
    return 'safe';
  },

  getDueSoon(subs: Subscription[], days: number): Subscription[] {
    return subs.filter((s) => {
      if (s.status === 'canceled') return false;
      const d = getDaysUntil(s.nextBillingDate);
      return d >= 0 && d <= days;
    });
  },

  getOverdue(subs: Subscription[]): Subscription[] {
    return subs.filter((s) => {
      if (s.status === 'canceled') return false;
      return getDaysUntil(s.nextBillingDate) < 0;
    });
  },

  normalizeToMonthly(sub: Subscription): number {
    switch (sub.billingCycle) {
      case 'yearly':  return sub.price / 12;
      case 'weekly':  return sub.price * 4.33;
      case 'custom':  return sub.price;
      default:        return sub.price;
    }
  },

  getMonthlyTotal(subs: Subscription[]): number {
    return subs
      .filter((s) => s.status === 'active' || s.status === 'trial')
      .reduce((sum, s) => sum + SubscriptionService.normalizeToMonthly(s), 0);
  },

  getMonthlyTotals(subs: Subscription[], months: number): { label: string; total: number }[] {
    const result: { label: string; total: number }[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const total = subs
        .filter((s) => {
          if (s.status === 'canceled') return false;
          const created = new Date(s.createdAt);
          return created <= monthEnd;
        })
        .reduce((sum, s) => sum + SubscriptionService.normalizeToMonthly(s), 0);

      result.push({ label, total });
    }
    return result;
  },

  getCategoryBreakdown(subs: Subscription[]): { category: string; total: number; color: string }[] {
    const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trial');
    const map = new Map<string, number>();

    for (const s of activeSubs) {
      map.set(s.category, (map.get(s.category) ?? 0) + SubscriptionService.normalizeToMonthly(s));
    }

    const categoryColors: Record<string, string> = {
      work: '#3b82f6', personal: '#ec4899', saas: '#8b5cf6',
      streaming: '#f59e0b', utility: '#10b981', other: '#6b7280',
    };

    return Array.from(map.entries()).map(([category, total]) => ({
      category, total, color: categoryColors[category] ?? '#6b7280',
    }));
  },

  getSavings(subs: Subscription[]): number {
    return subs
      .filter((s) => s.status === 'canceled')
      .reduce((sum, s) => sum + SubscriptionService.normalizeToMonthly(s) * 12, 0);
  },

  formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency,
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  },

  exportCSV(subs: Subscription[]): string {
    const headers = [
      'id', 'name', 'url', 'email', 'category', 'price', 'currency', 'billingCycle',
      'nextBillingDate', 'paymentMethod', 'status', 'reminder', 'notes', 'tags', 'createdAt',
    ];
    const rows = subs.map((s) =>
      [
        s.id, s.name, s.url ?? '', s.email ?? '', s.category, s.price.toString(), s.currency,
        s.billingCycle, s.nextBillingDate, s.paymentMethod ?? '', s.status,
        s.reminder.toString(), s.notes ?? '', (s.tags ?? []).join(';'), s.createdAt,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  },

  importCSV(csv: string): Subscription[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

    return lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (line[i] === ',' && !inQuotes) {
          values.push(current); current = '';
        } else {
          current += line[i];
        }
      }
      values.push(current);

      const get = (key: string) => values[headers.indexOf(key)] ?? '';

      return {
        id: get('id') || generateId(),
        name: get('name'),
        url: get('url') || undefined,
        email: get('email') || undefined,
        category: get('category') || 'other',
        price: parseFloat(get('price')) || 0,
        currency: get('currency') || 'USD',
        billingCycle: (get('billingCycle') as Subscription['billingCycle']) || 'monthly',
        nextBillingDate: get('nextBillingDate') || new Date().toISOString().split('T')[0],
        paymentMethod: get('paymentMethod') || undefined,
        status: (get('status') as Subscription['status']) || 'active',
        reminder: parseInt(get('reminder')) || 3,
        notes: get('notes') || undefined,
        tags: get('tags') ? get('tags').split(';').filter(Boolean) : [],
        createdAt: get('createdAt') || new Date().toISOString(),
      } as Subscription;
    }).filter((s) => s.name);
  },

  generateId,

  computeNextBillingDate(billingCycle: BillingCycle, from: Date = new Date()): string {
    const d = new Date(from);
    switch (billingCycle) {
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
      case 'weekly':  d.setDate(d.getDate() + 7); break;
      default:        d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  },
};
