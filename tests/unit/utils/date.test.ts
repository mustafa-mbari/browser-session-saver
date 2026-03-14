import { describe, it, expect } from 'vitest';
import { nowISO, formatTimestamp, formatRelative } from '@core/utils/date';

describe('nowISO', () => {
  it('returns a valid ISO string', () => {
    const iso = nowISO();
    expect(new Date(iso).toISOString()).toBe(iso);
  });
});

describe('formatTimestamp', () => {
  it('formats a date string', () => {
    const result = formatTimestamp('2026-03-14T15:45:00.000Z');
    expect(result).toContain('Mar');
    expect(result).toContain('14');
    expect(result).toContain('2026');
  });
});

describe('formatRelative', () => {
  it('returns "just now" for recent timestamps', () => {
    const result = formatRelative(new Date().toISOString());
    expect(result).toBe('just now');
  });

  it('returns minutes ago for timestamps within an hour', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = formatRelative(fiveMinAgo);
    expect(result).toBe('5 minutes ago');
  });

  it('returns hours ago for timestamps within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const result = formatRelative(threeHoursAgo);
    expect(result).toBe('3 hours ago');
  });

  it('returns days ago for timestamps within a week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelative(twoDaysAgo);
    expect(result).toBe('2 days ago');
  });
});
