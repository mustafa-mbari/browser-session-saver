/**
 * Generic adapter for storing an array of items under a single
 * `chrome.storage.local` key. Shared by SubscriptionStorage and
 * TabGroupTemplateStorage to eliminate duplicated boilerplate.
 */
export class ChromeLocalKeyAdapter<T> {
  constructor(private readonly key: string) {}

  getAll(): Promise<T[]> {
    return new Promise((resolve) =>
      chrome.storage.local.get(this.key, (r) =>
        resolve((r[this.key] as T[] | undefined) ?? []),
      ),
    );
  }

  setAll(items: T[]): Promise<void> {
    return new Promise((resolve) =>
      chrome.storage.local.set({ [this.key]: items }, resolve),
    );
  }
}
