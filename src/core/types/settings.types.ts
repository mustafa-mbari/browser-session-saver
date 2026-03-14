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
};
