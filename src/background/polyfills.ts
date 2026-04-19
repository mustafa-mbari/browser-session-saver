// Chrome extension service workers don't have `window` in their global scope.
// Some libraries (e.g. @supabase/auth-js) access `window` directly without
// guarding with `typeof window !== 'undefined'`, causing a ReferenceError.
// Binding `window` to `globalThis` (ServiceWorkerGlobalScope) prevents the
// crash. `document` is intentionally absent so isBrowser() checks still
// return false — Supabase won't attempt URL-based session detection.
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}
