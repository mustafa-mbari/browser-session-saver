import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Session } from '@core/types/session.types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@core/services/session.service', () => ({
  getAllSessions: vi.fn(),
}));

import { useSession } from '@shared/hooks/useSession';
import * as SessionService from '@core/services/session.service';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess1',
    name: 'Test Session',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    tabs: [],
    tabGroups: [],
    windowId: 1,
    tags: [],
    isPinned: false,
    isStarred: false,
    isLocked: false,
    isAutoSave: false,
    autoSaveTrigger: 'manual',
    notes: '',
    tabCount: 0,
    version: '2.0.0',
    ...overrides,
  };
}

const session1 = makeSession({ id: '1', name: 'Session Alpha' });
const session2 = makeSession({ id: '2', name: 'Session Beta' });

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default fallback for any sendMessage call not specifically mocked
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      success: true,
      data: { sessions: [], totalCount: 0 },
    });
  });

  it('fetches sessions on mount via GET_SESSIONS message', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      success: true,
      data: { sessions: [session1, session2], totalCount: 2 },
    });

    const { result } = renderHook(() => useSession());

    await act(async () => { await Promise.resolve(); });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GET_SESSIONS' }),
    );
    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it('sets error when GET_SESSIONS fails', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      success: false,
      error: 'Storage unavailable',
    });

    const { result } = renderHook(() => useSession());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.error).toBe('Storage unavailable');
    expect(result.current.sessions).toHaveLength(0);
  });

  it('saveSession sends SAVE_SESSION message and calls storage.set for cross-page sync', async () => {
    // Initial load
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      success: true,
      data: { sessions: [], totalCount: 0 },
    });
    const { result } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    // saveSession
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ success: true, data: session1 });

    await act(async () => {
      await result.current.saveSession({ name: 'My Save' });
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SAVE_SESSION' }),
    );
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ _sessions_updated: expect.any(Number) }),
    );
  });

  it('deleteSession sends DELETE_SESSION message', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ success: true, data: { sessions: [session1], totalCount: 1 } })
      .mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.deleteSession('1');
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_SESSION', payload: { sessionId: '1' } }),
    );
  });

  it('updateSession sends UPDATE_SESSION message', async () => {
    vi.mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ success: true, data: { sessions: [], totalCount: 0 } })
      .mockResolvedValueOnce({ success: true, data: session1 });

    const { result } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.updateSession('1', { name: 'Renamed' });
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_SESSION',
        payload: { sessionId: '1', updates: { name: 'Renamed' } },
      }),
    );
  });

  it('cross-page storage change (_sessions_updated) refreshes sessions via service', async () => {
    // Initial load
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      success: true,
      data: { sessions: [], totalCount: 0 },
    });

    vi.mocked(SessionService.getAllSessions).mockResolvedValueOnce([session1, session2]);

    const { result } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    // Simulate _sessions_updated storage change (cross-page sync)
    const onChangedListener = vi.mocked(chrome.storage.local.onChanged.addListener).mock.calls[0]?.[0];
    expect(onChangedListener).toBeDefined();

    await act(async () => {
      await onChangedListener(
        { _sessions_updated: { newValue: Date.now(), oldValue: null } },
        'local',
      );
    });

    expect(SessionService.getAllSessions).toHaveBeenCalled();
    expect(result.current.sessions).toHaveLength(2);
  });

  it('removes listeners on unmount', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      success: true,
      data: { sessions: [], totalCount: 0 },
    });

    const { unmount } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    unmount();

    expect(chrome.storage.local.onChanged.removeListener).toHaveBeenCalled();
  });
});
