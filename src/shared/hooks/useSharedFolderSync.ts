import { useEffect } from 'react';
import { onDataChanged } from '@core/events/data-change-bus';
import { syncNow } from '@core/sync/shared-folder/shared-folder.service';
import { getSharedFolderState, SHARED_FOLDER_STATE_KEY } from '@core/sync/shared-folder/state';

const SYNC_INTERVAL_MS = 60_000;
const AFTER_CHANGE_MS = 3_000;

/** chrome.storage keys holding shared data; a change is sent to the folder soon. */
const SHARED_STORAGE_KEYS = new Set([
  'prompts',
  'prompt_folders',
  'prompt_categories',
  'prompt_tags',
  'subscriptions',
  'subscription_categories',
  'tab_group_templates',
  'settings',
  'newtab_settings',
]);

/**
 * Keep this browser's data in step with the shared folder while the page is
 * visible: on open, when it becomes visible, every minute, and shortly after
 * local changes. Never prompts — a needed permission shows a reconnect banner.
 */
export function useSharedFolderSync(): void {
  useEffect(() => {
    let enabled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (enabled && document.visibilityState === 'visible') void syncNow();
    };
    const runSoon = () => {
      if (!enabled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, AFTER_CHANGE_MS);
    };

    void getSharedFolderState().then((state) => {
      enabled = state.enabled;
      run();
    });

    const onStorage = (changes: Record<string, chrome.storage.StorageChange>) => {
      const state = changes[SHARED_FOLDER_STATE_KEY]?.newValue as { enabled?: boolean } | undefined;
      if (state) enabled = Boolean(state.enabled);
      if (Object.keys(changes).some((key) => SHARED_STORAGE_KEYS.has(key))) runSoon();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };

    chrome.storage.local.onChanged.addListener(onStorage);
    // Data a sync just wrote is already in the folder; only edits need sending.
    const offDataChanged = onDataChanged((_modules, info) => {
      if (!info.fromSync) runSoon();
    });
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(run, SYNC_INTERVAL_MS);

    return () => {
      chrome.storage.local.onChanged.removeListener(onStorage);
      offDataChanged();
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
      if (timer) clearTimeout(timer);
    };
  }, []);
}
