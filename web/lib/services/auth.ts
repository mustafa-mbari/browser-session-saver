import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

// DEV: Mock user for testing when Supabase is not configured
const MOCK_USER = {
  id: 'dev-user-000',
  email: 'user@browserhub.dev',
  user_metadata: { display_name: 'Dev User' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User

function isSupabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function requireAuth() {
  if (!isSupabaseConfigured()) return MOCK_USER
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

export async function getUser() {
  if (!isSupabaseConfigured()) return MOCK_USER
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
