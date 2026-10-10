export interface Settings {
  enableAutoSave: boolean;
  saveInterval: number;
  saveOnBrowserClose: boolean;
  saveOnSleep: boolean;
  saveOnNetworkDisconnect: boolean;
  /** Soft-delete saved sessions older than this many days; null keeps them forever.
   *  Pinned, locked and starred sessions are always kept. */
  autoDeleteAfterDays: number | null;
  /** Close the window's tabs after a manual save (unless the request says otherwise). */
  closeTabsAfterSave: boolean;
  theme: 'light' | 'dark' | 'system';
  /** When false (default), auto-save only adds new tabs — closed tabs stay in the session.
   *  When true, auto-save reflects the exact current open tabs (closed tabs are removed). */
  autoSaveOnTabClose: boolean;
  /** When true, the "Update session" action also removes session tabs no longer open in the
   *  current window. Default false — only adds new tabs. */
  removeClosedTabsOnUpdate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enableAutoSave: true,
  saveInterval: 15,
  saveOnBrowserClose: true,
  saveOnSleep: true,
  saveOnNetworkDisconnect: false,
  autoDeleteAfterDays: null,
  closeTabsAfterSave: false,
  theme: 'system',
  autoSaveOnTabClose: true,
  removeClosedTabsOnUpdate: false,
};

/** Settings keys that earlier versions stored but no longer exist. */
export const REMOVED_SETTINGS_KEYS = [
  'maxAutoSaves',
  'saveOnLowBattery',
  'lowBatteryThreshold',
  'primaryUI',
] as const;
