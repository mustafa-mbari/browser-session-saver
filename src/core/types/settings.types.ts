export interface Settings {
  enableAutoSave: boolean;
  saveInterval: number;
  maxAutoSaves: number;
  saveOnBrowserClose: boolean;
  saveOnLowBattery: boolean;
  lowBatteryThreshold: number;
  saveOnSleep: boolean;
  saveOnNetworkDisconnect: boolean;
  autoDeleteAfterDays: number | null;
  closeTabsAfterSave: boolean;
  primaryUI: 'sidepanel' | 'popup';
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
  maxAutoSaves: 50,
  saveOnBrowserClose: true,
  saveOnLowBattery: true,
  lowBatteryThreshold: 15,
  saveOnSleep: true,
  saveOnNetworkDisconnect: false,
  autoDeleteAfterDays: 30,
  closeTabsAfterSave: false,
  primaryUI: 'sidepanel',
  theme: 'system',
  autoSaveOnTabClose: false,
  removeClosedTabsOnUpdate: false,
};
