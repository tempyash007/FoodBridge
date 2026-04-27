/**
 * pages/VolunteerDashboard.test.jsx
 * Integration tests for VolunteerDashboard.
 *
 * volunteerService methods are mocked with explicit vi.fn() factories.
 * useAuth and auth.service are mocked similarly.
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

vi.mock('../../services/volunteer.service', () => ({
  volunteerService: {
    getDashboard: vi.fn(),
    getAvailableMissions: vi.fn(),
    getActiveMissions: vi.fn(),
    getSchedule: vi.fn(),
    getLeaderboard: vi.fn(),
    acceptMission: vi.fn(),
    updateMissionStatus: vi.fn(),
    updateSchedule: vi.fn(),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { useAuth } from '../../context/AuthContext'
import { volunteerService } from '../../services/volunteer.service'
import { logout as logoutService } from '../../services/auth.service'
import VolunteerDashboard from '../../pages/VolunteerDashboard'

// ── Fixtures ────────────────────────────────────────────────────────────────

const dashboardData = {
  stats: {
    total_deliveries: 42,
    this_week_deliveries: 5,
    points_earned: 840,
    avg_rating: 4.9,
  },
  current_deliveries: [
    {
      mission_id: 'm1',
      status: 'assigned',
      is_urgent: false,
      pickup: {
        org_name: 'Bakery A',
        address: '10 Main St',
        quantity: 5,
        quantity_unit: 'kg',
        listing_title: 'Bread',
      },
      delivery: { org_name: 'Shelter B', address: '20 Park Ave' },
      distance_km: 3.5,
      est_duration_min: 15,
    },
  ],
  optimized_route: null,
}

const availableMissionsData = {
  missions: [
    {
      claim_id: 'c1',
      donor_org: 'Restaurant X',
      recipient_org: 'Food Bank Y',
      quantity: 10,
      quantity_unit: 'kg',
      listing_title: 'Pasta',
      distance_km: 2.1,
      points: 50,
      is_urgent: false,
      minutes_until_expiry: 30,
    },
  ],
}

const leaderboardData = {
  top3: [
    { name: 'Alice', points: 1000, total_deliveries: 50, is_current_user: true },
    { name: 'Bob', points: 800, total_deliveries: 40, is_current_user: false },
    { name: 'Carol', points: 600, total_deliveries: 30, is_current_user: false },
  ],
  rankings: [
    { rank: 1, name: 'Alice', points: 1000, total_deliveries: 50, is_current_user: true },
    { rank: 2, name: 'Bob', points: 800, total_deliveries: 40, is_current_user: false },
  ],
}

const scheduleData = {
  schedule: [
    { day_name: 'Monday', slots: [{ start_time: '09:00', end_time: '12:00' }] },
    { day_name: 'Tuesday', slots: [] },
  ],
}

function setupAuth(overrides = {}) {
  useAuth.mockReturnValue({
    user: { first_name: 'Volunteer', role: 'volunteer' },
    logout: vi.fn(),
    ...overrides,
  })
}

function renderDashboard() {
  setupAuth()
  return render(<MemoryRouter><VolunteerDashboard /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────────────────────

describe('VolunteerDashboard — Active Missions tab (default)', () => {
  it('renders Active Missions heading', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Active Missions')).toBeInTheDocument()
    })
  })

  it('displays stats cards with loaded data', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument()
      expect(screen.getByText('840')).toBeInTheDocument()
    })
  })

  it('shows a mission card with pickup and delivery info', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Bakery A')).toBeInTheDocument()
      expect(screen.getByText('Shelter B')).toBeInTheDocument()
    })
  })

  it('shows empty state when no current deliveries', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce({
      ...dashboardData,
      current_deliveries: [],
    })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('No active missions')).toBeInTheDocument()
    })
  })

  it('logs error when getDashboard throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    volunteerService.getDashboard.mockRejectedValueOnce(new Error('Server error'))
    renderDashboard()
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
    })
    consoleSpy.mockRestore()
  })
})

describe('VolunteerDashboard — Available Missions tab', () => {
  async function openAvailableTab() {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    volunteerService.getAvailableMissions.mockResolvedValueOnce(availableMissionsData)
    renderDashboard()
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Available'))
    await waitFor(() => screen.getByText('Available Missions'))
    return user
  }

  it('renders Available Missions heading', async () => {
    await openAvailableTab()
    expect(screen.getByText('Available Missions')).toBeInTheDocument()
  })

  it('renders mission cards from API response', async () => {
    await openAvailableTab()
    await waitFor(() => {
      expect(screen.getByText('Restaurant X')).toBeInTheDocument()
      expect(screen.getByText('Food Bank Y')).toBeInTheDocument()
    })
  })

  it('shows empty state when no missions available', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    volunteerService.getAvailableMissions.mockResolvedValueOnce({ missions: [] })
    renderDashboard()
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Available'))

    await waitFor(() => {
      expect(screen.getByText('No available missions right now')).toBeInTheDocument()
    })
  })

  it('calls acceptMission with correct claim id on Accept click', async () => {
    const user = await openAvailableTab()
    volunteerService.acceptMission.mockResolvedValueOnce({ mission_id: 'm2' })
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)

    await user.click(screen.getByRole('button', { name: /Accept Mission/i }))

    await waitFor(() => {
      expect(volunteerService.acceptMission).toHaveBeenCalledWith('c1')
    })
  })
})

describe('VolunteerDashboard — Schedule tab', () => {
  it('renders schedule days when data is loaded', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    volunteerService.getSchedule.mockResolvedValueOnce(scheduleData)
    renderDashboard()
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Schedule'))

    await waitFor(() => {
      expect(screen.getByText('Monday')).toBeInTheDocument()
      expect(screen.getByText('Tuesday')).toBeInTheDocument()
      expect(screen.getByText('09:00 - 12:00')).toBeInTheDocument()
      expect(screen.getByText('Off')).toBeInTheDocument()
    })
  })
})

describe('VolunteerDashboard — Leaderboard tab', () => {
  it('renders leaderboard with top 3 names', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    volunteerService.getLeaderboard.mockResolvedValueOnce(leaderboardData)
    renderDashboard()
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Leaderboard'))

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Carol')).toBeInTheDocument()
    })
  })

  it('renders rankings list below podium', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    volunteerService.getLeaderboard.mockResolvedValueOnce(leaderboardData)
    renderDashboard()
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Leaderboard'))

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument()
      expect(screen.getByText('#2')).toBeInTheDocument()
    })
  })
})

describe('VolunteerDashboard — Achievements tab', () => {
  it('renders achievements summary and grid', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    renderDashboard()
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Achievements'))

    await waitFor(() => {
      expect(screen.getByText('Achievements & Badges')).toBeInTheDocument()
      expect(screen.getByText('Earned')).toBeInTheDocument()
      expect(screen.getByText('First Delivery')).toBeInTheDocument()
    })
  })
})

describe('VolunteerDashboard — updateMissionStatus', () => {
  it('calls updateMissionStatus with correct args when status button clicked', async () => {
    volunteerService.getDashboard
      .mockResolvedValueOnce(dashboardData)
      .mockResolvedValueOnce(dashboardData)
    volunteerService.updateMissionStatus.mockResolvedValueOnce({ updated: true })

    renderDashboard()
    await waitFor(() => screen.getByText('Bakery A'))

    const user = userEvent.setup()
    await user.click(screen.getByText(/Mark Heading to Pickup/i))

    await waitFor(() => {
      expect(volunteerService.updateMissionStatus).toHaveBeenCalledWith('m1', 'in_transit')
    })
  })

  it('shows alert when updateMissionStatus fails', async () => {
    global.alert = vi.fn()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    volunteerService.updateMissionStatus.mockRejectedValueOnce(new Error('Update failed'))

    renderDashboard()
    await waitFor(() => screen.getByText('Bakery A'))

    const user = userEvent.setup()
    await user.click(screen.getByText(/Mark Heading to Pickup/i))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to update status')
    })
    consoleSpy.mockRestore()
  })
})

describe('VolunteerDashboard — logout', () => {
  it('calls logout and navigates to /login on Sign Out click', async () => {
    volunteerService.getDashboard.mockResolvedValueOnce(dashboardData)
    const logoutContext = vi.fn()
    useAuth.mockReturnValue({
      user: { first_name: 'Test', role: 'volunteer' },
      logout: logoutContext,
    })

    render(<MemoryRouter><VolunteerDashboard /></MemoryRouter>)
    await waitFor(() => screen.getByText('Active Missions'))

    const user = userEvent.setup()
    await user.click(screen.getByText('Sign Out'))

    await waitFor(() => {
      expect(logoutContext).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })
})
