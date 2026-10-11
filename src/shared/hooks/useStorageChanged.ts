import { useEffect, useRef } from 'react';

/**
 * Call `onChange` when any of the given chrome.storage.local keys changes —
 * from this page, another page, the service worker or a shared-folder sync.
 * Bursts are coalesced into one call.
 */
export function useStorageChanged(keys: readonly string[], onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const key = keys.join(',');
  useEffect(() => {
    const watched = new Set(key.split(','));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (!Object.keys(changes).some((k) => watched.has(k))) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), 50);
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => {
      chrome.storage.local.onChanged.removeListener(handler);
      if (timer) clearTimeout(timer);
    };
  }, [key]);
}
