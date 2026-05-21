import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/auth/resend-verification/route'
import { NextRequest } from 'next/server'

// Use vi.hoisted to declare mock functions before vi.mock calls are evaluated
const { mockGenerateLink, mockSendEmail } = vi.hoisted(() => ({
  mockGenerateLink: vi.fn(),
  mockSendEmail: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { full_name: 'Test User' } })),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
  buildEmailVerificationEmail: vi.fn(() => ({
    subject: 'Verify your email',
    html: '<p>Verify</p>',
  })),
}))

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth/resend-verification', {
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
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: '123' }, user: { id: 'user_id' } },
      error: null,
    })
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 200 even when email does not exist (no enumeration)', async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: { message: 'User not found' } })
    const res = await POST(makeRequest({ email: 'unknown@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('returns 200 even when generateLink throws', async () => {
    mockGenerateLink.mockRejectedValue(new Error('Network error'))
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('calls generateLink with type magiclink and the provided email', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: '123' }, user: { id: 'user_id' } },
      error: null,
    })
    await POST(makeRequest({ email: 'test@example.com' }))
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'test@example.com',
      options: { redirectTo: 'http://localhost/auth/confirm' },
    })
  })
})
