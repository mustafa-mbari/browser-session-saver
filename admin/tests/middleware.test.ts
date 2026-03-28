import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

function makeRequest(path: string) {
  return new NextRequest(new URL(`http://localhost${path}`))
}

describe('admin middleware', () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey
  })

  it('passes through for /login (public path)', async () => {
    const { middleware } = await import('../middleware')
    const res = await middleware(makeRequest('/login'))
    expect(res.status).not.toBe(307)
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through for /api/auth/sign-in (public path)', async () => {
    const { middleware } = await import('../middleware')
    const res = await middleware(makeRequest('/api/auth/sign-in'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('passes through when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    vi.resetModules()
    vi.mock('@supabase/ssr', () => ({
      createServerClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
      })),
    }))
    const { middleware } = await import('../middleware')
    const res = await middleware(makeRequest('/'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects to /login when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    vi.resetModules()
    vi.mock('@supabase/ssr', () => ({
      createServerClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
      })),
    }))

    const { middleware } = await import('../middleware')
    const res = await middleware(makeRequest('/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('passes through when authenticated (role check is in layout, not middleware)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })

    vi.resetModules()
    vi.mock('@supabase/ssr', () => ({
      createServerClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
      })),
    }))

    const { middleware } = await import('../middleware')
    const res = await middleware(makeRequest('/'))
    expect(res.headers.get('location')).toBeNull()
  })
})
