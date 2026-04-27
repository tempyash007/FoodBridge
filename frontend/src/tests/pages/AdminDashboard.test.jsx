/**
 * pages/AdminDashboard.test.jsx
 * Integration tests for AdminDashboard.
 *
 * - global.fetch intercepted for all /api/admin/* endpoints
 * - useAuth mocked with explicit vi.fn() factory
 * - useNavigate mocked
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useAuth } from '../../context/AuthContext'
import { logout as logoutService } from '../../services/auth.service'
import AdminDashboard from '../../pages/AdminDashboard'

// ── Fixtures ───────────────────────────────────────────────────────────────

const overviewPayload = {
  stats: {
    total_users: 500, users_this_week: 12,
    active_listings: 30, listings_today: 4,
    deliveries_today: 18, deliveries_vs_yesterday_pct: 10,
    meals_rescued: 2000, meals_this_week: 200,
  },
  weekly_activity: [
    { day: 'Mon', donors: 5, recipients: 3, deliveries: 2 },
  ],
  live_activity: [
    { type: 'VERIFICATION_APPROVED', message: 'Org A approved', created_at: new Date().toISOString() },
  ],
  quick_stats: { pending_verifications: 3, flagged_content: 1, system_health: '99.9%' },
}

const verificationPayload = {
  verifications: [
    { org_id: 'org1', org_name: 'Test Org', email: 'org@test.com', role: 'donor', submitted_at: new Date().toISOString() },
  ],
}

const moderationPayload = {
  flagged_listings: [
    { listing_id: 'lst1', title: 'Bad Listing', donor_name: 'Donor X', reason: 'Spam', report_count: 2, flagged_at: new Date().toISOString() },
  ],
}

const usersPayload = {
  counts: { donors: 100, recipients: 80, volunteers: 50, donors_verified: 90, recipients_verified: 70, volunteers_verified: 45 },
  recent_users: [
    { user_id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'donor', is_active: true, created_at: new Date().toISOString() },
  ],
  pagination: { total: 1, page: 1, total_pages: 1 },
}

function makeFetchResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    json: vi.fn().mockResolvedValue(body),
  }
}

function setupAuth(overrides = {}) {
  useAuth.mockReturnValue({ logout: vi.fn(), ...overrides })
}

function renderAdmin() {
  setupAuth()
  return render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AdminDashboard — Overview tab (default)', () => {
  let fetchSpy
  beforeEach(() => { fetchSpy = vi.spyOn(global, 'fetch') })
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

  it('renders the System Overview heading after data loads', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('System Overview')).toBeInTheDocument()
    })
  })

  it('displays total users metric', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument()
      expect(screen.getByText('500')).toBeInTheDocument()
    })
  })

  it('displays meals rescued metric', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Meals Rescued')).toBeInTheDocument()
    })
  })

  it('shows an error banner when overview API fails', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(500, { message: 'Server crash' }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText(/Server crash/i)).toBeInTheDocument()
    })
  })

  it('shows live activity item', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Live Activity')).toBeInTheDocument()
      expect(screen.getByText('Org A approved')).toBeInTheDocument()
    })
  })

  it('shows "No recent activity" when live_activity is empty', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { data: { ...overviewPayload, live_activity: [] } })
    )
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — sidebar navigation', () => {
  let fetchSpy
  beforeEach(() => { fetchSpy = vi.spyOn(global, 'fetch') })
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

  it('switches to Verification tab on click', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
      .mockResolvedValueOnce(makeFetchResponse(200, { data: verificationPayload }))

    renderAdmin()
    await waitFor(() => screen.getByText('System Overview'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Verification'))

    await waitFor(() => {
      expect(screen.getByText('User Verification')).toBeInTheDocument()
    })
  })

  it('switches to Moderation tab on click', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
      .mockResolvedValueOnce(makeFetchResponse(200, { data: moderationPayload }))

    renderAdmin()
    await waitFor(() => screen.getByText('System Overview'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Moderation'))

    await waitFor(() => {
      expect(screen.getByText('Content Moderation')).toBeInTheDocument()
    })
  })

  it('switches to Users tab on click', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
      .mockResolvedValueOnce(makeFetchResponse(200, { data: usersPayload }))

    renderAdmin()
    await waitFor(() => screen.getByText('System Overview'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Users'))

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — Verification tab actions', () => {
  let fetchSpy
  beforeEach(() => { fetchSpy = vi.spyOn(global, 'fetch') })
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

  async function openVerificationTab() {
    fetchSpy
      .mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
      .mockResolvedValueOnce(makeFetchResponse(200, { data: verificationPayload }))

    renderAdmin()
    await waitFor(() => screen.getByText('System Overview'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Verification'))
    await waitFor(() => screen.getByText('User Verification'))
    return user
  }

  it('renders pending verification card', async () => {
    await openVerificationTab()
    expect(screen.getByText('Test Org')).toBeInTheDocument()
    expect(screen.getByText('org@test.com')).toBeInTheDocument()
  })

  it('removes card from list after clicking Approve', async () => {
    const user = await openVerificationTab()
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: {} }))

    await user.click(screen.getByRole('button', { name: /Approve/i }))

    await waitFor(() => {
      expect(screen.queryByText('Test Org')).not.toBeInTheDocument()
      expect(screen.getByText('All caught up!')).toBeInTheDocument()
    })
  })

  it('removes card from list after clicking Reject', async () => {
    const user = await openVerificationTab()
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: {} }))

    await user.click(screen.getByRole('button', { name: /Reject/i }))

    await waitFor(() => {
      expect(screen.queryByText('Test Org')).not.toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — Moderation tab actions', () => {
  let fetchSpy
  beforeEach(() => { fetchSpy = vi.spyOn(global, 'fetch') })
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

  async function openModerationTab() {
    fetchSpy
      .mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
      .mockResolvedValueOnce(makeFetchResponse(200, { data: moderationPayload }))

    renderAdmin()
    await waitFor(() => screen.getByText('System Overview'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Moderation'))
    await waitFor(() => screen.getByText('Content Moderation'))
    return user
  }

  it('renders flagged listing card', async () => {
    await openModerationTab()
    expect(screen.getByText('Bad Listing')).toBeInTheDocument()
    expect(screen.getByText(/Spam/)).toBeInTheDocument()
  })

  it('removes card after Dismiss action', async () => {
    const user = await openModerationTab()
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: {} }))

    await user.click(screen.getByRole('button', { name: /Dismiss/i }))

    await waitFor(() => {
      expect(screen.queryByText('Bad Listing')).not.toBeInTheDocument()
      expect(screen.getByText('All clear!')).toBeInTheDocument()
    })
  })

  it('removes card after Remove action', async () => {
    const user = await openModerationTab()
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: {} }))

    await user.click(screen.getByRole('button', { name: /Remove/i }))

    await waitFor(() => {
      expect(screen.queryByText('Bad Listing')).not.toBeInTheDocument()
    })
  })
})

describe('AdminDashboard — logout', () => {
  let fetchSpy
  beforeEach(() => { fetchSpy = vi.spyOn(global, 'fetch') })
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

  it('calls logout services and navigates to /login on Sign Out click', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, { data: overviewPayload }))
    const logoutContext = vi.fn()
    useAuth.mockReturnValue({ logout: logoutContext })

    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    await waitFor(() => screen.getByText('System Overview'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Sign Out'))

    await waitFor(() => {
      expect(logoutContext).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})
