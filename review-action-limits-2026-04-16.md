# Code Review — Action-Based Limits Implementation
**Date:** 2026-04-16  
**Scope:** All files created or modified as part of the cloud-sync removal and action-limit redesign.  
**Method:** Two independent static-analysis passes + cross-validation against actual source code.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | Fixed in this review pass |
| High | 3 | Fixed in this review pass |
| Medium | 3 | Fixed (indexes) / Documented |
| Low | 2 | Fixed (defensiveness) / Documented |

---

## Critical

### C1 — Limit bypass via three uncovered mutation handlers
**File:** `src/background/event-listeners.ts`

Three handlers performed mutations but called neither `guardAction()` nor `trackAction()`, allowing users to circumvent daily/monthly limits entirely:

| Handler | Lines | Bypass |
|---------|-------|--------|
| `handleMergeSessions` | 393–418 | Creates a new session from merged sources |
| `handleUndeleteSession` | 382–391 | Re-inserts a previously deleted session |
| `handleImportSessions` | 366–379 | Bulk-saves all parsed sessions at once |

**Fix applied:** Added `await guardAction()` before each mutation and `void trackAction()` after. Import is treated as one action (consistent with the `allWindows` save pattern). New tests added to `event-listeners.test.ts` covering the blocked path for all three handlers.

---

## High

### H1 — `parseInt` without radix in admin quota editor
**File:** `admin/app/(admin)/quotas/page.tsx` line 45

```typescript
// Before
return parseInt(val)

// After
const n = parseInt(val, 10);
return isNaN(n) ? null : n;
```

Without a radix, strings beginning with `0` (e.g. `"08"`) are parsed as octal on some engines, yielding `0`. Non-numeric input produces `NaN`, which Supabase may reject with a type error or silently store as `null`, corrupting plan limits with no error surfaced to the admin.

**Fix applied:** Added explicit radix `10` and an `isNaN` guard.

---

### H2 — Unchecked `chrome.runtime.lastError` in limit-status message sends
**Files:** `src/sidepanel/components/Header.tsx` line 16, `src/newtab/components/DashboardSidebar.tsx` ~line 282

In MV3 the background service worker can be terminated while inactive. When a UI component calls `chrome.runtime.sendMessage` and the SW is down, Chrome fires the callback with `undefined` and marks `chrome.runtime.lastError`. The existing guard `if (r?.success && r.data)` handles the `undefined` case safely (the pill simply stays hidden), but not reading `chrome.runtime.lastError` causes Chrome to print an unchecked-error warning in DevTools. This console noise can mask real errors.

**Fix applied:** Added `void chrome.runtime.lastError;` inside both callbacks to explicitly acknowledge the error.

---

### H3 — Race condition in `incrementAction()` (documented, not fixed)
**File:** `src/core/services/limits/action-tracker.ts` lines 32–38

The read → increment → write sequence is not atomic:

```typescript
const usage = await getActionUsage();          // read
const updated = { daily: { count: + 1 }, … }; // compute
await chrome.storage.local.set(…);            // write
```

Two concurrent calls from different extension contexts (e.g. sidepanel and background SW simultaneously) can both read `count: 2` and both write `count: 3`, losing one increment.

**Why not fixed now:** In practice each user operates from a single extension context at a time. The impact is one lost count on rare simultaneous saves. A robust fix (advisory lock or serialisation queue) adds meaningful complexity for marginal gain. This is **documented here** as a known limitation; revisit if concurrent context usage becomes common.

---

## Medium

### M1 — Missing indexes on `user_action_usage` date columns
**File:** `supabase/migrations/029_action_limits.sql`

The `upsert_action_usage` RPC is called fire-and-forget on every tracked mutation for every signed-in user. At scale, admin queries filtering by `daily_date` or `monthly_month` (e.g. "how many users hit their daily limit today") perform full table scans.

**Fix applied:** Two indexes added to `029_action_limits.sql`:
```sql
CREATE INDEX idx_user_action_usage_daily   ON user_action_usage(daily_date);
CREATE INDEX idx_user_action_usage_monthly ON user_action_usage(monthly_month);
```

---

### M2 — `upsert_action_usage` RPC: TOCTOU count loss under concurrent server calls
**File:** `supabase/migrations/029_action_limits.sql` lines 48–50

