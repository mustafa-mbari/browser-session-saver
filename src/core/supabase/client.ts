import { createClient as _createClient } from '@supabase/supabase-js';

// Custom storage adapter that uses chrome.storage.local for auth token persistence.
// Required because @supabase/supabase-js defaults to localStorage which is not available
// in the Chrome extension service worker context.
const chromeAuthStorage = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) =>
      chrome.storage.local.get(key, (r) => resolve((r[key] as string) ?? null)),
    ),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve)),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.remove(key, resolve)),
};

// Singleton client instance — shared by sync-auth.service and sync.service.
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are injected at build time.
// Placeholder values are used when env vars are absent (e.g. in tests) so the
// module can be imported without throwing — API calls will simply fail gracefully.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://placeholder.supabase.co';
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'placeholder-anon-key';

export const supabase = _createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: chromeAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
