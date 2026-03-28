import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from '@shared/hooks/useSearch';
import type { Session } from '@core/types/session.types';

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

const sessions: Session[] = [
  makeSession({ id: '1', name: 'Work Session' }),
  makeSession({ id: '2', name: 'Personal Session' }),
];

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially returns all sessions with an empty query', () => {
    const { result } = renderHook(() => useSearch(sessions));

    expect(result.current.query).toBe('');
    expect(result.current.filteredSessions).toHaveLength(2);
  });

  it('setQueryImmediate filters sessions without waiting for debounce', () => {
    const { result } = renderHook(() => useSearch(sessions));

    act(() => result.current.setQueryImmediate('Work'));

    expect(result.current.query).toBe('Work');
    expect(result.current.filteredSessions).toHaveLength(1);
    expect(result.current.filteredSessions[0].id).toBe('1');
  });

  it('setQuery (debounced) does not filter until 300 ms elapse', () => {
    const { result } = renderHook(() => useSearch(sessions));

    act(() => result.current.setQuery('Work'));
    // Debounce hasn't fired yet — query unchanged
    expect(result.current.query).toBe('');

    act(() => vi.advanceTimersByTime(300));

    expect(result.current.query).toBe('Work');
    expect(result.current.filteredSessions).toHaveLength(1);
  });

  it('returns empty array when query matches nothing', () => {
    const { result } = renderHook(() => useSearch(sessions));

    act(() => result.current.setQueryImmediate('zzz_no_match'));

    expect(result.current.filteredSessions).toHaveLength(0);
  });

  it('updates filteredSessions when sessions prop changes', () => {
    const { result, rerender } = renderHook(({ s }) => useSearch(s), {
      initialProps: { s: sessions },
    });

    act(() => result.current.setQueryImmediate('Work'));
    expect(result.current.filteredSessions).toHaveLength(1);

    rerender({ s: [] });
    expect(result.current.filteredSessions).toHaveLength(0);
  });
});
