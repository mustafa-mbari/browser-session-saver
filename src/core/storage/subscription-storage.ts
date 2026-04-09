import type { Subscription, CustomCategory } from '@core/types/subscription.types';
import { ChromeLocalArrayRepository } from './chrome-local-array-repository';
import { ChromeLocalKeyAdapter } from './chrome-local-key-adapter';
import { recordDeletion, recordDeletions } from './deletion-log';
import { notifySyncMutation } from '@core/services/sync-trigger';

const subsRepo = new ChromeLocalArrayRepository<Subscription>('subscriptions');
const catsAdapter = new ChromeLocalKeyAdapter<CustomCategory>('subscription_categories');

export const SubscriptionStorage = {
  getAll: () => subsRepo.getAll(),
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
    await subsRepo.save(sub);
    notifySyncMutation();
  },

  async update(id: string, updates: Partial<Subscription>): Promise<void> {
    await subsRepo.update(id, updates);
    notifySyncMutation();
  },

  async delete(id: string): Promise<void> {
    await subsRepo.delete(id);
    await recordDeletion('tracked_subscriptions', id);
    notifySyncMutation();
  },

  async deleteAll(): Promise<void> {
    const all = await subsRepo.getAll();
    await subsRepo.replaceAll([]);
    await recordDeletions('tracked_subscriptions', all.map((s) => s.id));
    notifySyncMutation();
  },

  importMany: (subs: Subscription[]) => subsRepo.importMany(subs),

  replaceCustomCategories(cats: CustomCategory[]): Promise<void> {
    return catsAdapter.setAll(cats);
  },

  async mergeCustomCategories(incoming: CustomCategory[]): Promise<void> {
    const existing = await catsAdapter.getAll();
    const map = new Map(existing.map((c) => [c.value, c]));
    incoming.forEach((c) => map.set(c.value, c));
    await catsAdapter.setAll(Array.from(map.values()));
  },
};

/** Expose the underlying repository for direct IRepository<Subscription> usage. */
export function getSubscriptionRepository() {
  return subsRepo;
}
