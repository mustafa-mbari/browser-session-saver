import { registerEventListeners } from './event-listeners';
import { setupSidePanelController } from './side-panel-controller';
import { initAutoSaveEngine } from './auto-save-engine';
import { restoreTabGroupNamesOnStartup } from './tab-group-restore';
import { migrateIfNeeded } from '@core/services/migration.service';
import { getSettingsStorage } from '@core/storage/storage-factory';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import type { Settings } from '@core/types/settings.types';

console.log('Session Saver service worker started');

setupSidePanelController();
registerEventListeners();

chrome.runtime.onStartup.addListener(() => {
  void restoreTabGroupNamesOnStartup();
});

(async () => {
  await migrateIfNeeded();

  const storage = getSettingsStorage();
  const settings = (await storage.get<Settings>(STORAGE_KEYS.SETTINGS)) ?? DEFAULT_SETTINGS;

  initAutoSaveEngine(settings);
})();
