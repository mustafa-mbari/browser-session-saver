import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/auth/sign-in/route'

const mockSignInWithPassword = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
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

  it('returns 200 with success:true on valid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'secret123' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 401 with error message on invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Invalid login credentials' })
  })

  it('calls signInWithPassword with email and password', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    await POST(makeRequest({ email: 'test@example.com', password: 'pass1234' }))
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'pass1234',
    })
  })
})
