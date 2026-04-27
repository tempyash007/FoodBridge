import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
    Leaf, Lock, Eye, EyeOff, ArrowRight,
    AlertCircle, CheckCircle, ShieldCheck, Clock,
} from 'lucide-react'
import { fetchWithAuth } from '../services/api'

export default function ResetPassword() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const tokenFromUrl = searchParams.get('token') || ''
    const emailFromUrl = searchParams.get('email') || ''

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [expired, setExpired] = useState(false)

    // Validate query params on mount
    useEffect(() => {
        if (!tokenFromUrl || !emailFromUrl) {
            setError('Invalid or missing reset link. Please request a new one.')
        }
    }, [tokenFromUrl, emailFromUrl])

    // Password strength indicator
    const getPasswordStrength = (pw) => {
        if (!pw) return { label: '', color: '', percent: 0 }
        let score = 0
        if (pw.length >= 8) score++
        if (pw.length >= 12) score++
        if (/[A-Z]/.test(pw)) score++
        if (/[0-9]/.test(pw)) score++
        if (/[^A-Za-z0-9]/.test(pw)) score++

        if (score <= 1) return { label: 'Weak', color: '#f87171', percent: 20 }
        if (score === 2) return { label: 'Fair', color: '#fb923c', percent: 40 }
        if (score === 3) return { label: 'Good', color: '#facc15', percent: 60 }
        if (score === 4) return { label: 'Strong', color: '#34d399', percent: 80 }
        return { label: 'Excellent', color: '#10b981', percent: 100 }
    }

    const strength = getPasswordStrength(newPassword)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)

        try {
            const response = await fetchWithAuth('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    email: emailFromUrl,
                    token: tokenFromUrl,
                    new_password: newPassword,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                // Detect expired / invalid token → switch to dedicated expired screen
                const msg = (data.message || '').toLowerCase()
                if (msg.includes('expired') || msg.includes('invalid')) {
                    setExpired(true)
                    setLoading(false)
                    return
                }
                setError(data.message || 'Failed to reset password.')
                setLoading(false)
                return
            }

            setSuccess(true)
        } catch {
            setError('Server error. Please try again.')
        }

        setLoading(false)
    }

    /* ---- SUCCESS STATE ---- */
    if (success) {
        return (
            <div className="auth-page">
                <div className="auth-bg-pattern" />
                <div className="auth-glow auth-glow-1" />
                <div className="auth-glow auth-glow-2" />

                <div className="auth-container">
                    <div className="auth-card" id="reset-success-card">
                        <Link to="/" className="auth-brand">
                            <div className="brand-icon"><Leaf size={22} color="#fff" /></div>
                            <span>FoodBridge</span>
                        </Link>

                        <div className="auth-header">
                            <div className="auth-success-icon">
                                <CheckCircle size={48} />
                            </div>
                            <h1 className="auth-title">Password reset!</h1>
                            <p className="auth-subtitle">
                                Your password has been updated successfully. You can now sign in with your new password.
                            </p>
                        </div>

                        <button
                            className="btn btn-primary btn-lg btn-full"
                            onClick={() => navigate('/login', { replace: true })}
                            id="go-to-login-btn"
                        >
                            Go to Sign In
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    /* ---- EXPIRED / INVALID TOKEN STATE ---- */
    if (expired) {
        return (
            <div className="auth-page">
                <div className="auth-bg-pattern" />
                <div className="auth-glow auth-glow-1" />
                <div className="auth-glow auth-glow-2" />

                <div className="auth-container">
                    <div className="auth-card" id="reset-expired-card">
                        <Link to="/" className="auth-brand">
                            <div className="brand-icon"><Leaf size={22} color="#fff" /></div>
                            <span>FoodBridge</span>
                        </Link>

                        <div className="auth-header">
                            <div className="auth-success-icon" style={{ color: '#f87171' }}>
                                <Clock size={48} />
                            </div>
                            <h1 className="auth-title">Link expired</h1>
                            <p className="auth-subtitle">
                                This password reset link has expired or has already been used.
                                Reset links are valid for 15 minutes. Please request a new one.
                            </p>
                        </div>

                        <button
                            className="btn btn-primary btn-lg btn-full"
                            onClick={() => navigate('/forgot-password', { replace: true })}
                            id="request-new-link-btn"
                        >
                            Request New Link
                            <ArrowRight size={18} />
                        </button>

                        <p className="auth-footer-text" style={{ marginTop: '16px' }}>
                            <Link to="/login" className="auth-link">Back to Sign In</Link>
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    /* ---- FORM STATE ---- */
    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />
            <div className="auth-glow auth-glow-1" />
            <div className="auth-glow auth-glow-2" />

            <div className="auth-container">
                <div className="auth-card" id="reset-password-card">
                    <Link to="/" className="auth-brand">
                        <div className="brand-icon"><Leaf size={22} color="#fff" /></div>
                        <span>FoodBridge</span>
                    </Link>

                    <div className="auth-header">
                        <div className="auth-success-icon" style={{ color: 'var(--primary-400)' }}>
                            <ShieldCheck size={44} />
                        </div>
                        <h1 className="auth-title">Set new password</h1>
                        <p className="auth-subtitle">
                            Choose a strong password with at least 8 characters.
                        </p>
                    </div>

                    {error && (
                        <div className="auth-alert auth-alert-error" id="reset-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="reset-new-password">New Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="reset-new-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    disabled={!tokenFromUrl || !emailFromUrl}
                                />
                                <button
                                    type="button"
                                    className="input-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Password strength bar */}
                            {newPassword && (
                                <div className="password-strength">
                                    <div className="password-strength-bar">
                                        <div
                                            className="password-strength-fill"
                                            style={{ width: `${strength.percent}%`, background: strength.color }}
                                        />
                                    </div>
                                    <span className="password-strength-label" style={{ color: strength.color }}>
                                        {strength.label}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reset-confirm-password">Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="reset-confirm-password"
                                    type={showConfirm ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    disabled={!tokenFromUrl || !emailFromUrl}
                                />
                                <button
                                    type="button"
                                    className="input-toggle"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                >
                                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Match indicator */}
                            {confirmPassword && (
                                <span className={`password-match ${newPassword === confirmPassword ? 'match' : 'no-match'}`}>
                                    {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                </span>
                            )}
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary btn-lg btn-full${loading ? ' btn-loading' : ''}`}
                            id="reset-submit-btn"
                            disabled={loading || !tokenFromUrl || !emailFromUrl}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : (
                                <>
                                    Reset Password
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-footer-text">
                        <Link to="/login" className="auth-link">Back to Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
