# Codebase Review — Browser Hub

Review covering the extension, web app, and admin app. Generated after the tab-group-sync / billing / auth-UI sprint (commits 4a62bc1 → e59ee0e, 2026-03-29).

---

## A. Extension Issues

### High Severity

**A1 — Import validation skips schema check**
File: `src/background/event-listeners.ts`
The import handler checks file size (`> 5_242_880`) but writes imported session data directly to IndexedDB without validating that each object matches the `Session` schema. A malformed import could corrupt storage silently.
Fix: run each object through `isValidSession()` (or a lightweight field-presence check) before `storage.set()`.

**A2 — URL restore does not block dangerous schemes**
File: `src/background/event-listeners.ts`
`isValidUrl()` uses `new URL()` to test validity, but this accepts `javascript:`, `data:`, and `blob:` URLs. Restoring a session that contains such URLs opens them in real tabs.
Fix: add a scheme blocklist (`javascript:`, `data:`, `vbscript:`) alongside the existing `isValidUrl` check at the restore site.

### Medium Severity

**A3 — `getCurrentWindowId()` uses non-null assertion**
File: `src/background/event-listeners.ts`
```typescript
return window.id!;   // id can be undefined per Chrome types
```
Fix: guard and throw: `if (!window.id) throw new Error('No window id');`

**A4 — `AutoSaveStatusResponse.lastTrigger` is always `null`**
File: `src/core/types/messages.types.ts` + `src/background/event-listeners.ts`
The field is hardcoded `null` in the message handler and never populated. Either implement it or remove the field to avoid misleading consumers.

**A5 — `SaveSessionResponse.session` is `Session | Session[]`**
File: `src/core/types/messages.types.ts`
Callers are forced to branch on `Array.isArray(session)`. The handler always returns an array for bulk-save but a single object for single-save.
Fix: split into `SaveSessionResponse` (single) and `BulkSaveSessionResponse` (array).

**A6 — `_pendingCriticalTrigger` can only hold one queued trigger**
File: `src/background/auto-save-engine.ts`
If two critical triggers (e.g., `shutdown` + `window_close`) fire while `_isSaving` is true, the first is silently overwritten.
Fix: use a `Set<AutoSaveTrigger>` and drain it after the save completes.

**A7 — Fire-and-forget sync calls surface no errors**
File: `src/background/event-listeners.ts`
`void syncAfterMutation(session)` and `void deleteRemoteSession(id)` discard errors entirely. The user has no way to know a sync failed.
Fix: at minimum, update `SyncStatus.error` in `chrome.storage.local` on failure so the Cloud Sync UI can surface it.

**A8 — `debounce`/`throttle` use `any` generics**
File: `src/core/utils/debounce.ts`
```typescript
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number)
```
Fix: `T extends (...args: Parameters<T>) => ReturnType<T>` (or simply let `T extends (...args: never[]) => unknown`).

### Low Severity

**A9 — `CurrentTabsResponse` is unused**
File: `src/core/types/messages.types.ts`
The interface is defined but never imported anywhere. Safe to delete.

**A10 — `PromptCategory` type is defined but unused**
File: `src/core/types/prompt.types.ts`
`PromptCategory` has no callers in storage, service, or UI code.
Action: delete or add a TODO comment if the feature is planned.

**A11 — Repeated sort+slice pattern in sync.service.ts**
```typescript
.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
.slice(0, limit)
```
This appears 5+ times. Extract a small `sortByDateDesc<T extends { updatedAt: string }>(items: T[], limit: number): T[]` utility.

**A12 — Magic numbers scattered across files**
Values that should be named constants:

