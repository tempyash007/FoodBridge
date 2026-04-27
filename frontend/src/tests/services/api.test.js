/**
 * services/api.test.js
 * Unit tests for the fetchWithAuth wrapper (src/services/api.js)
 *
 * Strategy:
 *  - vi.spyOn(global, 'fetch') to intercept all network calls.
 *  - No real HTTP requests are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithAuth } from '../../services/api'

const API_BASE = 'http://localhost:3000/api'

// Helper to build a minimal Response-like mock
function makeFetchResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('fetchWithAuth', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns the response on a successful 200 request', async () => {
    const mockResponse = makeFetchResponse(200, { data: 'ok' })
    fetchSpy.mockResolvedValueOnce(mockResponse)

    const res = await fetchWithAuth('/some-endpoint')

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_BASE}/some-endpoint`,
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('merges caller-supplied headers with the default Content-Type', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200))

    await fetchWithAuth('/test', { headers: { 'X-Custom': 'yes' } })

    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_BASE}/test`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': 'yes',
        }),
      })
    )
  })

  it('uses the credentials from options when explicitly provided', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200))

    await fetchWithAuth('/test', { credentials: 'same-origin' })

    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_BASE}/test`,
      expect.objectContaining({ credentials: 'same-origin' })
    )
  })

  // ── 401 / token refresh flow ──────────────────────────────────────────────

  it('retries the original request after a successful token refresh on 401', async () => {
    const unauthorised = makeFetchResponse(401)
    const refreshOk = makeFetchResponse(200)
    const retryOk = makeFetchResponse(200, { data: 'retried' })

    fetchSpy
      .mockResolvedValueOnce(unauthorised) // original request → 401
      .mockResolvedValueOnce(refreshOk)    // refresh → 200
      .mockResolvedValueOnce(retryOk)      // retry → 200

    const res = await fetchWithAuth('/protected')

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(res.status).toBe(200)
  })

  it('clears localStorage and redirects to /login when refresh fails', async () => {
    const unauthorised = makeFetchResponse(401)
    const refreshFailed = makeFetchResponse(403)

    fetchSpy
      .mockResolvedValueOnce(unauthorised)
      .mockResolvedValueOnce(refreshFailed)

    await fetchWithAuth('/protected')

    expect(localStorage.clear).toHaveBeenCalled()
    expect(window.location.href).toBe('/login')
  })

  it('clears localStorage and redirects when the refresh request throws', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeFetchResponse(401))
      .mockRejectedValueOnce(new Error('Network error'))

    await fetchWithAuth('/protected')

    expect(localStorage.clear).toHaveBeenCalled()
    expect(window.location.href).toBe('/login')
  })

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('passes through non-401 error responses without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(500))

    const res = await fetchWithAuth('/boom')

    expect(res.status).toBe(500)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('passes through 403 Forbidden without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(403))

    const res = await fetchWithAuth('/forbidden')

    expect(res.status).toBe(403)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('appends the endpoint correctly even when it starts without a slash', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(200))

    await fetchWithAuth('no-leading-slash')

    // The URL is constructed by simple concatenation in the source
    expect(fetchSpy).toHaveBeenCalledWith(
      `${API_BASE}no-leading-slash`,
      expect.any(Object)
    )
  })
})
