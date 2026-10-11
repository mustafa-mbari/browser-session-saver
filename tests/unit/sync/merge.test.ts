import { describe, it, expect } from 'vitest';
import {
  fingerprint,
  findRemovedWhileAway,
  mergeList,
  mergeRecords,
  mergeSettings,
  pickNewer,
  stableStringify,
  unionList,
  versionOf,
} from '@core/sync/shared-folder/merge';

interface Rec {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

const T1 = '2026-05-01T10:00:00.000Z';
const T2 = '2026-05-02T10:00:00.000Z';
const T3 = '2026-05-03T10:00:00.000Z';
const byId = (r: Rec) => r.id;

describe('stableStringify / fingerprint', () => {
  it('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe(stableStringify({ a: [1, { d: 2 }], b: 1 }));
  });

  it('fingerprints differ for different content', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'));
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'));
  });
});

describe('pickNewer', () => {
  it('prefers the newer updatedAt, falling back to createdAt', () => {
    expect(pickNewer({ id: 'a', updatedAt: T1 }, { id: 'a', updatedAt: T2 }).updatedAt).toBe(T2);
    expect(versionOf({ createdAt: T1 })).toBe(T1);
  });

  it('lets a deletion win a tie', () => {
    const alive: Rec = { id: 'a', updatedAt: T1 };
    const dead: Rec = { id: 'a', updatedAt: T1, deletedAt: T1 };
    expect(pickNewer(alive, dead)).toBe(dead);
    expect(pickNewer(dead, alive)).toBe(dead);
  });

  it('breaks remaining ties the same way regardless of order', () => {
    const x: Rec = { id: 'a', updatedAt: T1, title: 'x' };
    const y: Rec = { id: 'a', updatedAt: T1, title: 'y' };
    expect(pickNewer(x, y)).toBe(pickNewer(y, x));
  });
});

describe('mergeRecords', () => {
  it('adds remote-only records and applies newer remote edits', () => {
    const local: Rec[] = [{ id: 'a', title: 'local a', updatedAt: T1 }, { id: 'b', title: 'b', updatedAt: T3 }];
    const remote: Rec[] = [{ id: 'a', title: 'remote a', updatedAt: T2 }, { id: 'c', title: 'c', updatedAt: T1 }, { id: 'b', title: 'old b', updatedAt: T1 }];

    const { merged, toApply } = mergeRecords(local, [remote], byId);

    expect(toApply.map((r) => r.title).sort()).toEqual(['c', 'remote a']);
    expect(merged.map((r) => r.title).sort()).toEqual(['b', 'c', 'remote a']);
  });

  it('propagates deletions as tombstones', () => {
    const local: Rec[] = [{ id: 'a', title: 'a', updatedAt: T1 }];
    const remote: Rec[] = [{ id: 'a', title: 'a', updatedAt: T2, deletedAt: T2 }];
    expect(mergeRecords(local, [remote], byId).toApply).toEqual(remote);
  });

  it('applies nothing when every peer has the same data', () => {
    const local: Rec[] = [{ id: 'a', title: 'a', updatedAt: T1 }];
    const remote: Rec[] = [{ title: 'a', updatedAt: T1, id: 'a' }];
    expect(mergeRecords(local, [remote], byId).toApply).toEqual([]);
  });

  it('takes the newest copy across several peers and skips malformed entries', () => {
    const peers = [
      [{ id: 'a', title: 'v1', updatedAt: T1 }],
      [{ id: 'a', title: 'v3', updatedAt: T3 }, null as unknown as Rec, { title: 'no id' } as Rec],
      [{ id: 'a', title: 'v2', updatedAt: T2 }],
    ];
    expect(mergeRecords<Rec>([], peers, byId).merged).toEqual([{ id: 'a', title: 'v3', updatedAt: T3 }]);
  });
});

describe('findRemovedWhileAway', () => {
  it('flags only records unchanged since the last sync and missing from all peers', () => {
    const local: Rec[] = [
      { id: 'gone', updatedAt: T1 },
      { id: 'edited-later', updatedAt: T3 },
      { id: 'still-there', updatedAt: T1 },
    ];
    const peers = [[{ id: 'still-there', updatedAt: T1 }]];
    expect(findRemovedWhileAway(local, peers, byId, T2)).toEqual(['gone']);
  });
});

describe('lists', () => {
  it('mergeList keeps the newest list as a whole', () => {
    const local = { updatedAt: T1, items: ['a'] };
    const remote = { updatedAt: T2, items: ['b'] };
    expect(mergeList(local, [remote, undefined])).toBe(remote);
    expect(mergeList(remote, [local])).toBe(remote);
  });

  it('unionList keeps local order and adds items only peers have', () => {
    const remote = { updatedAt: T1, items: [{ v: 'x' }, { v: 'b' }] };
    expect(unionList([{ v: 'a' }, { v: 'b' }], [remote], (i) => i.v)).toEqual([{ v: 'a' }, { v: 'b' }, { v: 'x' }]);
  });
});

describe('mergeSettings', () => {
  it('merges field by field and reports the fields to write locally', () => {
    const local = {
      values: { theme: 'dark', clockFormat: '12h', layoutMode: 'focus' },
      fieldUpdatedAt: { theme: T3, clockFormat: T1, layoutMode: T1 },
    };
    const remote = {
      values: { theme: 'light', clockFormat: '24h', searchEngine: 'bing' },
      fieldUpdatedAt: { theme: T1, clockFormat: T2, searchEngine: T1 },
    };

    const { merged, changed } = mergeSettings<Record<string, string>>(local, [remote]);

    expect(merged.values).toEqual({ theme: 'dark', clockFormat: '24h', layoutMode: 'focus', searchEngine: 'bing' });
    expect(merged.fieldUpdatedAt).toEqual({ theme: T3, clockFormat: T2, layoutMode: T1, searchEngine: T1 });
    expect(changed).toEqual({ clockFormat: '24h', searchEngine: 'bing' });
  });
});
