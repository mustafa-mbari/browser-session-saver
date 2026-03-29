import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '@shared/hooks/useAutoSave';

const successResponse = {
  success: true,
  data: { isActive: true, lastAutoSave: '2026-01-01T00:00:00.000Z' },
};

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with default status before first fetch completes', () => {
    vi.mocked(chrome.runtime.sendMessage).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAutoSave());

    expect(result.current.isActive).toBe(false);
    expect(result.current.lastAutoSave).toBeNull();
  });

  it('updates status after initial fetch resolves', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(successResponse);

    const { result } = renderHook(() => useAutoSave());

    // Advance 0ms to flush microtasks without triggering the 30s interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isActive).toBe(true);
  });

  it('sends AUTO_SAVE_STATUS message on mount', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(successResponse);

    renderHook(() => useAutoSave());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'AUTO_SAVE_STATUS',
      payload: {},
    });
  });

  it('polls again after 30 seconds', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(successResponse);

    renderHook(() => useAutoSave());

    // Flush initial fetch (microtasks only)
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const firstCount = vi.mocked(chrome.runtime.sendMessage).mock.calls.length;

    // Advance exactly 30 seconds to trigger the interval (then flush microtasks)
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });

    expect(vi.mocked(chrome.runtime.sendMessage).mock.calls.length).toBeGreaterThan(firstCount);
  });

  it('clears interval on unmount so no further polls occur', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(successResponse);

    const { unmount } = renderHook(() => useAutoSave());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const countAfterMount = vi.mocked(chrome.runtime.sendMessage).mock.calls.length;

    unmount();

    // Advancing time after unmount should not trigger any more calls
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(vi.mocked(chrome.runtime.sendMessage).mock.calls.length).toBe(countAfterMount);
  });
});
