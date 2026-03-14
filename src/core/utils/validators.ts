import type { Session, Tab } from '@core/types/session.types';

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'file:', 'chrome:', 'chrome-extension:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string): string {
  if (!isValidUrl(url)) return '';
  return url.trim();
}

export function isValidTab(data: unknown): data is Tab {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.index === 'number' &&
    typeof obj.pinned === 'boolean'
  );
}

export function isValidSession(data: unknown): data is Session {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.createdAt === 'string' &&
    Array.isArray(obj.tabs) &&
    typeof obj.tabCount === 'number'
  );
}
