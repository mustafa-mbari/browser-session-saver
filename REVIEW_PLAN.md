# Browser Hub — Complete Architecture & Bug Review Plan

**Prepared by:** Senior Software Architect Review  
**Date:** 2026-04-19  
**Scope:** Chrome Extension (MV3) + Web App + Admin App  
**Purpose:** Phase 1 review plan — identifies issues for a fixing agent in Phase 2.  
**Rule:** This document contains NO code changes. It is read-only analysis and structured guidance.

---

## Table of Contents

1. [Review Strategy](#1-review-strategy)
2. [System-by-System Checklist](#2-system-by-system-checklist)
3. [Risk Matrix](#3-risk-matrix)
4. [Bug Detection Plan](#4-bug-detection-plan)
5. [Test Plan](#5-test-plan)
6. [Refactor Plan](#6-refactor-plan)

---

## 1. Review Strategy

### Overview

This codebase is a mature, multi-surface Chrome extension with two companion Next.js apps. The core logic is well-structured with clear abstractions (IRepository, ChromeLocalKeyAdapter, Zustand stores, typed message protocol). However, the system has a cluster of **concurrent-write vulnerabilities** that all stem from the same root cause: `chrome.storage.local` provides no atomic read-modify-write semantics, and no locking layer has been added to compensate.

Secondary risks center on **import/export data integrity** (no multi-module rollback), **service worker lifecycle edge cases** (async operations killed mid-flight), and **rate limiting correctness** (TOCTOU window between check and increment).

### Step-by-Step Execution Order

Phase 2 (fixing agent) should work in this order to avoid fixing symptoms before causes:

```
Step 1 → Fix concurrent write root cause (chrome.storage.local locking)
           └─ Affects: action_usage, guest_id, all ChromeLocalKeyAdapter callers

Step 2 → Fix TOCTOU in rate limiting
           └─ Affects: guardAction / trackAction split pattern

Step 3 → Fix import/export data integrity
           └─ Affects: full-import.service, newtab import clear-before-write

Step 4 → Fix service worker lifecycle edge cases
           └─ Affects: onSuspend async, tab cache write-order

Step 5 → Fix state management divergence
           └─ Affects: newtab-ui.store silent async failures, redundant derived state

Step 6 → Fix missing limit guards
           └─ Affects: UPDATE_SESSION_TABS handler

Step 7 → Fix guest identity race
           └─ Affects: getOrCreateGuestId concurrent callers

Step 8 → Clean up manifest and permissions
Step 9 → Add all missing tests
Step 10 → Verify end-to-end flows
```

---

## 2. System-by-System Checklist

### 2.1 Architecture Review

#### Separation of Concerns

- [ ] **A-01** Verify that no UI surface (`sidepanel/`, `newtab/`, `popup/`) imports directly from `@background/`. Confirm all mutations go through `chrome.runtime.sendMessage`.
- [ ] **A-02** Verify that `src/core/` has no imports from any UI surface (`@sidepanel/*`, `@newtab/*`, `@popup/*`).
- [ ] **A-03** Confirm that `SubscriptionStorage`, `PromptStorage`, and `TabGroupTemplateStorage` are NOT called from `src/background/event-listeners.ts`. These storage modules are UI-side only.
- [ ] **A-04** Check that `newtab-storage.ts` (NewTabDB singleton) is never imported by the service worker or sidepanel.
- [ ] **A-05** Verify that `supabase/client.ts` singleton is imported in exactly the right places — not in test code paths that stub it incorrectly.

#### Message Flow Correctness

- [ ] **A-06** Audit all 19 message action handlers in `event-listeners.ts`. Confirm every write-producing handler calls `guardAction()` before the mutation. **Known gap: `UPDATE_SESSION_TABS` (line ~515) has no `guardAction` or `trackAction` call.**
- [ ] **A-07** Confirm `UPDATE_SETTINGS` intentionally skips rate limiting and document this decision in code. Currently there is no comment explaining why.
- [ ] **A-08** Verify `MERGE_SESSIONS` handler calls `trackAction(sessions.length)` not `trackAction()`. Merging N sessions should count as N actions, not 1.
- [ ] **A-09** Confirm `RESTORE_SESSION` (read-like but creates Chrome tabs) is intentionally unmetered. If bulk-restoring is possible, it could open hundreds of tabs with no limit.
- [ ] **A-10** Verify every message handler that returns `{ success: false }` also includes a meaningful `error` string and, where applicable, a `limitStatus` for the UI to display.

#### Service Boundaries

- [ ] **A-11** Check whether `web/` and `admin/` share any code directly (e.g., imported utility modules). They should be fully independent — shared logic should live in a shared package or be duplicated intentionally.
- [ ] **A-12** Confirm the email system (`lib/email/`) is identical in both `web/` and `admin/`. If diverged, document the differences.

---

### 2.2 Data & Storage Review

#### IndexedDB Correctness

- [ ] **D-01** In `indexeddb-repository.ts` `replaceAll()` (line ~193): the operation clears the store then writes all records in a single IDB transaction. Verify that the IDB transaction wrapping both the `clear()` and all `put()` calls is truly a single transaction — if yes, it is atomic. If the `clear` is on one transaction and `put` calls are on another, there is a data-loss window.
- [ ] **D-02** Verify the `open()` method in `indexeddb-repository.ts` handles `onversionchange` (user opens a second tab that triggers an upgrade). The legacy adapter (`indexeddb.ts`) handles this (line 40-42) — confirm the repository version does too.
- [ ] **D-03** Confirm that soft-deleted sessions (with `deletedAt` set) are excluded from `getAll()` and `getByIndex()` but included in `getAllRaw()`. Check for any query path that would accidentally expose tombstones in the UI.
- [ ] **D-04** Verify that `getSessionRepository()` in `storage-factory.ts` returns the same singleton on every call. Check what happens if the IndexedDB connection is closed (e.g., schema upgrade in another tab) — does the factory reconnect or serve a stale closed handle?
- [ ] **D-05** In `newtab-storage.ts`, check if the `NewTabDB` singleton has an `onclose`/`onversionchange` handler. If not, opening the new-tab in two tabs simultaneously could cause one tab to silently fail all DB writes.

#### chrome.storage.local Race Conditions

- [ ] **D-06** **CRITICAL.** `ChromeLocalKeyAdapter.getAll()` + mutate + `setAll()` is NOT atomic. List every call site that follows this read-modify-write pattern across: `SubscriptionStorage`, `TabGroupTemplateStorage`, `PromptStorage`, `chrome-local-array-repository.ts`. Each is vulnerable to a lost-update when the extension is open in multiple surfaces simultaneously (sidepanel + new tab).
- [ ] **D-07** Confirm the `action_usage` key in `chrome.storage.local` is read-modify-written by `incrementAction()` with no lock. Test scenario: two tabs both trigger an action within 50ms. Count should be 2 but may be 1 due to the race.
- [ ] **D-08** Confirm the `cached_plan` key is only ever written by `cachePlanTier()` (single writer). Verify no other path writes to this key.
- [ ] **D-09** Check if `chrome.storage.local.set()` calls are ever batched (multiple keys in one call). Batching is safer than serial calls for atomicity.

#### Import / Export Completeness

- [ ] **D-10** Confirm `exportFullBackup()` reads from ALL data stores: sessions, settings, prompts + folders + categories + tags, subscriptions + categories, tab-group templates, and all 6 dashboard stores (boards, categories, entries, quickLinks, todoLists, todoItems). **From analysis: all 6 are included.** Verify dashboard settings are also captured.
- [ ] **D-11** Verify that `executeImport()` in `full-import.service.ts` does NOT auto-call `createAutoBackup()` before replace-mode imports. This is a risk: if sessions are cleared and prompts fail, there is no recovery. Verify whether calling code always creates a backup first.
- [ ] **D-12** Confirm that `runModuleImport()` error handling logs failures but does NOT roll back previously completed modules. If 3 of 6 modules succeed before a failure, the database is left in a partially updated state with no recovery path.
- [ ] **D-13** In `importDashboardFromJSON()` (called from `importDashboard()`): verify whether `clearDataStores()` and subsequent writes are in a single atomic operation or sequential separate operations. If sequential, a crash between clear and write loses all dashboard data.
- [ ] **D-14** Verify the export format version (`CURRENT_SCHEMA_VERSION`) is checked on import. If a v1 backup is imported into a v2+ schema, are missing fields handled gracefully or do they cause runtime errors?
- [ ] **D-15** Check whether sessions imported in merge mode regenerate IDs (to prevent UUID collisions with existing sessions). In the legacy `import.service.ts` IDs ARE regenerated; in `full-import.service.ts` they are preserved. Document which behavior is intended for each mode.

#### Data Duplication Risks

- [ ] **D-16** In the auto-save engine, `upsertAutoSaveSession()` finds the existing auto-save by `getByIndex('isAutoSave', true)` and takes the most recent. If two auto-save entries exist (e.g., from a previous bug), the second one is orphaned forever and grows stale. Verify a cleanup path exists.
- [ ] **D-17** In `importMany()`, records with duplicate IDs are silently overwritten (upsert). Verify this is the intended behavior for merge-mode imports, and that it is documented.

---

### 2.3 State Management Review

#### Zustand Store Consistency

- [ ] **S-01** In `sidepanel.store.ts`: `isSelectionMode` (line ~18) is stored state but is fully derivable from `selectedSessionIds.size > 0`. Storing it separately creates a consistency risk: if `selectedSessionIds` is updated without updating `isSelectionMode`, the UI enters an inconsistent state. Verify all code paths that modify `selectedSessionIds` also update `isSelectionMode`.
- [ ] **S-02** In `newtab-ui.store.ts`: `layoutMode` is stored at line ~23 AND derived from `settings.layoutMode` at line ~44. If `updateSettings({ layoutMode: 'focus' })` is called, does `layoutMode` state update correctly? Trace through `updateSettings()` — it calls `setSettings()` which updates the whole settings object. Confirm `layoutMode` stays in sync.
- [ ] **S-03** In `newtab-ui.store.ts` `updateSettings()` (line ~54): the call to `updateNewTabSettings(partial)` is fire-and-forget (`void` prefix). If the write fails, the store state reflects the new value but storage has the old value. On next reload, the setting reverts. Verify error handling exists.
- [ ] **S-04** Verify no Zustand store subscribes to `chrome.storage.onChanged` without unsubscribing on component unmount. A subscription that outlives the component will fire callbacks on a destroyed component, causing React state-update-after-unmount warnings.

#### UI vs Background Sync

- [ ] **S-05** The sidepanel `HomeView` and `SessionsPanel` read session data via messages to the background worker. After a `SAVE_SESSION` or `DELETE_SESSION` response, verify the store is re-fetched. Check whether the store auto-refreshes or whether the UI can show stale session data after a write.
- [ ] **S-06** When `LimitReachedModal` fires, it reads the `LimitStatus` from the error. Verify this status object is current at the time of the error — not stale from a prior `getLimitStatus()` call.
- [ ] **S-07** The `DashboardSidebar` listens to `chrome.storage.onChanged` for `cloud_sync_status`. Verify the listener is removed when the component unmounts (memory leak check).

#### Memory Leaks

- [ ] **S-08** Audit all `useEffect` hooks in sidepanel and newtab components for: `chrome.storage.onChanged.addListener` calls that do not have a corresponding `removeListener` in the cleanup return.
- [ ] **S-09** Audit all `chrome.runtime.onMessage.addListener` calls in UI code. These should only be in hooks with proper cleanup.
- [ ] **S-10** Check `focusSearch` callback stored in `sidepanel.store.ts` (line ~16). If a component sets this and then unmounts without clearing it, the stored function reference points to a destroyed component. Verify a cleanup convention exists.

---

### 2.4 Message System Review

#### Handler Coverage

- [ ] **M-01** All 19 message types are handled — confirmed by exploration. **Verify**: The message listener uses a discriminated union switch/dispatch. Confirm the default/fallback case returns `{ success: false, error: 'Unknown action' }` rather than `undefined` (which would leave the channel open forever if `return true` is used).
- [ ] **M-02** The message listener returns `true` to signal async response. Verify every code path inside `handleMessage()` eventually calls `sendResponse`. A code path that throws before `sendResponse` will cause the caller to wait indefinitely.
- [ ] **M-03** `GET_LIMIT_STATUS` handler exists but has no test. Verify it returns a `LimitStatus` object in the same shape as `getLimitStatus()`, not a raw storage object.

#### Payload Validation

- [ ] **M-04** Verify that `SAVE_SESSION` handler validates the incoming `session` payload. What happens if the UI sends a session with a missing `id`, null `tabs`, or an invalid `createdAt` date string? Does IndexedDB silently accept bad data?
- [ ] **M-05** Verify that `IMPORT_SESSIONS` validates the import payload before calling `importMany()`. A malformed import payload could corrupt the session store.
- [ ] **M-06** Verify that `MERGE_SESSIONS` validates that all session IDs in the request exist before starting the merge. Merging a non-existent session ID should return a clear error, not silently fail or create an orphaned record.
- [ ] **M-07** Confirm that `UPDATE_SESSION_TABS` validates the incoming tab array. Empty arrays, duplicate tab URLs, or null entries should be rejected before writing.

#### Type Safety

- [ ] **M-08** Verify the discriminated union `Message` type is exhaustive — that TypeScript would produce a compile error if a new message type was added to the type but not handled in the dispatcher. Check if the dispatcher uses `never` assertion on the default branch.

---

### 2.5 Background Service Worker Review

#### Lifecycle Correctness

- [ ] **B-01** Verify all Chrome event listeners are registered **synchronously** at the top level of `background/index.ts`, before any `await`. Chrome MV3 requires this — listeners registered after an `await` may not wake the service worker. **From analysis: this is correctly done.**
- [ ] **B-02** `chrome.runtime.onSuspend` fires when Chrome is about to kill the service worker. The handler calls `performAutoSave('shutdown')` without `await`. This is an **async function called in a synchronous context** — the SW will be killed before the save completes. Verify whether a synchronous fallback (using `chrome.storage.session` to flag a pending save) exists for this scenario.
- [ ] **B-03** The `_initialized` flag in `auto-save-engine.ts` prevents duplicate listener registration on SW restart. Verify this flag resets correctly when the module is re-imported after a full SW termination (module state is cleared on SW kill, so re-import gives `false` — correct).
- [ ] **B-04** The tab cache is persisted to `chrome.storage.session` via `persistTabCache()`. Verify this write is awaited before the SW suspends. If the SW suspends before `persistTabCache()` completes, the tab cache is lost and the next window-close save would have no data.

#### Auto-Save Correctness

- [ ] **B-05** `_isSaving` flag prevents concurrent saves. Non-critical triggers (timer, sleep, network) are dropped if a save is in progress. Verify that a timer-triggered save does not cause the loss of a window-close trigger that fires concurrently. **From analysis: window_close is queued as `_pendingCriticalTriggers` — verify this queue is not lost if SW is killed between the queue being populated and being processed.**
- [ ] **B-06** `upsertAutoSaveSession()` finds the existing auto-save by `getByIndex('isAutoSave', true)` and updates it. If the index query returns multiple results (e.g., from a past bug), only the most-recent is updated and the rest become orphaned. Verify a deduplication or cleanup path.
- [ ] **B-07** The merge-with-existing path in `upsertAutoSaveSession()` grows the session indefinitely by appending new URLs. Verify there is a max-tab-count guard to prevent unbounded session growth.
- [ ] **B-08** Battery trigger (`chrome.idle.onStateChanged`) fires when browser becomes idle. Verify that repeated idle→active→idle cycles don't trigger multiple back-to-back saves faster than the `_isSaving` guard can clear.

#### Alarm Reliability

- [ ] **B-09** The auto-save alarm is created with `chrome.alarms.create()`. Verify that on `chrome.runtime.onStartup`, the alarm is re-created if it doesn't exist. Chrome may clear alarms after browser restart.
- [ ] **B-10** Verify the alarm period matches the user's auto-save interval setting, and that changing the interval in settings immediately updates the alarm period.

---

### 2.6 Rate Limiting System Review

#### guardAction / trackAction Pattern

- [ ] **R-01** **CRITICAL TOCTOU.** `guardAction()` reads the limit status and throws if blocked. `trackAction()` later increments the counter. Between these two calls, another concurrent operation can also pass `guardAction()` with the same stale count, causing the limit to be exceeded. Verify whether this is an accepted risk (optimistic limiting) or a bug to fix.
- [ ] **R-02** **CRITICAL CONCURRENCY.** `incrementAction()` does a read-then-write on `action_usage`. Two rapid calls will both read the same count, both increment, and one write will overwrite the other. Net result: count increments by 1 instead of 2. Verify whether a serialization queue exists.
- [ ] **R-03** The daily counter resets automatically by comparing stored date to `todayDate()` in `getActionUsage()`. Verify `todayDate()` uses the same timezone consistently (UTC vs local). A timezone mismatch could cause the counter to reset at midnight UTC instead of midnight local time, or fail to reset for users in UTC+X timezones.
- [ ] **R-04** `trackAction(count)` can be called with `count > 1` (e.g., `trackAction(sessions.length)` for bulk saves). Verify `incrementAction(count)` correctly adds `count` to both daily and monthly counters, not just increments by 1 per call.
- [ ] **R-05** Verify that `MERGE_SESSIONS` calls `trackAction(sessions.length)` — currently it calls `trackAction()` (default count=1). Merging 5 sessions counts as 1 action, allowing users to bypass daily limits by merging instead of individually saving.

#### Guest Behavior

- [ ] **R-06** `fetchAndCacheGuestLimits()` is called at service worker startup. Verify it is also called after network reconnection (currently only fires on startup — if the user was offline at startup, guest limits stay at hardcoded defaults until next SW restart).
- [ ] **R-07** Dynamic guest limits are cached in `cached_guest_limits`. Verify there is no stale-cache scenario where old limits (higher than current) persist and allow more actions than intended.
- [ ] **R-08** Verify that when a guest user signs in, `clearGuestId()` is only called after a confirmed successful merge. **From analysis: `clearGuestId()` is called if `res.ok` — but if `clearGuestId()` itself throws, the exception is caught silently, leaving the guest ID in storage. Next sign-in will attempt merge again, double-counting usage.**

#### Supabase Sync Integrity

- [ ] **R-09** `syncUsageFromServer()` reconstructs `ActionUsage` from the `user_action_usage` table on sign-in. Verify the column names and data types match what `setActionUsage()` expects. A mismatch would silently reset the counter to 0 or an incorrect value.
- [ ] **R-10** `reportActionToSupabase()` is fire-and-forget. Verify that failed Supabase reports do NOT cause the local counter to be rolled back. The local counter must remain the authoritative source of truth.
- [ ] **R-11** Verify that the `mapPlanTier()` function in `auth.service.ts` maps ALL expected plan tier strings from the DB. If the DB contains `'premium'` and the map doesn't handle it, the user defaults to `'free'` — silent downgrade.

---

### 2.7 Sync & Cloud Interaction Review

#### Guest Identity

- [ ] **C-01** **CRITICAL RACE.** `getOrCreateGuestId()` does a read-then-write with no lock. If called from two concurrent code paths (e.g., `reportActionToSupabase()` called twice rapidly), two different guest IDs may be generated. One will be stored, the other used ephemerally. Usage reported under the ephemeral ID is orphaned. Verify how many call sites invoke `getOrCreateGuestId()`.
- [ ] **C-02** Verify `getGuestId()` (read-only) is used everywhere that only needs to READ the ID, and `getOrCreateGuestId()` is only called where ID creation is intended. If `getOrCreateGuestId()` is called in a read-only path, it may create a guest ID prematurely for users who will later sign in.

#### Plan Tier Caching

- [ ] **C-03** On `signOut()`, plan tier is reset to `'guest'` but `action_usage` is NOT reset. A user who was on Pro tier (50/day) and signs out will immediately hit the guest limit (3/day) on their next action. Verify whether this is intended.
- [ ] **C-04** `fetchAndCachePlanTier()` is fire-and-forget in `signIn()`. If the fetch completes 200ms after the user performs their first action post-login, `guardAction()` may still read `'guest'` tier and block a legitimate Pro user. Verify whether there is a loading state that prevents actions until the plan tier is confirmed.

#### Offline Behavior

- [ ] **C-05** Verify that ALL Supabase operations in the extension (auth, action tracking, plan fetch, merge-guest) have proper catch blocks that allow offline operation. The extension must remain fully functional with no network.
- [ ] **C-06** Verify `fetchAndCacheGuestLimits()` does not throw or reject in a way that prevents SW initialization when offline.
- [ ] **C-07** Verify `syncUsageFromServer()` does not overwrite a higher local usage count with a lower server count. If the user performed 10 actions offline since last sync, and the server shows 3, `setActionUsage()` would reset local count to 3 — allowing 7 more free actions.

#### Retry Logic

- [ ] **C-08** `mergeGuestOnSignIn()` silently catches all errors and relies on the guest ID persisting for a retry on next sign-in. Verify there is no scenario where the merge endpoint succeeds but returns a non-ok status (e.g., 409 Conflict), causing the guest ID to persist indefinitely and duplicate usage to be reported on every subsequent sign-in.

---

### 2.8 Import / Export Review

- [ ] **IE-01** Verify the full export JSON is a single atomic snapshot. `readSessions()`, `readPrompts()`, `readSubscriptions()` etc. are called in `Promise.all()`. If a user adds a session between the parallel reads, one data type may include it and another may not. Assess whether eventual consistency is acceptable here.
- [ ] **IE-02** Verify `executeImport()` in REPLACE mode automatically calls `createAutoBackup()` before any module is written. **From analysis: it does NOT.** The calling UI component must trigger this manually. If the UI skips it, data is irrecoverable.
- [ ] **IE-03** Verify that when `runModuleImport()` catches an error, it records the error AND continues with remaining modules. Confirm the final result object clearly indicates which modules succeeded and which failed.
- [ ] **IE-04** Verify the `previewImport()` function returns a clear, user-readable error for: invalid JSON, missing required top-level fields, wrong schema version, and truncated files.
- [ ] **IE-05** For session import in MERGE mode: verify that `importMany()` (bulk upsert) correctly handles sessions that have `deletedAt` set. Should tombstones from the import overwrite live local sessions? Confirm intended behavior.
- [ ] **IE-06** For dashboard import: confirm `clearDataStores()` and subsequent puts are wrapped in a mechanism that prevents data loss if the extension is suspended mid-write.
- [ ] **IE-07** Verify that `IMPORT_SESSIONS` message handler in `event-listeners.ts` calls `guardAction()` with the correct count (number of sessions being imported, not 1).

---

### 2.9 UI/UX Logic Review

- [ ] **U-01** `DashboardLayout.tsx` uses `isSessionView` to split layout branches. Verify all views that are full-page panels are correctly classified as session views and rendered in the `overflow-hidden h-full` branch, not the `overflow-y-auto px-[6%]` padded branch.
- [ ] **U-02** Verify `LimitReachedModal` is shown for ALL surfaces where `ActionLimitError` can be thrown: sidepanel background message responses, newtab direct storage calls (bookmarks, todos, prompts, subscriptions), and both sidepanel and newtab should show the modal.
- [ ] **U-03** When `guardAction()` throws inside a start-tab service call (e.g., `bookmark.service.ts`), the calling component must catch `ActionLimitError` and show the modal. Verify the error propagation chain for every service that calls `guardAction()`.
- [ ] **U-04** Verify `SessionsPanel` and `AutoSavesPanel` virtual scroll threshold (≤30 plain DOM, >30 virtualizer). Check whether the layout mode switch (minimal/focus/dashboard) causes the virtual scroll container to unmount and remount, triggering a full re-render and scroll position loss.
- [ ] **U-05** Verify `ContextMenu` keyboard navigation (Enter/Space open, Escape close, ArrowUp/Down/Home/End) works when the menu is opened near the bottom/right edge of the panel and repositions correctly.
- [ ] **U-06** Check loading states: when a message is in-flight to the background worker, does the UI show a spinner or disable buttons to prevent double-submission?
- [ ] **U-07** Check error boundary coverage. Verify `ErrorBoundary` wraps each major section. If a child of a session card throws, does the entire session list crash or just that card?

---

### 2.10 Performance Review

- [ ] **P-01** `getAll()` in `IndexedDBRepository` loads ALL sessions into memory. For users with thousands of sessions, this could be multiple MB. Verify whether paginated or cursor-based reads are available for large lists.
- [ ] **P-02** `getByIndex('isAutoSave', true)` is used to find the auto-save entry. This triggers a full index scan. Verify the `isAutoSave` index is actually defined in the IndexedDB schema (it should be, per architecture docs). If missing, it falls back to JS-level filtering of the entire sessions array.
- [ ] **P-03** The virtual scroll threshold of 30 items means a user with 31 sessions gets virtualizer instantiation. Verify that the virtualizer container div has a fixed height — without it, `@tanstack/react-virtual` renders all items.
- [ ] **P-04** `Promise.all()` in `exportFullBackup()` fires 6–7 parallel reads from different storage backends. Check whether parallel reads to IndexedDB and `chrome.storage.local` cause contention.
- [ ] **P-05** Zustand store state updates in the newtab dashboard (multiple widgets) — verify that adding/removing a widget does not trigger a full re-render of all other widgets. Check whether `useNewTabDataStore()` selector granularity is correct (subscribing to the whole store vs. a slice).
- [ ] **P-06** Check `chrome.alarms` frequency. The auto-save alarm and cloud-sync alarm (15 min) both run in the service worker. Verify they don't overlap in a way that triggers two expensive storage operations simultaneously.
- [ ] **P-07** `BookmarkCategoryCard.tsx` dispatches to multiple body components. Check whether the drag-and-drop context (`@dnd-kit`) re-renders the entire board on every drag move or only the affected cells.

---

### 2.11 Security Review

#### Token & Key Storage

- [ ] **SEC-01** Supabase session tokens (JWT access + refresh) are stored in `chrome.storage.local` via the `chromeAuthStorage` adapter. `chrome.storage.local` is NOT encrypted by default on all platforms. **Check:** On Windows/Mac, is Chrome's local storage encrypted at rest? Verify whether `chrome.storage.session` (encrypted, session-scoped) should be used for the JWT instead.
- [ ] **SEC-02** The Supabase anon key is embedded in the extension bundle via `VITE_SUPABASE_ANON_KEY`. It is visible to any user who inspects the extension. **This is expected for client-side Supabase apps but requires RLS to be the actual security layer.** Verify that ALL Supabase tables used by the extension have correct RLS policies that prevent cross-user data access.
- [ ] **SEC-03** `https://bh.mbari.de/*` is in `host_permissions`. Verify what this endpoint is used for and whether the JWT is sent to it. If a custom domain has weaker security than Supabase, token leakage could occur.

#### Permissions Audit

- [ ] **SEC-04** `topSites` permission — search entire codebase for `chrome.topSites`. If unused, remove it. Unused permissions are a security surface and may trigger Chrome Web Store review flags.
- [ ] **SEC-05** `https://*.supabase.co/*` is a wildcard matching ALL Supabase projects. If this extension is compromised, it could make requests to any Supabase project. Consider narrowing to the specific project URL: `https://<project-ref>.supabase.co/*`.
- [ ] **SEC-06** `history` is declared as optional permission. Verify no code path silently requests it. Optional permissions should only be requested via `chrome.permissions.request()` with user consent.

#### XSS Risks

- [ ] **SEC-07** The new-tab page renders user-controlled content (bookmark titles, note content, todo text). Verify these are rendered as text nodes (React's `{}` interpolation), not `dangerouslySetInnerHTML`. If any bookmark title contains `<script>`, React should escape it automatically — confirm no `dangerouslySetInnerHTML` usage in newtab components.
- [ ] **SEC-08** Session names and tab titles are rendered in the sidepanel and new-tab. Tab titles come from `chrome.tabs.query()` — they include page titles from any website. Verify these are never injected as raw HTML.
- [ ] **SEC-09** The CSP `script-src 'self'` prevents inline scripts. Verify no component uses `eval()`, `new Function()`, or dynamic `import()` with user-provided strings. Template literal injection via `eval` would bypass CSP.
- [ ] **SEC-10** Prompt content (from the prompt manager) is displayed and potentially inserted into pages. Verify prompt variable substitution (`{{variable}}` → user input) sanitizes the output before display.

#### Extension-Specific

- [ ] **SEC-11** The `activeTab` permission grants access to the currently active tab. Verify this is only used in focused, user-initiated actions (not in background alarms or auto-save).
- [ ] **SEC-12** Verify the popup and new-tab page do not use `chrome.scripting.executeScript()` with user-provided code.

---

### 2.12 Testing Coverage Review

#### Coverage Gaps (Confirmed Missing)

- [ ] **T-01** `action-tracker.test.ts`: No concurrent `incrementAction()` test. Must add: call `incrementAction()` twice with `Promise.all()` and verify final count is 2.
- [ ] **T-02** `limit-guard.test.ts`: No TOCTOU scenario. Must add: mock `getLimitStatus` to return unblocked, then call `guardAction()` twice concurrently, then verify `incrementAction` was called twice and final count reflects both.
- [ ] **T-03** `event-listeners.test.ts`: No test for `UPDATE_SESSION_TABS` being unguarded. Must add: verify handler succeeds even when daily limit is reached (documenting the intentional/unintentional bypass).
- [ ] **T-04** `event-listeners.test.ts`: No test for `GET_LIMIT_STATUS`. Must add: verify it returns correct structure.
- [ ] **T-05** No test for `SAVE_SESSION` with `allWindows=true`. Must add: verify `trackAction(sessions.length)` is called, not `trackAction()`.
- [ ] **T-06** No test for `MERGE_SESSIONS` tracking count. Must add: verify `trackAction(N)` is called when merging N sessions.
- [ ] **T-07** No test for `getOrCreateGuestId()` concurrent calls. Must add: two simultaneous calls, verify only one ID is created and persisted.
- [ ] **T-08** No test for `mergeGuestOnSignIn()` when `clearGuestId()` fails after a successful merge response. Must add: verify guest ID is NOT cleared when `clearGuestId()` throws.
- [ ] **T-09** No test for `syncUsageFromServer()` where server count is lower than local count. Must add: verify server count does NOT overwrite a higher local count.
- [ ] **T-10** No test for the import/export rollback absence. Must add: simulate `importSessions()` succeeding and `importPrompts()` failing — verify the final DB state is documented (sessions imported, prompts not, no rollback).
- [ ] **T-11** No test for `replaceAll()` being atomic — verify that if the put phase fails, the cleared store is not left empty.
- [ ] **T-12** No test for `newtab-ui.store.ts` `updateSettings()` when the underlying write fails. Must add: verify store state diverges from storage, and document this as a known issue until fixed.
- [ ] **T-13** No test for `onSuspend` handler not awaiting `performAutoSave`. Must add: verify the save is initiated (mock called) even if SW is killed before completion.
- [ ] **T-14** `auto-save-engine.test.ts`: Verify `_pendingCriticalTriggers` queue is processed after `_isSaving` clears. Must add: simulate a window-close trigger while a timer save is in progress and verify the window-close save runs after.

#### Mocking Correctness

- [ ] **T-15** Verify all tests mocking `@core/services/limits/limit-guard` use `vi.hoisted()` to ensure the mock is set up before module initialization. Incorrect mock order causes the real implementation to run.
- [ ] **T-16** Verify all tests that import `auth.service.ts` or `guest.service.ts` mock both: `vi.mock('@core/services/guest.service', ...)` and Supabase client.
- [ ] **T-17** Verify `chrome.storage.local` mock in `tests/setup.ts` accurately simulates concurrent access (it probably serializes calls, masking the real race conditions).

---

## 3. Risk Matrix

| ID | Issue | Area | Severity | Likelihood | Impact | Priority |
|----|-------|------|----------|------------|--------|----------|
| RM-01 | `incrementAction()` read-modify-write race | Rate Limiting | CRITICAL | High | Silent limit bypass | P0 |
| RM-02 | `getOrCreateGuestId()` concurrent call creates duplicate IDs | Guest Tracking | CRITICAL | Medium | Orphaned usage data | P0 |
| RM-03 | TOCTOU between `guardAction()` check and `trackAction()` write | Rate Limiting | CRITICAL | Medium | Limit exceeded silently | P0 |
| RM-04 | `ChromeLocalKeyAdapter` read-modify-write in multi-tab scenario | Storage | CRITICAL | Medium | Lost subscription/prompt/tab-group writes | P0 |
| RM-05 | `replaceAll()` — clear then write not verified as single transaction | Storage | HIGH | Low | Full session wipe on crash | P1 |
| RM-06 | `executeImport()` no multi-module rollback | Import | HIGH | Medium | Partial import, no recovery | P1 |
| RM-07 | Dashboard `clearDataStores()` then write — two-phase, not atomic | Import | HIGH | Low | Dashboard wipe on interrupted import | P1 |
| RM-08 | `onSuspend` handler calls async save without `await` | SW Lifecycle | HIGH | High | Shutdown save never completes | P1 |
| RM-09 | `updateSettings()` in newtab store is fire-and-forget | State Mgmt | HIGH | Medium | Silent setting persistence failure | P1 |
| RM-10 | `mergeGuestOnSignIn()` clearGuestId fails after successful merge | Guest | HIGH | Low | Duplicate usage merged on each sign-in | P1 |
| RM-11 | `UPDATE_SESSION_TABS` has no `guardAction` | Rate Limiting | MEDIUM | High | Limit bypass for tab edits | P2 |
| RM-12 | `MERGE_SESSIONS` counts as 1 action regardless of N merged | Rate Limiting | MEDIUM | High | Limit bypass via bulk merge | P2 |
| RM-13 | `syncUsageFromServer()` may overwrite higher local count | Sync | MEDIUM | Medium | Free actions granted after sync | P2 |
| RM-14 | `auto-save` grows session indefinitely (no max-tab guard) | Auto-save | MEDIUM | Medium | Memory bloat in long sessions | P2 |
| RM-15 | `isSelectionMode` derived state stored redundantly | State Mgmt | MEDIUM | Low | UI inconsistency on partial state update | P2 |
| RM-16 | `layoutMode` derived from settings but stored separately | State Mgmt | MEDIUM | Low | Setting update doesn't sync layout | P2 |
| RM-17 | `createAutoBackup()` not called automatically before replace import | Import | MEDIUM | Medium | User loses data without warning | P2 |
| RM-18 | No schema version check on import | Import | MEDIUM | Low | Old backup silently corrupts new schema | P2 |
| RM-19 | `topSites` permission unused | Security | LOW | Confirmed | Unnecessary permission surface | P3 |
| RM-20 | `https://*.supabase.co/*` wildcard too broad | Security | LOW | Low | Over-granted fetch permissions | P3 |
| RM-21 | JWT in `chrome.storage.local` (unencrypted on some platforms) | Security | LOW | Low | Token readable by other local extensions | P3 |
| RM-22 | Supabase anon key in extension bundle | Security | LOW | Confirmed | Requires RLS to be security layer | P3 |
| RM-23 | `focusSearch` callback in sidepanel store not always cleared | State Mgmt | LOW | Low | Stale function reference after unmount | P3 |
| RM-24 | `_pendingCriticalTriggers` queue lost if SW killed mid-save | SW Lifecycle | LOW | Low | One window-close save missed | P3 |

**Priority Key:**
- **P0** — Data integrity or security critical, must fix before any release
- **P1** — High risk of data loss or silent failure, fix in next sprint
- **P2** — Behavioral bugs, limit bypasses, UX degradation, fix soon
- **P3** — Technical debt, cleanup, low-probability edge cases

---

## 4. Bug Detection Plan

### Strategy

Use this systematic approach to find bugs beyond what static analysis revealed:

### 4.1 Concurrency Bug Reproduction

**Setup required:** Two Chrome tabs open simultaneously — one with the sidepanel, one with the new tab page. Both must be authenticated as the same user.

```
TEST-CONCURRENT-01: Lost counter write
  1. Set daily limit to a known value (mock or use guest tier = 3)
  2. In Tab A: trigger an action (e.g., add a bookmark)
  3. In Tab B: trigger an action (e.g., add a todo) simultaneously
  4. Expected: action_usage.daily.count = 2
  5. Actual (bug): count = 1 (one write lost)
  Detection: chrome.storage.local.get('action_usage') after both complete

TEST-CONCURRENT-02: Lost subscription write
  1. Have 3 subscriptions
  2. In Tab A: edit subscription 1
  3. In Tab B: edit subscription 2 simultaneously  
  4. Expected: both edits saved
  5. Actual (bug): one edit overwritten by the other
  Detection: reload both tabs, verify both edits persisted

TEST-CONCURRENT-03: Duplicate guest ID
  1. Clear guest_id from storage
  2. Call getOrCreateGuestId() from two promises concurrently in same SW
  3. Expected: same ID returned from both
  4. Actual (bug): two different IDs, last write wins in storage
```

### 4.2 Import/Export Data Integrity

```
TEST-IMPORT-01: Partial import failure
  1. Export full backup
  2. Corrupt the prompts section of the JSON (make it invalid)
  3. Import with REPLACE mode
  4. Expected: all modules fail or rollback
  5. Actual (bug): sessions, settings imported; prompts fail; no rollback
  Detection: verify sessions were deleted even though import "failed"

TEST-IMPORT-02: Dashboard import interruption
  1. Export full backup with dashboard data
  2. Mock clearDataStores() to succeed, then make the first put() throw
  3. Import dashboard
  4. Expected: rollback or error without data loss
  5. Actual (bug): dashboard cleared, partial data written

TEST-IMPORT-03: No auto-backup in replace mode
  1. Start replace-mode import
  2. Do NOT call createAutoBackup() manually
  3. Verify whether the UI warns the user or silently proceeds
  4. Expected: mandatory backup prompt
  5. Actual: unclear — depends on calling code
```

### 4.3 Rate Limit Bypass

```
TEST-LIMIT-01: MERGE bypass
  1. Use guest tier (3 actions/day limit)
  2. Perform 2 normal actions (used = 2)
  3. Merge 10 sessions in one operation
  4. Expected: blocked at 3rd action (before merge)
  5. Actual: merge succeeds, trackAction counts as 1 (used = 3, not 12)
  6. Perform 2 more normal actions
  7. Expected: blocked at daily limit
  8. Actual (bug): only 1 count was added for 10-session merge

TEST-LIMIT-02: UPDATE_SESSION_TABS bypass
  1. Reach daily limit (used = 3 for guest)
  2. Try UPDATE_SESSION_TABS message
  3. Expected: blocked by guardAction
  4. Actual: succeeds (no guard on this handler)

TEST-LIMIT-03: TOCTOU bypass
  1. Guest tier, 2/3 actions used
  2. Call guardAction() from two concurrent contexts simultaneously
  3. Both check: dailyUsed=2, limit=3 → not blocked → both proceed
  4. Both call trackAction() → count = 4 (2 over limit)
  Detection: requires 2 simultaneous SW message dispatches
```

### 4.4 Service Worker Lifecycle

```
TEST-SW-01: Shutdown save incomplete
  1. Enable auto-save on browser close
  2. Trigger chrome.runtime.onSuspend (simulate via devtools or sw restart)
  3. Check if auto-save entry exists and was updated
  4. Expected: save completed with current tabs
  5. Actual (risk): save may not complete before SW is killed

TEST-SW-02: Alarm persistence after browser restart
  1. Set auto-save interval to 5 minutes
  2. Fully restart Chrome
  3. Wait 5 minutes
  4. Verify auto-save fired
  Expected: alarm was recreated on startup
  Risk: alarm may have been cleared

TEST-SW-03: Tab cache after SW kill
  1. Open 3 windows
  2. Force-kill the service worker (chrome://serviceworker-internals/)
  3. Close one window
  4. Check if the auto-save for that window fires
  Expected: tab cache rehydrated, save proceeds
  Risk: stale or empty cache
```

### 4.5 State Divergence

```
TEST-STATE-01: Settings persistence failure
  1. Mock updateNewTabSettings() to throw an error
  2. Change a setting in the newtab UI
  3. UI updates immediately (Zustand store)
  4. Reload extension
  5. Expected: old setting appears (persisted state)
  6. Expected UX: error shown or retry triggered
  Actual: setting reverts with no UI feedback

TEST-STATE-02: Plan tier race on sign-in
  1. Sign in as Pro user
  2. Immediately (< 200ms) perform an action
  3. Verify action succeeds (not blocked as guest)
  Risk: plan tier fetch is fire-and-forget, may not be cached before action
```

---

## 5. Test Plan

### New Tests Required Before Any Fix

All tests listed below must be written and passing **before Phase 2 fixes** are applied. They will initially fail (or reveal bugs) and pass after fixes.

### 5.1 Rate Limiting Tests

**File:** `tests/unit/services/limits/action-tracker.test.ts`

```
[NEW] concurrently incrementing action twice should result in count of 2
  - Call incrementAction() twice with Promise.all()
  - Mock storage to simulate real async delay
  - Assert final count = 2, not 1

[NEW] incrementAction with count=5 should add 5 to both daily and monthly
  - Setup count = 0
  - Call incrementAction(5)
  - Assert daily.count = 5, monthly.count = 5

[NEW] daily reset at midnight should not affect monthly count
  - Setup daily.date = yesterday, monthly.month = current month, count = 15
  - Call getActionUsage()
  - Assert daily.count = 0, monthly.count = 15

[NEW] getLimitStatus with timezone edge case
  - Mock Date to return midnight UTC on a day boundary
  - Verify todayDate() returns the correct local date
```

**File:** `tests/unit/services/limits/limit-guard.test.ts`

```
[NEW] two concurrent guardAction calls at limit-1 should both proceed
  - Setup dailyUsed = 2, limit = 3
  - Call guardAction() from two concurrent contexts
  - Verify both resolve without throwing
  - Verify trackAction was called twice
  - Verify final count = 4 (documents the TOCTOU bug)

[NEW] trackAction with count=3 should call incrementAction(3)
  - Call trackAction(3)
  - Verify incrementAction was called with argument 3
```

### 5.2 Background / Event Listener Tests

**File:** `tests/unit/background/event-listeners.test.ts`

```
[NEW] UPDATE_SESSION_TABS should succeed even when daily limit is reached
  - Mock getLimitStatus to return dailyBlocked: true
  - Send UPDATE_SESSION_TABS message
  - Verify response is { success: true } (documents the unguarded behavior)

[NEW] MERGE_SESSIONS should call trackAction with sessions.length not 1
  - Mock trackAction
  - Send MERGE_SESSIONS with 5 sessions
  - Verify trackAction was called with argument 5

[NEW] SAVE_SESSION with allWindows=true should call trackAction with window count
  - Mock windows and tabs
  - Send SAVE_SESSION with allWindows: true
  - Verify trackAction was called with correct count

[NEW] GET_LIMIT_STATUS should return LimitStatus object
  - Mock getLimitStatus to return known status
  - Send GET_LIMIT_STATUS message
  - Verify response matches LimitStatus shape

[NEW] unknown action type should return { success: false, error: string }
  - Send message with action: 'NONEXISTENT_ACTION'
  - Verify response is { success: false } with error message
```

### 5.3 Guest Service Tests

**File:** `tests/unit/services/guest.service.test.ts`

```
[NEW] concurrent getOrCreateGuestId calls should return the same ID
  - Start with no guest_id in storage
  - Call getOrCreateGuestId() twice simultaneously
  - Both should resolve to the same ID
  - Storage should have exactly one guest_id

[NEW] clearGuestId should remove guest_id from storage
  - Setup guest_id in storage
  - Call clearGuestId()
  - Verify storage key is gone

[NEW] getGuestId should return null when no ID exists
  - Empty storage
  - Call getGuestId()
  - Verify null returned (not undefined, not error)
```

### 5.4 Auth Service Tests

**File:** `tests/unit/services/auth.service.test.ts`

```
[NEW] signIn should call fetchAndCachePlanTier with user ID
  - Mock Supabase signIn to succeed
  - Verify fetchAndCachePlanTier called (even fire-and-forget)

[NEW] signIn when fetchAndCachePlanTier fails should still return success
  - Mock fetchAndCachePlanTier to throw
  - Verify signIn still returns { success: true }

[NEW] mergeGuestOnSignIn when clearGuestId throws should keep guest_id
  - Mock fetch to return ok: true
  - Mock clearGuestId to throw
  - Verify guest_id still in storage after call

[NEW] syncUsageFromServer should not overwrite higher local count
  - Setup local count = 10
  - Mock server to return count = 3
  - Verify final count remains 10 or higher (documents the issue)
```

### 5.5 Import / Export Tests

**File:** `tests/unit/services/import-export/full-import.service.test.ts`

```
[NEW] executeImport should continue on single module failure (no rollback)
  - Mock importPrompts to throw
  - Verify result.errors includes prompts
  - Verify sessions were still imported (no rollback)

[NEW] executeImport in replace mode without prior backup should warn or auto-backup
  - Verify createAutoBackup is called before clear, or calling code is responsible

[NEW] previewImport with corrupted JSON should return clear error
  - Pass malformed JSON
  - Verify result.valid = false with specific error message

[NEW] importSessions in merge mode should not regenerate IDs
  - Import sessions with known IDs
  - Verify stored sessions have the same IDs
```

### 5.6 Storage Tests

**File:** `tests/unit/storage/chrome-local-key-adapter.test.ts`

```
[NEW] concurrent save calls should not lose writes
  - Setup 2 entities
  - Save both concurrently
  - Verify both are in storage (documents the race condition bug)
```

### 5.7 Zustand Store Tests

**File:** `tests/unit/stores/newtab-ui.store.test.ts`

```
[NEW] updateSettings when write fails should still update store state
  - Mock updateNewTabSettings to throw
  - Call updateSettings partial
  - Verify store state updated (documents the divergence)
  - Verify no error is thrown to caller

[NEW] layoutMode should stay in sync with settings.layoutMode
  - Call setSettings with layoutMode: 'focus'
  - Verify both settings.layoutMode and layoutMode store field are 'focus'
```

---

## 6. Refactor Plan

> This section identifies WHERE the architecture is weak and WHAT must change structurally. No code is suggested — only the intent.

### RF-01: Introduce a Write Serializer for `chrome.storage.local`

**Problem:** `chrome.storage.local` has no atomic read-modify-write. Every caller that reads, mutates, and writes back is susceptible to lost updates under concurrent access (sidepanel + new tab simultaneously).

**What needs to exist:** A queue-based serializer that wraps all read-modify-write operations on the same storage key. Concurrent writes to the same key must be serialized through this queue. Writes to different keys can remain parallel.

**Scope of change:** `ChromeLocalKeyAdapter`, `action-tracker.ts`, `guest.service.ts`, and any other location that does `get → mutate → set` on a `chrome.storage.local` key.

---

### RF-02: Atomic Pattern for Rate Limit Check + Increment

**Problem:** The `guardAction()` + `trackAction()` pattern has a TOCTOU window. The check and the increment are two separate, non-atomic operations.

**What needs to exist:** A single `checkAndIncrementAction()` function that reads the usage, checks limits, increments if allowed, and writes back — all as one serialized operation (benefiting from RF-01). `guardAction()` and `trackAction()` become thin wrappers around this single atomic operation.

**Scope of change:** `limit-guard.ts`, `action-tracker.ts`.

---

### RF-03: Multi-Module Import Transaction

**Problem:** `executeImport()` runs modules sequentially with no rollback. A failure in module 4 leaves modules 1–3 permanently written with no recovery.

**What needs to exist:** Either:
- (a) A pre-flight backup that is automatically created before any REPLACE-mode import and automatically restored on partial failure.
- (b) An all-or-nothing pre-validation step that verifies all modules can be parsed successfully before any write begins.

Option (b) is preferred — validate all data, then write all modules. The validation (already partially done in `previewImport()`) needs to be extended to cover all module data, not just the overall structure.

**Scope of change:** `full-import.service.ts`, `previewImport()`, `executeImport()`.

---

### RF-04: Eliminate Derived State from Zustand Stores

**Problem:** `isSelectionMode` in `sidepanel.store` and `layoutMode` in `newtab-ui.store` are stored state that is fully derivable from other stored state. Having two sources of truth creates synchronization bugs.

**What needs to exist:** These should be computed properties (Zustand `getState()` selectors or derived with `useMemo` in components). No stored state should exist for values that can be derived from other state.

**Scope of change:** `sidepanel.store.ts`, `newtab-ui.store.ts`, and all components reading these fields.

---

### RF-05: Error Propagation in Store Mutations

**Problem:** Async store mutations (`updateSettings()` in `newtab-ui.store`) are fire-and-forget. Silent failures cause state divergence — the UI shows a value that isn't persisted. On reload, the user sees their change reverted with no explanation.

**What needs to exist:** Store actions that call async persistence functions must:
1. Await the persistence call.
2. Either show an error toast on failure (optimistic) or revert the store state on failure (pessimistic).

The chosen pattern (optimistic vs pessimistic) must be applied consistently across ALL store mutations.

**Scope of change:** All Zustand store actions that call async storage functions.

---

### RF-06: Guest ID Creation Idempotency

**Problem:** `getOrCreateGuestId()` is not idempotent under concurrency. Two concurrent calls can produce two guest IDs.

**What needs to exist:** Guest ID creation should use the write serializer from RF-01. Alternatively, the creation check should use a CAS (compare-and-swap) pattern: only write the ID if the storage key is still absent at write time. Since `chrome.storage.local` doesn't support CAS natively, the serializer from RF-01 is the practical solution.

**Scope of change:** `guest.service.ts`.

---

### RF-07: Service Worker Shutdown Save

**Problem:** `chrome.runtime.onSuspend` calls an async function without awaiting. The SW is killed before the save completes.

**What needs to exist:** On `onSuspend`, the tab state (current open tabs and groups) should be synchronously written to `chrome.storage.session` (which is synchronous-ish and survives SW kill) before any async IndexedDB write begins. On the next SW startup, `chrome.runtime.onStartup` should check for a pending-shutdown flag in session storage and complete the deferred save.

**Scope of change:** `background/index.ts` (onSuspend handler), `auto-save-engine.ts` (startup rehydration), `alarms.ts` (startup check).

---

### RF-08: Import Validation Schema Versioning

**Problem:** Imported backup files have no schema version validation beyond a top-level version string. Old backups may have missing fields that cause silent runtime errors when the new code expects them.

**What needs to exist:** A versioned migration layer in `previewImport()` that detects the backup version and either migrates it to current schema or rejects it with a clear error and guidance.

**Scope of change:** `full-import.service.ts`, `previewImport()`.

---

### RF-09: Permission Hygiene

**Problem:** `topSites` permission appears unused. `https://*.supabase.co/*` is broader than needed.

**What needs to exist:**
- Remove `topSites` if unused (search codebase for `chrome.topSites`).
- Narrow Supabase host permission to the project-specific URL.
- Document `https://bh.mbari.de/*` with a comment explaining its purpose.

**Scope of change:** `public/manifest.json`.

---

### RF-10: Consistent Loading States in UI

**Problem:** Some message-in-flight scenarios lack loading indicators, allowing double-submission of actions while the background worker processes the first.

**What needs to exist:** A consistent pattern for "pending action" state in the Zustand stores and a shared loading indicator component. The pattern should make it impossible to submit a second action while the first is in-flight to the background worker.

**Scope of change:** `sidepanel.store.ts`, key action components in `sidepanel/views/` and `newtab/components/`.

---

## Appendix: Files Requiring the Most Attention in Phase 2

These files have the highest density of confirmed issues and should be reviewed first:

| File | Issues | Priority |
|------|--------|----------|
| `src/core/services/limits/action-tracker.ts` | RM-01, RM-03 (concurrent write, TOCTOU) | P0 |
| `src/core/services/guest.service.ts` | RM-02 (concurrent guest ID creation) | P0 |
| `src/core/storage/chrome-local-key-adapter.ts` | RM-04 (all callers race-prone) | P0 |
| `src/core/services/limits/limit-guard.ts` | RM-03, RM-05, RM-12 | P0–P2 |
| `src/core/services/import-export/full-import.service.ts` | RM-06, RM-07, RM-17, RM-18 | P1 |
| `src/background/index.ts` | RM-08 (onSuspend async) | P1 |
| `src/newtab/stores/newtab-ui.store.ts` | RM-09, RM-16 | P1 |
| `src/core/services/auth.service.ts` | RM-10, RM-13 | P1 |
| `src/background/event-listeners.ts` | RM-11, RM-12 | P2 |
| `public/manifest.json` | RM-19, RM-20 | P3 |

---

*End of Review Plan — 12 systems reviewed, 87 checklist items, 24 risk entries, 14 reproduction tests, 22 new test cases required, 10 refactor targets identified.*
