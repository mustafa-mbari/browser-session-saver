import { describe, it, expect } from 'vitest';
import { searchSessions, highlightMatches } from '@core/services/search.service';
import type { Session } from '@core/types/session.types';

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: '1',
    name: 'Test Session',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
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
    version: '1.0.0',
    ...overrides,
  };
}

describe('searchSessions', () => {
  const sessions = [
    makeSession({ id: '1', name: 'Work Session', tags: ['work'] }),
    makeSession({ id: '2', name: 'Personal Tabs', tags: ['personal'] }),
    makeSession({
      id: '3',
      name: 'Research',
      tabs: [
        { id: 't1', url: 'https://github.com', title: 'GitHub', favIconUrl: '', index: 0, pinned: false, groupId: -1, active: false, scrollPosition: { x: 0, y: 0 } },
      ],
      tabCount: 1,
    }),
  ];

  it('returns all sessions for empty query', () => {
    const results = searchSessions(sessions, '');
    expect(results).toHaveLength(3);
  });

  it('finds sessions by name', () => {
    const results = searchSessions(sessions, 'work');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('finds sessions by tag', () => {
    const results = searchSessions(sessions, 'personal');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('finds sessions by tab URL', () => {
    const results = searchSessions(sessions, 'github');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
  });

  it('returns empty for no match', () => {
    const results = searchSessions(sessions, 'zzzzzzz');
    expect(results).toHaveLength(0);
  });
});

describe('highlightMatches', () => {
  it('returns full text as non-highlighted when no match', () => {
    const result = highlightMatches('hello world', 'xyz');
    expect(result).toEqual([{ text: 'hello world', highlighted: false }]);
  });

  it('highlights matching segments', () => {
    const result = highlightMatches('hello world', 'world');
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((s) => s.text === 'world' && s.highlighted)).toBe(true);
  });
});
