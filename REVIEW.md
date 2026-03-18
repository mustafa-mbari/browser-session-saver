# REVIEW.md — Browser Hub Chrome Extension
## Full-Project Architecture & Code Quality Audit

---

## 1. Executive Summary

**Overall Project Rating: 6.5 / 10**

Browser Hub is a well-intentioned Chrome MV3 extension with a clear feature set and a solid
TypeScript/React foundation. The code demonstrates good separation of concerns in the core layer,
strong typing in the messaging protocol, and thoughtful UX detail (virtual scrolling, glassmorphism,
keyboard shortcuts). However, a cluster of critical issues—a missing entire surface (Dashboard), a
service worker state reliability flaw, overly broad content script injection, and a full-table-scan
data layer—constitute real production risks that overshadow the otherwise competent work.

### Key Risks

| Risk | Severity |
|---|---|
| Dashboard surface entirely absent from codebase | Critical |
| Content script injected on every website visited | Critical |
| Auto-save state silently lost on service worker restart | Critical |
| Full IndexedDB table scan on every session query | Critical |
| Rollup pinned to ancient v2.80.0 via overrides | High |

### Top 5 Critical Issues

1. `src/dashboard/` directory does not exist — the entire Dashboard surface is absent from the build
2. Content script matches `http://*/*, https://*/*` — runs scroll capture on every website visited
3. `windowTabCache` (module-level) is destroyed on every service worker restart → window-close auto-saves silently fail
4. `getAllSessions()` does a full `storage.getAll()` scan then filters in memory — unscalable beyond ~300 sessions
5. `Ctrl+Shift+S` keyboard shortcut collision between manifest `_execute_action` and Subscriptions nav in sidepanel

---

## 2. Detailed Findings

### 2.1 Code Quality & Structure

---

**[CQ-1] Dashboard surface completely absent**
- **Severity:** Critical
- **Files:** `src/dashboard/` (does not exist), `vite.config.ts`, `public/manifest.json`
- **Description:** CLAUDE.md documents a full Dashboard with 5 pages (Sessions, Auto-Saves,
  Tab Groups, Import/Export, Settings), a Zustand store, and sidebar navigation. The directory
  `src/dashboard/` returns zero files. The `vite.config.ts` build inputs include only `sidepanel`,
  `popup`, and `newtab` — no `dashboard` entry. The `@dashboard` path alias is also absent from
  `vite.config.ts`. Features described as "Dashboard pages" (`SessionBulkToolbar`,
  `SessionDiffModal`, `SettingsPanel`, `AutoSavesPanel`) actually live under `src/newtab/`.
- **Impact:** Documentation mismatch causes developer confusion; any import using `@dashboard/*`
  fails to resolve at build time; the full-page management UI referenced in docs does not exist.
- **Suggested Fix:** Either create the Dashboard surface as documented, or remove all references to
  it from CLAUDE.md and align the docs with the newtab-based implementation reality.

---

**[CQ-2] HomeView.tsx directly imports from `@core/services` bypassing the service worker**
- **Severity:** High
- **Files:** `src/sidepanel/views/HomeView.tsx` lines 21, 61
- **Description:** `import * as SessionService from '@core/services/session.service'` followed by
  `SessionService.getAllSessions({ isAutoSave: true })` opens a direct IndexedDB connection from the
  sidepanel. The rest of HomeView fetches sessions via `useSession()` → `useMessaging()` → service
  worker. Two separate read paths now exist for the same data.
- **Impact:** Race condition: the SW may be mid-write when the direct DB read executes, returning
  stale or partial data. Also violates the architectural boundary explicitly warned against in CLAUDE.md.
- **Suggested Fix:** All session reads from UI code must go through `sendMessage`. Add a dedicated
  `GET_AUTO_SAVE_SESSION` message action or extend the existing `GET_SESSIONS` filter to cover this
  use case.

---

**[CQ-3] HomeView.tsx duplicates session filter/sort logic from `session.service.ts`**
- **Severity:** High
- **Files:** `src/sidepanel/views/HomeView.tsx` lines 91–137, `src/core/services/session.service.ts` lines 265–297
- **Description:** `filteredByType`, `filteredSessions`, and `sortedSessions` useMemo blocks
  re-implement the same filtering and sorting logic already present in `applyFilter()` and
  `applySort()` in `session.service.ts`.
- **Impact:** Bug fixes to filter/sort logic must be applied in two places. All session data is
  loaded on every render and re-filtered client-side, defeating any server-side filtering.
- **Suggested Fix:** Move filtering/sorting into the `GET_SESSIONS` message payload and remove the
  redundant client-side re-computation.

---

**[CQ-4] `TG_COLOR_MAP` in HomeView.tsx duplicates `GROUP_COLORS` constant**
- **Severity:** Medium
- **Files:** `src/sidepanel/views/HomeView.tsx` lines 434–437, `src/core/constants/tab-group-colors.ts`
- **Description:** A local `TG_COLOR_MAP` object defines the same 9 ChromeGroupColor → hex-string
  mappings already exported from `tab-group-colors.ts` as `GROUP_COLORS`.
- **Impact:** Any color correction must be applied twice; values can silently diverge over time.
- **Suggested Fix:** Replace with `import { GROUP_COLORS } from '@core/constants/tab-group-colors'`.

---

