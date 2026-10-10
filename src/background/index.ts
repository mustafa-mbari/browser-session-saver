import './polyfills';
import { registerEventListeners } from './event-listeners';
import { setupSidePanelController } from './side-panel-controller';
import { initAutoSaveEngine, saveShutdownSnapshot } from './auto-save-engine';
import { initMaintenance } from './maintenance';
import { restoreTabGroupNamesOnStartup } from './tab-group-restore';
import { migrateIfNeeded } from '@core/services/migration.service';
import { fetchAndCacheGuestLimits } from '@core/services/limits/limits.service';

setupSidePanelController();
registerEventListeners();

// CRITICAL (Chrome MV3): All chrome event listeners must be registered synchronously
// during top-level evaluation of the service worker — Chrome uses these to decide when
// to wake the SW. Registering after any `await` means alarms and other events can fire
// without the SW being woken up. The engine loads the user's settings itself.
initAutoSaveEngine();
initMaintenance();

chrome.runtime.onStartup.addListener(() => {
  void restoreTabGroupNamesOnStartup();
  void saveShutdownSnapshot();
  // Signal to the New Tab page and sidepanel that a restore prompt should be shown.
  chrome.storage.local.set({ session_restore_prompt: { shownAt: Date.now() } });
});

(async () => {
  try {
    await migrateIfNeeded();

    // Fetch dynamic guest limits from Supabase plans table so admins can adjust
    // them without a new extension release. Falls back to PLAN_LIMITS.guest if offline.
    void fetchAndCacheGuestLimits();
  } catch (error) {
    console.error('Service worker startup failed:', error);
  }
})();
