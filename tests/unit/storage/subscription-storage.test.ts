import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionStorage } from '@core/storage/subscription-storage';
import type { Subscription, CustomCategory } from '@core/types/subscription.types';

vi.mock('@core/services/limits/limit-guard', () => ({
  guardAction: vi.fn().mockResolvedValue(undefined),
  trackAction: vi.fn().mockResolvedValue(undefined),
  ActionLimitError: class ActionLimitError extends Error {},
}));



// In-memory store that backs the callback-based chrome.storage.local mock
let store: Record<string, unknown> = {};

function setupStorage(initial: Record<string, unknown> = {}) {
  store = { ...initial };

  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string, cb: (r: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    },
  );

  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    },
  );
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    name: 'Netflix',
    category: 'streaming',
    price: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: '2026-04-01',
    status: 'active',
    reminder: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCat(overrides: Partial<CustomCategory> = {}): CustomCategory {
  return {
    value: 'gaming',
    label: 'Gaming',
    emoji: '🎮',
    color: '#3b82f6',
    ...overrides,
  };
}

describe('SubscriptionStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStorage();
  });

  // ── getAll ───────────────────────────────────────────────────────────────

  it('getAll returns empty array when no subscriptions stored', async () => {
    const result = await SubscriptionStorage.getAll();
    expect(result).toEqual([]);
  });

  it('getAll returns stored subscriptions', async () => {
    const sub = makeSub();
    setupStorage({ subscriptions: [sub] });
    const result = await SubscriptionStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sub-1');
  });

  // ── save (insert) ─────────────────────────────────────────────────────────

  it('save inserts a new subscription', async () => {
    const sub = makeSub();
    await SubscriptionStorage.save(sub);
    const result = await SubscriptionStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(sub);
  });

  // ── save (update) ─────────────────────────────────────────────────────────

  it('save replaces existing subscription with same id', async () => {
    const original = makeSub({ price: 10 });
    setupStorage({ subscriptions: [original] });

    const updated = makeSub({ price: 20 });
    await SubscriptionStorage.save(updated);

    const result = await SubscriptionStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(20);
  });

  // ── update ────────────────────────────────────────────────────────────────

  it('update applies partial changes to matching subscription', async () => {
    setupStorage({ subscriptions: [makeSub({ price: 10 })] });
    await SubscriptionStorage.update('sub-1', { price: 99, status: 'paused' });
    const result = await SubscriptionStorage.getAll();
    expect(result[0].price).toBe(99);
    expect(result[0].status).toBe('paused');
    expect(result[0].name).toBe('Netflix'); // unchanged field preserved
  });

  it('update is a no-op for unknown id', async () => {
    setupStorage({ subscriptions: [makeSub()] });
    await SubscriptionStorage.update('unknown-id', { price: 0 });
    const result = await SubscriptionStorage.getAll();
    expect(result[0].price).toBe(15.99); // unchanged
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it('delete removes the subscription by id', async () => {
    setupStorage({ subscriptions: [makeSub({ id: 'a' }), makeSub({ id: 'b' })] });
    await SubscriptionStorage.delete('a');
    const result = await SubscriptionStorage.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('delete is a no-op for unknown id', async () => {
    setupStorage({ subscriptions: [makeSub()] });
    await SubscriptionStorage.delete('no-such-id');
    expect(await SubscriptionStorage.getAll()).toHaveLength(1);
  });

  // ── deleteAll ─────────────────────────────────────────────────────────────

  it('deleteAll empties the subscriptions list', async () => {
    setupStorage({ subscriptions: [makeSub(), makeSub({ id: 'sub-2' })] });
    await SubscriptionStorage.deleteAll();
    expect(await SubscriptionStorage.getAll()).toEqual([]);
  });

  // ── importMany ────────────────────────────────────────────────────────────

  it('importMany inserts new subscriptions', async () => {
    const subs = [makeSub({ id: 'a' }), makeSub({ id: 'b' })];
    await SubscriptionStorage.importMany(subs);
    expect(await SubscriptionStorage.getAll()).toHaveLength(2);
  });

  it('importMany deduplicates by id (imported replaces existing)', async () => {
    setupStorage({ subscriptions: [makeSub({ id: 'a', price: 1 })] });
    await SubscriptionStorage.importMany([makeSub({ id: 'a', price: 99 }), makeSub({ id: 'b' })]);
    const result = await SubscriptionStorage.getAll();
    expect(result).toHaveLength(2);
    const updated = result.find((s) => s.id === 'a');
    expect(updated?.price).toBe(99);
  });

  // ── custom categories ─────────────────────────────────────────────────────

  it('getCustomCategories returns empty array initially', async () => {
    expect(await SubscriptionStorage.getCustomCategories()).toEqual([]);
  });

  it('addCustomCategory appends a new category', async () => {
    const cat = makeCat();
    await SubscriptionStorage.addCustomCategory(cat);
    const all = await SubscriptionStorage.getCustomCategories();
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe('gaming');
  });

  it('addCustomCategory does not duplicate by value', async () => {
    const cat = makeCat();
    await SubscriptionStorage.addCustomCategory(cat);
    await SubscriptionStorage.addCustomCategory(cat); // duplicate
    expect(await SubscriptionStorage.getCustomCategories()).toHaveLength(1);
  });

  it('deleteCustomCategory removes by value', async () => {
    setupStorage({
      subscription_categories: [makeCat({ value: 'gaming' }), makeCat({ value: 'fitness', label: 'Fitness', emoji: '🏋️', color: '#22c55e' })],
    });
    await SubscriptionStorage.deleteCustomCategory('gaming');
    const all = await SubscriptionStorage.getCustomCategories();
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe('fitness');
  });
});