**[CQ-5] HomeView.tsx is 900+ lines with multiple embedded sub-components**
- **Severity:** Medium
- **Files:** `src/sidepanel/views/HomeView.tsx`
- **Description:** The file contains `HomeView`, `CurrentTabsPanel`, `TabGroupsPanel`,
  `HomeLiveGroupRow`, and several inner helper components all inline. This single file handles
  session filtering, tab listing, tab group management, restore prompts, toasts, and search.
- **Impact:** High cognitive load; nearly impossible to unit-test individual sections; frequent
  merge conflicts.
- **Suggested Fix:** Extract `CurrentTabsPanel`, `TabGroupsPanel`, and `HomeLiveGroupRow` into
  separate files under `src/sidepanel/components/`.

---

**[CQ-6] `SessionDetailView.tsx` manages 10+ independent state variables**
- **Severity:** Medium
- **Files:** `src/sidepanel/views/SessionDetailView.tsx` lines 38–62
- **Description:** `editingName`, `nameInput`, `showExportMenu`, `editMode`, `newTag`,
  `notesValue`, `notesDirty`, `showRestoreModal`, `selectedTabIds`, `restoreMode` are all
  independent `useState` calls with complex interdependencies.
- **Impact:** State transitions are difficult to reason about; partial-update bugs (e.g. modal
  opening while notes are dirty) are easy to introduce.
- **Suggested Fix:** Consolidate into a `useReducer` or a custom `useSessionDetailState` hook
  with clear action types.

---

**[CQ-7] `generateSessionName()` replaces only the first underscore**
- **Severity:** Low
- **Files:** `src/core/services/session.service.ts` line 23
- **Description:** `trigger.slice(1).replace('_', ' ')` — `.replace()` without the `g` regex flag
  only replaces the first match. Any future trigger with multiple underscores (e.g.
  `tab_open_close`) would produce a name with stale underscores.
- **Impact:** Low now, fragile for future triggers.
- **Suggested Fix:** Use `.replace(/_/g, ' ')`.

---

**[CQ-8] Migration service is a no-op with an empty migrations array**
- **Severity:** High
- **Files:** `src/core/services/migration.service.ts` line 11
- **Description:** `const migrations: Migration[] = []` — the migration framework exists but has
  zero entries. Every schema change made to `Session`, `Settings`, or storage layouts since v1.0.0
  has been applied without a migration path, silently breaking existing user data on extension
  update.
- **Impact:** Users upgrading from an earlier build will have inconsistent or broken stored data
  until an unhandled exception surfaces.
- **Suggested Fix:** Retroactively add migration entries for every breaking schema change since
  launch. Establish a policy: every PR that touches storage types must include a migration entry.

---

**[CQ-9] `Session.tabCount` is a denormalized field prone to drift**
- **Severity:** Medium
- **Files:** `src/core/types/session.types.ts` line 55, `src/background/event-listeners.ts`
- **Description:** `tabCount: number` is stored alongside `tabs: Tab[]`, requiring manual
  synchronization. `handleMergeSessions` updates `mergedTabs` but does not explicitly pass
  `tabCount` — `saveSession()` sets it correctly only because it derives it from `tabs.length`
  at create time. Any code path that mutates `tabs` directly risks divergence.
- **Impact:** Wrong tab counts silently displayed in the UI.
- **Suggested Fix:** Derive `tabCount` at read time (`session.tabs.length`) or enforce it via a
  write helper that always recomputes before persisting.

---

**[CQ-10] `handleUndeleteSession` stores an untrusted, UI-provided Session object**
- **Severity:** High
- **Files:** `src/background/event-listeners.ts` lines 341–347
- **Description:** The `UNDELETE_SESSION` handler accepts a full `Session` object from the UI
  message and writes it directly to IndexedDB with no validation. A UI bug or crafted message
  could set `isLocked: false` on a protected auto-save, or inject arbitrary session data.
- **Impact:** Bypasses session locking; potential data integrity violation.
- **Suggested Fix:** Accept only a `sessionId`, re-fetch the original session from a backup store,
  or at minimum validate that the provided session's `id` matches an existing deleted record.

---

**[CQ-11] Non-null assertions `window.id!` in restore handler**
- **Severity:** High
- **Files:** `src/background/event-listeners.ts` lines 137, 413
- **Description:** `const windowId = win.id!` — `chrome.windows.create()` can return a window
  object without an `id` in error conditions. No try/catch wraps the `windows.create` call at
  line 136, so any failure in window creation crashes the entire restore handler without returning
  a meaningful error response.
- **Impact:** Unhandled rejection; UI receives no error response; user sees an infinite spinner.
- **Suggested Fix:** Validate `win.id` explicitly and return `{ success: false, error: '...' }`.

---

**[CQ-12] Active tab restored by URL match only — duplicates ignored**
- **Severity:** Low
- **Files:** `src/background/event-listeners.ts` line 193
- **Description:** `allWindowTabs.find((t) => t.url === activeSavedTab.url)` — if two restored
  tabs share the same URL, the first match is always activated, ignoring the original active tab's
  position.
- **Impact:** Incorrect tab focus after restore when duplicate URLs exist.
- **Suggested Fix:** Match by URL AND original tab index rather than URL alone.

---

