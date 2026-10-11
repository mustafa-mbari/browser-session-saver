import { generateId } from '@core/utils/uuid';
import { withStorageLock } from '@core/storage/storage-mutex';

/** Identity of this browser profile's copy of the extension. */
export interface BrowserInstance {
  /** Stable for the life of the install. */
  id: string;
  /** User-visible name, e.g. "Edge". Renamable. */
  label: string;
}

const INSTANCE_KEY = 'browser_instance';

let _cached: Promise<BrowserInstance> | null = null;

/** This browser's identity, created on first use. */
export function getBrowserInstance(): Promise<BrowserInstance> {
  _cached ??= withStorageLock(INSTANCE_KEY, async () => {
    const result = await chrome.storage.local.get(INSTANCE_KEY);
    const stored = result[INSTANCE_KEY] as BrowserInstance | undefined;
    if (stored?.id) return stored;
    const instance: BrowserInstance = { id: generateId(), label: detectBrowserName() };
    await chrome.storage.local.set({ [INSTANCE_KEY]: instance });
    return instance;
  }).catch((error: unknown) => {
    _cached = null;
    throw error;
  });
  return _cached;
}

export async function renameBrowserInstance(label: string): Promise<BrowserInstance> {
  const current = await getBrowserInstance();
  const renamed: BrowserInstance = { ...current, label: label.trim() || current.label };
  await chrome.storage.local.set({ [INSTANCE_KEY]: renamed });
  _cached = Promise.resolve(renamed);
  return renamed;
}

type BrowserNavigator = Navigator & {
  userAgentData?: { brands?: { brand: string }[] };
  brave?: unknown;
};

/** Best-effort browser name for labels; users can rename it. */
export function detectBrowserName(nav: BrowserNavigator = globalThis.navigator as BrowserNavigator): string {
  if (nav?.brave) return 'Brave';
  const brands = nav?.userAgentData?.brands?.map((b) => b.brand) ?? [];
  const byBrand: [string, string][] = [
    ['Microsoft Edge', 'Edge'],
    ['Opera', 'Opera'],
    ['Vivaldi', 'Vivaldi'],
    ['Brave', 'Brave'],
    ['Google Chrome', 'Chrome'],
  ];
  for (const [brand, name] of byBrand) {
    if (brands.some((b) => b.includes(brand))) return name;
  }
  const ua = nav?.userAgent ?? '';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Vivaldi/.test(ua)) return 'Vivaldi';
  if (/Chrome\//.test(ua)) return 'Chrome';
  return 'Browser';
}

/** The browser an auto-save came from, when it is not this one; null otherwise. */
export function otherBrowserLabel(
  session: { isAutoSave: boolean; sourceInstanceId?: string; sourceLabel?: string },
  localInstanceId: string | undefined,
): string | null {
  if (!session.isAutoSave || !session.sourceInstanceId || !localInstanceId) return null;
  if (session.sourceInstanceId === localInstanceId) return null;
  return session.sourceLabel || 'another browser';
}
