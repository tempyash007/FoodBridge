import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Leaf, Mail, Lock, Eye, EyeOff, ArrowRight, User,
    Chrome, Facebook,
    Utensils, HandHeart, Truck, ShieldCheck,
    Phone,
} from 'lucide-react'
import { fetchWithAuth } from '../services/api'

const ROLES = [
    { id: 'donor', label: 'Donor', icon: Utensils, desc: 'Restaurant, grocery store, or caterer with surplus food', color: 'green' },
    { id: 'recipient', label: 'Recipient', icon: HandHeart, desc: 'NGO, shelter, or individual in need of food', color: 'orange' },
    { id: 'volunteer', label: 'Volunteer', icon: Truck, desc: 'Delivery partner with vehicle for food transport', color: 'blue' },
    // { id: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'Platform administrator managing operations', color: 'purple' },
]

export default function Register() {
    const [step, setStep] = useState(1)
    const [selectedRole, setSelectedRole] = useState(null)
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
    })

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const response = await fetchWithAuth('/auth/register', {
                method: "POST",
                body: JSON.stringify({
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    role: selectedRole
                })
            })

            const data = await response.json()

            if (!response.ok) {
                alert(data.message || "Registration failed")
                setLoading(false)
                return
            }

            alert("Registration successful!")
            navigate("/login")

        } catch (error) {
            console.error(error)
            alert("Server error")
        }

        setLoading(false)
    }

    return (
        <div className="auth-page">
            <div className="auth-bg-pattern" />
            <div className="auth-glow auth-glow-1" />
            <div className="auth-glow auth-glow-2" />

            <div className="auth-container">
                <div className="auth-card auth-card-wide" id="register-card">
                    <Link to="/" className="auth-brand">
                        <div className="brand-icon">
                            <Leaf size={22} color="#fff" />
                        </div>
                        <span>FoodBridge</span>
                    </Link>

                    {/* Step indicators */}
                    <div className="auth-steps">
                        <div className={`auth-step${step >= 1 ? ' active' : ''}`}>
                            <div className="auth-step-dot">1</div>
                            <span>Select Role</span>
                        </div>
                        <div className="auth-step-line" />
                        <div className={`auth-step${step >= 2 ? ' active' : ''}`}>
                            <div className="auth-step-dot">2</div>
                            <span>Your Details</span>
                        </div>
                    </div>

                    {step === 1 && (
                        <>
                            <div className="auth-header">
                                <h1 className="auth-title">Join FoodBridge</h1>
                                <p className="auth-subtitle">Select your role to get started</p>
                            </div>

                            <div className="role-grid" id="role-grid">
                                {ROLES.map(role => {
                                    const Icon = role.icon
                                    return (
                                        <button
                                            key={role.id}
                                            className={`role-card ${role.color}${selectedRole === role.id ? ' selected' : ''}`}
                                            onClick={() => setSelectedRole(role.id)}
                                            id={`role-${role.id}`}
                                        >
                                            <div className="role-icon-wrap">
                                                <Icon size={28} />
                                            </div>
                                            <div className="role-info">
                                                <h3>{role.label}</h3>
                                                <p>{role.desc}</p>
                                            </div>
                                            <div className="role-check">
                                                {selectedRole === role.id && (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                className="btn btn-primary btn-lg btn-full"
                                onClick={() => selectedRole && setStep(2)}
                                disabled={!selectedRole}
                                id="role-continue-btn"
                            >
                                Continue
                                <ArrowRight size={18} />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="auth-header">
                                <h1 className="auth-title">Create your account</h1>
                                <p className="auth-subtitle">
                                    Registering as <span className="highlight-role">{selectedRole}</span>
                                </p>
                            </div>

                            <div className="oauth-buttons">
                                <button className="oauth-btn" id="google-register-btn">
                                    <Chrome size={20} />
                                    <span>Google</span>
                                </button>
                                <button className="oauth-btn" id="facebook-register-btn">
                                    <Facebook size={20} />
                                    <span>Facebook</span>
                                </button>
                            </div>

                            <div className="auth-divider">
                                <span>or fill in details</span>
                            </div>

                            <form onSubmit={handleSubmit} className="auth-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="reg-firstname">First Name</label>
                                        <div className="input-wrapper">
                                            <User size={18} className="input-icon" />
                                            <input
                                                id="reg-firstname"
                                                type="text"
                                                className="form-input"
                                                placeholder="John"
                                                value={formData.first_name}
                                                onChange={e => updateField('first_name', e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" htmlFor="reg-lastname">Last Name</label>
                                        <div className="input-wrapper">
                                            <User size={18} className="input-icon" />
                                            <input
                                                id="reg-lastname"
                                                type="text"
                                                className="form-input"
                                                placeholder="Doe"
                                                value={formData.last_name}
                                                onChange={e => updateField('last_name', e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="reg-email">Email Address</label>
                                    <div className="input-wrapper">
                                        <Mail size={18} className="input-icon" />
                                        <input
                                            id="reg-email"
                                            type="email"
                                            className="form-input"
                                            placeholder="you@example.com"
                                            value={formData.email}
                                            onChange={e => updateField('email', e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="reg-phone">Phone Number</label>
                                    <div className="input-wrapper">
                                        <Phone size={18} className="input-icon" />
                                        <input
                                            id="reg-phone"
                                            type="tel"
                                            className="form-input"
                                            placeholder="+1 (555) 000-0000"
                                            value={formData.phone}
                                            onChange={e => updateField('phone', e.target.value)}
                                            required={selectedRole !== 'donor'}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="reg-password">Password</label>
                                    <div className="input-wrapper">
                                        <Lock size={18} className="input-icon" />
                                        <input
                                            id="reg-password"
                                            type={showPassword ? 'text' : 'password'}
                                            className="form-input"
                                            placeholder="Create a strong password"
                                            value={formData.password}
                                            onChange={e => updateField('password', e.target.value)}
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

                                <div className="form-row" style={{ gap: '12px', alignItems: 'flex-start' }}>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-lg"
                                        onClick={() => setStep(1)}
                                        style={{ flex: '0 0 auto' }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className={`btn btn-primary btn-lg btn-full${loading ? ' btn-loading' : ''}`}
                                        id="register-submit-btn"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span className="spinner" />
                                        ) : (
                                            <>
                                                Create Account
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    <p className="auth-footer-text">
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
