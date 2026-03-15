# Project Technical Review

## Executive Summary

Session Saver is a Chrome Manifest V3 extension built with React 18, TypeScript (strict mode), Tailwind CSS, and Zustand. It has grown from a session management tool into a multi-feature productivity suite spanning sessions, subscriptions, tab groups, bookmarks, to-do lists, and a full new-tab-page replacement.

**Architecture is sound.** Clean layered separation (core → background → UI surfaces), typed discriminated union message protocol, IndexedDB abstraction via `IStorage` interface, and per-surface Zustand stores. TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters` enforced.

**Technical debt has accumulated.** Test coverage is approximately 7% (7 test files out of ~95 source modules). There are no React error boundaries anywhere — an unhandled exception in any component crashes the entire UI surface. A native Node.js package (`sharp`) sits in production dependencies despite never being imported. A 722-line component handles six different card types. Tab group color maps are copy-pasted across four files.

**The extension works** and is well-structured for a solo/small-team project, but the items below must be addressed before Chrome Web Store publication at scale.

---

## Critical Issues (Fix Immediately)

### 1. `sharp` in production `dependencies`

- [ ] Remove `sharp` from `dependencies` in `package.json` (line 23)
- [ ] Remove `jimp` from `devDependencies` in `package.json` (line 43)
- **Impact:** `sharp` is a native Node.js image processing library (~30 MB of platform-specific binaries). It is **never imported** anywhere in `src/`. It cannot execute in a Chrome extension context. It inflates `node_modules`, slows installs, and may confuse bundlers. `jimp` is also never imported.
- **Fix:** Delete both entries from `package.json` and run `npm install`.

### 2. No React error boundaries

- [ ] Create `src/shared/components/ErrorBoundary.tsx`
- [ ] Wrap each UI surface root: Side Panel `App.tsx`, Dashboard `App.tsx`, New Tab `App.tsx`, Popup `App.tsx`
- **Impact:** Any unhandled exception in a React component tree (failed API call, unexpected data shape, rendering error) crashes the entire UI surface with a blank white screen. For a new-tab override, this means the user loses their new-tab page entirely until the extension is reloaded. There is zero graceful degradation.
- **Fix:** Create a generic `ErrorBoundary` class component with a fallback UI ("Something went wrong — reload") and wrap each `App.tsx` root.

### 3. Content script not explicitly registered in manifest

- [ ] Verify `src/content/scroll-capture.ts` is included in production build output
- [ ] If not, add `content_scripts` entry to `public/manifest.json`
- **Impact:** `src/content/scroll-capture.ts` exists and listens for `CAPTURE_SCROLL` messages to capture scroll position. However, `public/manifest.json` has no `content_scripts` field. The CRXJS Vite plugin may auto-inject it during build, but this is implicit and fragile. If it fails silently, scroll position capture breaks with no error.
- **Fix:** Inspect `dist/manifest.json` after build. If `content_scripts` is absent, add it explicitly to `public/manifest.json`.

### 4. Shallow import validation allows data corruption

- [ ] Extend `isValidSession()` in `src/core/utils/validators.ts` to validate tab array contents using `isValidTab()`
- [ ] Add URL validation per tab in `importFromJSON()` in `src/core/services/import.service.ts`
- **Impact:** `isValidSession()` (line 29-39 of `validators.ts`) only checks for field existence (`id`, `name`, `createdAt`, `tabs`, `tabCount`) — it does not validate that `tabs` entries are well-formed or that URLs are safe. `importFromJSON()` (line 22 of `import.service.ts`) passes the validation then pushes `raw.tabGroups` directly without any validation (line 40). Malformed or malicious JSON can write arbitrary data to IndexedDB.
- **Fix:** Iterate `tabs` in `isValidSession()` and validate each with `isValidTab()`. Apply `isValidUrl()` to each tab URL in `importFromJSON()` (the HTML and URL-list importers already do this).

---

## Major Improvements

### 1. Split BookmarkCategoryCard.tsx (722 lines)

- [ ] Extract each card-type body into its own component file
- [ ] Extract entry row rendering into a standalone `BookmarkEntryRow` component
- [ ] Extract resize popover into a `CardResizePopover` component
- [ ] Extract context menu logic into a custom hook
- **Why:** `src/newtab/components/BookmarkCategoryCard.tsx` is 722 lines handling 6 card types (bookmark, clock, note, todo, subscription, tab-groups), drag-and-drop, inline editing, context menus, virtualization, and resize controls. This violates SRP and makes the file difficult to review, test, or modify without risk of regressions.
- **Suggested:** Max 200 lines per component. Each card body is already partially extracted (SubscriptionCardBody, TabGroupsCardBody exist as separate files) — complete the pattern for all types.

### 2. Eliminate duplicated GROUP_COLORS constant

- [ ] Create `src/core/constants/tab-group-colors.ts` with a single `GROUP_COLORS` map
- [ ] Replace all 4 local definitions with imports
- **Why:** The exact same 9-color `Record<string, string>` is independently defined in:
  - `src/newtab/components/TabGroupsPanel.tsx` (line 22)
  - `src/newtab/components/TabGroupsCardBody.tsx` (line 15)
  - `src/newtab/components/SessionsPanel.tsx` (line 13)
  - `src/sidepanel/views/TabGroupsView.tsx` (line 22, named `GROUP_COLOR_MAP`)
- **Impact:** A color change requires editing 4 files. Divergence risk is high.

### 3. Standardize storage adapter patterns

- [ ] Refactor `SubscriptionStorage` (`src/core/storage/subscription-storage.ts`) to align with `IStorage` or a consistent flat-key pattern
- [ ] Refactor `TabGroupTemplateStorage` (`src/core/storage/tab-group-template-storage.ts`) similarly
- **Why:** Session storage uses `IStorage` interface with `IndexedDBAdapter`. Subscription storage uses standalone functions with manual `new Promise()` wrappers around `chrome.storage.local.get()`. Tab group template storage uses a static class with its own Promise patterns. Three different patterns for the same operation.
- **Suggested:** Create a lightweight `ChromeLocalKeyAdapter<T>` generic class for flat `chrome.storage.local` key/value pairs, and use it for subscriptions, tab-group templates, and newtab settings.

### 4. Add debouncing to search inputs

- [ ] Wrap `onSearch` callback in `src/sidepanel/components/SearchBar.tsx` with `debounce()` from `src/core/utils/debounce.ts`
- **Why:** The sidepanel SearchBar fires `onSearch(e.target.value)` on every keystroke with no debounce. With hundreds of sessions, this triggers expensive filtering on every character. The debounce utility already exists in the codebase.
- **Suggested:** 200ms debounce with leading=false.

### 5. Reduce BookmarkBoard prop drilling

- [ ] Create a `BookmarkBoardContext` or move board operations into the Zustand store
- **Why:** `src/newtab/components/BookmarkBoard.tsx` passes 16+ callback props down to `BookmarkCategoryCard`. This makes the component interface unwieldy and changes require touching multiple files.
- **Suggested:** React Context with a custom hook `useBookmarkBoard()` or consolidate callbacks into the newtab Zustand store.

### 6. Split monolithic newtab Zustand store

- [ ] Slice `src/newtab/stores/newtab.store.ts` into domain stores: `bookmark-store`, `todo-store`, `settings-store`, `ui-store`
- **Why:** The store manages 12+ state fields and 13+ setters. Any state change potentially triggers re-renders in all subscribed components. Zustand supports slices pattern (`combine`, `create` with partials) to isolate state domains.

---

## Performance Risks

### 1. `getUsedBytes()` serializes entire IndexedDB

- [ ] Replace with `navigator.storage.estimate()` or incremental size tracking
- **Impact:** `src/core/storage/indexeddb.ts` line 96-100: `getUsedBytes()` calls `getAll()` (full cursor scan of every session), then `JSON.stringify()` on the entire result, then `new Blob([json]).size`. For a user with 500 sessions averaging 20 tabs each, this creates a ~5 MB temporary string on every call.
- **Strategy:** Use the Storage API (`navigator.storage.estimate()`) which returns quota/usage without serialization, or track size incrementally on writes.

### 2. All newtab data loaded at mount

- [ ] Lazy-load categories and entries per active board only
- **Impact:** `src/newtab/App.tsx` loads ALL boards, ALL categories for every board, and ALL entries for every category on first render via cascading `Promise.all` calls. A user with multiple boards and hundreds of bookmarks faces a slow first paint.
- **Strategy:** Load only the active board's data initially. Fetch other boards on demand when the user switches.

### 3. No code splitting within UI surfaces

- [ ] Add `React.lazy()` for heavy components (WallpaperPicker, SubscriptionsPanel, SettingsPanel, KeyboardHelpModal)
- **Impact:** Each entry point bundles all components including rarely-used ones (wallpaper picker, settings panel, keyboard help modal). This increases initial parse/execute time.
- **Strategy:** Dynamic imports with `React.lazy()` and `Suspense` for infrequently-accessed components.

### 4. Auto-save queries all windows and tabs on every trigger

- [ ] Cache current window's tabs separately; only query all windows when `saveAllWindows=true`
- **Impact:** `performAutoSave()` in `auto-save-engine.ts` calls `chrome.windows.getAll({populate: true})` on every auto-save trigger (timer, idle, etc.), querying all browser windows and all tabs regardless of settings. For users with many windows, this is expensive.

---

## Security Risks

### 1. No URL validation on JSON import

- [ ] Add `isValidUrl()` check per tab URL in `importFromJSON()` at `src/core/services/import.service.ts` line 31
- **Impact:** `importFromHTML()` and `importFromURLList()` both validate URLs with `isValidUrl()` before accepting them. `importFromJSON()` does not — it passes `String(t.url)` through directly (line 31). This inconsistency means JSON import can inject arbitrary URLs including `javascript:`, `data:`, or malformed protocols.
- **Mitigation:** Apply the same `isValidUrl()` filter used by the other importers.

### 2. Unvalidated URLs opened via `window.open()`

- [ ] Create a `safeOpenUrl()` utility that validates URLs before opening
- **Impact:** `window.open()` is called directly on user-entered subscription URLs (`SubscriptionCardBody.tsx` lines 161, 207; `SubscriptionsPanel.tsx` line 209) and bookmark URLs (`BookmarkCategoryCard.tsx` lines 71, 132; `QuickLinksRow.tsx` lines 67, 69). URLs are user-provided and could be `javascript:` or other dangerous protocols.
- **Mitigation:** Create `src/core/utils/safe-open.ts` that checks `isValidUrl()` before calling `window.open()`.

### 3. No explicit Content Security Policy in manifest

- [ ] Add `content_security_policy.extension_pages` to `public/manifest.json`
- **Impact:** MV3 provides a default CSP, but an explicit declaration documents the security intent and prevents accidental weakening. The extension uses inline styles extensively (glassmorphism, dynamic colors) which are allowed by MV3 defaults, but future changes could introduce `eval()` or unsafe patterns without a CSP guard.
- **Mitigation:** Add `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }`.

### 4. `chrome://` URLs accepted by `isValidUrl()`

