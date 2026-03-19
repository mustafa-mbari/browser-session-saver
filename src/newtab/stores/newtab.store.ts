/**
 * Facade re-exporting both UI and Data stores.
 * Existing imports of `useNewTabStore` and `NewTabView` continue to work.
 * New code should import the specific store directly for better re-render isolation:
 *   import { useNewTabUIStore } from '@newtab/stores/newtab-ui.store';
 *   import { useNewTabDataStore } from '@newtab/stores/newtab-data.store';
 */
export { useNewTabUIStore as useNewTabStore } from './newtab-ui.store';
export type { NewTabView } from './newtab-ui.store';
export { useNewTabUIStore } from './newtab-ui.store';
export { useNewTabDataStore } from './newtab-data.store';
