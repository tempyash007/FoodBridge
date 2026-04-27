import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    Leaf,
    ChevronRight,
    Menu,
    X,
    User,
    LogOut,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import { logout as logoutService } from '../services/auth.service'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const location = useLocation()
    const isLanding = location.pathname === '/'
    const navigate = useNavigate()
    const { user, isAuthenticated, logout: logoutContext } = useAuth()

    const handleLogout = async () => {
        await logoutService()
        logoutContext()
        navigate('/login', { replace: true })
    }

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const getDashboardLink = () => {
        if (!user) return '/login'
        switch (user.role) {
            case 'donor': return '/donor'
            case 'recipient': return '/recipient'
            case 'volunteer': return '/volunteer'
            case 'admin': return '/admin'
            default: return '/login'
        }
    }

    return (
        <nav className={`navbar${scrolled ? ' scrolled' : ''}${!isLanding ? ' navbar-inner' : ''}`} id="navbar">
            <div className="container">
                <Link to="/" className="navbar-brand" id="navbar-brand">
                    <div className="brand-icon">
                        <Leaf size={20} color="#fff" />
                    </div>
                    <span>FoodBridge</span>
                </Link>

                {isAuthenticated ? (
                    <div className="navbar-actions">
                        <Link to={getDashboardLink()} className="btn btn-ghost">Dashboard</Link>
                        <ThemeToggle />
                        <NotificationBell />
                        <Link to={getDashboardLink()} className="navbar-icon-btn" id="profile-btn" title="Profile">
                            <User size={20} />
                        </Link>
                        <button onClick={handleLogout} className="navbar-icon-btn" id="logout-btn" title="Sign Out">
                            <LogOut size={20} />
                        </button>
                    </div>
                ) : (
                    <div className="navbar-actions">
                        <ThemeToggle />
                        <Link to="/login" className="btn btn-ghost" id="login-btn">Login</Link>
                        <Link to="/register" className="btn btn-primary" id="get-started-btn">
                            Get Started
                            <ChevronRight size={16} />
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    )
}
