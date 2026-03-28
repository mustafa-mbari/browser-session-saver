import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMessaging } from '@shared/hooks/useMessaging';

describe('useMessaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns success response from service worker', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ success: true, data: [1, 2, 3] });

    const { result } = renderHook(() => useMessaging());
    const response = await result.current.sendMessage({ action: 'GET_SESSIONS', payload: {} });

    expect(response).toEqual({ success: true, data: [1, 2, 3] });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'GET_SESSIONS', payload: {} });
  });

  it('returns error object when sendMessage throws', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(new Error('port closed'));

    const { result } = renderHook(() => useMessaging());
    const response = await result.current.sendMessage({ action: 'SAVE_SESSION', payload: {} });

    expect(response.success).toBe(false);
    expect(response.error).toContain('port closed');
  });

  it('returns timedOut response after 10 seconds of no reply', async () => {
    // Never-resolving promise simulates a sleeping service worker
    vi.mocked(chrome.runtime.sendMessage).mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useMessaging());
    const responsePromise = result.current.sendMessage({ action: 'GET_SESSIONS', payload: {} });

    vi.advanceTimersByTime(10001);
    const response = await responsePromise;

    expect(response).toMatchObject({ success: false, timedOut: true });
  });

  it('resolves before timeout when response arrives quickly', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ success: true, data: null });

    const { result } = renderHook(() => useMessaging());
    const response = await result.current.sendMessage({ action: 'DELETE_SESSION', payload: { sessionId: 'abc' } });

    expect(response.success).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledOnce();
  });
});
