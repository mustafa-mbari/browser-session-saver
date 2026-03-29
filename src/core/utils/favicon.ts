/** Returns true for hostnames that no external favicon service can resolve. */
function isLocalHost(hostname: string, protocol: string): boolean {
  return (
    protocol === 'chrome:' ||
    protocol === 'edge:' ||
    protocol === 'about:' ||
    protocol === 'file:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    !hostname.includes('.') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

/**
 * Primary favicon source: DuckDuckGo's service.
 * Returns a placeholder instead of 404 for unknown domains (prevents console noise).
 * May be blocked on corporate/enterprise networks — use getFaviconFallbackUrl() as fallback.
 */
export function getFaviconUrl(url: string, size = 32): string {
  try {
    const { hostname, protocol } = new URL(url);
    if (isLocalHost(hostname, protocol)) return '';
    void size;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  } catch {
    return '';
  }
}

/**
 * Secondary favicon source: Google's favicon service.
 * More universally reachable on corporate/enterprise networks where DuckDuckGo
 * may be blocked. Used as an automatic fallback when getFaviconUrl() fails.
 */
export function getFaviconFallbackUrl(url: string, size = 32): string {
  try {
    const { hostname, protocol } = new URL(url);
    if (isLocalHost(hostname, protocol)) return '';
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
  } catch {
    return '';
  }
}

/**
 * Returns the first character of the title or URL for use as a letter avatar
 * when a favicon fails to load.
 */
export function getFaviconInitial(title: string, url: string): string {
  return (title || url).charAt(0).toUpperCase();
}

/**
 * Resolves a stored favIconUrl to a usable URL, sanitizing browser-internal
 * URLs (chrome://, edge://) that extensions cannot load. Falls back to
 * Google's favicon service using the page URL.
 */
export function resolveFavIcon(stored: string | undefined, pageUrl: string): string {
  if (!stored || stored.startsWith('chrome://') || stored.startsWith('edge://')) {
    return getFaviconUrl(pageUrl);
  }
  return stored;
}
