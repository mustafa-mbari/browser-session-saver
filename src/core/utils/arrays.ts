/** Narrow an array to a non-empty tuple (e.g. chrome.tabs.group / ungroup require one). */
export function isNonEmpty<T>(items: T[]): items is [T, ...T[]] {
  return items.length > 0;
}