**[CQ-13] `HomeLiveGroupRow` uses `setTimeout` for focus management**
- **Severity:** Low
- **Files:** `src/sidepanel/views/HomeView.tsx` line 476
- **Description:** `setTimeout(() => inputRef.current?.focus(), 0)` — the zero-delay timeout is
  a common React anti-pattern. React's scheduling does not guarantee the input is mounted by the
  time the callback fires.
- **Impact:** Edit mode may not receive focus on slower devices.
- **Suggested Fix:** Use a `useEffect` dependent on the `editing` flag to focus the input after
  the render cycle.

---

### 2.2 Performance & Data Size

---

**[PERF-1] `getAllSessions()` performs a full IndexedDB scan on every call**
- **Severity:** Critical
- **Files:** `src/core/services/session.service.ts` lines 171–195
- **Description:** `storage.getAll()` retrieves every record in the `browser-hub` IndexedDB, then
  filtering and sorting are applied in memory. The `limit`/`offset` pagination in
  `handleGetSessions` is applied **after** the full scan.
- **Impact:** Linear time complexity with session count. At ~500 sessions the sidepanel becomes
  noticeably sluggish; at 2000+ sessions it hangs on open. Pagination provides zero DB-level
  speedup.
- **Suggested Fix:** Add an IDBIndex on `createdAt` and use `IDBKeyRange` for date-based queries.
  Cache the total count in metadata rather than recomputing on every call.

---

**[PERF-2] `updateTabCache()` queries ALL windows and tabs on every tab-update event**
- **Severity:** High
- **Files:** `src/background/auto-save-engine.ts` lines 199–224
- **Description:** `chrome.tabs.onUpdated` fires on nearly every browser action (page load,
  favicon change, title update). Each event triggers `debouncedUpdateTabCache` (2s debounce),
  which queries all windows and all their tabs via Chrome APIs.
- **Impact:** Constant background Chrome API churn during normal browsing. High CPU and memory
  pressure in the service worker even when the extension is idle.
- **Suggested Fix:** Throttle more aggressively (5–10s). Use the `windowId` from the event
  parameters to update only the affected window's cache, not all windows.

---

**[PERF-3] Import sessions written sequentially in a for loop**
- **Severity:** Medium
- **Files:** `src/background/event-listeners.ts` lines 330–332
- **Description:** `for (const session of result.sessions) { await storage.set(...) }` — each
  write is awaited before the next begins. Importing 50 sessions = 50 sequential IndexedDB
  transactions.
- **Impact:** Importing large session files blocks the service worker for multiple seconds.
- **Suggested Fix:** Use `Promise.all(result.sessions.map(s => storage.set(s.id, s)))` to
  parallelize writes.

---

**[PERF-4] No Vite manual chunk splitting configured**
- **Severity:** Medium
- **Files:** `vite.config.ts`
- **Description:** No `build.rollupOptions.output.manualChunks` is defined. All vendors (React,
  dnd-kit, tanstack-virtual, lucide-react) and all app code are split only by Vite's default
  heuristics per entry point.
- **Impact:** Each entry point (`sidepanel`, `popup`, `newtab`) likely bundles its own copy of
  shared vendor code, inflating total extension size.
- **Suggested Fix:** Define a `vendor` chunk for React and a `shared` chunk for core utilities.

---

**[PERF-5] `newtab.store.ts` is a single monolithic Zustand store**
- **Severity:** Medium
- **Files:** `src/newtab/stores/newtab.store.ts`
- **Description:** Settings, boards, bookmark categories, bookmark entries, quick links, todo
  lists, todo items, wallpaper state, and all UI flags live in one Zustand store. Any state
  change re-renders every subscriber regardless of which slice changed.
- **Impact:** Editing a single bookmark entry triggers re-renders in unrelated components
  (clock widget, subscription widget, tab groups widget, etc.).
- **Suggested Fix:** Split into domain-specific slices using Zustand's slice pattern:
  `useBoardStore`, `useTodoStore`, `useSettingsStore`.

---

**[PERF-6] Lucide-react icon bundle not audited**
- **Severity:** Low
- **Files:** Multiple files (HomeView.tsx imports 17 icons alone)
- **Description:** While `lucide-react` supports tree-shaking via named imports, no bundle audit
  has been performed to confirm that unused icons are excluded from the final chunks.
- **Impact:** Potential bundle size inflation.
- **Suggested Fix:** Run `vite-bundle-visualizer` or `rollup-plugin-visualizer` to confirm only
  used icons are bundled.

---

**[PERF-7] `checkDuplicate()` only compares against the single most recent session**
- **Severity:** Low
- **Files:** `src/core/services/session.service.ts` lines 241–251
- **Description:** Fetches only 1 session for duplicate detection. If the user saves sessions
  out of order, duplicate detection fails silently for non-latest sessions.
- **Impact:** Silent duplicate saves accumulate over time.
- **Suggested Fix:** Compare against the N most recent sessions, or hash tab URL sets for
  efficient multi-session comparison.

---

### 2.3 Memory & Resource Usage

---

**[MEM-1] Service worker module-level state silently lost on restart**
- **Severity:** Critical
- **Files:** `src/background/auto-save-engine.ts` lines 7–16
- **Description:** `windowTabCache`, `_settings`, `_initialized`, `_isSaving`,
  `_pendingCriticalTrigger` are all module-level variables. Chrome terminates idle service workers
  after ~30 seconds of inactivity. On the next wakeup every variable resets to its default.
  `windowTabCache` is empty, so `chrome.windows.onRemoved` fires on a window close, finds no
  cached tabs, and silently skips the auto-save.
