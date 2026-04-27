/**
 * components/Navbar.test.jsx
 * Integration tests for the Navbar component.
 *
 * - useAuth mocked with explicit vi.fn() factory
 * - auth.service.logout mocked
 * - useNavigate mocked
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../services/auth.service', () => ({
  logout: vi.fn().mockResolvedValue({ success: true }),
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
import { logout as logoutService } from '../../services/auth.service'
import Navbar from '../../components/Navbar'

function renderNavbar(path = '/', authState = {}) {
  const defaultAuth = {
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
    ...authState,
  }
  useAuth.mockReturnValue(defaultAuth)

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>
  )
}

describe('Navbar — unauthenticated', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows Login and Get Started links when not authenticated', () => {
    renderNavbar('/', { isAuthenticated: false, user: null })
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('does NOT show Dashboard or logout button when not authenticated', () => {
    renderNavbar('/', { isAuthenticated: false, user: null })
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Sign Out')).not.toBeInTheDocument()
  })

  it('renders FoodBridge brand link', () => {
    renderNavbar()
    expect(screen.getByText('FoodBridge')).toBeInTheDocument()
  })
})

describe('Navbar — authenticated', () => {
  afterEach(() => vi.clearAllMocks())

  it('shows Dashboard link and logout button when authenticated', () => {
    renderNavbar('/', {
      user: { role: 'donor' },
      isAuthenticated: true,
      logout: vi.fn(),
    })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByTitle('Sign Out')).toBeInTheDocument()
  })

  it('does NOT show Login/Get Started when authenticated', () => {
    renderNavbar('/', {
      user: { role: 'donor' },
      isAuthenticated: true,
      logout: vi.fn(),
    })
    expect(screen.queryByText('Login')).not.toBeInTheDocument()
    expect(screen.queryByText('Get Started')).not.toBeInTheDocument()
  })

  it('calls logoutService and logoutContext then navigates to /login on logout click', async () => {
    const logoutContext = vi.fn()
    renderNavbar('/', {
      user: { role: 'admin' },
      isAuthenticated: true,
      logout: logoutContext,
    })

    const user = userEvent.setup()
    await user.click(screen.getByTitle('Sign Out'))

    await waitFor(() => {
      expect(logoutService).toHaveBeenCalledOnce()
      expect(logoutContext).toHaveBeenCalledOnce()
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})

describe('Navbar — getDashboardLink', () => {
  afterEach(() => vi.clearAllMocks())

  const cases = [
    { role: 'donor', expectedPath: '/donor' },
    { role: 'recipient', expectedPath: '/recipient' },
    { role: 'volunteer', expectedPath: '/volunteer' },
    { role: 'admin', expectedPath: '/admin' },
  ]

  cases.forEach(({ role, expectedPath }) => {
    it(`Dashboard links to ${expectedPath} for role=${role}`, () => {
      renderNavbar('/', {
        user: { role },
        isAuthenticated: true,
        logout: vi.fn(),
      })
      const dashboardLinks = screen.getAllByText('Dashboard')
      expect(dashboardLinks[0].closest('a')).toHaveAttribute('href', expectedPath)
    })
  })

  it('Login link goes to /login for unauthenticated users', () => {
    renderNavbar('/', { user: null, isAuthenticated: false, logout: vi.fn() })
    expect(screen.getByText('Login').closest('a')).toHaveAttribute('href', '/login')
  })
})
