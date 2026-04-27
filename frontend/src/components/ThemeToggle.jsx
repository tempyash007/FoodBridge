import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
    const [dark, setDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('foodbridge-theme') === 'dark'
        }
        return false
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
        localStorage.setItem('foodbridge-theme', dark ? 'dark' : 'light')
    }, [dark])

    return (
        <button
            className="theme-toggle"
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            id="theme-toggle-btn"
        >
            <div className={`theme-toggle-track${dark ? ' dark' : ''}`}>
                <Sun size={14} className="theme-icon sun" />
                <Moon size={14} className="theme-icon moon" />
                <div className="theme-toggle-thumb" />
            </div>
        </button>
    )
}