| Value | Location | Suggested constant |
|-------|----------|--------------------|
| `5_242_880` | event-listeners.ts | `MAX_IMPORT_SIZE_BYTES` |
| `24 * 60 * 60 * 1000` | HomeView.tsx | `RESTORE_PROMPT_MAX_AGE_MS` |
| `10_000` | useMessaging.ts | `MESSAGE_TIMEOUT_MS` |
| `2500` / `3000` | BookmarksPanel, PromptCard | `TOAST_DISMISS_MS` |
| `5000` | auto-save-engine.ts | `TAB_CACHE_DEBOUNCE_MS` |
| `80` | CloudSyncView.tsx | `QUOTA_WARNING_PCT` |

Suggested home: `src/core/constants/timings.ts` and `src/core/constants/limits.ts`.

---

## B. Web App Issues

### High Severity

**B1 — Auth routes fall back to `localhost:3000` in production**
Files:
- `web/app/api/auth/sign-up/route.ts`
- `web/app/api/auth/forgot-password/route.ts`
- `web/app/api/auth/google/route.ts`

```typescript
emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/confirm`
```
If `NEXT_PUBLIC_SITE_URL` is missing in production, every email confirmation and OAuth callback redirects to localhost, breaking authentication for all users.
Fix: throw at startup (or in middleware) if this env var is absent in a non-development environment.

**B2 — AppHeader loads a non-existent image asset**
File: `web/app/(authenticated)/AppHeader.tsx`
Attempts to load `/icons/browser-hub_logo.png`. The actual asset in `web/public/icons/` is `icon-128.png`. This produces a 404 in production.
Fix: update the `src` to `/icons/icon-128.png` or add the missing asset.

**B3 — `google/route.ts` lacks a try-catch around `signInWithOAuth`**
File: `web/app/api/auth/google/route.ts`
Network errors from Supabase are uncaught and will produce an unhandled 500.
Fix: wrap the `supabase.auth.signInWithOAuth` call in try-catch.

### Medium Severity

**B4 — `(plan as any)[row.field]` in billing page**
File: `web/app/(authenticated)/billing/page.tsx` ~line 167
Unsafe cast silences TypeScript for a dynamic property lookup.
Fix: define a typed `PlanRow` interface with an index signature `[key: string]: string | number | boolean | null` and cast to that instead.

**B5 — Checkout page has hardcoded plan features**
File: `web/app/(authenticated)/checkout/page.tsx`
`PLAN_INFO` defines feature strings like `'10 synced sessions'` as literal strings. These can drift from the actual quota values in the database.
Fix: fetch plan limits from `get_user_quota` and render them dynamically, or at minimum add a comment warning that these must match `supabase/migrations/002_plans.sql`.

### Low Severity

**B6 — Two sidebar hook sources**
`web/app/(authenticated)/AppHeader.tsx` imports from `@/components/ui/sidebar` (shadcn generated hook), while `web/components/SidebarLockProvider.tsx` and others import from `@/hooks/use-sidebar-lock` (custom hook). Pick one pattern.

**B7 — `any` in Supabase SSR cookie setup**
File: `web/lib/supabase/server.ts`
Two `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments on cookie callbacks. The `@supabase/ssr` package exports `CookieOptions`; use it for a typed `{ name: string; value: string; options: CookieOptions }[]`.

---

## C. Admin App Issues

### Medium Severity

**C1 — Server actions have no client-side feedback**
Files: `admin/app/(admin)/quotas/page.tsx`, `admin/app/(admin)/suggestions/page.tsx`, `admin/app/(admin)/subscriptions/page.tsx`
Server actions (`savePlan`, `updateStatus`, `grantSubscription`) only call `revalidatePath` on success and log to `console.error` on failure. The admin has no toast, redirect, or error message to confirm the action worked.
Fix: use React 19 Server Action error/state pattern or convert to client-side `fetch` with toast feedback.

**C2 — Emails page is a placeholder**
File: `admin/app/(admin)/emails/page.tsx`
The `logEmail` server action contains `// In production, this would call an email service (Resend, SendGrid, etc.)`. It inserts a row into `email_log` with `status: 'sent'` but sends no actual email.
Action: either implement via an email provider or add a visible "Not yet implemented" banner so admins don't believe emails are sending.