- [ ] Restrict `chrome:` and `chrome-extension:` to internal use only; reject them in import flows
- **Impact:** `src/core/utils/validators.ts` line 6 accepts `chrome:` and `chrome-extension:` protocols. While needed for internal functionality, these should be rejected when processing imported data to prevent crafted imports from navigating to sensitive Chrome internal pages.

---

## Architecture Improvements

- [ ] **Add error boundaries** to all 4 UI surface roots (Side Panel, Dashboard, New Tab, Popup)
- [ ] **Extract tab-group colors** to `src/core/constants/tab-group-colors.ts` — eliminate 4-way duplication
- [ ] **Unify storage patterns** — create a generic `ChromeLocalKeyAdapter<T>` for flat chrome.storage.local keys (subscriptions, tab-group templates, newtab settings)
- [ ] **Split BookmarkCategoryCard** into focused sub-components per card type
- [ ] **Reduce prop drilling** in BookmarkBoard via React Context or Zustand store consolidation
- [ ] **Add message protocol timeouts** — `chrome.runtime.sendMessage` calls in UI code have no timeout; a hung service worker blocks the UI indefinitely
- [ ] **Verify content script deployment** — ensure `scroll-capture.ts` reliably reaches production builds

---

## Code Quality Improvements

- [ ] **Extract GROUP_COLORS** to shared constant — 4 files define the same 9-color map independently
- [ ] **Split 722-line BookmarkCategoryCard** — extract card bodies, entry rows, resize logic into separate files
- [ ] **Remove unused dependencies** — `sharp` (production), `jimp` (devDependency) are never imported
- [ ] **Add debounce to SearchBar** — `debounce()` utility exists at `src/core/utils/debounce.ts` but is not used in the sidepanel search
- [ ] **Wire up `chrome.i18n.getMessage()`** — locale files exist (`_locales/en/messages.json` with 265 entries, `_locales/ar/messages.json`) and a `t()` wrapper exists at `src/shared/utils/i18n.ts`, but the `t()` function is called in only 1 file. Most UI strings are hardcoded
- [ ] **Add return type annotations** to all service functions — many use implicit TypeScript return type inference
- [ ] **Standardize naming** — `GROUP_COLORS` vs `GROUP_COLOR_MAP` for the same constant across files
- [ ] **Remove migration system dead code** — `src/core/services/migration.service.ts` has a migrations framework with an always-empty migrations array; either use it or remove it

