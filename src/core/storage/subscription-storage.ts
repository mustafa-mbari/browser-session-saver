import type { Subscription, CustomCategory } from '@core/types/subscription.types';

const KEY = 'subscriptions';
const CUSTOM_CATS_KEY = 'subscription_categories';

function getAll(): Promise<Subscription[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY, (result) => {
      resolve((result[KEY] as Subscription[]) ?? []);
    });
  });
}

function saveAll(subs: Subscription[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: subs }, resolve);
  });
}

function getCustomCategories(): Promise<CustomCategory[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(CUSTOM_CATS_KEY, (r) => {
      resolve((r[CUSTOM_CATS_KEY] as CustomCategory[]) ?? []);
    });
  });
}

function saveCustomCategories(cats: CustomCategory[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CUSTOM_CATS_KEY]: cats }, resolve);
  });
}

export const SubscriptionStorage = {
  getAll,
  getCustomCategories,

  async addCustomCategory(cat: CustomCategory): Promise<void> {
    const all = await getCustomCategories();
    if (!all.find((c) => c.value === cat.value)) {
      await saveCustomCategories([...all, cat]);
    }
  },

  async deleteCustomCategory(value: string): Promise<void> {
    const all = await getCustomCategories();
    await saveCustomCategories(all.filter((c) => c.value !== value));
  },

  async save(sub: Subscription): Promise<void> {
    const all = await getAll();
    const idx = all.findIndex((s) => s.id === sub.id);
    if (idx >= 0) {
      all[idx] = sub;
    } else {
      all.push(sub);
    }
    await saveAll(all);
  },

  async update(id: string, updates: Partial<Subscription>): Promise<void> {
    const all = await getAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...updates };
      await saveAll(all);
    }
  },

  async delete(id: string): Promise<void> {
    const all = await getAll();
    await saveAll(all.filter((s) => s.id !== id));
  },

  async deleteAll(): Promise<void> {
    await saveAll([]);
  },

  async importMany(subs: Subscription[]): Promise<void> {
    const all = await getAll();
    const map = new Map(all.map((s) => [s.id, s]));
    for (const sub of subs) {
      map.set(sub.id, sub);
    }
    await saveAll(Array.from(map.values()));
  },
};