- **Impact:** Window-close auto-saves silently fail whenever the user hasn't interacted with the
  extension in ~30 seconds — which is the common case during normal browsing.
- **Suggested Fix:** Persist `windowTabCache` to `chrome.storage.session` (ephemeral storage that
  survives SW restarts within the same browser session) and rehydrate it on SW startup.

---

**[MEM-2] Battery API listener never cleaned up**
- **Severity:** Medium
- **Files:** `src/background/auto-save-engine.ts` lines 171–197
- **Description:** `battery.addEventListener('levelchange', ...)` is added in `initBatteryMonitor()`
  with no corresponding `removeEventListener`. The Battery Status API is deprecated and its
  service-worker availability is undefined behavior.
- **Impact:** Minor; opaque lifetime management.
- **Suggested Fix:** Remove battery monitoring or use a stored reference to properly clean up the
  listener.

---

**[MEM-3] `chrome.idle.onStateChanged` registered unconditionally regardless of `saveOnSleep`**
- **Severity:** Medium
- **Files:** `src/background/auto-save-engine.ts` lines 43–47
- **Description:** The idle listener is always registered when `enableAutoSave` is true, even when
  `saveOnSleep` is false. Every system idle state change triggers the callback, which then checks
  the flag.
- **Impact:** Unnecessary listener overhead on every idle state transition.
- **Suggested Fix:** Register the listener only when `settings.saveOnSleep` is true; deregister
  when the setting is toggled off.

---

**[MEM-4] `NewTabDB.clearAll()` can partially clear stores on error**
- **Severity:** Medium
- **Files:** `src/core/storage/newtab-storage.ts` lines 137–149
- **Description:** `clearAll()` opens a multi-store transaction and fires parallel `clear()`
  requests. If any request errors, the Promise rejects — but other stores' clears may have already
  committed, leaving the DB in a partially cleared state.
- **Impact:** Data corruption after a failed clear operation.
- **Suggested Fix:** Resolve via the transaction's `oncomplete` event rather than individual
  request counters, and reject via `tx.onerror`.

---

### 2.4 Chrome Extension Best Practices

---

**[EXT-1] Content script injected on ALL HTTP/HTTPS pages**
- **Severity:** Critical
- **Files:** `public/manifest.json` lines 44–50
- **Description:** `"matches": ["http://*/*", "https://*/*"]` is functionally equivalent to
  `<all_urls>`. The `scroll-capture.ts` content script runs on every website the user visits,
  waiting for `CAPTURE_SCROLL` messages that are never sent during session restore (scroll
  positions are captured but never applied — see EXT-7).
- **Impact:**
  - Chrome Web Store install prompt shows "Read and change all your data on all websites"
  - A dormant listener on every tab consumes memory across the entire browser
  - The overhead is entirely wasted because scroll restoration is unimplemented
- **Suggested Fix:** Remove the content script entirely until scroll restoration is fully
  implemented. If retained, switch to `chrome.scripting.executeScript` on demand rather than
  a persistent injection.

---

**[EXT-2] Keyboard shortcut collision: `Ctrl+Shift+S`**
- **Severity:** High
- **Files:** `public/manifest.json` line 56, `src/sidepanel/App.tsx`
- **Description:** The manifest binds `_execute_action` (toggle side panel) to `Ctrl+Shift+S`.
  The sidepanel `App.tsx` also registers `Ctrl+Shift+S` as the Subscriptions view shortcut.
  Both handlers fire simultaneously when the user presses this key combo.
- **Impact:** Unpredictable behavior; Subscriptions shortcut is unreliable.
- **Suggested Fix:** Change the sidepanel Subscriptions shortcut to a non-conflicting binding
  (e.g. `Ctrl+Shift+B`), or remove the manifest command since the panel opens via
  `openPanelOnActionClick`.

---

**[EXT-3] Single PNG used for all icon sizes**
- **Severity:** Medium
- **Files:** `public/manifest.json` lines 30–43
- **Description:** `browser-hub_logo.png` is referenced for 16×16, 32×32, 48×48, and 128×128
  icon slots. Chrome scales the same file down for all contexts.
- **Impact:** Blurry toolbar icon (16px); fails Chrome Web Store icon quality guidelines.
- **Suggested Fix:** Generate separate optimized PNG files at each required resolution.

---

**[EXT-4] `@crxjs/vite-plugin` is a beta dependency with a caret range**
- **Severity:** Medium
- **Files:** `package.json` line 29
- **Description:** `"@crxjs/vite-plugin": "^2.0.0-beta.30"` — the `^` range automatically
  upgrades to any new `2.0.0-beta.x`, including potentially breaking pre-release versions.
- **Impact:** Any `npm install` or `npm update` can silently pull in a breaking change.
- **Suggested Fix:** Pin to an exact version (`"2.0.0-beta.30"`) until a stable release is
  available.

---

**[EXT-5] Rollup forcibly pinned to ancient v2.80.0 via `overrides`**
- **Severity:** High
- **Files:** `package.json` lines 25–27
- **Description:** `"overrides": { "rollup": "2.80.0" }` forces all packages to use Rollup 2.80.0.
  Rollup is currently at v4.x. This override exists to paper over an incompatibility that was
  never diagnosed or properly resolved.
