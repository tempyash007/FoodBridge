/**
 * context/AuthContext.test.jsx
 * Unit + integration tests for AuthProvider and useAuth hook.
 *
 * All fetch calls are intercepted — no real network requests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext'

const API_BASE = 'http://localhost:3000/api/auth'

function makeFetchResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  }
}

// ── Helper consumer component ──────────────────────────────────────────────
function TestConsumer() {
  const { user, isAuthenticated, loading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <button onClick={login} data-testid="login-btn">login</button>
      <button onClick={logout} data-testid="logout-btn">logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Happy path: valid session on mount ─────────────────────────────────────

  it('sets user when /me returns 200 on mount', async () => {
    const mockUser = { id: 1, email: 'donor@test.com', role: 'donor' }
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { data: { user: mockUser } })
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('donor@test.com')
  })

  // ── Unauthenticated state ──────────────────────────────────────────────────

  it('leaves user null when /me returns 401 on mount', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(401))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('leaves user null when the /me fetch throws (network error)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network down'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  // ── login() function ───────────────────────────────────────────────────────

  it('login() fetches /me again and updates user in context', async () => {
    const mockUser = { id: 2, email: 'vol@test.com', role: 'volunteer' }

    // Initial mount call → unauthenticated
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(401))
    // login() call → authenticated
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { data: { user: mockUser } })
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('login-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('vol@test.com')
    })
  })

  // ── logout() function ──────────────────────────────────────────────────────

  it('logout() clears user state to null', async () => {
    const mockUser = { id: 3, email: 'admin@test.com', role: 'admin' }
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { data: { user: mockUser } })
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('admin@test.com')
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('logout-btn'))

    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
  })

  // ── useAuth outside provider ───────────────────────────────────────────────

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress the expected React error boundary output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider'
    )

    consoleSpy.mockRestore()
  })

  // ── Loading state transition ───────────────────────────────────────────────

  it('starts with loading=true then transitions to false', async () => {
    let resolveFetch
    fetchSpy.mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve })
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    // Should be loading initially
    expect(screen.getByTestId('loading').textContent).toBe('true')

    await act(async () => {
      resolveFetch(makeFetchResponse(401))
    })

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
  })
})