```sql
daily_count = CASE
  WHEN user_action_usage.daily_date = p_daily_date
  THEN user_action_usage.daily_count + 1   -- reads at READ COMMITTED isolation
  ELSE 1
END
```

At `READ COMMITTED` isolation (PostgreSQL default), two concurrent upserts for the same `user_id` can both read `daily_count = 5` and both write `6`, losing one increment. A fully atomic solution requires `FOR UPDATE` row locking or `SERIALIZABLE` isolation.

**Not fixed:** The extension has exactly one active context per user. Concurrent server-side RPC calls for the same user_id are not possible in normal operation. The remote `user_action_usage` count is a secondary telemetry source — the **local** `action_usage` key in `chrome.storage.local` is the authoritative limit enforcer. Documenting as an accepted limitation.

---

### M3 — Migration 030 re-run safety
**File:** `supabase/migrations/030_rename_max_to_lifetime.sql`

`INSERT … ON CONFLICT (id) DO NOTHING` followed by `DELETE FROM plans WHERE id = 'max'` is idempotent on repeated runs, but if a future admin manually re-adds a `'max'` plan, a stale re-run of this migration would silently delete it with no error.

**Mitigation applied:** Added a comment to the migration file making the one-run-only constraint explicit. Full guard clause considered unnecessary overhead for a migration this simple.

---

## Low

### L1 — Defensive `?? 0` fallback for corrupted storage data
**File:** `src/core/services/limits/action-tracker.ts` lines 21–27

If `chrome.storage.local` contains partial data — e.g. `{ daily: { date: TODAY } }` without a `count` field — the existing code reads `raw.daily.count` as `undefined`. `incrementAction` then computes `undefined + 1 = NaN`, and NaN is written back to storage, permanently breaking limit tracking until the key is manually cleared.

**Fix applied:**
```typescript
const daily = raw?.daily?.date === today
  ? { date: today, count: raw.daily.count ?? 0 }
  : { date: today, count: 0 };

const monthly = raw?.monthly?.month === month
  ? { month, count: raw.monthly.count ?? 0 }
  : { month, count: 0 };
```

A test case was added to `action-tracker.test.ts` covering partial storage data.

---

### L2 — Redundant branch in `UsageBar` colour logic (not fixed — no wrong behaviour)
**File:** `src/shared/components/LimitReachedModal.tsx` line 100

```typescript
pct >= 1 ? '#ef4444' : pct >= 0.9 ? '#ef4444' : pct >= 0.7 ? '#f59e0b' : '#625fff'
```

Because `Math.min(used/limit, 1)` caps `pct` at `1.0`, the `pct >= 1` branch fires only at exactly 100%, returning the same colour as the next branch (`pct >= 0.9`). The two conditions are redundant — collapsing to `pct >= 0.9 ? '#ef4444' : …` is equivalent. No user-visible defect; noted for future simplification.

---

## False Positives Ruled Out

The following were raised during review but confirmed to be non-issues after reading the actual code:

| Claim | Verdict |
|-------|---------|
| `handleRestoreSession` bypasses limits | ✗ — restoring tabs is a read, not a data mutation |
| `handleRestoreSelectedTabs` bypasses limits | ✗ — same; opens existing data, creates no new entities |
| `allWindows` undercounts (1 action for N windows) | ✗ — intentional design: one user trigger = one action |
| Billing page `.single()` throws on missing row | ✗ — Supabase `.single()` returns `{ data: null, error }`, does not throw |
| LimitReachedModal bar colour wrong at > 100% | ✗ — `Math.min` prevents pct > 1; redundant branch but no wrong output |

---

## Files Changed in This Review Pass

| File | Change |
|------|--------|
| `src/background/event-listeners.ts` | Added guard+track to 3 handlers |
| `admin/app/(admin)/quotas/page.tsx` | Fixed `parseInt` radix + `isNaN` guard |
| `src/sidepanel/components/Header.tsx` | Suppressed `chrome.runtime.lastError` |
| `src/newtab/components/DashboardSidebar.tsx` | Suppressed `chrome.runtime.lastError` |
| `src/core/services/limits/action-tracker.ts` | Added `?? 0` defensive fallbacks |
| `supabase/migrations/029_action_limits.sql` | Added 2 date indexes |
| `tests/unit/background/event-listeners.test.ts` | Tests for 3 newly guarded handlers |
| `tests/unit/services/limits/action-tracker.test.ts` | Malformed storage data test |
