import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResetPasswordPage from '../../app/(public)/reset-password/page'

const mockGetSession = vi.fn()
const mockUpdateUser = vi.fn()
const mockPush = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      updateUser: mockUpdateUser,
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const activeSession = { data: { session: { user: { id: 'user-1' } } }, error: null }
const noSession = { data: { session: null }, error: null }

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a spinner while checking session', () => {
    // Never resolves during this test
    mockGetSession.mockReturnValue(new Promise(() => {}))
    render(<ResetPasswordPage />)
    // Spinner is present (aria or svg element)
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('renders the password form when a session exists', async () => {
    mockGetSession.mockResolvedValue(activeSession)
    render(<ResetPasswordPage />)
    await screen.findByText('Set new password')
    expect(screen.getByLabelText('New Password')).toBeTruthy()
    expect(screen.getByLabelText('Confirm New Password')).toBeTruthy()
  })

  it('shows error state with link to forgot-password when no session', async () => {
    mockGetSession.mockResolvedValue(noSession)
    render(<ResetPasswordPage />)
    await screen.findByText('Link expired')
    expect(screen.getByRole('link', { name: /request new link/i })).toBeTruthy()
  })

  it('shows toast error when passwords do not match', async () => {
    const { toast } = await import('sonner')
    mockGetSession.mockResolvedValue(activeSession)
    render(<ResetPasswordPage />)
    await screen.findByLabelText('New Password')

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'different!' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(toast.error).toHaveBeenCalledWith('Passwords do not match.')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('shows toast error when password is too short', async () => {
    const { toast } = await import('sonner')
    mockGetSession.mockResolvedValue(activeSession)
    render(<ResetPasswordPage />)
    await screen.findByLabelText('New Password')

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(toast.error).toHaveBeenCalledWith('Password must be at least 8 characters.')
  })

  it('calls updateUser and redirects on success', async () => {
    mockGetSession.mockResolvedValue(activeSession)
    mockUpdateUser.mockResolvedValue({ error: null })
    render(<ResetPasswordPage />)
    await screen.findByLabelText('New Password')

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword123' } })
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
      expect(mockPush).toHaveBeenCalledWith('/login?message=password-updated')
    })
  })

  it('shows toast error when updateUser fails', async () => {
    const { toast } = await import('sonner')
    mockGetSession.mockResolvedValue(activeSession)
    mockUpdateUser.mockResolvedValue({ error: { message: 'Update failed' } })
    render(<ResetPasswordPage />)
    await screen.findByLabelText('New Password')

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword123' } })
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