- **Impact:** ~2 years of security patches and build performance improvements are blocked.
  `npm audit` may flag CVEs in Rollup 2.80.0. Vite 6.x with Rollup 2.x is an unsupported
  combination.
- **Suggested Fix:** Investigate the original incompatibility, update `@crxjs/vite-plugin` or
  migrate to an alternative build plugin (`vite-plugin-web-extension`), and remove the override.

---

**[EXT-6] `bookmarks` permission appears unused**
- **Severity:** Low
- **Files:** `public/manifest.json` line 16
- **Description:** `bookmarks` is declared in `permissions`. The start-tab manages its own
  bookmark data via `newtab-db` IndexedDB. No `chrome.bookmarks.*` API calls were found in the
  codebase.
- **Impact:** Users see "Read and change your bookmarks" in the install dialog, increasing
  install friction unnecessarily.
- **Suggested Fix:** Audit for any `chrome.bookmarks` usage; remove the permission if confirmed
  unused.

---

**[EXT-7] Scroll position captured but never restored**
- **Severity:** High
- **Files:** `src/content/scroll-capture.ts`, `src/background/event-listeners.ts`
- **Description:** `Tab.scrollPosition` is populated during session save via `CAPTURE_SCROLL`
  messages to the content script. However, `handleRestoreSession()` never applies scroll data
  when opening restored tabs — the field is written and then permanently ignored.
- **Impact:** The content script runs on every page for zero user benefit. Scroll state is
  silently discarded. This is the sole justification for `<all_urls>`-equivalent injection.
- **Suggested Fix:** Implement scroll restoration in the restore handler using
  `chrome.scripting.executeScript`, or remove the entire scroll capture infrastructure until
  it can be completed.

---

### 2.5 Security Review

---

**[SEC-1] Untrusted `Session` object stored verbatim via `UNDELETE_SESSION`**
- **Severity:** High
- **Files:** `src/background/event-listeners.ts` lines 341–347
- **Description:** The handler accepts a complete `Session` object from the UI and writes it
  directly to IndexedDB with no validation. A UI bug or crafted message could set
  `isLocked: false` on a protected auto-save or inject arbitrary fields.
- **Impact:** Bypasses the session locking mechanism; data integrity at risk.
- **Suggested Fix:** Accept only a `sessionId`; re-fetch the original from storage before
  restoring.

---

**[SEC-2] No input size limit on `IMPORT_SESSIONS` payload**
- **Severity:** Medium
- **Files:** `src/background/event-listeners.ts` lines 311–338
- **Description:** `handleImportSessions` accepts `data: string` with no size check before
  parsing. A multi-megabyte import string could consume service worker memory and trigger
  an OOM termination.
- **Impact:** Service worker crash; all in-flight auto-saves and pending state lost.
- **Suggested Fix:** Validate `payload.data.length` against a reasonable maximum (e.g. 5MB)
  before any parsing begins.

---

**[SEC-3] Tab URLs passed to `chrome.tabs.create` without validation**
- **Severity:** Low
- **Files:** `src/background/event-listeners.ts` lines 145, 157, 416, 426
- **Description:** `tab.url` values from stored sessions are passed directly to
  `chrome.tabs.create({ url: tab.url })` without scheme validation.
- **Impact:** Low in practice (Chrome prevents `javascript:` and `data:` navigation), but
  defense-in-depth is absent.
- **Suggested Fix:** Validate that URLs match `https?://` or known safe schemes before opening.

---

**[SEC-4] Content script does not validate the message sender**
- **Severity:** Medium
- **Files:** `src/content/scroll-capture.ts`
- **Description:** The content script responds to `CAPTURE_SCROLL` messages without verifying
  `sender.id === chrome.runtime.id`. A compromised or spoofed message source could trigger
  scroll responses.
- **Impact:** Low probability; violates the principle of least privilege.
- **Suggested Fix:** Add a sender origin check before processing any incoming messages.

---

### 2.6 State Management

---

**[STATE-1] Four distinct storage access patterns for the same backends**
- **Severity:** High
- **Description:** The codebase uses four different patterns to access two storage backends:
  1. `IndexedDBAdapter` via `getSessionStorage()` — sessions (`browser-hub` DB)
  2. `ChromeStorageAdapter` via `getSettingsStorage()` — settings, metadata
  3. `ChromeLocalKeyAdapter<T>` — subscriptions, tab group templates
  4. `NewTabDB` class — newtab data (`newtab-db`)

  Patterns 2 and 3 both wrap `chrome.storage.local` with different APIs and Promise patterns.
  Pattern 4 is a custom IndexedDB wrapper that duplicates what `IndexedDBAdapter` already provides.
- **Impact:** Inconsistent error handling across the codebase; new features have no clear storage
  pattern to follow; double implementation of identical IndexedDB logic.
- **Suggested Fix:** Consolidate patterns 2 and 3 so `ChromeStorageAdapter` handles both scalar
  and array keys. Evaluate whether `NewTabDB` should reuse `IndexedDBAdapter` internals.

---

**[STATE-2] `ChromeStorageAdapter.count()` returns an incorrect value**
- **Severity:** Medium
- **Files:** `src/core/storage/chrome-storage.ts` lines 29–32
- **Description:** `count()` calls `chrome.storage.local.get(null)` and counts ALL keys in
  `chrome.storage.local`, including settings, metadata, subscriptions, and tab group templates.
