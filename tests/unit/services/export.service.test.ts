import { describe, it, expect } from 'vitest';
import { exportAsJSON, exportAsHTML, exportAsMarkdown, exportAsCSV, exportAsText } from '@core/services/export.service';
import type { Session } from '@core/types/session.types';

const mockSession: Session = {
  id: '1',
  name: 'Test Session',
  createdAt: '2026-03-14T15:00:00Z',
  updatedAt: '2026-03-14T15:00:00Z',
  tabs: [
    {
      id: 't1',
      url: 'https://example.com',
      title: 'Example',
      favIconUrl: '',
      index: 0,
      pinned: false,
      groupId: -1,
      active: false,
      scrollPosition: { x: 0, y: 0 },
    },
    {
      id: 't2',
      url: 'https://github.com',
      title: 'GitHub',
      favIconUrl: '',
      index: 1,
      pinned: true,
      groupId: 1,
      active: false,
      scrollPosition: { x: 0, y: 0 },
    },
  ],
  tabGroups: [
    { id: 1, title: 'Dev', color: 'blue', collapsed: false, tabIds: ['t2'] },
  ],
  windowId: 1,
  tags: ['test'],
  isPinned: false,
  isStarred: false,
  isLocked: false,
  isAutoSave: false,
  autoSaveTrigger: 'manual',
  notes: '',
  tabCount: 2,
  version: '1.0.0',
};

describe('exportAsJSON', () => {
  it('produces valid JSON with envelope', () => {
    const result = exportAsJSON([mockSession]);
    const parsed = JSON.parse(result);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sessionCount).toBe(1);
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].name).toBe('Test Session');
  });
});

describe('exportAsHTML', () => {
  it('produces Netscape bookmark format', () => {
    const result = exportAsHTML([mockSession]);
    expect(result).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(result).toContain('Test Session');
    expect(result).toContain('https://example.com');
    expect(result).toContain('https://github.com');
  });
});

describe('exportAsMarkdown', () => {
  it('produces markdown with links', () => {
    const result = exportAsMarkdown([mockSession]);
    expect(result).toContain('## Test Session');
    expect(result).toContain('[Example](https://example.com)');
    expect(result).toContain('### Dev (blue)');
  });
});

describe('exportAsCSV', () => {
  it('produces CSV with header row', () => {
    const result = exportAsCSV([mockSession]);
    const lines = result.split('\n');
    expect(lines[0]).toBe('Session,Group,Title,URL,Pinned,Created');
    expect(lines.length).toBe(3); // header + 2 tabs
  });
});

describe('exportAsText', () => {
  it('produces plain URL list', () => {
    const result = exportAsText([mockSession]);
    expect(result).toBe('https://example.com\nhttps://github.com');
  });
});
