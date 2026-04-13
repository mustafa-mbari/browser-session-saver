import { describe, it, expect } from 'vitest';
import { resolve } from '@core/sync/conflict/resolver';
import type { SyncableEntity } from '@core/sync/types/syncable';

interface TestEntity extends SyncableEntity {
  value: string;
}

function make(overrides: Partial<TestEntity> = {}): TestEntity {
  return {
    id: 'a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    dirty: false,
    lastSyncedAt: null,
    value: 'x',
    ...overrides,
  };
}

describe('ConflictResolver.resolve', () => {
  // ── 1: both sides missing ────────────────────────────────────────────────
  it('returns none when both local and remote are null', () => {
    const r = resolve<TestEntity>(null, null);
    expect(r.winner).toBeNull();
    expect(r.source).toBe('none');
  });

  // ── 2: new-local (only local exists — hasn't been pushed yet) ────────────
  it('picks local when remote is null', () => {
    const local = make({ id: 'a', value: 'local-only' });
    const r = resolve<TestEntity>(local, null);
    expect(r.winner).toBe(local);
    expect(r.source).toBe('local');
  });

  // ── 3: new-remote (pulled from another device for the first time) ───────
  it('picks remote when local is null', () => {
    const remote = make({ id: 'a', value: 'remote-only' });
    const r = resolve<TestEntity>(null, remote);
    expect(r.winner).toBe(remote);
    expect(r.source).toBe('remote');
  });

  // ── 4: both-edit — pick the newer updatedAt ──────────────────────────────
  it('picks local when local.updatedAt is newer', () => {
    const local = make({ updatedAt: '2026-02-01T00:00:00.000Z', value: 'new' });
    const remote = make({ updatedAt: '2026-01-01T00:00:00.000Z', value: 'old' });
    const r = resolve(local, remote);
    expect(r.source).toBe('local');
    expect(r.winner?.value).toBe('new');
  });

  it('picks remote when remote.updatedAt is newer', () => {
    const local = make({ updatedAt: '2026-01-01T00:00:00.000Z', value: 'old' });
    const remote = make({ updatedAt: '2026-02-01T00:00:00.000Z', value: 'new' });
    const r = resolve(local, remote);
    expect(r.source).toBe('remote');
    expect(r.winner?.value).toBe('new');
  });

  // ── 5: edit-vs-tombstone — tombstone wins when its updatedAt >= edit ────
  it('picks the tombstone when remote is deleted and equal-or-newer than local edit', () => {
    const local = make({ updatedAt: '2026-02-01T00:00:00.000Z' });
    const remote = make({
      updatedAt: '2026-02-01T00:00:00.000Z',
      deletedAt: '2026-02-01T00:00:00.000Z',
    });
    const r = resolve(local, remote);
    expect(r.source).toBe('remote');
    expect(r.winner?.deletedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('picks the tombstone when local is deleted and equal-or-newer than remote edit', () => {
    const local = make({
      updatedAt: '2026-02-01T00:00:00.000Z',
      deletedAt: '2026-02-01T00:00:00.000Z',
    });
    const remote = make({ updatedAt: '2026-02-01T00:00:00.000Z' });
    const r = resolve(local, remote);
    expect(r.source).toBe('local');
    expect(r.winner?.deletedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  // ── 6: resurrect — edit after delete wins ────────────────────────────────
  // Local user edits the record AFTER the remote device deleted it.
  it('picks the edit when its updatedAt is strictly newer than the remote tombstone', () => {
    const local = make({ updatedAt: '2026-03-01T00:00:00.000Z', value: 'resurrected' });
    const remote = make({
      updatedAt: '2026-02-01T00:00:00.000Z',
      deletedAt: '2026-02-01T00:00:00.000Z',
    });
    const r = resolve(local, remote);
    expect(r.source).toBe('local');
    expect(r.winner?.value).toBe('resurrected');
    expect(r.winner?.deletedAt).toBeFalsy();
  });

  // ── 7: both-tombstone — pick newer ───────────────────────────────────────
  it('picks the newer tombstone when both sides are deleted', () => {
    const local = make({
      updatedAt: '2026-02-01T00:00:00.000Z',
      deletedAt: '2026-02-01T00:00:00.000Z',
    });
    const remote = make({
      updatedAt: '2026-03-01T00:00:00.000Z',
      deletedAt: '2026-03-01T00:00:00.000Z',
    });
    const r = resolve(local, remote);
    expect(r.source).toBe('remote');
    expect(r.winner?.deletedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  // ── 8: pure-equality tie on updatedAt with same value ────────────────────
  it('is deterministic for exact updatedAt ties — higher id wins', () => {
    const lower = make({ id: 'a', updatedAt: '2026-02-01T00:00:00.000Z' });
    const higher = make({ id: 'b', updatedAt: '2026-02-01T00:00:00.000Z' });

    const r1 = resolve(lower, higher);
    expect(r1.source).toBe('remote');
    expect(r1.winner?.id).toBe('b');

    // Flip sides — should still be the lex-higher id that wins (deterministic).
    const r2 = resolve(higher, lower);
    expect(r2.source).toBe('local');
    expect(r2.winner?.id).toBe('b');
  });

  it('resolves perfect equality (same id, same updatedAt) to local', () => {
    const local = make({ id: 'a', updatedAt: '2026-02-01T00:00:00.000Z', value: 'local' });
    const remote = make({ id: 'a', updatedAt: '2026-02-01T00:00:00.000Z', value: 'remote' });
    const r = resolve(local, remote);
    expect(r.source).toBe('local');
    expect(r.winner?.value).toBe('local');
  });
});
