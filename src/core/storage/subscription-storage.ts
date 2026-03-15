import type { Subscription, CustomCategory } from '@core/types/subscription.types';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';

const subsAdapter = new ChromeLocalKeyAdapter<Subscription>('subscriptions');
const catsAdapter = new ChromeLocalKeyAdapter<CustomCategory>('subscription_categories');

export const SubscriptionStorage = {
  getAll: () => subsAdapter.getAll(),
  getCustomCategories: () => catsAdapter.getAll(),

  async addCustomCategory(cat: CustomCategory): Promise<void> {
    const all = await catsAdapter.getAll();
    if (!all.find((c) => c.value === cat.value)) {
      await catsAdapter.setAll([...all, cat]);
    }
  },

  async deleteCustomCategory(value: string): Promise<void> {
    const all = await catsAdapter.getAll();
    await catsAdapter.setAll(all.filter((c) => c.value !== value));
  },

  async save(sub: Subscription): Promise<void> {
    const all = await subsAdapter.getAll();
    const idx = all.findIndex((s) => s.id === sub.id);
    if (idx >= 0) {
      all[idx] = sub;
    } else {
      all.push(sub);
    }
    await subsAdapter.setAll(all);
  },

  async update(id: string, updates: Partial<Subscription>): Promise<void> {
    const all = await subsAdapter.getAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updates };
      await subsAdapter.setAll(all);
    }
  },

  async delete(id: string): Promise<void> {
    const all = await subsAdapter.getAll();
    await subsAdapter.setAll(all.filter((s) => s.id !== id));
  },

  async deleteAll(): Promise<void> {
    await subsAdapter.setAll([]);
  },

  async importMany(subs: Subscription[]): Promise<void> {
    const all = await subsAdapter.getAll();
    const map = new Map(all.map((s) => [s.id, s]));
    for (const sub of subs) {
      map.set(sub.id, sub);
    }
    await subsAdapter.setAll(Array.from(map.values()));
  },
};
