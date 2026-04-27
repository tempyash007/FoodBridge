/**
 * components/ProtectedRoute.test.jsx
 * Tests for the ProtectedRoute component.
 *
 * useAuth is mocked via an explicit factory that returns a vi.fn() so each
 * test can configure return values with mockReturnValue.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'
import ProtectedRoute from '../../components/ProtectedRoute'

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderProtected({ user, isAuthenticated, loading, allowedRoles }) {
  useAuth.mockReturnValue({ user, isAuthenticated, loading })

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div data-testid="protected-content">Protected!</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows spinner while loading=true', () => {
    renderProtected({ user: null, isAuthenticated: false, loading: true })
    expect(screen.getByText(/Verifying your session/i)).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  // ── Unauthenticated redirect ───────────────────────────────────────────────

  it('redirects to /login when user is not authenticated', () => {
    renderProtected({ user: null, isAuthenticated: false, loading: false })
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  // ── Role mismatch ──────────────────────────────────────────────────────────

  it('redirects to /login when authenticated but role does not match allowedRoles', () => {
    renderProtected({
      user: { role: 'donor' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: ['admin'],
    })
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects when role is volunteer but allowedRoles is recipient', () => {
    renderProtected({
      user: { role: 'volunteer' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: ['recipient'],
    })
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  // ── Successful access ──────────────────────────────────────────────────────

  it('renders children when authenticated and role matches', () => {
    renderProtected({
      user: { role: 'admin' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: ['admin'],
    })
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('renders children when allowedRoles contains multiple roles and user matches one', () => {
    renderProtected({
      user: { role: 'donor' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: ['donor', 'admin'],
    })
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('renders children when no allowedRoles are specified (any authenticated user)', () => {
    renderProtected({
      user: { role: 'recipient' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: undefined,
    })
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('redirects when user object exists but role is an unexpected value', () => {
    renderProtected({
      user: { role: 'superuser' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: ['admin', 'donor'],
    })
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('redirects when allowedRoles is an empty array', () => {
    renderProtected({
      user: { role: 'donor' },
      isAuthenticated: true,
      loading: false,
      allowedRoles: [],
    })
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })
})