- **Impact:** Any caller using `count()` as a session counter receives an inflated number.
- **Suggested Fix:** The session storage uses `IndexedDBAdapter.count()` which is correct.
  `ChromeStorageAdapter.count()` should be removed (no valid use case exists) or scoped to a
  namespace prefix.

---

**[STATE-3] `sendMessage` timeout error is indistinguishable from a real SW error**
- **Severity:** Low
- **Files:** `src/shared/hooks/useMessaging.ts`
- **Description:** `Promise.race()` with a rejection timer produces an error with the same type
  as a genuine service worker error. Callers cannot distinguish "SW timed out" from "SW returned
  failure."
- **Impact:** No retry or fallback logic is possible; UI shows generic error messages.
- **Suggested Fix:** Use a distinct `TimeoutError` class or return `{ success: false, timedOut: true }`
  to allow callers to implement retries.

---

### 2.7 Error Handling & Logging

---

**[ERR-1] `console.error`/`console.warn` present in production service worker**
- **Severity:** Low
- **Files:** `src/background/auto-save-engine.ts` lines 103, 157, 185, 189
- **Description:** Production service worker contains multiple `console.error` and `console.warn`
  calls, including messages that expose internal implementation details
  (`'Battery API not available in service worker context'`).
- **Impact:** Internal details visible in DevTools; potential confusion for users who open the
  console.
- **Suggested Fix:** Gate verbose logs behind a `DEBUG` build flag; keep only critical failure
  logs in production.

---

**[ERR-2] `chrome.windows.create` failure is not caught in restore handler**
- **Severity:** High
- **Files:** `src/background/event-listeners.ts` lines 134–140
- **Description:** `const win = await chrome.windows.create(...)` is not wrapped in try/catch.
  If window creation fails, the exception propagates to the top-level `.catch()` in
  `registerEventListeners`. But because `win.id!` is asserted on the very next line, the
  resulting error message is `"Cannot read property 'id' of undefined"` — not the actual cause.
- **Suggested Fix:** Wrap `chrome.windows.create` in try/catch and return a descriptive error.

---

**[ERR-3] Silent early return in `upsertAutoSaveSession` merge path**
- **Severity:** Medium
- **Files:** `src/core/services/session.service.ts` lines 113–117
- **Description:** When nothing has changed during a merge, the function silently returns early.
  No metadata update is written, leaving `lastAutoSave` stale in the UI.
- **Impact:** Auto-save status UI may show a misleading "last saved" timestamp.
- **Suggested Fix:** This behavior is acceptable but should be explicitly documented; consider
  writing a `lastChecked` timestamp even when skipping the write.

---

### 2.8 Build & Deployment

---

**[BUILD-1] No source map configuration for production**
- **Severity:** Low
- **Files:** `vite.config.ts`
- **Description:** No `build.sourcemap` setting. Vite defaults to no source maps in production,
  making crash reports from the Chrome Web Store error dashboard impossible to diagnose.
- **Suggested Fix:** Set `build.sourcemap: 'hidden'` to generate source maps without bundling
  them into the packed extension.

---

**[BUILD-2] `npm run build` does not gate on test results**
- **Severity:** Low
- **Files:** `package.json` line 8
- **Description:** `"build": "tsc && vite build"` — tests are not required to pass before a
  build succeeds. A build with failing tests can be shipped.
- **Suggested Fix:** Change to `"build": "tsc && vitest run && vite build"` or add a CI pipeline
  that enforces green tests before allowing a merge.

---

**[BUILD-3] `npm run preview` is misleading for an extension**
- **Severity:** Low
- **Files:** `package.json` line 9 (`preview` script)
- **Description:** `npm run preview` starts Vite's preview server, which has no meaning for a
  Chrome MV3 extension. Extensions must be loaded via `chrome://extensions`, not a dev server.
- **Suggested Fix:** Remove or replace with a script that opens the `dist/` folder in Chrome
  developer mode.

---

## 3. Duplicate Code Report

| Duplication | Files Involved | Refactoring Suggestion |
|---|---|---|
| Color map: `TG_COLOR_MAP` vs `GROUP_COLORS` | `HomeView.tsx:434`, `tab-group-colors.ts` | Delete local map; import the existing constant |
| Session filter/sort logic | `HomeView.tsx:91–137`, `session.service.ts:265–297` | Remove client-side re-implementation; delegate to SW-side filter |
| IndexedDB wrapper: `NewTabDB` vs `IndexedDBAdapter` | `newtab-storage.ts`, `indexeddb.ts` | Extract shared low-level IDB helper; compose rather than duplicate |
| Tab restore loop (new\_window vs append/current) | `handleRestoreSession` lines 142–167, `handleRestoreSelectedTabs` lines 413–442 | Extract a shared `openTabsInWindow(tabs, windowId)` helper |
| `chrome.storage.local` array-key pattern | `ChromeStorageAdapter`, `ChromeLocalKeyAdapter` | Extend `ChromeStorageAdapter` to handle array keys; retire `ChromeLocalKeyAdapter` |
| `formatRelative` vs `formatTimestamp` | HomeView.tsx, SessionDetailView.tsx, Popup App.tsx | Standardize on one function; remove or alias the other |
| Repeated Tailwind hover class `hover:bg-gray-100 dark:hover:bg-gray-700` | HomeView.tsx, TabGroupsView.tsx, others | Extract to a `@apply`-based Tailwind component class (e.g. `.btn-ghost`) |

