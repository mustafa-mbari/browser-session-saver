/**
 * Returns a reliable favicon URL using Google's favicon service.
 * Falls back to empty string if the URL is invalid or if the hostname is
 * local/internal (localhost, bare names, IPs, browser-internal protocols)
 * where Google will always return 404.
 */
export function getFaviconUrl(url: string, size = 32): string {
  try {
    const { hostname, protocol } = new URL(url);
    if (
      protocol === 'chrome:' ||
      protocol === 'edge:' ||
      protocol === 'about:' ||
      protocol === 'file:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      !hostname.includes('.') ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    ) {
      return '';
    }
    // DuckDuckGo's service returns a placeholder icon instead of 404 for unknown
    // domains, which prevents console noise. Size parameter is ignored but kept
    // for signature compatibility.
    void size;
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
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
