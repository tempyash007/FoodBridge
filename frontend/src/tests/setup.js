import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── Stub IntersectionObserver (used in LandingPage hooks) ──────────────────
const observerMock = () => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
})
global.IntersectionObserver = vi.fn(observerMock)

// ── Stub requestAnimationFrame (used by useCounter hook) ───────────────────
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)

// ── Stub window.open (opened by map links / export buttons) ───────────────
global.open = vi.fn()

// ── Stub window.location (redirect in api.js 401 handler) ─────────────────
delete window.location
window.location = { href: '', reload: vi.fn() }

// ── Suppress expected console.error noise in component tests ──────────────
const originalConsoleError = console.error
beforeAll(() => {
  console.error = (...args) => {
    // Suppress act() warnings and lucide-react prop warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') ||
        args[0].includes('Warning: validateDOMNesting'))
    ) return
    originalConsoleError(...args)
  }
})
afterAll(() => { console.error = originalConsoleError })
