import { describe, it, expect } from 'vitest';
import { withStorageLock } from '@core/storage/storage-mutex';

describe('withStorageLock', () => {
  it('serializes concurrent calls on the same key', async () => {
    const order: string[] = [];
    let firstRunning = false;

    const first = withStorageLock('k', async () => {
      firstRunning = true;
      order.push('first-start');
      // Yield to let the second call attempt to run
      await Promise.resolve();
      await Promise.resolve();
      order.push('first-end');
      firstRunning = false;
    });

    const second = withStorageLock('k', async () => {
      order.push('second-start');
      // At this point, first must have already completed
      expect(firstRunning).toBe(false);
      order.push('second-end');
    });

    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it('runs calls on different keys in parallel', async () => {
    const started: string[] = [];

    // Both should start before either finishes
    let resolveA!: () => void;
    let resolveB!: () => void;

    const a = withStorageLock('a', () => new Promise<void>((r) => { started.push('a'); resolveA = r; }));
    const b = withStorageLock('b', () => new Promise<void>((r) => { started.push('b'); resolveB = r; }));

    // Flush microtasks so both fns start
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toContain('a');
    expect(started).toContain('b');

    resolveA();
    resolveB();
    await Promise.all([a, b]);
  });

  it('releases the lock after fn throws (no deadlock)', async () => {
    // First call throws
    await expect(
      withStorageLock('k2', async () => { throw new Error('boom'); }),
    ).rejects.toThrow('boom');

    // Second call on the same key must still resolve
    const result = await withStorageLock('k2', async () => 'ok');
    expect(result).toBe('ok');
  });
});