---

## 4. Performance & Size Report

### Estimated Heavy Parts

| Area | Risk |
|---|---|
| `getAllSessions()` full table scan | Largest single performance bottleneck |
| `updateTabCache()` on every tab event | Constant background API churn |
| Monolithic `newtab.store.ts` | Broad re-render surface on any state update |
| No vendor chunk splitting | React/dnd-kit duplicated across 3 entry bundles |
| Sequential import writes | Import of >20 sessions blocks the SW for seconds |

### Bundle Size Risks

- Each of the 3 entry points (`sidepanel`, `popup`, `newtab`) may bundle its own copy of React +
  ReactDOM (~140KB gzipped). No `manualChunks` prevents this.
- `@dnd-kit` (3 packages, ~50KB) loads only in `newtab` — confirm it is not pulled into
  `sidepanel` or `popup` bundles.
- `lucide-react` icons: 17+ imported in HomeView.tsx alone. Tree-shaking should exclude unused
  icons but has not been verified with a bundle analyzer.

### Optimization Opportunities

1. Add `build.rollupOptions.output.manualChunks` to extract `react`, `react-dom`, and `@dnd-kit`
   into shared chunks.
2. Lazy-load `SubscriptionsView`, `TabGroupsView`, and `ImportExportView` in the sidepanel
   (heavy panels in the newtab surface are already lazy-loaded — apply the same pattern).
3. Slice the monolithic `newtab.store.ts` into domain stores to reduce re-render scope.
4. Add IDBIndex on `createdAt`; rewrite `getAllSessions` with cursor-based queries and server-side
   filtering.
5. Replace sequential import writes with `Promise.all()`.

### Heavy Assets

- `browser-hub_logo.png` serves all 4 icon sizes from one file. If the source is a 128×128+ PNG,
  the 16px slot loads a disproportionately large file.
- Wallpaper images are stored as Blobs in IndexedDB with no size or quota enforcement. A single
  high-resolution wallpaper can easily consume >5MB of the extension's storage budget.

---

## 5. Chrome Extension Specific Issues Summary

| ID | Issue | File | Severity |
|---|---|---|---|
| EXT-1 | Content script on all HTTP/HTTPS | `manifest.json` | Critical |
| MEM-1 | SW module-level state lost on restart | `auto-save-engine.ts` | Critical |
| EXT-2 | `Ctrl+Shift+S` shortcut collision | `manifest.json` + `App.tsx` | High |
| EXT-5 | Rollup v2 override blocks security patches | `package.json` | High |
| EXT-7 | Scroll capture never used in restore | `event-listeners.ts`, `scroll-capture.ts` | High |
| EXT-3 | Single PNG for all icon sizes | `manifest.json` | Medium |
| EXT-4 | `@crxjs` beta plugin auto-upgrades | `package.json` | Medium |
| EXT-6 | `bookmarks` permission likely unused | `manifest.json` | Low |

---

## 6. Actionable Task List

### Priority: Critical

- [ ] Decide Dashboard surface fate: create `src/dashboard/` as documented **or** formally
      update CLAUDE.md to reflect newtab sidebar as the canonical management surface
- [ ] Remove content script from `manifest.json` or restrict match patterns until scroll
      restoration is fully implemented
- [ ] Persist `windowTabCache` to `chrome.storage.session` to survive service worker restarts
- [ ] Add IDBIndex on `createdAt` in the `browser-hub` sessions store; rewrite `getAllSessions`
      to use cursor-based queries instead of `getAll()`
- [ ] Fix `Ctrl+Shift+S` collision: rename the sidepanel Subscriptions shortcut to a
      non-conflicting key combination

### Priority: High

- [ ] Resolve rollup v2 override: diagnose original incompatibility, upgrade `@crxjs` or
      evaluate `vite-plugin-web-extension` as a stable alternative
- [ ] Pin `@crxjs/vite-plugin` to exact version `"2.0.0-beta.30"` (remove the `^` caret)
- [ ] Remove `HomeView.tsx` direct `SessionService` import; route all session reads through
      the SW messaging protocol
- [ ] Remove client-side filter/sort re-implementation in HomeView.tsx useMemo blocks
- [ ] Validate `win.id` in restore handlers; wrap `chrome.windows.create` in try/catch
- [ ] Validate `UNDELETE_SESSION` payload in the handler; accept session ID only
- [ ] Add input size limit check in `handleImportSessions` before JSON parsing
- [ ] Replace sequential import loop with `Promise.all()` parallel writes
- [ ] Audit for `chrome.bookmarks` API usage; remove `bookmarks` permission if unused
- [ ] Implement scroll position restoration in `handleRestoreSession`, or remove the entire
      scroll capture infrastructure (content script, `Tab.scrollPosition`, CAPTURE_SCROLL)

### Priority: Medium

- [ ] Replace `TG_COLOR_MAP` in HomeView.tsx with `import { GROUP_COLORS }` from core
- [ ] Add retroactive migration entries for all schema changes since v1.0.0; establish
      a migration-per-PR policy for all future storage type changes
- [ ] Extract `CurrentTabsPanel`, `TabGroupsPanel`, `HomeLiveGroupRow` from HomeView.tsx
      into separate files under `src/sidepanel/components/`
