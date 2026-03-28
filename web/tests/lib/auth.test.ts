import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns MOCK_USER when Supabase is not configured', async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Re-import to pick up missing env vars
    vi.resetModules()
    const { requireAuth } = await import('../../lib/services/auth')
    const user = await requireAuth()

    expect(user.id).toBe('dev-user-000')
    expect(user.email).toBe('user@browserhub.dev')

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey
  })

  it('returns the authenticated user when Supabase is configured and user exists', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    vi.resetModules()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-abc', email: 'test@example.com' } },
        }),
      },
    } as never)

    const { requireAuth } = await import('../../lib/services/auth')
    const user = await requireAuth()
    expect(user.id).toBe('user-abc')
  })

  it('calls redirect to /login when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    vi.resetModules()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never)

    const { redirect } = await import('next/navigation')
    const { requireAuth } = await import('../../lib/services/auth')

    try {
      await requireAuth()
    } catch {
      // redirect() throws in tests
    }
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns MOCK_USER when Supabase is not configured', async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    vi.resetModules()
    const { getUser } = await import('../../lib/services/auth')
    const user = await getUser()
    expect(user?.id).toBe('dev-user-000')

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey
  })

  it('returns null when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    vi.resetModules()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never)

    const { getUser } = await import('../../lib/services/auth')
    const user = await getUser()
    expect(user).toBeNull()
  })
})
