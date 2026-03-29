import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

// DEV: Mock user for testing when Supabase is not configured
const MOCK_USER = {
  id: 'dev-admin-000',
  email: 'admin@browserhub.dev',
  user_metadata: { display_name: 'Dev Admin' },
  app_metadata: { role: 'admin' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User

function isSupabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Get the current user or null (no redirect).
 */
export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return MOCK_USER
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/**
 * Require an authenticated admin user. Redirects to login if not found or not admin.
 */
export async function requireAdmin(): Promise<User> {
  if (!isSupabaseConfigured()) return MOCK_USER
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const serviceSupabase = await createServiceClient()
  const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/login?error=forbidden')
  return user
}

/**
 * Require an authenticated admin user for API routes. Returns null instead of redirecting.
 */
export async function requireAdminApi(): Promise<{ user: User; serviceSupabase: Awaited<ReturnType<typeof createServiceClient>> } | null> {
  if (!isSupabaseConfigured()) {
    const serviceSupabase = await createServiceClient()
    return { user: MOCK_USER, serviceSupabase }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const serviceSupabase = await createServiceClient()
  const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return { user, serviceSupabase }
}
