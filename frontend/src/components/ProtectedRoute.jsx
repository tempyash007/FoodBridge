import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute — guards dashboard routes.
 *
 * Props:
 *   allowedRoles (optional) — array of roles, e.g. ['admin', 'donor']
 *                              If omitted, any authenticated user is allowed.
 *
 * Behaviour:
 *   1. While the AuthContext is still verifying the session → show spinner.
 *   2. If user is NOT authenticated → redirect to /login with a state message.
 *   3. If allowedRoles is specified and user role doesn't match → redirect to /login.
 *   4. Otherwise → render children.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user, isAuthenticated, loading } = useAuth()
    const location = useLocation()

    // 1. Still checking session
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--bg-primary, #0a0a0a)',
                color: 'var(--text-primary, #fff)',
                flexDirection: 'column',
                gap: '16px',
            }}>
                <span className="spinner" style={{ width: 40, height: 40 }} />
                <p style={{ opacity: 0.6 }}>Verifying your session…</p>
            </div>
        )
    }

    // 2. Not authenticated
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location.pathname, message: 'Please login first to access this page.' }}
            />
        )
    }

    // 3. Role mismatch (optional)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location.pathname, message: 'You do not have permission to access this page.' }}
            />
        )
    }

    // 4. Authenticated — render the page
    return children
}
