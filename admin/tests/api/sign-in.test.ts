import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/auth/sign-in/route'

const mockSignIn = vi.fn()
const mockSignOut = vi.fn()
const mockProfileSingle = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
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

function makeRequest(body: object) {
  return new Request('http://localhost/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success:true for valid admin credentials', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })

    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 401 with error message on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } })

    const res = await POST(makeRequest({ email: 'admin@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Invalid login credentials' })
  })

  it('returns 403 when credentials valid but role is not admin', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSingle.mockResolvedValue({ data: { role: 'user' }, error: null })

    const res = await POST(makeRequest({ email: 'user@example.com', password: 'secret' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'Admin access required' })
  })

  it('signs out non-admin user to clean up session', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockProfileSingle.mockResolvedValue({ data: { role: 'user' }, error: null })

    await POST(makeRequest({ email: 'user@example.com', password: 'secret' }))
    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it('returns 403 when profile is not found', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-3' } }, error: null })
    mockProfileSingle.mockResolvedValue({ data: null, error: null })

    const res = await POST(makeRequest({ email: 'unknown@example.com', password: 'secret' }))
    expect(res.status).toBe(403)
  })

  it('calls signInWithPassword with the correct credentials', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })

    await POST(makeRequest({ email: 'test@example.com', password: 'pass1234' }))
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@example.com', password: 'pass1234' })
  })
})
