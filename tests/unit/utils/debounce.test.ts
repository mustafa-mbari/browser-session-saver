import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle } from '@core/utils/debounce';

describe('debounce', () => {
  it('delays function execution', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    await new Promise((r) => setTimeout(r, 50));
    debounced(); // reset timer

    await new Promise((r) => setTimeout(r, 60));
    expect(fn).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 60));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  it('limits execution frequency', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
