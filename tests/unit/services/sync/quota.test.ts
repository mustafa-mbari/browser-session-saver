import { describe, it, expect } from 'vitest';
import { enforceQuota } from '@core/services/sync/quota';

interface TestEntity {
  id: string;
  updatedAt: string;
  createdAt: string;
}

const makeEntities = (count: number): TestEntity[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    updatedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    createdAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }));

describe('enforceQuota', () => {
  it('returns all entities when limit is null', () => {
    const entities = makeEntities(5);
    const result = enforceQuota(entities, { limit: null, sortField: 'updatedAt' });
    expect(result).toHaveLength(5);
  });

  it('returns all entities when limit is Infinity', () => {
    const entities = makeEntities(5);
    const result = enforceQuota(entities, { limit: Infinity, sortField: 'updatedAt' });
    expect(result).toHaveLength(5);
  });

  it('returns empty array when limit is 0', () => {
    const entities = makeEntities(5);
    const result = enforceQuota(entities, { limit: 0, sortField: 'updatedAt' });
    expect(result).toHaveLength(0);
  });

  it('slices to limit after sorting descending by sortField', () => {
    const entities = makeEntities(5);
    const result = enforceQuota(entities, { limit: 2, sortField: 'updatedAt' });
    expect(result).toHaveLength(2);
    // Most recent first (id-4 = Jan 5, id-3 = Jan 4)
    expect(result[0].id).toBe('id-4');
    expect(result[1].id).toBe('id-3');
  });

  it('works with createdAt sort field', () => {
    const entities = makeEntities(3);
    const result = enforceQuota(entities, { limit: 1, sortField: 'createdAt' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('id-2'); // Jan 3 is the most recent
  });

  it('does not mutate the original array', () => {
    const entities = makeEntities(3);
    const original = [...entities];
    enforceQuota(entities, { limit: 1, sortField: 'updatedAt' });
    expect(entities).toEqual(original);
  });

  it('returns all entities when limit exceeds count', () => {
    const entities = makeEntities(2);
    const result = enforceQuota(entities, { limit: 10, sortField: 'updatedAt' });
    expect(result).toHaveLength(2);
  });
});
