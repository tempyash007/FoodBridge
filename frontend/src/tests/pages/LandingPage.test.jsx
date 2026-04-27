/**
 * pages/LandingPage.test.jsx
 * Smoke + content tests for the public LandingPage.
 *
 * IntersectionObserver and requestAnimationFrame are already stubbed in setup.js.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from '../../pages/LandingPage'

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )
}

describe('LandingPage — static content', () => {
  it('renders the brand name "FoodBridge"', () => {
    renderLanding()
    const brands = screen.getAllByText('FoodBridge')
    expect(brands.length).toBeGreaterThan(0)
  })

  it('renders the hero headline', () => {
    renderLanding()
    expect(screen.getByText(/Connect/i)).toBeInTheDocument()
    expect(screen.getByText(/Surplus Food/i)).toBeInTheDocument()
  })

  it('renders the hero description paragraph', () => {
    renderLanding()
    expect(screen.getByText(/reduce food waste/i)).toBeInTheDocument()
  })

  it('renders "Join FoodBridge" CTA button', () => {
    renderLanding()
    const joinBtns = screen.getAllByRole('link', { name: /Join FoodBridge/i })
    expect(joinBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Login and Get Started navbar links', () => {
    renderLanding()
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('Login link points to /login', () => {
    renderLanding()
    expect(screen.getByText('Login').closest('a')).toHaveAttribute('href', '/login')
  })

  it('"Get Started" link points to /register', () => {
    renderLanding()
    expect(screen.getByText('Get Started').closest('a')).toHaveAttribute('href', '/register')
  })
})

describe('LandingPage — How It Works section', () => {
  it('renders "How FoodBridge Works" section heading', () => {
    renderLanding()
    expect(screen.getByText('How FoodBridge Works')).toBeInTheDocument()
  })

  it('renders all 3 process steps', () => {
    renderLanding()
    expect(screen.getByText('Donors List Food')).toBeInTheDocument()
    expect(screen.getByText('Recipients Claim')).toBeInTheDocument()
    expect(screen.getByText('Volunteers Deliver')).toBeInTheDocument()
  })
})

describe('LandingPage — Features section', () => {
  it('renders "Platform Features" heading', () => {
    renderLanding()
    expect(screen.getByText('Platform Features')).toBeInTheDocument()
  })

  it('renders 4 feature cards', () => {
    renderLanding()
    expect(screen.getByText('Reduce Waste')).toBeInTheDocument()
    expect(screen.getByText('Smart Routing')).toBeInTheDocument()
    expect(screen.getByText('Verified Users')).toBeInTheDocument()
    expect(screen.getByText('Impact Tracking')).toBeInTheDocument()
  })
})

describe('LandingPage — Footer', () => {
  it('renders footer copyright text', () => {
    renderLanding()
    expect(screen.getByText(/2026 FoodBridge/i)).toBeInTheDocument()
  })
})

describe('LandingPage — Stat cards (initial state)', () => {
  it('renders "Meals Saved" stat label', () => {
    renderLanding()
    expect(screen.getByText('Meals Saved')).toBeInTheDocument()
  })

  it('renders "Active Users" stat label', () => {
    renderLanding()
    expect(screen.getByText('Active Users')).toBeInTheDocument()
  })

  it('renders "CO₂ Reduced" stat label', () => {
    renderLanding()
    expect(screen.getByText('CO₂ Reduced')).toBeInTheDocument()
  })
})

describe('LandingPage — CTA section', () => {
  it('renders the CTA headline', () => {
    renderLanding()
    expect(screen.getByText('Ready to Make a Difference?')).toBeInTheDocument()
  })

  it('"Join FoodBridge Today" CTA link points to /register', () => {
    renderLanding()
    const ctaLink = screen.getByRole('link', { name: /Join FoodBridge Today/i })
    expect(ctaLink).toHaveAttribute('href', '/register')
  })
})
