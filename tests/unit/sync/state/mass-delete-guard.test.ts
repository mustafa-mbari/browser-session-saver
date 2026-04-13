import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateMassDelete,
  recordTrip,
  getTrips,
  clearTrip,
  clearAllTrips,
  MIN_ABSOLUTE_TOMBSTONES,
  DEFAULT_TOMBSTONE_FRACTION,
} from '@core/sync/state/mass-delete-guard';

function setupChromeStorage(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {}),
  );
  (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
    (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve(undefined);
    },
  );
  return store;
}

describe('MassDeleteGuard — evaluation', () => {
  it('does not trip for an empty store', () => {
    const r = evaluateMassDelete('sessions', 0, 0);
    expect(r.tripped).toBe(false);
    expect(r.threshold).toBe(MIN_ABSOLUTE_TOMBSTONES);
  });

  it('does not trip below the absolute minimum threshold', () => {
    // 9 tombstones out of 9 total — 100% but still under MIN_ABSOLUTE (10)
    const r = evaluateMassDelete('prompts', 9, 9);
    expect(r.tripped).toBe(false);
  });

  it('does not trip when tombstones equal the threshold (strict greater-than)', () => {
    // total=100, fraction=0.2 → threshold=20. 20 tombstones should NOT trip.
    const r = evaluateMassDelete('sessions', 20, 100);
    expect(r.threshold).toBe(20);
    expect(r.tripped).toBe(false);
  });

  it('trips when tombstones exceed the fractional threshold', () => {
    // 21 tombstones of 100 → 21% > 20% → trip
    const r = evaluateMassDelete('sessions', 21, 100);
    expect(r.threshold).toBe(20);
    expect(r.tripped).toBe(true);
  });

  it('uses the MIN_ABSOLUTE threshold for small stores', () => {
    // 15 of 30 = 50%. Absolute threshold is max(10, ceil(30 * 0.2)=6) = 10.
    // 15 > 10 → trip.
    const r = evaluateMassDelete('subscriptions', 15, 30);
    expect(r.threshold).toBe(10);
    expect(r.tripped).toBe(true);
  });

  it('scales linearly for large stores', () => {
    // 5000 total, 20% = 1000 threshold. 1001 tombstones → trip.
    const r = evaluateMassDelete('bookmark_entries', 1001, 5000);
    expect(r.threshold).toBe(1000);
    expect(r.tripped).toBe(true);
  });

  it('uses the fraction argument when provided', () => {
    // 50% fraction. 100 total → threshold = max(10, 50) = 50. 51 → trip.
    const r = evaluateMassDelete('sessions', 51, 100, 0.5);
    expect(r.threshold).toBe(50);
    expect(r.tripped).toBe(true);
  });

  it('DEFAULT_TOMBSTONE_FRACTION is 0.2 — constants stable', () => {
    expect(DEFAULT_TOMBSTONE_FRACTION).toBe(0.2);
    expect(MIN_ABSOLUTE_TOMBSTONES).toBe(10);
  });
});

describe('MassDeleteGuard — trip persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChromeStorage();
  });

  it('recordTrip persists an entity trip with timestamp', async () => {
    await recordTrip({
      entity: 'sessions',
      tombstoneCount: 30,
      totalCount: 100,
      threshold: 20,
      tripped: true,
    });
    const trips = await getTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].entity).toBe('sessions');
    expect(trips[0].tombstoneCount).toBe(30);
    expect(trips[0].detectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('recordTrip overwrites an existing entity trip (same entity, latest counts)', async () => {
    await recordTrip({
      entity: 'sessions', tombstoneCount: 30, totalCount: 100, threshold: 20, tripped: true,
    });
    await recordTrip({
      entity: 'sessions', tombstoneCount: 80, totalCount: 100, threshold: 20, tripped: true,
    });
    const trips = await getTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].tombstoneCount).toBe(80);
  });

  it('keeps separate trips for different entities', async () => {
    await recordTrip({
      entity: 'sessions', tombstoneCount: 30, totalCount: 100, threshold: 20, tripped: true,
    });
    await recordTrip({
      entity: 'prompts', tombstoneCount: 50, totalCount: 200, threshold: 40, tripped: true,
    });
    const trips = await getTrips();
    expect(trips).toHaveLength(2);
    expect(trips.map((t) => t.entity).sort()).toEqual(['prompts', 'sessions']);
  });

  it('clearTrip removes a specific entity trip only', async () => {
    await recordTrip({
      entity: 'sessions', tombstoneCount: 30, totalCount: 100, threshold: 20, tripped: true,
    });
    await recordTrip({
      entity: 'prompts', tombstoneCount: 50, totalCount: 200, threshold: 40, tripped: true,
    });
    await clearTrip('sessions');
    const trips = await getTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].entity).toBe('prompts');
  });

  it('clearAllTrips wipes every recorded trip', async () => {
    await recordTrip({
      entity: 'sessions', tombstoneCount: 30, totalCount: 100, threshold: 20, tripped: true,
    });
    await recordTrip({
      entity: 'prompts', tombstoneCount: 50, totalCount: 200, threshold: 40, tripped: true,
    });
    await clearAllTrips();
    expect(await getTrips()).toEqual([]);
  });

  it('getTrips returns empty when storage is uninitialised', async () => {
    expect(await getTrips()).toEqual([]);
  });
});
