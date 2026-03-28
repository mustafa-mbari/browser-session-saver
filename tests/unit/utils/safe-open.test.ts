import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeOpenUrl } from '@core/utils/safe-open';

describe('safeOpenUrl', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('opens valid https URLs in a new tab by default', () => {
    safeOpenUrl('https://example.com');
    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank');
  });

  it('opens valid http URLs', () => {
    safeOpenUrl('http://example.com');
    expect(window.open).toHaveBeenCalledWith('http://example.com', '_blank');
  });

  it('respects the _self target', () => {
    safeOpenUrl('https://example.com', '_self');
    expect(window.open).toHaveBeenCalledWith('https://example.com', '_self');
  });

  it('does NOT open invalid URLs', () => {
    safeOpenUrl('not-a-url');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('does NOT open undefined', () => {
    safeOpenUrl(undefined);
    expect(window.open).not.toHaveBeenCalled();
  });

  it('does NOT open null', () => {
    safeOpenUrl(null);
    expect(window.open).not.toHaveBeenCalled();
  });

  it('does NOT open empty string', () => {
    safeOpenUrl('');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('does NOT open javascript: URLs', () => {
    safeOpenUrl('javascript:alert(1)');
    expect(window.open).not.toHaveBeenCalled();
  });
});
