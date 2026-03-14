/**
 * Returns a reliable favicon URL using Google's favicon service.
 * Falls back to empty string if the URL is invalid.
 */
export function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
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
