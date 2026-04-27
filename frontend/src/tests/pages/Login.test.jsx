/**
 * pages/Login.test.jsx
 * Integration tests for the Login page.
 *
 * - global.fetch is spied upon for POST /api/auth/login
 * - useAuth mocked with explicit vi.fn() factory
 * - useNavigate mocked
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import { useAuth } from '../../context/AuthContext'
import Login from '../../pages/Login'

function makeFetchResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('Login page — render', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ login: vi.fn() })
  })
  afterEach(() => vi.clearAllMocks())

  function renderLogin(locationState = null) {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: locationState }]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('renders the email and password inputs', () => {
    renderLogin()
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
  })

  it('renders the submit button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('renders a redirect message passed via location.state', () => {
    renderLogin({ message: 'Please login first to access this page.' })
    expect(
      screen.getByText(/Please login first to access this page/i)
    ).toBeInTheDocument()
  })
})

describe('Login page — form submission (happy path)', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    )
  }

  async function submitForm(email, password) {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Email address/i), email)
    await user.type(screen.getByLabelText(/Password/i), password)
    await user.click(screen.getByRole('button', { name: /Sign In/i }))
  }

  it('navigates to /donor after successful donor login', async () => {
    const mockUser = { role: 'donor', email: 'donor@test.com' }
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { data: { user: mockUser } })
    )
    useAuth.mockReturnValue({ login: vi.fn().mockResolvedValue(mockUser) })

    renderLogin()
    await submitForm('donor@test.com', 'password123')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/donor', { replace: true })
    })
  })

  it('navigates to /admin for admin role', async () => {
    const mockUser = { role: 'admin' }
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: { user: mockUser } }))
    useAuth.mockReturnValue({ login: vi.fn().mockResolvedValue(mockUser) })

    renderLogin()
    await submitForm('admin@test.com', 'securepass')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true })
    })
  })

  it('navigates to /recipient for recipient role', async () => {
    const mockUser = { role: 'recipient' }
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: { user: mockUser } }))
    useAuth.mockReturnValue({ login: vi.fn().mockResolvedValue(mockUser) })

    renderLogin()
    await submitForm('recipient@test.com', 'pass')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/recipient', { replace: true })
    })
  })

  it('navigates to /volunteer for volunteer role', async () => {
    const mockUser = { role: 'volunteer' }
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: { user: mockUser } }))
    useAuth.mockReturnValue({ login: vi.fn().mockResolvedValue(mockUser) })

    renderLogin()
    await submitForm('vol@test.com', 'pass')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/volunteer', { replace: true })
    })
  })
})

describe('Login page — error handling', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
    useAuth.mockReturnValue({ login: vi.fn() })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  function renderLogin() {
    return render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('shows error message when server returns 401 with a message', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(401, { message: 'Invalid credentials' })
    )

    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Email address/i), 'bad@email.com')
    await user.type(screen.getByLabelText(/Password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('shows fallback "Login failed" when server returns 401 with no message', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(401, {}))

    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Email address/i), 'x@x.com')
    await user.type(screen.getByLabelText(/Password/i), 'bad')
    await user.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument()
    })
  })

  it('shows "Server error" message when fetch throws a network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network down'))

    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Email address/i), 'x@x.com')
    await user.type(screen.getByLabelText(/Password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument()
    })
  })

  it('submit button is re-enabled after a failed login attempt', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(401, { message: 'Bad credentials' })
    )

    renderLogin()
    const submitBtn = screen.getByRole('button', { name: /Sign In/i })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Email address/i), 'x@x.com')
    await user.type(screen.getByLabelText(/Password/i), 'pass')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled()
    })
  })
})
