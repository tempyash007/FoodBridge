/**
 * components/ThemeToggle.test.jsx
 * Unit tests for ThemeToggle component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeToggle from '../../components/ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    // Reset theme attribute
    document.documentElement.removeAttribute('data-theme')
  })

  // ── Initial render ─────────────────────────────────────────────────────────

  it('renders the toggle button', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('defaults to light mode when localStorage has no saved theme', () => {
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('starts in dark mode when localStorage has "dark"', () => {
    localStorage.setItem('foodbridge-theme', 'dark')
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('starts in light mode when localStorage has "light"', () => {
    localStorage.setItem('foodbridge-theme', 'light')
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  // ── Toggle behaviour ───────────────────────────────────────────────────────

  it('switches from light to dark on click', async () => {
    render(<ThemeToggle />)
    const user = userEvent.setup()
    const btn = screen.getByRole('button')

    await user.click(btn)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('foodbridge-theme')).toBe('dark')
  })

  it('switches from dark back to light on second click', async () => {
    localStorage.setItem('foodbridge-theme', 'dark')
    render(<ThemeToggle />)
    const user = userEvent.setup()
    const btn = screen.getByRole('button')

    await user.click(btn)

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('foodbridge-theme')).toBe('light')
  })

  it('updates the title attribute after toggle', async () => {
    render(<ThemeToggle />)
    const user = userEvent.setup()
    const btn = screen.getByRole('button')

    // Initially light mode
    expect(btn).toHaveAttribute('title', 'Switch to dark mode')

    await user.click(btn)

    expect(btn).toHaveAttribute('title', 'Switch to light mode')
  })

  it('button has the correct id', () => {
    render(<ThemeToggle />)
    expect(document.getElementById('theme-toggle-btn')).toBeInTheDocument()
  })
})
