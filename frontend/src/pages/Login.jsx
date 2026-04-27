import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
    Leaf, Mail, Lock, Eye, EyeOff, ArrowRight,
    Chrome, Facebook, AlertCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchWithAuth } from '../services/api'

export default function Login() {
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const location = useLocation()
    const { login } = useAuth()

    // Message passed by ProtectedRoute when user is redirected here
    const redirectMessage = location.state?.message || ''

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const response = await fetchWithAuth('/auth/login', {
                method: "POST",
                body: JSON.stringify({ email, password })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.message || "Login failed")
                setLoading(false)
                return
            }

            // fetch user from /me via context
            const user = await login()
            
            // Route user based on their role
            const userRole = data.data.user.role;
            if (user.role === 'admin') {
                navigate('/admin', { replace: true });
            } else if (user.role === 'recipient') {
                navigate('/recipient', { replace: true });
            } else if (user.role === 'volunteer') {
                navigate('/volunteer', { replace: true });
            } else if (user.role === 'donor') {
                navigate('/donor', { replace: true });
            }

        } catch (err) {
            console.error(err)
            setError("Server error. Please try again.")
        }

        setLoading(false)
    }

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />
            <div className="auth-glow auth-glow-1" />
            <div className="auth-glow auth-glow-2" />

            <div className="auth-container">
                <div className="auth-card" id="login-card">
                    <Link to="/" className="auth-brand">
                        <div className="brand-icon">
                            <Leaf size={22} color="#fff" />
                        </div>
                        <span>FoodBridge</span>
                    </Link>

                    <div className="auth-header">
                        <h1 className="auth-title">Welcome back</h1>
                        <p className="auth-subtitle">Sign in to continue your food rescue mission</p>
                    </div>

                    {/* Redirect / error messages */}
                    {redirectMessage && (
                        <div className="auth-alert auth-alert-warning" id="redirect-message">
                            <AlertCircle size={18} />
                            <span>{redirectMessage}</span>
                        </div>
                    )}
                    {error && (
                        <div className="auth-alert auth-alert-error" id="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="oauth-buttons">
                        <button className="oauth-btn" id="google-login-btn">
                            <Chrome size={20} />
                            <span>Google</span>
                        </button>
                        <button className="oauth-btn" id="facebook-login-btn">
                            <Facebook size={20} />
                            <span>Facebook</span>
                        </button>
                    </div>

                    <div className="auth-divider">
                        <span>or continue with email</span>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-email">Email address</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    id="login-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="form-label-row">
                                <label className="form-label" htmlFor="login-password">Password</label>
                                <Link to="/forgot-password" className="form-link">Forgot password?</Link>
                            </div>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="input-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary btn-lg btn-full${loading ? ' btn-loading' : ''}`}
                            id="login-submit-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="spinner" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-footer-text">
                        Don't have an account?{' '}
                        <Link to="/register" className="auth-link">Create one</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