---

## Scalability Improvements

- [ ] **Paginate session loading** — `getAllSessions()` returns all sessions at once via IndexedDB cursor scan; add pagination with IDBKeyRange for users with hundreds of sessions
- [ ] **Batch IndexedDB operations** in `NewTabDB` — currently each put/get/delete is a separate transaction; batch related operations in a single readwrite transaction
- [ ] **Lazy-load newtab board data** — only load the active board's categories and entries; defer other boards until the user switches
- [ ] **Add virtual scrolling to newtab panels** — `SessionsPanel`, `AutoSavesPanel`, `SubscriptionsPanel` render full lists without virtualization (the side panel `SessionList` does use `@tanstack/react-virtual`)
- [ ] **Implement `chrome.storage.local.onChanged` listener** — instead of re-fetching all data after every write, listen for changes and update state incrementally

---

## Testing Improvements

**Current state:** 7 test files, all utility/service unit tests. Estimated coverage: ~7%.

| Tested | Not Tested |
|--------|------------|
| `uuid.ts` | `session.service.ts` |
| `date.ts` | `subscription.service.ts` |
| `validators.ts` | `tab-group.service.ts` |
| `debounce.ts` | `bookmark.service.ts` |
| `search.service.ts` | `auto-save-engine.ts` |
| `export.service.ts` | `event-listeners.ts` |
| `import.service.ts` | `alarms.ts` |
| | All React components (0 component tests) |
| | `newtab-storage.ts` (IndexedDB adapter) |
| | `subscription-storage.ts` |
| | `tab-group-template-storage.ts` |

