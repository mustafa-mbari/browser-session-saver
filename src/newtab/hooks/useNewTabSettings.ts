import { useCallback, useEffect, useState } from 'react';
import {
  getNewTabSettings,
  updateNewTabSettings,
} from '@core/services/newtab-settings.service';
import type { NewTabSettings } from '@core/types/newtab.types';
import { NEWTAB_SETTINGS_KEY } from '@core/types/newtab.types';
import { DEFAULT_NEWTAB_SETTINGS } from '@core/types/newtab.types';
import { useNewTabStore } from '@newtab/stores/newtab.store';

export function useNewTabSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const { settings, setSettings } = useNewTabStore();

  useEffect(() => {
    getNewTabSettings()
      .then((s) => {
        setSettings(s);
        setIsLoading(false);
      })
      .catch(() => {
        setSettings(DEFAULT_NEWTAB_SETTINGS);
        setIsLoading(false);
      });
  }, [setSettings]);

  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      const change = changes[NEWTAB_SETTINGS_KEY];
      if (change?.newValue) {
        setSettings(change.newValue as NewTabSettings);
      }
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }, [setSettings]);

  const update = useCallback(
    async (partial: Partial<NewTabSettings>) => {
      const next = await updateNewTabSettings(partial);
      setSettings(next);
    },
    [setSettings],
  );

  return { settings, updateSettings: update, isLoading };
}