- [ ] Refactor `SessionDetailView.tsx` state (10+ variables) into a `useReducer`
- [ ] Standardize date formatting across all surfaces on a single utility function
- [ ] Fix `NewTabDB.clearAll()` to use the transaction `oncomplete` event for atomic clearing
- [ ] Add `build.sourcemap: 'hidden'` to `vite.config.ts`
- [ ] Add `manualChunks` configuration for React and dnd-kit vendor splitting
- [ ] Generate separate icon PNG files at 16, 32, 48, and 128px resolutions
- [ ] Fix underscore replacement in `generateSessionName()`: use `replace(/_/g, ' ')`
- [ ] Derive `tabCount` from `tabs.length` at read time; remove the stored denormalized field
- [ ] Register `chrome.idle.onStateChanged` listener only when `settings.saveOnSleep` is true
- [ ] Replace `setTimeout` focus workaround in HomeLiveGroupRow with a `useEffect` approach

### Priority: Low

- [ ] Split `newtab.store.ts` into domain-specific Zustand slices
- [ ] Gate verbose `console.warn/error` logs behind a `DEBUG` build flag
- [ ] Audit and complete i18n translations for `_locales/ar` and `_locales/de`
- [ ] Gate `npm run build` on a passing test run
- [ ] Remove or replace the `npm run preview` script
- [ ] Validate `tab.url` against safe URL schemes before passing to `chrome.tabs.create`
- [ ] Add `sender.id` validation in content script message handler

---

## 7. Quick Wins

High-impact improvements requiring minimal effort:

1. **Remove `TG_COLOR_MAP` in HomeView.tsx** — single-line import swap; eliminates a live
   maintenance hazard immediately.
2. **Fix `generateSessionName()` underscore replace** — change `replace('_', ' ')` to
   `replace(/_/g, ' ')` — one character, prevents future breakage.
3. **Pin `@crxjs/vite-plugin`** — remove the `^` caret from `"^2.0.0-beta.30"`; prevents
   silent build breakage on next `npm install`.
4. **Validate `win.id` in restore** — 2-line null check prevents an unhandled crash with a
   confusing error message.
5. **Add import payload size check** — one `if (payload.data.length > 5_000_000)` guard before
   JSON.parse prevents service worker OOM on corrupt or malicious imports.
6. **Replace sequential import writes with `Promise.all()`** — 1-line change; dramatically
   reduces import time for large files.
7. **Add `build.sourcemap: 'hidden'`** — one config line; makes future crash reports from the
   Web Store error dashboard debuggable.
8. **Add/remove `@dashboard` alias** — either add it to `vite.config.ts` or remove all
   references from CLAUDE.md; resolves the documentation–reality mismatch immediately.

---

## 8. Long-Term Improvements

### Architecture

**Implement a proper data access layer with IDB cursor queries.**
The current `getAll()` → in-memory filter pattern will not scale beyond a few hundred sessions.
A query layer using `IDBIndex` ranges would enable efficient date filtering, tag search, and
true server-side pagination, keeping latency <50ms regardless of total session count.

**Enforce the UI ↔ Service Worker boundary.**
Audit all UI surfaces for direct `@core` service imports. All session data access must go through
typed SW messages. Consider a typed request/response bus abstraction that makes violations
immediately visible at compile time.

**Resolve the Dashboard surface ambiguity.**
Either commit to building the full-page Dashboard (`src/dashboard/`, 5 pages, sidebar nav) as
documented, or formally retire it and promote the newtab sidebar panels as the canonical
management surface. Maintaining documentation that describes a non-existent surface erodes
developer trust in all project documentation.

**Complete or remove scroll restoration.**
A half-implemented feature that injects a content script on every website — with active memory
and permission costs — is worse than an absent feature. Deliver it completely or remove it
cleanly.

### Scalability

**Cursor-based pagination in IndexedDB.**
Implement a true cursor-based paginator so the first page of sessions loads in <50ms regardless
of total count. Store a cached count in metadata to avoid recomputing on every open.

**Wallpaper storage quota enforcement.**
Blobs in `newtab-db` can grow without bound. Add a total size check in `putBlob()` and surface
a user-visible warning when wallpaper storage exceeds a configurable threshold.

**Zustand store slicing for newtab.**
The monolithic `newtab.store.ts` becomes increasingly expensive as the widget count grows.
Slicing it into domain stores (`useBoardStore`, `useTodoStore`, `useSettingsStore`) is a
prerequisite for adding more start-tab widgets without degrading render performance.

### Developer Experience

**Add UI-layer and E2E tests.**
The 186 unit tests cover utilities, services, storage, and background logic well. Zero tests
exist for React views or end-to-end user flows (save session, restore session, auto-save
trigger). Add smoke-level integration tests for the most critical paths using
`@testing-library/react` with a mocked service worker.

**Resolve build toolchain debt.**
The rollup v2 override and the `@crxjs` beta plugin together represent compounding build risk.
Investing in a clean migration to a stable CRX build toolchain (evaluate
`vite-plugin-web-extension`) removes a fragile dependency that blocks routine dependency updates.

**Centralize keyboard shortcut registry.**
As shortcut count grows, a central registry (a typed map of key combo → action) prevents
collisions and makes `KeyboardHelpModal` self-maintaining. The current `Ctrl+Shift+S` collision
is a direct consequence of having no such registry.
