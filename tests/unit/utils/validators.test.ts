import { describe, it, expect } from 'vitest';
import { isValidUrl, sanitizeUrl, isValidSession, isValidTab } from '@core/utils/validators';

describe('isValidUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('accepts chrome URLs', () => {
    expect(isValidUrl('chrome://settings')).toBe(true);
  });

  it('rejects invalid strings', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  it('rejects javascript protocol', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('returns valid URL trimmed', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('returns empty string for invalid URLs', () => {
    expect(sanitizeUrl('invalid')).toBe('');
  });
});

describe('isValidTab', () => {
  it('validates a proper tab object', () => {
    expect(
      isValidTab({
        id: '1',
        url: 'https://example.com',
        title: 'Example',
        index: 0,
        pinned: false,
      }),
    ).toBe(true);
  });

  it('rejects incomplete objects', () => {
    expect(isValidTab({ id: '1' })).toBe(false);
    expect(isValidTab(null)).toBe(false);
    expect(isValidTab('string')).toBe(false);
  });
});

describe('isValidSession', () => {
  it('validates a proper session object', () => {
    expect(
      isValidSession({
        id: '1',
        name: 'Test Session',
        createdAt: '2026-01-01T00:00:00Z',
        tabs: [],
        tabCount: 0,
      }),
    ).toBe(true);
  });

  it('rejects incomplete objects', () => {
    expect(isValidSession({ id: '1' })).toBe(false);
    expect(isValidSession(null)).toBe(false);
  });
});
