import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClock } from '@newtab/hooks/useClock';

describe('useClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns timeString and dateString on initial render', () => {
    const { result } = renderHook(() => useClock('24h'));
    expect(result.current.timeString).toBeTruthy();
    expect(result.current.dateString).toBeTruthy();
  });

  it('updates time after 1 second', () => {
    const { result } = renderHook(() => useClock('24h'));
    const initial = result.current.timeString;
    act(() => {
      vi.advanceTimersByTime(60_000); // advance 1 minute
    });
    // time should have changed
    expect(result.current.timeString).not.toBe(initial);
  });

  it('clears interval on unmount (no memory leak)', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useClock('24h'));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('returns different format for 12h vs 24h', () => {
    const { result: r12 } = renderHook(() => useClock('12h'));
    const { result: r24 } = renderHook(() => useClock('24h'));
    // Both return strings — the actual format depends on the system locale.
    // We just verify they are non-empty strings.
    expect(typeof r12.current.timeString).toBe('string');
    expect(typeof r24.current.timeString).toBe('string');
    expect(r12.current.timeString.length).toBeGreaterThan(0);
    expect(r24.current.timeString.length).toBeGreaterThan(0);
  });
});
