import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubscriptionService } from '@core/services/subscription.service';
import type { Subscription } from '@core/types/subscription.types';

// Use a fixed "today" so urgency tests are deterministic
const TODAY = '2026-03-15';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    name: 'Netflix',
    category: 'streaming',
    price: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: TODAY,
    status: 'active',
    reminder: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    tags: [],
    ...overrides,
  };
}

describe('SubscriptionService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  describe('getUrgency', () => {
    it('returns safe for canceled subscriptions regardless of date', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ status: 'canceled', nextBillingDate: '2026-03-10' })),
      ).toBe('safe');
    });

    it('returns safe for paused subscriptions', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ status: 'paused', nextBillingDate: '2026-03-10' })),
      ).toBe('safe');
    });

    it('returns overdue when billing date is in the past', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: '2026-03-10' })),
      ).toBe('overdue');
    });

    it('returns today when billing date is today', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: TODAY })),
      ).toBe('today');
    });

    it('returns urgent when 1 day away', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: '2026-03-16' })),
      ).toBe('urgent');
    });

    it('returns urgent when exactly 3 days away', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: '2026-03-18' })),
      ).toBe('urgent');
    });

    it('returns soon when 4 days away', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: '2026-03-19' })),
      ).toBe('soon');
    });

    it('returns soon when exactly 7 days away', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: '2026-03-22' })),
      ).toBe('soon');
    });

    it('returns safe when more than 7 days away', () => {
      expect(
        SubscriptionService.getUrgency(makeSub({ nextBillingDate: '2026-04-01' })),
      ).toBe('safe');
    });
  });

  // -------------------------------------------------------------------------
  describe('normalizeToMonthly', () => {
    it('returns price as-is for monthly', () => {
      expect(SubscriptionService.normalizeToMonthly(makeSub({ billingCycle: 'monthly', price: 12 }))).toBe(12);
    });

    it('divides yearly price by 12', () => {
      expect(
        SubscriptionService.normalizeToMonthly(makeSub({ billingCycle: 'yearly', price: 120 })),
      ).toBeCloseTo(10);
    });

    it('multiplies weekly price by 4.33', () => {
      expect(
        SubscriptionService.normalizeToMonthly(makeSub({ billingCycle: 'weekly', price: 10 })),
      ).toBeCloseTo(43.3);
    });

    it('returns price as-is for custom billing cycle', () => {
      expect(SubscriptionService.normalizeToMonthly(makeSub({ billingCycle: 'custom', price: 25 }))).toBe(25);
    });
  });

  // -------------------------------------------------------------------------
  describe('getMonthlyTotal', () => {
    it('returns 0 for an empty list', () => {
      expect(SubscriptionService.getMonthlyTotal([])).toBe(0);
    });

    it('sums only active and trial subscriptions', () => {
      const subs = [
        makeSub({ id: '1', price: 10, billingCycle: 'monthly', status: 'active' }),
        makeSub({ id: '2', price: 5, billingCycle: 'monthly', status: 'trial' }),
        makeSub({ id: '3', price: 99, billingCycle: 'monthly', status: 'canceled' }),
        makeSub({ id: '4', price: 50, billingCycle: 'monthly', status: 'paused' }),
      ];
      expect(SubscriptionService.getMonthlyTotal(subs)).toBeCloseTo(15);
    });

    it('normalizes yearly subscriptions before summing', () => {
      const subs = [
        makeSub({ id: '1', price: 120, billingCycle: 'yearly', status: 'active' }),
      ];
      expect(SubscriptionService.getMonthlyTotal(subs)).toBeCloseTo(10);
    });
  });

  // -------------------------------------------------------------------------
  describe('getDueSoon', () => {
    it('returns subscriptions within the given day threshold', () => {
      const subs = [
        makeSub({ id: '1', nextBillingDate: '2026-03-18', status: 'active' }), // 3 days
        makeSub({ id: '2', nextBillingDate: '2026-03-22', status: 'active' }), // 7 days
        makeSub({ id: '3', nextBillingDate: '2026-03-25', status: 'active' }), // 10 days
        makeSub({ id: '4', nextBillingDate: '2026-03-18', status: 'canceled' }), // excluded
      ];
      const result = SubscriptionService.getDueSoon(subs, 7);
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toContain('1');
      expect(result.map((s) => s.id)).toContain('2');
    });

    it('excludes overdue subscriptions', () => {
      const subs = [makeSub({ nextBillingDate: '2026-03-10', status: 'active' })];
      expect(SubscriptionService.getDueSoon(subs, 7)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('getOverdue', () => {
    it('returns subscriptions with past billing dates', () => {
      const subs = [
        makeSub({ id: '1', nextBillingDate: '2026-03-10', status: 'active' }),
        makeSub({ id: '2', nextBillingDate: '2026-03-20', status: 'active' }),
        makeSub({ id: '3', nextBillingDate: '2026-03-10', status: 'canceled' }), // excluded
      ];
      const result = SubscriptionService.getOverdue(subs);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('returns empty when nothing is overdue', () => {
      expect(SubscriptionService.getOverdue([makeSub({ nextBillingDate: '2026-04-01' })])).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('computeNextBillingDate', () => {
    const from = new Date('2026-01-15T00:00:00.000Z');

    it('adds one month for monthly', () => {
      expect(SubscriptionService.computeNextBillingDate('monthly', from)).toBe('2026-02-15');
    });

    it('adds one year for yearly', () => {
      expect(SubscriptionService.computeNextBillingDate('yearly', from)).toBe('2027-01-15');
    });

    it('adds 7 days for weekly', () => {
      expect(SubscriptionService.computeNextBillingDate('weekly', from)).toBe('2026-01-22');
    });

    it('adds one month for custom (default behaviour)', () => {
      expect(SubscriptionService.computeNextBillingDate('custom', from)).toBe('2026-02-15');
    });
  });

  // -------------------------------------------------------------------------
  describe('exportCSV / importCSV round-trip', () => {
    it('preserves all fields through export and re-import', () => {
      const subs = [
        makeSub({ id: 'abc', name: 'Netflix', price: 15.99, tags: ['streaming', 'video'] }),
        makeSub({ id: 'def', name: 'Spotify', price: 9.99, notes: 'Family plan' }),
      ];
      const csv = SubscriptionService.exportCSV(subs);
      const imported = SubscriptionService.importCSV(csv);

      expect(imported).toHaveLength(2);
      expect(imported[0].name).toBe('Netflix');
      expect(imported[0].price).toBe(15.99);
      expect(imported[0].tags).toEqual(['streaming', 'video']);
      expect(imported[1].notes).toBe('Family plan');
    });

    it('handles quoted fields with commas and embedded double-quotes', () => {
      const subs = [makeSub({ name: 'He said "hello"', notes: 'A, B, C' })];
      const csv = SubscriptionService.exportCSV(subs);
      const imported = SubscriptionService.importCSV(csv);

      expect(imported[0].name).toBe('He said "hello"');
      expect(imported[0].notes).toBe('A, B, C');
    });

    it('returns empty array for header-only CSV', () => {
      expect(SubscriptionService.importCSV('id,name')).toHaveLength(0);
    });

    it('skips rows without a name', () => {
      const subs = [makeSub({ name: 'Valid' }), makeSub({ name: '' })];
      const csv = SubscriptionService.exportCSV(subs);
      const imported = SubscriptionService.importCSV(csv);
      expect(imported).toHaveLength(1);
      expect(imported[0].name).toBe('Valid');
    });
  });

  // -------------------------------------------------------------------------
  describe('formatCurrency', () => {
    it('formats USD amounts with two decimal places', () => {
      const result = SubscriptionService.formatCurrency(15.99, 'USD');
      expect(result).toContain('15.99');
    });

    it('falls back gracefully for an unknown currency code', () => {
      const result = SubscriptionService.formatCurrency(10, 'XYZ');
      expect(result).toContain('10.00');
    });
  });

  // -------------------------------------------------------------------------
  describe('getCategoryBreakdown', () => {
    it('groups active subscriptions by category', () => {
      const subs = [
        makeSub({ id: '1', category: 'work', price: 20, status: 'active' }),
        makeSub({ id: '2', category: 'work', price: 30, status: 'active' }),
        makeSub({ id: '3', category: 'streaming', price: 10, status: 'active' }),
        makeSub({ id: '4', category: 'streaming', price: 5, status: 'canceled' }), // excluded
      ];
      const result = SubscriptionService.getCategoryBreakdown(subs);
      const work = result.find((r) => r.category === 'work');
      const streaming = result.find((r) => r.category === 'streaming');

      expect(work?.total).toBeCloseTo(50);
      expect(streaming?.total).toBeCloseTo(10);
    });
  });

  // -------------------------------------------------------------------------
  describe('getSavings', () => {
    it('sums the annual equivalent of canceled subscriptions', () => {
      const subs = [
        makeSub({ id: '1', price: 10, billingCycle: 'monthly', status: 'canceled' }),
        makeSub({ id: '2', price: 5, billingCycle: 'monthly', status: 'active' }), // excluded
      ];
      // 10/month * 12 = 120
      expect(SubscriptionService.getSavings(subs)).toBeCloseTo(120);
    });
  });
});