**C3 — Unsafe double-cast in subscriptions page**
File: `admin/app/(admin)/subscriptions/page.tsx` ~line 52
```typescript
(rowsRes.data ?? []) as unknown as UserPlanRow[]
```
Fix: define a Supabase query return type that narrows to `UserPlanRow[]` directly, or cast via a type guard.

### Low Severity

**C4 — `any` in Supabase SSR cookie setup (same as web)**
File: `admin/lib/supabase/server.ts`
Same pattern as B7. Replace with typed `CookieOptions`.

---

## D. Supabase / Sync Issues

### Critical

**D1 — Verify `.env.local` files are in `.gitignore`**
The service role key (`SUPABASE_SERVICE_ROLE_KEY`) in `web/.env.local` and `admin/.env.local` must never be committed. Confirm both paths appear in `.gitignore`. If they were committed in a prior commit, the key should be rotated in the Supabase dashboard immediately.

### High Severity

**D2 — `plans` table has no Row Level Security**
File: `supabase/migrations/002_plans.sql`
`ALTER TABLE plans ENABLE ROW LEVEL SECURITY` is absent. All authenticated users can currently query and potentially modify plan definitions if Supabase's default deny is not in effect for the project.
Fix: add a migration:
```sql
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select_all" ON public.plans
  FOR SELECT USING (true);
```

### Medium Severity

**D3 — `DROP FUNCTION IF EXISTS` anti-pattern in migrations 013–016**
Each of migrations 013, 015 (for `get_user_quota`) and 014, 016 (for `get_user_usage`, `get_admin_overview`) drops the function before recreating it. During the brief window between DROP and CREATE, any in-flight RPC call (background sync alarm, dashboard page load) will receive a "function does not exist" error.
Fix for future migrations: use `CREATE OR REPLACE FUNCTION` wherever the return-type signature is compatible. When the return type must change (adding a column), the drop is unavoidable — but should be noted prominently in the migration comment.

**D4 — Missing root `.env.example`**
`README.md` tells developers to create a `.env` file and references `.env.example`, but the example file may not exist at the project root.
Fix: create `/.env.example` with:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Low Severity

**D5 — `prompts_access_limit` is in `UserQuota` but never enforced**
File: `src/core/services/sync.service.ts`
The field is fetched and stored in `UserQuota` but no code path checks it. Either document that read-access limits are intentionally not enforced client-side (because reads happen locally, not from Supabase) or remove the field from the interface.

**D6 — `get_user_quota` vs `get_user_usage` naming is confusing**
Both functions exist and are called in parallel on the dashboard. Their names do not clearly distinguish "plan limits" from "current counts".
Action: add a JSDoc comment above each RPC call in `sync.service.ts` and `web/app/(authenticated)/dashboard/page.tsx` explaining the distinction.

---

## Summary by Severity

| Severity | Count | Key items |
|----------|-------|-----------|
| Critical | 1 | D1 — service role key in git |
| High | 5 | A1, A2, B1, B2, D2 |
| Medium | 10 | A3–A7, B3–B5, C1–C3, D3–D4 |
| Low | 8 | A8–A12, B6–B7, C4, D5–D6 |

## Suggested Fix Order

1. **D1** — Verify `.gitignore` covers `.env.local`; rotate key if committed
2. **B1** — Add `NEXT_PUBLIC_SITE_URL` guard in auth routes
3. **B2** — Fix missing image asset in AppHeader
4. **D2** — Add RLS to `plans` table via a new migration (017)
5. **A1** — Validate imported session schema before storage write
6. **A2** — Add scheme blocklist in URL restore
7. **C1** — Add feedback to admin server actions
8. **C2** — Mark emails page as placeholder in UI or implement
9. **A3–A8** — TypeScript / type-safety cleanup
10. **A9–A12, B6–B7, C4, D5–D6** — Low-effort cleanup
