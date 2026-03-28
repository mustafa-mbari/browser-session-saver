import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../../app/api/auth/sign-out/route'

const mockSignOut = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}))

describe('POST /api/auth/sign-out', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with success:true', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('calls supabase.auth.signOut()', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    await POST()
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
