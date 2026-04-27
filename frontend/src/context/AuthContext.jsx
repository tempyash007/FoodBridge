import { createContext, useContext, useState, useEffect } from 'react'


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const API_BASE = `${API_URL}/api/auth`

const AuthContext = createContext(null)

/**
 * Custom hook to consume the AuthContext.
 * Usage: const { user, isAuthenticated, login, logout } = useAuth()
 */
export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

/**
 * AuthProvider wraps the entire app and manages authentication state.
 * On mount it calls /api/auth/me to check if the user has a valid session.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true) // true while checking session

    /**
     * Check the current session by calling /api/auth/me.
     * If the HTTP-only cookie is valid the backend returns the user object.
     */
    const checkAuth = async () => {
        try {
            const res = await fetch(`${API_BASE}/me`, {
                method: 'GET',
                credentials: 'include',
            })

            if (res.ok) {
                const data = await res.json()
                setUser(data.data.user)
            } else {
                setUser(null)
            }
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    // On first mount, verify existing session
    useEffect(() => {
        checkAuth()
    }, [])

    /**
     * Called after a successful login API response.
     * Stores the returned user in context so the entire app re-renders
     * with authentication-aware state.
     */
    const login = async () => {
        const res = await fetch(`${API_BASE}/me`, {
            credentials: 'include'
        });

        const data = await res.json();
        setUser(data.data.user);
        return data.data.user; // fetch fresh user from backend
    }

    /**
     * Called on sign-out. Clears application state.
     * The actual API call to /api/auth/logout is handled by auth.service.js;
     * this function only clears the React state.
     */
    const logoutUser = () => {
        setUser(null)
    }

    const value = {
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout: logoutUser,
        checkAuth,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
