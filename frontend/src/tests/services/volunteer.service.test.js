/**
 * services/volunteer.service.test.js
 * Unit tests for volunteerService (src/services/volunteer.service.js)
 *
 * fetchWithAuth is mocked via an explicit factory — Vitest hoists vi.mock()
 * so we cannot rely on a variable defined before it.  The factory returns a
 * single vi.fn() that each test controls via mockResolvedValueOnce.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The mock MUST be declared before any import that transitively uses the module.
vi.mock('../../services/api', () => ({
  fetchWithAuth: vi.fn(),
}))

// Now import the mocked dep and the module under test.
import { fetchWithAuth } from '../../services/api'
import { volunteerService } from '../../services/volunteer.service'

function okResponse(data) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ data }),
  }
}
function errorResponse(status = 400) {
  return { ok: false, status, json: vi.fn().mockResolvedValue({}) }
}

beforeEach(() => vi.clearAllMocks())

// ─── getDashboard ────────────────────────────────────────────────────────────

describe('volunteerService.getDashboard', () => {
  it('returns data on success', async () => {
    const payload = { stats: { total_deliveries: 10 } }
    fetchWithAuth.mockResolvedValueOnce(okResponse(payload))

    const result = await volunteerService.getDashboard()

    expect(fetchWithAuth).toHaveBeenCalledWith('/volunteer/dashboard')
    expect(result).toEqual(payload)
  })

  it('throws when response is not ok', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse())
    await expect(volunteerService.getDashboard()).rejects.toThrow(
      'Failed to fetch volunteer dashboard'
    )
  })
})

// ─── getAvailableMissions ────────────────────────────────────────────────────

describe('volunteerService.getAvailableMissions', () => {
  it('returns missions data on success', async () => {
    const payload = { missions: [{ claim_id: 'c1' }] }
    fetchWithAuth.mockResolvedValueOnce(okResponse(payload))

    const result = await volunteerService.getAvailableMissions()

    expect(fetchWithAuth).toHaveBeenCalledWith('/volunteer/missions/available')
    expect(result).toEqual(payload)
  })

  it('throws on failure', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(500))
    await expect(volunteerService.getAvailableMissions()).rejects.toThrow(
      'Failed to fetch available missions'
    )
  })
})

// ─── getActiveMissions ───────────────────────────────────────────────────────

describe('volunteerService.getActiveMissions', () => {
  it('returns active missions on success', async () => {
    const payload = { missions: [{ mission_id: 'm1', status: 'assigned' }] }
    fetchWithAuth.mockResolvedValueOnce(okResponse(payload))

    const result = await volunteerService.getActiveMissions()

    expect(result).toEqual(payload)
  })

  it('throws on failure', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse())
    await expect(volunteerService.getActiveMissions()).rejects.toThrow(
      'Failed to fetch active missions'
    )
  })
})

// ─── acceptMission ───────────────────────────────────────────────────────────

describe('volunteerService.acceptMission', () => {
  it('posts to correct URL and returns data', async () => {
    const payload = { mission_id: 'm1' }
    fetchWithAuth.mockResolvedValueOnce(okResponse(payload))

    const result = await volunteerService.acceptMission('c42')

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/volunteer/missions/c42/accept',
      { method: 'POST' }
    )
    expect(result).toEqual(payload)
  })

  it('throws when claim is not found (404)', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(404))
    await expect(volunteerService.acceptMission('bad-id')).rejects.toThrow(
      'Failed to accept mission'
    )
  })

  it('throws when claimId is undefined', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(400))
    await expect(volunteerService.acceptMission(undefined)).rejects.toThrow(
      'Failed to accept mission'
    )
  })
})

// ─── updateMissionStatus ─────────────────────────────────────────────────────

describe('volunteerService.updateMissionStatus', () => {
  it('sends PATCH with correct body', async () => {
    fetchWithAuth.mockResolvedValueOnce(okResponse({ updated: true }))

    await volunteerService.updateMissionStatus('m1', 'in_transit')

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/volunteer/missions/m1/status',
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_transit' }),
      }
    )
  })

  it('throws on invalid status (server rejects with 422)', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(422))
    await expect(
      volunteerService.updateMissionStatus('m1', 'invalid_status')
    ).rejects.toThrow('Failed to update mission status')
  })

  it('throws when missionId is null', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(400))
    await expect(
      volunteerService.updateMissionStatus(null, 'delivered')
    ).rejects.toThrow('Failed to update mission status')
  })
})

// ─── getSchedule ─────────────────────────────────────────────────────────────

describe('volunteerService.getSchedule', () => {
  it('returns schedule data', async () => {
    const payload = { schedule: [{ day_name: 'Monday', slots: [] }] }
    fetchWithAuth.mockResolvedValueOnce(okResponse(payload))

    const result = await volunteerService.getSchedule()

    expect(fetchWithAuth).toHaveBeenCalledWith('/volunteer/schedule')
    expect(result).toEqual(payload)
  })

  it('throws on failure', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse())
    await expect(volunteerService.getSchedule()).rejects.toThrow(
      'Failed to fetch schedule'
    )
  })
})

// ─── updateSchedule ──────────────────────────────────────────────────────────

describe('volunteerService.updateSchedule', () => {
  it('sends PUT with schedule data', async () => {
    const scheduleData = { slots: [{ day: 'Monday', start: '09:00' }] }
    fetchWithAuth.mockResolvedValueOnce(okResponse({ updated: true }))

    await volunteerService.updateSchedule(scheduleData)

    expect(fetchWithAuth).toHaveBeenCalledWith(
      '/volunteer/schedule',
      { method: 'PUT', body: JSON.stringify(scheduleData) }
    )
  })

  it('throws when schedule update is rejected by server', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(400))
    await expect(volunteerService.updateSchedule({})).rejects.toThrow(
      'Failed to update schedule'
    )
  })
})

// ─── getLeaderboard ──────────────────────────────────────────────────────────

describe('volunteerService.getLeaderboard', () => {
  it('returns leaderboard data', async () => {
    const payload = { top3: [], rankings: [] }
    fetchWithAuth.mockResolvedValueOnce(okResponse(payload))

    const result = await volunteerService.getLeaderboard()

    expect(fetchWithAuth).toHaveBeenCalledWith('/volunteer/leaderboard')
    expect(result).toEqual(payload)
  })

  it('throws on server error', async () => {
    fetchWithAuth.mockResolvedValueOnce(errorResponse(503))
    await expect(volunteerService.getLeaderboard()).rejects.toThrow(
      'Failed to fetch leaderboard'
    )
  })
})
