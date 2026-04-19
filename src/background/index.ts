import { registerEventListeners } from './event-listeners';
import { setupSidePanelController } from './side-panel-controller';
import { initAutoSaveEngine, updateSettings } from './auto-save-engine';
import { restoreTabGroupNamesOnStartup } from './tab-group-restore';
import { migrateIfNeeded } from '@core/services/migration.service';
import { getSettingsStorage } from '@core/storage/storage-factory';
import { STORAGE_KEYS } from '@core/types/storage.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import type { Settings } from '@core/types/settings.types';

console.log('Browser Hub service worker started');

setupSidePanelController();
registerEventListeners();

// CRITICAL (Chrome MV3): All chrome event listeners must be registered synchronously
// during top-level evaluation of the service worker — Chrome uses these to decide when
// to wake the SW. Registering after any `await` means alarms and other events can fire
// without the SW being woken up. Use DEFAULT_SETTINGS as a safe initial value; actual
// user settings are applied immediately below once storage is read.
initAutoSaveEngine(DEFAULT_SETTINGS);


chrome.runtime.onStartup.addListener(() => {
  void restoreTabGroupNamesOnStartup();
  // Signal to the New Tab page and sidepanel that a restore prompt should be shown.
  chrome.storage.local.set({ session_restore_prompt: { shownAt: Date.now() } });
});

(async () => {
  try {
    await migrateIfNeeded();

    // Fetch dynamic guest limits from Supabase plans table so admins can adjust
    // them without a new extension release. Falls back to PLAN_LIMITS.guest if offline.
    const { fetchAndCacheGuestLimits } = await import('@core/services/limits/action-tracker');
    void fetchAndCacheGuestLimits();

    const storage = getSettingsStorage();
    const settings = (await storage.get<Settings>(STORAGE_KEYS.SETTINGS)) ?? DEFAULT_SETTINGS;

    // Apply actual user settings (updates _settings + alarm interval without re-registering
    // event listeners, which are already registered synchronously above).
    updateSettings(settings);
  } catch (error) {
    console.error('Service worker startup failed:', error);
  }
})();
