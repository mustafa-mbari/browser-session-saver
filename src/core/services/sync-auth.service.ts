import type { Session } from '@supabase/supabase-js';
import { supabase } from '@core/supabase/client';

export interface SyncSignInResult {
  success: boolean;
  email?: string;
  error?: string;
}

/**
 * Sign in to the Browser Hub cloud account using email + password.
 * The session is persisted in chrome.storage.local via the custom auth adapter.
 */
export async function syncSignIn(email: string, password: string): Promise<SyncSignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, email: data.user?.email ?? email };
}

/**
 * Sign out and clear the persisted auth session from chrome.storage.local.
 */
export async function syncSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Return the current Supabase auth session, or null if not authenticated.
 */
export async function getSyncSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Return the current authenticated user's ID, or null.
 */
export async function getSyncUserId(): Promise<string | null> {
  const session = await getSyncSession();
  return session?.user?.id ?? null;
}

/**
 * Return true if there is a valid auth session.
 */
export async function isSyncAuthenticated(): Promise<boolean> {
  const userId = await getSyncUserId();
  return userId !== null;
}

/**
 * Return the current user's email address, or null.
 */
export async function getSyncEmail(): Promise<string | null> {
  const session = await getSyncSession();
  return session?.user?.email ?? null;
}

/**
 * Return the current user's display name.
 * Queries profiles.display_name; falls back to the email prefix (before '@') if not set.
 * Returns null if not authenticated.
 */
export async function getSyncDisplayName(): Promise<string | null> {
  const session = await getSyncSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', session.user.id)
    .single();

  if (data?.display_name) return data.display_name as string;

  const email = session.user.email;
  return email ? email.split('@')[0] : null;
}
