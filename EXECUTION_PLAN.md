# Browser Hub — Practical Execution Plan for Fixing Agent

**Prepared by:** Senior Engineering Lead  
**Input:** REVIEW_PLAN.md (2026-04-19)  
**Purpose:** Executable task plan for a fixing AI agent. Supersedes the review plan's execution order.  
**Rule:** Read each task group fully before starting it. Do not skip the verification layer.

---

## Pre-Flight: False Positives Removed

Two issues from the review plan were **verified as non-issues** and must NOT be fixed:

| Review ID | Claim | Actual State | Action |
|-----------|-------|--------------|--------|
| RM-05 | `replaceAll()` not atomic — data loss risk | **FALSE.** `store.clear()` and all `store.put()` calls share the exact same `tx` object (verified lines 196–207 of `indexeddb-repository.ts`). IDB transactions are atomic by spec. | Ignore. Do not touch. |
| RM-19 | `topSites` permission unused | **FALSE.** Used in `src/core/services/quicklinks.service.ts` and `src/newtab/components/FrequentlyVisitedPanel.tsx` for the "Frequently Visited" panel. | Ignore. Do not remove. |

---

## Table of Contents

1. [Verification Layer — Read Before Fixing](#1-verification-layer)
2. [Phase 1 — Critical Concurrent Writes](#2-phase-1--critical-concurrent-writes)
3. [Phase 2 — Rate Limiting Correctness](#3-phase-2--rate-limiting-correctness)
4. [Phase 3 — Import Safety & SW Lifecycle](#4-phase-3--import-safety--sw-lifecycle)
5. [Phase 4 — State, UI & Cleanup](#5-phase-4--state-ui--cleanup)
6. [Safe Fix Order](#6-safe-fix-order)
7. [Minimal Fix Strategy](#7-minimal-fix-strategy)

---

## 1. Verification Layer

Before writing any fix, the agent must verify these items by **reading the actual code**. Each item is either a confirmed bug, a design decision to document, or a potential false positive.

### 1.1 Must Verify Before Phase 1

| ID | File | What to Read | Question | Expected Outcome |
|----|------|-------------|----------|-----------------|
| V-01 | `src/core/storage/chrome-local-key-adapter.ts` | Full file | Is the adapter stateless? Does it do read-modify-write itself, or do callers do it? | Adapter is stateless (only getAll/setAll). The race is in callers. |
| V-02 | `src/core/services/limits/action-tracker.ts` lines 33–40 | `incrementAction()` body | Does it do `get → increment → set` in sequence? Is there any lock, mutex, or queue? | Confirmed no lock. Get + set are two separate async calls. |
| V-03 | `src/core/services/guest.service.ts` lines 10–17 | `getOrCreateGuestId()` body | Does it do `get → generate → set` with no guard? | Confirmed no lock. Two concurrent callers can generate two IDs. |
| V-04 | `src/core/storage/chrome-local-key-adapter.ts` callers | Run grep for `adapter.getAll()` or `this.getAll()` across `subscription-storage.ts`, `tab-group-template-storage.ts`, `prompt-storage.ts`, `chrome-local-array-repository.ts` | How many read-modify-write call sites exist? | Likely 15–25 sites across 4 files. |

### 1.2 Must Verify Before Phase 2

| ID | File | What to Read | Question | Expected Outcome |
|----|------|-------------|----------|-----------------|
| V-05 | `src/core/services/limits/limit-guard.ts` lines 18–34 | Full `guardAction()` and `trackAction()` functions | Is there any mechanism that binds the check to the increment atomically? | No. They are fully independent async calls. TOCTOU confirmed. |
| V-06 | `src/background/event-listeners.ts` lines 401–430 | `handleMergeSessions()` | Does it call `trackAction()` with `sessions.length` or without any argument? | Line 427: `void trackAction()` — no count argument. Confirmed bug. |
| V-07 | `src/background/event-listeners.ts` lines 515–559 | `handleUpdateSessionTabs()` | Is there any `guardAction()` or `trackAction()` call anywhere in this function? | None. Confirmed unguarded write. |
| V-08 | `src/core/services/auth.service.ts` lines 87–103 | `syncUsageFromServer()` | Does it compare server count vs. local count before writing, or does it write unconditionally? | Line 99: `await setActionUsage(usage)` — unconditional overwrite. Confirmed bug. |

### 1.3 Must Verify Before Phase 3

| ID | File | What to Read | Question | Expected Outcome |
|----|------|-------------|----------|-----------------|
| V-09 | `src/core/services/import-export/full-import.service.ts` | `executeImport()` and `runModuleImport()` bodies | If `importPrompts()` throws, are previously-written modules (sessions, settings) rolled back? | No rollback. Confirmed. |
| V-10 | Wherever `importDashboardFromJSON` is defined | The `clearDataStores()` call and subsequent writes | Are these in the same IndexedDB transaction, or sequential separate operations? | Likely sequential — two separate operations. **If they are in the same IDB transaction, this is safe and the fix described in Phase 3 is not needed for this specific path.** |
| V-11 | `src/background/index.ts` | The `chrome.runtime.onSuspend` handler | Does it `await` the `performAutoSave()` call or call it without await? | Called without await. Confirmed bug. |
| V-12 | `src/background/auto-save-engine.ts` | `upsertAutoSaveSession()` | Is there a max-tab-count cap anywhere in the merge path? | Likely none. Verify before deciding to add a cap. |

### 1.4 Must Verify Before Phase 4

| ID | File | What to Read | Question | Expected Outcome |
|----|------|-------------|----------|-----------------|
| V-13 | `src/newtab/stores/newtab-ui.store.ts` lines 50–60 | `updateSettings()` action | Is the `updateNewTabSettings()` call awaited, or is it fire-and-forget via `void`? | `void` prefix — fire-and-forget. Confirmed. |
| V-14 | `src/sidepanel/stores/sidepanel.store.ts` | All code paths that modify `selectedSessionIds` | Does every path also set `isSelectionMode`? | Check `toggleSelection()`, `clearSelection()`, `selectSession()`. |
| V-15 | `src/newtab/stores/newtab-ui.store.ts` | `updateSettings()` partial update | When `updateSettings({ layoutMode: 'focus' })` is called, does the top-level `layoutMode` field also update? | Check whether `setSettings` is called inside `updateSettings` or whether partial merge skips the top-level field. |
| V-16 | Grep for `chrome.storage.onChanged.addListener` in `src/sidepanel/` and `src/newtab/` | All listener registrations | Does each `addListener` call have a matching `removeListener` in a `useEffect` cleanup? | May have leaks in `DashboardSidebar` and `HomeView`. |

---

## 2. Phase 1 — Critical Concurrent Writes

**Goal:** Eliminate the root cause of all race conditions: unprotected read-modify-write operations on `chrome.storage.local`.

**Risk Level:** CRITICAL — data loss in production today  
**Blocks:** Phase 2 (the atomic rate-limit fix depends on this)  
**Run tests after:** `npm test` must pass before moving to Phase 2

---

### Task Group 1A — Write Serializer

**Files to modify:**
- `src/core/storage/chrome-local-key-adapter.ts` — add per-key queue
- `src/core/services/limits/action-tracker.ts` — adopt the serializer
- `src/core/services/guest.service.ts` — adopt the serializer

**Tasks:**

```
1A-01  Create a per-key serializer utility
       - Location: src/core/storage/storage-mutex.ts (new file)
       - It must queue concurrent read-modify-write operations on the same key
       - Operations on different keys must NOT block each other
       - Implementation: a Map<string, Promise> where each key's pending operation
         chains via .then() — no external libraries
       - The queue must drain itself (no memory leak after operations complete)
       - Export: withStorageLock(key: string, fn: () => Promise<T>): Promise<T>

1A-02  Apply the serializer to ChromeLocalKeyAdapter
       - Wrap any read-modify-write pattern inside withStorageLock(key, ...)
       - The adapter itself (getAll/setAll) does not need the lock
       - The lock must be applied at the call sites that do get → mutate → set
       - Audit these 4 files for all read-modify-write sites:
           src/core/storage/chrome-local-array-repository.ts
           src/core/storage/subscription-storage.ts
           src/core/storage/tab-group-template-storage.ts
           src/core/storage/prompt-storage.ts
       - Wrap EACH read-modify-write block in withStorageLock(STORAGE_KEY, ...)
       - Do NOT wrap read-only calls (getAll used for display only)

1A-03  Apply the serializer to incrementAction()
       - In src/core/services/limits/action-tracker.ts
       - The STORAGE_KEY for this lock is 'action_usage'
       - The entire read-modify-write in incrementAction() must be inside
         withStorageLock('action_usage', async () => { ... })
       - Do NOT lock getLimitStatus() or getActionUsage() — they are read-only

1A-04  Apply the serializer to getOrCreateGuestId()
       - In src/core/services/guest.service.ts
       - The STORAGE_KEY for this lock is 'guest_id'
       - The entire read-check-write in getOrCreateGuestId() must be inside
         withStorageLock('guest_id', async () => { ... })
       - getGuestId() and clearGuestId() do NOT need the lock
         (single-operation reads/writes are already atomic in chrome.storage.local)
```

**Tests to write first (T-01, T-07 from review plan):**
```
File: tests/unit/storage/storage-mutex.test.ts (new)
  - Two concurrent withStorageLock calls on same key serialize correctly
  - Two concurrent calls on different keys execute in parallel
  - Lock releases after fn throws (no deadlock)

File: tests/unit/services/limits/action-tracker.test.ts (add)
  - Call incrementAction() twice with Promise.all() → final count must be 2

File: tests/unit/services/guest.service.test.ts (add)
  - Call getOrCreateGuestId() twice concurrently → both return same ID
  - Storage has exactly one guest_id after concurrent calls
```

**Verification before marking done:**
- `npm test` passes
- Manually verify `withStorageLock` does not deadlock if `fn` rejects

---

### Task Group 1B — Guest Merge Partial Success

**Files to modify:**
- `src/core/services/auth.service.ts` — `mergeGuestOnSignIn()`

**Tasks:**

```
1B-01  Fix mergeGuestOnSignIn() partial-success handling
       - Current bug: if res.ok but clearGuestId() throws, the guest ID
         persists and the merge re-runs on next sign-in (double-counting)
       - Fix: wrap clearGuestId() in its own try/catch inside the res.ok block
       - If clearGuestId() fails, log the error but do not propagate
       - The merge endpoint is idempotent (returns { merged: false } on second call)
         so re-running is safe, but the double-count risk on non-idempotent servers
         must be documented
       - Add a comment explaining idempotency assumption
```

**Tests to write first (T-08 from review plan):**
```
File: tests/unit/services/auth.service.test.ts (add)
  - mergeGuestOnSignIn: mock fetch ok:true, mock clearGuestId to throw
  - Verify: no exception thrown from mergeGuestOnSignIn
  - Verify: guest_id still in storage (clearGuestId failed, ID preserved for retry)
```

---

## 3. Phase 2 — Rate Limiting Correctness

**Goal:** Make the rate-limiting system correct: atomic check+increment, accurate counts, no bypass paths.

**Risk Level:** HIGH — limit bypass in production  
**Depends on:** Phase 1 (1A-03 must be complete — incrementAction must be serialized)  
**Run tests after:** `npm test` must pass before moving to Phase 3

---

### Task Group 2A — Atomic Check + Increment

**Files to modify:**
- `src/core/services/limits/limit-guard.ts`
- `src/core/services/limits/action-tracker.ts`

**Tasks:**

```
2A-01  Merge guardAction + trackAction into a single atomic operation
       - Add a new internal function: checkAndIncrementAction(count: number)
         in action-tracker.ts (not exported initially)
       - This function MUST run entirely inside withStorageLock('action_usage', ...)
       - Inside the lock:
           1. Read current usage (getActionUsage logic inline, not a separate call)
           2. Check limits (same logic as getLimitStatus, inline)
           3. If blocked: throw ActionLimitError with current status
           4. If allowed: write incremented counts back to storage
           5. Return the updated LimitStatus
       - Update guardAction() to call checkAndIncrementAction(1) and throw on block
       - Update trackAction(count) to... (see 2A-02)

2A-02  Simplify trackAction after merging into guardAction
       - DECISION POINT: with 2A-01 complete, guardAction now both checks AND increments
       - trackAction() must no longer increment the local counter (already done)
       - trackAction() should ONLY fire the Supabase report (reportActionToSupabase)
       - Rename or document this clearly: trackAction = "report to remote"
       - All existing call sites that call both guardAction() + trackAction() must
         be updated: guardAction() alone handles local increment; trackAction() is
         only for remote reporting
       - DO NOT remove trackAction() from call sites — Supabase reporting still needed
       - Update all 8 call sites in event-listeners.ts and any service-level callers

2A-03  Document the new pattern in a code comment at the top of limit-guard.ts
       - Explain: guardAction() checks + increments atomically (local, under lock)
       - trackAction() reports to Supabase (fire-and-forget, remote only)
       - The two must always be called in this order, and trackAction only after
         a successful (non-throwing) guardAction
```

**Tests to write first (T-02 from review plan):**
```
File: tests/unit/services/limits/limit-guard.test.ts (add)
  - Two concurrent guardAction calls at limit-1: first succeeds, second throws
    (after fix, the atomic operation means the second must see the incremented count)
  - trackAction with count=3 reports count=3 to Supabase (not local increment)
  - guardAction() at exact limit blocks the next call immediately (no TOCTOU window)
```

---

### Task Group 2B — Count Accuracy

**Files to modify:**
- `src/background/event-listeners.ts`

**Tasks:**

```
2B-01  Fix MERGE_SESSIONS to pass session count to guardAction
       - In handleMergeSessions() (line ~401):
       - guardAction() is called ONCE with no count → must check if N sessions
         can all be performed
       - Option A (recommended): call guardAction(sessions.length) — let the atomic
         check validate that the user has sessions.length actions remaining
         This requires checkAndIncrementAction to accept count > 1 and check that
         current + count <= limit before any increment
       - Option B (simpler): call guardAction() once per session in a loop
         (less efficient but simpler to reason about)
       - Remove the separate trackAction() call at line 427 (now handled by guardAction)
       - Add trackAction() after success for Supabase reporting only

2B-02  Add guardAction + trackAction to UPDATE_SESSION_TABS
       - In handleUpdateSessionTabs() (lines 515–559):
       - Add await guardAction() immediately after the session-not-found check
       - Add void trackAction() before the return statement
       - DECISION NEEDED: should tab-update count as 1 action or N tabs?
         Use count=1 (one session update = one action) unless product says otherwise
       - Document the decision with a comment
```

**Tests to write first (T-03, T-05, T-06 from review plan):**
```
File: tests/unit/background/event-listeners.test.ts (add)
  - MERGE_SESSIONS with 5 sessions: verify guardAction called with count=5
  - UPDATE_SESSION_TABS: verify guardAction is called
  - UPDATE_SESSION_TABS at daily limit: verify { success: false, limitStatus }
  - SAVE_SESSION allWindows=true: verify guardAction called with window count
```

---

### Task Group 2C — Server Sync Safety

**Files to modify:**
- `src/core/services/auth.service.ts`

**Tasks:**

```
2C-01  Fix syncUsageFromServer() overwrite of higher local count
       - Current bug: line 99 calls setActionUsage(usage) unconditionally
       - If user did 10 offline actions and server shows 3, local resets to 3
       - Fix: before writing, read current local usage via getActionUsage()
       - Only overwrite if server count >= local count for BOTH daily AND monthly
       - If server count is lower for either dimension, keep the local value
       - This preserves the principle: local is the authoritative source of truth;
         server sync is additive only
       - Add a comment explaining this invariant
```

**Tests to write first (T-09 from review plan):**
```
File: tests/unit/services/auth.service.test.ts (add)
  - syncUsageFromServer: server daily=3, local daily=10 → local stays at 10
  - syncUsageFromServer: server daily=15, local daily=3 → local updates to 15
  - syncUsageFromServer: server monthly higher, daily lower → each dimension uses max
```

---

## 4. Phase 3 — Import Safety & SW Lifecycle

**Goal:** Prevent data loss during import operations and on browser shutdown.

**Risk Level:** HIGH — data loss possible but lower-probability than Phase 1/2  
**Depends on:** Phases 1 and 2 complete and tests passing  
**Run tests after:** `npm test` must pass before moving to Phase 4

---

### Task Group 3A — Import Integrity

**Files to modify:**
- `src/core/services/import-export/full-import.service.ts`

**Tasks:**

```
3A-01  Move full validation before any write in executeImport()
       - Current flow: validate → write module 1 → write module 2 → ... → fail
       - Required flow: validate ALL modules → if all valid: write ALL modules
       - Extend previewImport() or add a new validateAllModules() that parses
         every selected module's data and returns errors without writing
       - executeImport() must call validateAllModules() first
       - If validation returns errors for ANY selected module: return early
         with { success: false, errors } — write NOTHING
       - EXCEPTION: merge mode — validation failures for individual modules
         should be reported but not necessarily block other modules
         (merging partial data is safer than replacing with partial data)
       - For REPLACE mode: any validation error = full abort (no writes at all)

3A-02  Force auto-backup before REPLACE-mode writes
       - In executeImport(), when mode === 'replace':
       - Call createAutoBackup() BEFORE the first module write
       - If createAutoBackup() fails: abort with clear error
         "Backup failed — import aborted to prevent data loss"
       - Do not proceed without a successful backup in replace mode
       - In merge mode: auto-backup is recommended but should NOT abort on failure
         (merge is safer; user data is not fully replaced)

3A-03  Add clear per-module status to the return value
       - Ensure executeImport() result includes { moduleName: 'success' | 'failed' | 'skipped' }
         for each module, not just a flat errors array
       - The UI should be able to show "Sessions: ✓, Settings: ✓, Prompts: ✗"
```

**Regarding RM-07 (dashboard clearDataStores atomicity):**

Before implementing any fix here, the agent MUST verify V-10:
- If `clearDataStores()` and the subsequent puts are already in a single IDB transaction → **no fix needed**
- If they are sequential operations → wrap them in a single transaction or add the pre-validation approach

```
3A-04  [CONDITIONAL — only if V-10 confirms two-phase write]
       Wrap clearDataStores + puts in a single IDB transaction for dashboard import
       - If newtab storage uses a multi-store IDB, the clear and writes must share
         one transaction to be atomic
       - If this is not architecturally possible with the current newtab-storage API,
         add an auto-backup before dashboard clear (same pattern as 3A-02)
```

**Tests to write first (T-10, T-11 from review plan):**
```
File: tests/unit/services/import-export/full-import.service.test.ts (add)
  - executeImport REPLACE mode: prompts invalid → verify sessions NOT written
  - executeImport REPLACE mode: all valid → verify backup created first
  - executeImport: verify per-module status in return value
```

---

### Task Group 3B — Service Worker Shutdown

**Files to modify:**
- `src/background/index.ts`
- `src/background/auto-save-engine.ts`

**Tasks:**

```
3B-01  Fix the onSuspend async-without-await problem
       - Verify V-11 first (confirmed: performAutoSave called without await)
       - Chrome MV3 does not support awaiting in onSuspend — the SW is killed
         immediately after the handler returns
       - Solution: on onSuspend, synchronously write a "shutdown pending" flag
         to chrome.storage.session (fast, synchronous-style via callback)
       - The flag should include: { pendingShutdownSave: true, timestamp: Date.now() }
       - Then kick off performAutoSave as fire-and-forget (current behavior, keep it)
         It may or may not complete — that's acceptable
       - On chrome.runtime.onStartup: check for pendingShutdownSave flag
       - If found AND timestamp < 30 minutes ago: trigger a deferred shutdown save
         using the tab cache (rehydrated from chrome.storage.session)
       - Clear the flag after the deferred save completes or after 30 min timeout

3B-02  Verify tab cache write ordering
       - Verify V-04 (tab cache persist path): confirm persistTabCache() is awaited
         before onSuspend could fire, OR confirm it runs quickly enough
       - If tab cache writes are deferred in ways that lose data on SW kill,
         move the tab cache write to be synchronous in the onTabUpdate handler
         (store to chrome.storage.session immediately on every tab change)
       - This is a "write-through" strategy: always current in session storage
```

**Tests to write first (T-13, T-14 from review plan):**
```
File: tests/unit/background/auto-save-engine.test.ts (add)
  - onSuspend: verify pendingShutdownSave written to chrome.storage.session
  - onStartup with pendingShutdownSave flag: verify deferred save triggered
  - Window-close trigger while timer save in progress: verify window-close queued
    and processed after _isSaving clears
```

---

## 5. Phase 4 — State, UI & Cleanup

**Goal:** Fix state management divergence, remove dead code, address low-priority security items.

**Risk Level:** MEDIUM–LOW  
**Depends on:** Phases 1–3 complete  
**Run tests after:** Full `npm test` suite

---

### Task Group 4A — Store Error Handling

**Files to modify:**
- `src/newtab/stores/newtab-ui.store.ts`

**Tasks:**

```
4A-01  Fix updateSettings() fire-and-forget
       - Verify V-13 (confirmed: void prefix, no await, no error handling)
       - Choose ONE strategy and apply it consistently:

       Strategy A (Optimistic + Revert on failure — RECOMMENDED):
         - Capture the previous state before updating
         - Update store optimistically
         - Await the persistence call
         - On failure: revert store to previous state AND show error toast
         - Benefit: user sees instant feedback, error is surfaced clearly

       Strategy B (Pessimistic — wait before updating):
         - Await persistence first
         - Only update store after successful write
         - On failure: keep old store state, show error
         - Drawback: UI feels sluggish on every settings change

       The chosen strategy must be documented in a comment in the store
       and applied to ALL other async mutations in newtab-ui.store.ts

4A-02  Remove redundant layoutMode field (verify V-15 first)
       - Verify that layoutMode stored separately is causing actual desync
       - If setSettings() already updates the layoutMode field correctly
         in the same set() call, the risk is low and this can be deferred
       - Only remove if V-15 confirms a real desync scenario
       - If removing: update all component consumers of layoutMode to read
         from settings.layoutMode instead
```

---

### Task Group 4B — Derived State Cleanup

**Files to modify:**
- `src/sidepanel/stores/sidepanel.store.ts`

**Tasks:**

```
4B-01  Verify and optionally remove isSelectionMode (verify V-14 first)
       - Run V-14: confirm all paths that modify selectedSessionIds
         also correctly set isSelectionMode
       - If ALL paths are correct: the stored field is redundant but not buggy
         Add a comment documenting: "isSelectionMode === selectedSessionIds.size > 0"
       - If ANY path modifies selectedSessionIds without updating isSelectionMode:
         Fix that path. Then replace isSelectionMode with a derived getter.
       - To replace with derived: add a Zustand selector that returns
         state.selectedSessionIds.size > 0, update all components reading it
```

---

### Task Group 4C — Memory Leak Audit

**Files to audit (read-only first, then fix):**
- All files matching `src/sidepanel/**/*.tsx`
- All files matching `src/newtab/**/*.tsx`

**Tasks:**

```
4C-01  Audit chrome.storage.onChanged.addListener in useEffect hooks
       - Grep for: chrome\.storage\.onChanged\.addListener
       - For each match: verify the useEffect return function calls removeListener
         with the EXACT SAME function reference
       - Common mistake: adding a new arrow function vs. removing a stored reference
       - Fix any addListener calls without a matching cleanup

4C-02  Audit chrome.runtime.onMessage.addListener in UI code
       - Grep for: chrome\.runtime\.onMessage\.addListener in src/sidepanel, src/newtab
       - These must only appear inside useEffect with cleanup, or inside hooks
         that return cleanup functions
       - Any top-level or component-body registrations are leaks

4C-03  Fix focusSearch cleanup in sidepanel store
       - Verify V-14 related: when the component that sets focusSearch unmounts,
         it must call setFocusSearch(null) or equivalent
       - Add to the component's useEffect cleanup if missing
```

---

### Task Group 4D — Security Cleanup

**Files to modify:**
- `public/manifest.json`
- `src/core/supabase/client.ts` (comment only)

**Tasks:**

```
4D-01  Narrow Supabase host_permissions
       - Current: "https://*.supabase.co/*" (all projects)
       - Replace with the specific project URL from VITE_SUPABASE_URL
       - If the URL is injected at build time, use a build-time replacement
         or set the specific project ref as a constant

4D-02  Document bh.mbari.de in manifest
       - Add a comment in manifest.json explaining why this host is needed
       - If it is a custom backend/edge function host, document what JWT is sent
       - If unused: remove it

4D-03  Document the anon key security model
       - In src/core/supabase/client.ts, add a comment:
         "Anon key is intentionally client-side. Security is enforced by
          Supabase RLS policies, not by key secrecy."
       - This documents the design intent and prevents future devs from thinking
         it's a mistake

4D-04  Verify dangerouslySetInnerHTML usage
       - Grep for: dangerouslySetInnerHTML in src/newtab and src/sidepanel
       - If found: audit each usage, confirm the content is not user-controlled
       - If user content can reach dangerouslySetInnerHTML: sanitize with DOMPurify
         or switch to text rendering
       - React's {} interpolation is safe — only dangerouslySetInnerHTML is a risk
```

---

### Task Group 4E — Test Coverage Completion

**Files to create or modify:**

```
4E-01  Add missing tests from review plan
       Priority order (high to low):

       ALREADY COVERED by earlier phases (tests written in Phase 1–3):
       - T-01, T-07: incrementAction concurrency, getOrCreateGuestId race
       - T-02: guardAction TOCTOU (now atomic, test the new behavior)
       - T-03, T-05, T-06: event-listeners limits
       - T-08: mergeGuestOnSignIn clearGuestId failure
       - T-09: syncUsageFromServer local-wins
       - T-10, T-11: import rollback documentation

       STILL NEEDED in Phase 4:
       - T-04: GET_LIMIT_STATUS handler returns correct LimitStatus shape
       - T-12: updateSettings() store-diverges-on-error (after 4A-01 fix, test
               the new behavior: error shown, state reverted)
       - T-13, T-14: SW lifecycle (after 3B-01 fix, these should now pass)
       - T-15: Verify vi.hoisted() used in all limit-guard mocks
       - T-16: Verify guest.service mock in auth tests
       - T-17: Document that chrome.storage mock serializes calls (known limitation)

4E-02  Verify mock correctness in existing tests
       - Check all files that mock @core/services/limits/limit-guard
       - Verify vi.hoisted() is used to declare the mock before module init
       - Fix any mocks that use vi.mock() without vi.hoisted() for the factory
```

---

## 6. Safe Fix Order

This is the exact sequence for the fixing agent. Each step depends on the previous.

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Write storage-mutex.ts                                  │
│  → No existing code changes. Safe to add first.                  │
│  → Run: npm test (all pass — no code changed yet)                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 2: Write failing tests for Phase 1 (1A + 1B)               │
│  → Tests fail. This documents the bugs before fixing.            │
│  → DO NOT fix yet. Just verify tests fail as expected.           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 3: Apply 1A-02 → ChromeLocalKeyAdapter callers             │
│  → Apply to chrome-local-array-repository.ts first (broadest)   │
│  → Then subscription-storage.ts, prompt-storage.ts,             │
│     tab-group-template-storage.ts                                │
│  → Run: npm test after each file                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 4: Apply 1A-03 → incrementAction serialization             │
│  → One function change in action-tracker.ts                      │
│  → Run: npm test — Phase 1 action-tracker tests should pass      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 5: Apply 1A-04 → getOrCreateGuestId serialization          │
│  → One function change in guest.service.ts                       │
│  → Apply 1B-01 → mergeGuestOnSignIn clearGuestId safety          │
│  → Run: npm test — all Phase 1 tests pass                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 6: Write failing tests for Phase 2 (2A + 2B + 2C)         │
│  → Tests for TOCTOU, MERGE count, UPDATE_SESSION_TABS guard,     │
│     syncUsageFromServer local-wins                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 7: Apply 2A-01 → checkAndIncrementAction atomic            │
│  → This is the most complex change. Work in action-tracker.ts    │
│    first, keep existing public API intact                        │
│  → Apply 2A-02 → simplify trackAction                            │
│  → Update all 8+ call sites in event-listeners.ts               │
│  → Run: npm test — Phase 2 atomic tests should pass             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 8: Apply 2B-01, 2B-02 → count accuracy fixes              │
│  → MERGE_SESSIONS count, UPDATE_SESSION_TABS guard               │
│  → Run: npm test                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 9: Apply 2C-01 → syncUsageFromServer local-wins           │
│  → One logic change in auth.service.ts                          │
│  → Run: npm test                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 10: Apply 3A-01, 3A-02, 3A-03 → import integrity          │
│  → Validate before write, force backup before replace            │
│  → Run: npm test                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 11: Verify V-10 (dashboard atomicity)                      │
│  → If sequential: apply 3A-04                                    │
│  → Apply 3B-01, 3B-02 → SW shutdown save                        │
│  → Run: npm test                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  STEP 12: Phase 4 — State, UI, Security, Tests                   │
│  → 4A-01 first (settings error handling)                        │
│  → 4B, 4C, 4D in any order (independent of each other)         │
│  → 4E last (complete test coverage)                              │
│  → Final: npm test — ALL tests pass                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Minimal Fix Strategy

### Fix Immediately (P0 — Before Next Release)

These four issues share a root cause. Fixing RF-01 (storage serializer) resolves RM-01, RM-02, and RM-04 as a group. Do not fix them individually.

| What | Why | Task |
|------|-----|------|
| Storage write serializer | Root cause of 3 P0 races | 1A-01 through 1A-04 |
| Atomic check+increment | TOCTOU in rate limiting | 2A-01, 2A-02 |
| MERGE_SESSIONS count | Trivial fix, high bypass risk | 2B-01 |
| UPDATE_SESSION_TABS guard | One-line add, high bypass risk | 2B-02 |

### Fix Soon (P1 — Next Sprint)

| What | Why | Task |
|------|-----|------|
| Import pre-validation + auto-backup | Silent data loss on replace import | 3A-01, 3A-02 |
| onSuspend deferred save | Shutdown save currently no-ops | 3B-01 |
| updateSettings() error handling | Silent state divergence | 4A-01 |
| syncUsageFromServer local-wins | Server sync can grant free actions | 2C-01 |
| mergeGuestOnSignIn clearGuestId | Double-merge on repeated sign-in | 1B-01 |

### Delay (P2–P3 — After Core Is Stable)

| What | Why | Task |
|------|-----|------|
| layoutMode/isSelectionMode derived state | Low actual bug probability | 4A-02, 4B-01 |
| Memory leak audit | No confirmed crash/leak in production | 4C-01 through 4C-03 |
| Supabase permission narrowing | Aesthetic security improvement | 4D-01 |
| Schema version validation on import | Only an issue with very old backups | RF-08 |
| Auto-save unbounded growth | Add cap only after verifying limit needed | V-12 |

### Do Not Touch (False Positives or Design Decisions)

| What | Reason |
|------|--------|
| `replaceAll()` in indexeddb-repository.ts | Already atomic (verified). Touching it risks introducing a real bug. |
| `topSites` in manifest.json | In active use. Removing it breaks FrequentlyVisitedPanel. |
| Supabase anon key in bundle | Expected behavior for client-side Supabase. Fix is on the RLS side, not the code. |
| JWT in chrome.storage.local | Chrome encrypts this on all modern platforms. Migrating to session storage would break cross-tab auth. |
| `onSuspend` not awaiting save | Can't be fixed by adding await — Chrome doesn't support it. Only workaround is the flag+deferred approach in 3B-01. |
| `history` optional permission | Correctly guarded by chrome.permissions.request(). No change needed. |

---

## Appendix: Quick Reference

### Files Touched Across All Phases

| File | Phase | Change Type |
|------|-------|-------------|
| `src/core/storage/storage-mutex.ts` *(new)* | 1 | New utility |
| `src/core/storage/chrome-local-array-repository.ts` | 1 | Wrap RMW in lock |
| `src/core/storage/subscription-storage.ts` | 1 | Wrap RMW in lock |
| `src/core/storage/tab-group-template-storage.ts` | 1 | Wrap RMW in lock |
| `src/core/storage/prompt-storage.ts` | 1 | Wrap RMW in lock |
| `src/core/services/limits/action-tracker.ts` | 1, 2 | Serialize + atomic check |
| `src/core/services/guest.service.ts` | 1 | Serialize getOrCreate |
| `src/core/services/auth.service.ts` | 1, 2 | clearGuestId safety + local-wins sync |
| `src/core/services/limits/limit-guard.ts` | 2 | Atomic pattern, doc update |
| `src/background/event-listeners.ts` | 2 | MERGE count, UPDATE_SESSION_TABS guard |
| `src/core/services/import-export/full-import.service.ts` | 3 | Pre-validate + auto-backup |
| `src/background/index.ts` | 3 | onSuspend flag pattern |
| `src/background/auto-save-engine.ts` | 3 | Startup deferred save check |
| `src/newtab/stores/newtab-ui.store.ts` | 4 | Error handling in updateSettings |
| `src/sidepanel/stores/sidepanel.store.ts` | 4 | isSelectionMode (if desync confirmed) |
| `public/manifest.json` | 4 | Permission narrowing, comments |
| `src/core/supabase/client.ts` | 4 | Comment only |

### Tests to Write (by Phase)

| Phase | Test File | Count |
|-------|-----------|-------|
| 1 | `tests/unit/storage/storage-mutex.test.ts` (new) | 3 |
| 1 | `tests/unit/services/limits/action-tracker.test.ts` | 2 |
| 1 | `tests/unit/services/guest.service.test.ts` | 3 |
| 1 | `tests/unit/services/auth.service.test.ts` | 2 |
| 2 | `tests/unit/services/limits/limit-guard.test.ts` | 3 |
| 2 | `tests/unit/background/event-listeners.test.ts` | 5 |
| 2 | `tests/unit/services/auth.service.test.ts` | 3 |
| 3 | `tests/unit/services/import-export/full-import.service.test.ts` | 3 |
| 3 | `tests/unit/background/auto-save-engine.test.ts` | 3 |
| 4 | Various remaining from T-04 to T-17 | ~8 |
| **Total** | | **~35 new tests** |

---

*End of Execution Plan — 4 phases, 12 task groups, 30 discrete tasks, 2 confirmed false positives removed, safe fix order defined.*