### Priority test additions:

- [ ] `session.service.test.ts` — Core business logic: save, restore, upsert auto-save, enforce limits
- [ ] `subscription.service.test.ts` — Urgency calculation, monthly normalization, CSV import/export
- [ ] `auto-save-engine.test.ts` — Trigger management, race condition handling, window cache behavior
- [ ] `event-listeners.test.ts` — All 15 message handlers with success/error paths
- [ ] `newtab-storage.test.ts` — IndexedDB CRUD, index queries, migration
- [ ] `ErrorBoundary.test.tsx` — Fallback rendering on component crash
- [ ] `Modal.test.tsx` — Focus management, escape key, click-outside
- [ ] `SessionList.test.tsx` — Virtual scrolling, selection, context menu
- [ ] Integration tests for message passing (UI → service worker → storage → response)
- [ ] E2E tests with Puppeteer/Playwright for Chrome extension context

---

## Quick Wins

Small changes with high impact:

1. **Remove `sharp` and `jimp`** from `package.json` — eliminates ~30 MB of unused binaries, zero code changes needed
2. **Extract GROUP_COLORS** to `src/core/constants/tab-group-colors.ts` — 15-minute refactor, eliminates 4-way duplication
3. **Add debounce to SearchBar** — 10-minute change using existing `debounce()` utility, improves responsiveness with large session lists
4. **Add ErrorBoundary wrappers** — 30-minute implementation with generic fallback UI, prevents blank-screen crashes
5. **Add explicit CSP to manifest** — 5-minute manifest edit, documents security intent
6. **Add URL validation to JSON import** — 10-minute change, aligns with HTML/URL-list importers that already validate

---

## Long-Term Improvements

Future architectural enhancements for sustained quality:

1. **Full i18n adoption** — Wire all hardcoded UI strings through `chrome.i18n.getMessage()` using the existing `t()` helper. The locale files (`_locales/en/messages.json`, `_locales/ar/messages.json`) already exist with 265 message keys but are barely used. This is required for proper Arabic support and Chrome Web Store internationalization.
2. **Migration framework** — The migration infrastructure exists (`src/core/services/migration.service.ts`) but the migrations array is empty. Build out version-based migrations for schema evolution as the data model grows (session format, newtab settings, subscription fields).
3. **Code splitting with React.lazy** — Lazy-load heavy components (WallpaperPicker, KeyboardHelpModal, SettingsPanel, SubscriptionsPanel) to reduce initial bundle parse time per surface.
4. **E2E testing** — Use Puppeteer with `--load-extension` flag or Playwright's Chrome extension support for end-to-end testing of actual extension behavior (side panel opening, session save/restore, new tab rendering).
5. **CI/CD pipeline** — Automate build, lint, test, and Chrome Web Store deployment via GitHub Actions. Include bundle size tracking and visual regression tests.
6. **Accessibility audit** — Add focus traps to `Modal` component, keyboard navigation to `ContextMenu`, non-color indicators for subscription urgency (icons, text labels), `aria-live` regions for async updates.
7. **Message protocol timeouts and retries** — Add configurable timeout to all `chrome.runtime.sendMessage` calls to prevent UI hangs when the service worker is restarting (MV3 service workers are ephemeral and may be terminated by Chrome).
8. **Storage quota monitoring** — Track `chrome.storage.local` usage against the 10 MB quota. Alert users before they hit the limit. Consider compressing session data for heavy users.
