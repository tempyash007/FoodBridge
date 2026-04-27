import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Leaf, Mail, ArrowRight, ArrowLeft,
    AlertCircle, CheckCircle, RefreshCw,
} from 'lucide-react'
import { fetchWithAuth } from '../services/api'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    // Resend cooldown state
    const [resending, setResending] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const [resendMessage, setResendMessage] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const response = await fetchWithAuth('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.message || 'Something went wrong')
                setLoading(false)
                return
            }

            setSubmitted(true)
        } catch {
            setError('Server error. Please try again.')
        }

        setLoading(false)
    }

    const handleResend = async () => {
        if (resendCooldown > 0 || resending) return

        setResending(true)
        setResendMessage('')

        try {
            const response = await fetchWithAuth('/auth/resend-reset', {
                method: 'POST',
                body: JSON.stringify({ email }),
            })

            const data = await response.json()

            if (response.status === 429) {
                setResendMessage('Please wait before requesting another reset.')
            } else if (!response.ok) {
                setResendMessage(data.message || 'Failed to resend.')
            } else {
                setResendMessage('A new reset link has been sent!')
            }

            // Start 60 s cooldown
            setResendCooldown(60)
            const tick = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) { clearInterval(tick); return 0 }
                    return prev - 1
                })
            }, 1000)
        } catch {
            setResendMessage('Network error. Please try again.')
        }

        setResending(false)
    }

    /* ---- SUCCESS STATE ---- */
    if (submitted) {
        return (
            <div className="auth-page">
                <div className="auth-bg-pattern" />
                <div className="auth-glow auth-glow-1" />
                <div className="auth-glow auth-glow-2" />

                <div className="auth-container">
                    <div className="auth-card" id="forgot-password-success-card">
                        <Link to="/" className="auth-brand">
                            <div className="brand-icon"><Leaf size={22} color="#fff" /></div>
                            <span>FoodBridge</span>
                        </Link>

                        <div className="auth-header">
                            <div className="auth-success-icon">
                                <CheckCircle size={48} />
                            </div>
                            <h1 className="auth-title">Check your email</h1>
                            <p className="auth-subtitle">
                                If <strong>{email}</strong> is registered, you'll receive a reset link shortly.
                                The link expires in 15 minutes.
                            </p>
                        </div>

                        {resendMessage && (
                            <div className={`auth-alert ${resendMessage.includes('sent') ? 'auth-alert-success' : 'auth-alert-warning'}`}>
                                <AlertCircle size={18} />
                                <span>{resendMessage}</span>
                            </div>
                        )}

                        <button
                            className={`btn btn-outline btn-lg btn-full${resending ? ' btn-loading' : ''}`}
                            onClick={handleResend}
                            disabled={resending || resendCooldown > 0}
                            id="resend-reset-btn"
                        >
                            {resending ? (
                                <span className="spinner" />
                            ) : (
                                <>
                                    <RefreshCw size={18} />
                                    {resendCooldown > 0
                                        ? `Resend available in ${resendCooldown}s`
                                        : 'Resend reset email'}
                                </>
                            )}
                        </button>

                        <p className="auth-footer-text" style={{ marginTop: '24px' }}>
                            <Link to="/login" className="auth-link">
                                <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Back to Sign In
                            </Link>
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
                <div className="auth-card" id="forgot-password-card">
                    <Link to="/" className="auth-brand">
                        <div className="brand-icon"><Leaf size={22} color="#fff" /></div>
                        <span>FoodBridge</span>
                    </Link>

                    <div className="auth-header">
                        <h1 className="auth-title">Forgot password?</h1>
                        <p className="auth-subtitle">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                    </div>

                    {error && (
                        <div className="auth-alert auth-alert-error" id="forgot-error">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="forgot-email">Email address</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    id="forgot-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary btn-lg btn-full${loading ? ' btn-loading' : ''}`}
                            id="forgot-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : (
                                <>
                                    Send Reset Link
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-footer-text">
                        Remember your password?{' '}
                        <Link to="/login" className="auth-link">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
