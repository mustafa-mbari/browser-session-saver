const locks = new Map<string, Promise<void>>();

/**
 * Serializes concurrent read-modify-write operations on the same chrome.storage.local key.
 * Operations on different keys run in parallel. The queue drains itself — no memory leak.
 * If fn throws, the lock is still released so subsequent calls on the same key proceed.
 */
export function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const result = prev.then(() => fn());
  locks.set(key, result.then(() => {}, () => {}));
  return result;
}
