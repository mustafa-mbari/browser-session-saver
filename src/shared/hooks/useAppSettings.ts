import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { useMessaging } from './useMessaging';

/**
 * App settings (auto-save, sessions, theme) loaded through the service worker.
 * Stays in sync when another extension page — or an import — changes them.
 */
export function useAppSettings() {
  const { sendMessage } = useMessaging();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    void sendMessage<Settings>({ action: 'GET_SETTINGS', payload: {} }).then((res) => {
      if (active && res.success && res.data) setSettings({ ...DEFAULT_SETTINGS, ...res.data });
    });

    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      const next = changes[STORAGE_KEYS.SETTINGS]?.newValue as Partial<Settings> | undefined;
      if (next) setSettings({ ...DEFAULT_SETTINGS, ...next });
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => {
      active = false;
      chrome.storage.local.onChanged.removeListener(handler);
    };
  }, [sendMessage]);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      await sendMessage({ action: 'UPDATE_SETTINGS', payload: { [key]: value } });
    },
    [sendMessage],
  );

  return { settings, updateSetting };
}
