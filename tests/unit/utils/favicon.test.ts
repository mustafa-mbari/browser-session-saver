import { describe, it, expect } from 'vitest';
import { getFaviconUrl, getFaviconInitial, resolveFavIcon } from '@core/utils/favicon';

describe('getFaviconUrl', () => {
  it('returns Google favicon URL for a valid HTTPS domain', () => {
    expect(getFaviconUrl('https://github.com')).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=32');
  });

  it('returns Google favicon URL for HTTP domains', () => {
    expect(getFaviconUrl('http://example.com/page')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('returns empty string for chrome:// URLs', () => {
    expect(getFaviconUrl('chrome://newtab')).toBe('');
  });

  it('returns empty string for edge:// URLs', () => {
    expect(getFaviconUrl('edge://settings')).toBe('');
  });

  it('returns empty string for about:// URLs', () => {
    expect(getFaviconUrl('about:blank')).toBe('');
  });

  it('returns empty string for file:// URLs', () => {
    expect(getFaviconUrl('file:///home/user/index.html')).toBe('');
  });

  it('returns empty string for localhost', () => {
    expect(getFaviconUrl('http://localhost:3000')).toBe('');
  });

  it('returns empty string for 127.0.0.1', () => {
    expect(getFaviconUrl('http://127.0.0.1:8080')).toBe('');
  });

  it('returns empty string for bare hostnames without dots', () => {
    expect(getFaviconUrl('http://myapp')).toBe('');
  });

  it('returns empty string for IPv4 addresses', () => {
    expect(getFaviconUrl('http://192.168.1.1')).toBe('');
  });

  it('returns empty string for invalid URLs', () => {
    expect(getFaviconUrl('not-a-url')).toBe('');
    expect(getFaviconUrl('')).toBe('');
  });

  it('respects the size parameter', () => {
    const url = getFaviconUrl('https://github.com', 64);
    expect(url).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=64');
  });
});

describe('getFaviconInitial', () => {
  it('returns the first character of title uppercased', () => {
    expect(getFaviconInitial('GitHub', 'https://github.com')).toBe('G');
  });

  it('falls back to URL first character when title is empty', () => {
    expect(getFaviconInitial('', 'https://example.com')).toBe('H');
  });

  it('uppercases the first character', () => {
    expect(getFaviconInitial('google', 'https://google.com')).toBe('G');
  });

  it('handles empty title and URL gracefully', () => {
    expect(getFaviconInitial('', '')).toBe('');
  });
});

describe('resolveFavIcon', () => {
  it('returns stored URL when it is a valid http/https URL', () => {
    expect(resolveFavIcon('https://cdn.example.com/favicon.ico', 'https://example.com')).toBe('https://cdn.example.com/favicon.ico');
  });

  it('falls back to getFaviconUrl when stored is undefined', () => {
    expect(resolveFavIcon(undefined, 'https://github.com')).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=32');
  });

  it('falls back to getFaviconUrl when stored is empty string', () => {
    expect(resolveFavIcon('', 'https://github.com')).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=32');
  });

  it('falls back to getFaviconUrl when stored is chrome:// URL', () => {
    expect(resolveFavIcon('chrome://favicon/https://example.com', 'https://example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('falls back to getFaviconUrl when stored is edge:// URL', () => {
    expect(resolveFavIcon('edge://favicon/https://example.com', 'https://example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });
});
