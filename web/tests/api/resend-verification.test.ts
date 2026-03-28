import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/auth/resend-verification/route'

const mockResend = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      resend: mockResend,
    },
  })),
}))

function makeRequest(body: object) {
  return new Request('http://localhost/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success:true on valid email', async () => {
    mockResend.mockResolvedValue({ error: null })
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 200 even when email does not exist (no enumeration)', async () => {
    mockResend.mockResolvedValue({ error: { message: 'User not found' } })
    const res = await POST(makeRequest({ email: 'unknown@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 200 even when resend throws', async () => {
    mockResend.mockRejectedValue(new Error('Network error'))
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('calls resend with type signup and the provided email', async () => {
    mockResend.mockResolvedValue({ error: null })
    await POST(makeRequest({ email: 'test@example.com' }))
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'test@example.com' })
  })
})
