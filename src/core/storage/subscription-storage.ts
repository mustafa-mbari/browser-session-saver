import type { Subscription } from '@core/types/subscription.types';

const KEY = 'subscriptions';

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

export const SubscriptionStorage = {
  getAll,

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
