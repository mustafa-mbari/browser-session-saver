import { describe, it, expect } from 'vitest';
import { importFromJSON, importFromURLList } from '@core/services/import.service';

describe('importFromJSON', () => {
  it('imports valid session data', () => {
    const data = JSON.stringify({
      sessions: [
        {
          id: '1',
          name: 'Test',
          createdAt: '2026-01-01T00:00:00Z',
          tabs: [],
          tabCount: 0,
          updatedAt: '2026-01-01T00:00:00Z',
          tabGroups: [],
          windowId: 1,
          tags: [],
          isPinned: false,
          isStarred: false,
          isLocked: false,
          isAutoSave: false,
          autoSaveTrigger: 'manual',
          notes: '',
          version: '1.0.0',
        },
      ],
    });

    const result = importFromJSON(data);
    expect(result.sessions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.sessions[0].name).toBe('Test');
  });

  it('assigns new IDs to imported sessions', () => {
    const data = JSON.stringify({
      sessions: [
        {
          id: 'original-id',
          name: 'Test',
          createdAt: '2026-01-01T00:00:00Z',
          tabs: [],
          tabCount: 0,
          updatedAt: '2026-01-01T00:00:00Z',
          tabGroups: [],
          windowId: 1,
          tags: [],
          isPinned: false,
          isStarred: false,
          isLocked: false,
          isAutoSave: false,
          autoSaveTrigger: 'manual',
          notes: '',
          version: '1.0.0',
        },
      ],
    });

    const result = importFromJSON(data);
    expect(result.sessions[0].id).not.toBe('original-id');
  });

  it('reports errors for invalid data', () => {
    const result = importFromJSON('not json');
    expect(result.sessions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports errors for invalid session objects', () => {
    const data = JSON.stringify({ sessions: [{ invalid: true }] });
    const result = importFromJSON(data);
    expect(result.sessions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});

describe('importFromURLList', () => {
  it('imports valid URLs', () => {
    const text = 'https://example.com\nhttps://github.com\nhttps://google.com';
    const result = importFromURLList(text);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].tabs).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it('reports invalid URLs', () => {
    const text = 'https://example.com\nnot-a-url\nhttps://github.com';
    const result = importFromURLList(text);
    expect(result.sessions[0].tabs).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it('skips empty lines', () => {
    const text = 'https://example.com\n\n\nhttps://github.com';
    const result = importFromURLList(text);
    expect(result.sessions[0].tabs).toHaveLength(2);
  });
});
