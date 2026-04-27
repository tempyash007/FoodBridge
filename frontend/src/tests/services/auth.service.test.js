/**
 * services/auth.service.test.js
 * Unit tests for auth.service.js (logout)
 *
 * All network calls are intercepted via vi.spyOn(global, 'fetch').
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logout } from '../../services/auth.service'

function makeFetchResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('auth.service → logout()', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
    // Seed localStorage with tokens that should be cleared after logout
    localStorage.setItem('accessToken', 'fake-access')
    localStorage.setItem('refreshToken', 'fake-refresh')
    localStorage.setItem('user', JSON.stringify({ id: 1 }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('calls POST /api/auth/logout with credentials: include', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { success: true, message: 'Logged out' })
    )

    await logout()

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('removes all three localStorage keys on success', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { success: true, message: 'Logged out' })
    )

    await logout()

    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('returns the server response data on success', async () => {
    const serverData = { success: true, message: 'Goodbye' }
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200, serverData))

    const result = await logout()

    expect(result).toEqual(serverData)
  })

  // ── Error handling ─────────────────────────────────────────────────────────

  it('still clears localStorage when the network request throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'))

    const result = await logout()

    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(result).toEqual({
      success: false,
      message: 'Network error during logout',
    })
  })

  it('still clears localStorage when server returns a 500', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(500, { success: false, message: 'Internal Server Error' })
    )

    await logout()

    expect(localStorage.getItem('accessToken')).toBeNull()
  })

  // ── Edge case ──────────────────────────────────────────────────────────────

  it('does not throw when localStorage is already empty', async () => {
    localStorage.clear()
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(200, { success: true, message: 'ok' })
    )

    await expect(logout()).resolves.not.toThrow()
  })
})
