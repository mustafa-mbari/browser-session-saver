import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockProfileSingle = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockProfileSingle,
        })),
      })),
    })),
  })),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('returns MOCK_USER when Supabase is not configured', async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    vi.resetModules()
    const { requireAdmin } = await import('../../lib/services/auth')
    const user = await requireAdmin()

    expect(user.id).toBe('dev-admin-000')
    expect(user.email).toBe('admin@browserhub.dev')

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey
  })

  it('returns the user when authenticated and role is admin', async () => {
    vi.resetModules()
    const { createClient, createServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-abc', email: 'admin@example.com' } },
        }),
      },
    } as never)
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          })),
        })),
      })),
    } as never)

    const { requireAdmin } = await import('../../lib/services/auth')
    const user = await requireAdmin()
    expect(user.id).toBe('user-abc')
  })

  it('redirects to /login when unauthenticated', async () => {
    vi.resetModules()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never)

    const { redirect } = await import('next/navigation')
    const { requireAdmin } = await import('../../lib/services/auth')

    try {
      await requireAdmin()
    } catch {
      // redirect() throws in tests
    }
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /login?error=forbidden when role is not admin', async () => {
    vi.resetModules()
    const { createClient, createServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-xyz', email: 'user@example.com' } },
        }),
      },
    } as never)
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null }),
          })),
        })),
      })),
    } as never)

    const { redirect } = await import('next/navigation')
    const { requireAdmin } = await import('../../lib/services/auth')

    try {
      await requireAdmin()
    } catch {
      // redirect() throws in tests
    }
    expect(redirect).toHaveBeenCalledWith('/login?error=forbidden')
  })

  it('redirects to /login?error=forbidden when profile not found', async () => {
    vi.resetModules()
    const { createClient, createServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-xyz', email: 'user@example.com' } },
        }),
      },
    } as never)
    vi.mocked(createServiceClient).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as never)

    const { redirect } = await import('next/navigation')
    const { requireAdmin } = await import('../../lib/services/auth')

    try {
      await requireAdmin()
    } catch {
      // redirect() throws in tests
    }
    expect(redirect).toHaveBeenCalledWith('/login?error=forbidden')
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
    expect(user?.id).toBe('dev-admin-000')

    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey
  })

  it('returns the user when authenticated', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    vi.resetModules()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-abc', email: 'admin@example.com' } },
        }),
      },
    } as never)

    const { getUser } = await import('../../lib/services/auth')
    const user = await getUser()
    expect(user?.id).toBe('user-abc')
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
