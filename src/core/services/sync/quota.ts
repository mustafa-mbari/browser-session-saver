/**
 * sync/quota.ts — Shared quota enforcement utility.
 *
 * Replaces the duplicated topByUpdatedAt / topByCreatedAt helpers
 * that were repeated across every per-entity sync function.
 */

export interface QuotaConfig {
  /** Maximum number of entities allowed. null = unlimited. */
  limit: number | null;
  /** Entity field to sort by (descending) before slicing. */
  sortField: string;
}

/**
 * Enforce a quota by sorting entities descending by the given field
 * and taking at most `limit` items.
 *
 * Returns the full array when limit is null or Infinity.
 */
export function enforceQuota<T>(entities: T[], config: QuotaConfig): T[] {
  const { limit, sortField } = config;
  if (limit == null || !isFinite(limit)) return entities;
  if (limit <= 0) return [];

  const sorted = [...entities].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortField] as string ?? '';
    const bVal = (b as Record<string, unknown>)[sortField] as string ?? '';
    return bVal.localeCompare(aVal); // descending
  });

  return sorted.slice(0, limit);
}
