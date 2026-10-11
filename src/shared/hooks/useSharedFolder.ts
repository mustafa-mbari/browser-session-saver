import { useEffect, useState } from 'react';
import {
  DEFAULT_SHARED_FOLDER_STATE,
  getSharedFolderState,
  SHARED_FOLDER_STATE_KEY,
  type SharedFolderState,
} from '@core/sync/shared-folder/state';

/** The shared-folder status, kept current across pages. */
export function useSharedFolderState(): SharedFolderState {
  const [state, setState] = useState<SharedFolderState>(DEFAULT_SHARED_FOLDER_STATE);

  useEffect(() => {
    let active = true;
    void getSharedFolderState().then((s) => {
      if (active) setState(s);
    });
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      const next = changes[SHARED_FOLDER_STATE_KEY]?.newValue as Partial<SharedFolderState> | undefined;
      if (next) setState({ ...DEFAULT_SHARED_FOLDER_STATE, ...next });
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => {
      active = false;
      chrome.storage.local.onChanged.removeListener(handler);
    };
  }, []);

  return state;
}
