/**
 * pages/Register.test.jsx
 * Integration tests for the two-step Register page.
 *
 * - global.fetch is mocked for POST /api/auth/register
 * - useNavigate is mocked for redirect assertions
 * - window.alert is mocked
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import Register from '../../pages/Register'

global.alert = vi.fn()

function makeFetchResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  }
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Step 1 helpers ──────────────────────────────────────────────────────────

async function goToStep2(roleId = 'Donor') {
  const user = userEvent.setup()
  const roleBtn = screen.getByRole('button', { name: new RegExp(roleId, 'i') })
  await user.click(roleBtn)
  await user.click(screen.getByRole('button', { name: /Continue/i }))
  return user
}

describe('Register page — Step 1 (role selection)', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders all three role cards', () => {
    renderRegister()
    expect(screen.getByText('Donor')).toBeInTheDocument()
    expect(screen.getByText('Recipient')).toBeInTheDocument()
    expect(screen.getByText('Volunteer')).toBeInTheDocument()
  })

  it('Continue button is disabled until a role is selected', () => {
    renderRegister()
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled()
  })

  it('Continue button is enabled after clicking a role card', async () => {
    renderRegister()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Donor$/i }))
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled()
  })

  it('advances to step 2 when a role is selected and Continue clicked', async () => {
    renderRegister()
    await goToStep2('Donor')
    expect(screen.getByText(/Create your account/i)).toBeInTheDocument()
    expect(screen.getByText(/Registering as/i)).toBeInTheDocument()
  })
})

describe('Register page — Step 2 (form inputs)', () => {
  afterEach(() => vi.clearAllMocks())

  it('renders first name, last name, email, phone and password fields', async () => {
    renderRegister()
    await goToStep2('Recipient')

    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
  })

  it('Back button navigates back to step 1', async () => {
    renderRegister()
    const user = await goToStep2('Volunteer')
    await user.click(screen.getByRole('button', { name: /Back/i }))
    expect(screen.getByText(/Select your role/i)).toBeInTheDocument()
  })
})

describe('Register page — form submission (happy path)', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    global.alert.mockClear()
  })

  async function fillAndSubmit(role = 'Donor') {
    renderRegister()
    const user = await goToStep2(role)

    await user.type(screen.getByLabelText(/First Name/i), 'Alice')
    await user.type(screen.getByLabelText(/Last Name/i), 'Smith')
    await user.type(screen.getByLabelText(/Email Address/i), 'alice@test.com')
    await user.type(screen.getByLabelText(/Phone Number/i), '1234567890')
    await user.type(screen.getByLabelText(/Password/i), 'Secure@123')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))
    return user
  }

  it('calls POST /api/auth/register with correct payload on submit', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(201, { message: 'Registration successful' })
    )

    await fillAndSubmit('Donor')

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledOnce()
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"email":"alice@test.com"'),
        })
      )
    })
  })

  it('navigates to /login after successful registration', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(201, { message: 'Registration successful' })
    )

    await fillAndSubmit('Recipient')

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Registration successful!')
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  it('includes role in request body', async () => {
    fetchSpy.mockResolvedValueOnce(makeFetchResponse(201, {}))

    await fillAndSubmit('Volunteer')

    await waitFor(() => {
      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(callBody.role).toBe('volunteer')
    })
  })
})

describe('Register page — form submission (error handling)', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    global.alert.mockClear()
  })

  it('shows server error message via alert when registration fails', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(409, { message: 'Email already registered' })
    )

    renderRegister()
    const user = await goToStep2('Volunteer')
    await user.type(screen.getByLabelText(/First Name/i), 'Bob')
    await user.type(screen.getByLabelText(/Last Name/i), 'Jones')
    await user.type(screen.getByLabelText(/Email Address/i), 'existing@test.com')
    await user.type(screen.getByLabelText(/Phone Number/i), '9999999999')
    await user.type(screen.getByLabelText(/Password/i), 'pass')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Email already registered')
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows "Server error" alert when fetch throws a network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network failure'))

    renderRegister()
    const user = await goToStep2('Donor')
    await user.type(screen.getByLabelText(/First Name/i), 'Bob')
    await user.type(screen.getByLabelText(/Last Name/i), 'Jones')
    await user.type(screen.getByLabelText(/Email Address/i), 'bob@test.com')
    await user.type(screen.getByLabelText(/Phone Number/i), '1111111111')
    await user.type(screen.getByLabelText(/Password/i), 'secure')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Server error')
    })
  })
})
