import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from '../services/notification.service'

/**
 * Notification type → icon color mapping
 */
const TYPE_COLORS = {
    NEW_LISTING: '#10b981',
    CLAIM_RECEIVED: '#f97316',
    VOLUNTEER_ASSIGNED: '#3b82f6',
    FOOD_DELIVERED: '#8b5cf6',
    REVIEW_RECEIVED: '#eab308',
    VERIFICATION: '#06b6d4',
    BROADCAST: '#ec4899',
}

/**
 * Notification type → emoji badge
 */
const TYPE_ICONS = {
    NEW_LISTING: '🍽️',
    CLAIM_RECEIVED: '📋',
    VOLUNTEER_ASSIGNED: '🚗',
    FOOD_DELIVERED: '✅',
    REVIEW_RECEIVED: '⭐',
    VERIFICATION: '🛡️',
    BROADCAST: '📢',
}

/**
 * Format a timestamp into a relative time string (e.g. "2m ago", "3h ago").
 */
function timeAgo(dateStr) {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.max(0, now - then)
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

const POLL_INTERVAL = 30_000 // 30 seconds

export default function NotificationBell() {
    const { isAuthenticated } = useAuth()
    const [open, setOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(false)
    const panelRef = useRef(null)

    // Poll for unread count
    const fetchUnread = useCallback(async () => {
        if (!isAuthenticated) return
        try {
            const count = await getUnreadCount()
            setUnreadCount(count)
        } catch {
            // silent — non-critical
        }
    }, [isAuthenticated])

    useEffect(() => {
        fetchUnread()
        const id = setInterval(fetchUnread, POLL_INTERVAL)
        return () => clearInterval(id)
    }, [fetchUnread])

    // Load notifications when panel opens
    useEffect(() => {
        if (!open) return
        let cancelled = false

        ;(async () => {
            setLoading(true)
            try {
                const data = await getNotifications({ limit: 15 })
                if (!cancelled) setNotifications(data.notifications || [])
            } catch {
                // silent
            }
            if (!cancelled) setLoading(false)
        })()

        return () => { cancelled = true }
    }, [open])

    // Close panel on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    const handleMarkRead = async (id) => {
        try {
            await markAsRead(id)
            setNotifications(prev =>
                prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch { /* silent */ }
    }

    const handleMarkAllRead = async () => {
        try {
            await markAllAsRead()
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        } catch { /* silent */ }
    }

    const handleDelete = async (id) => {
        try {
            const item = notifications.find(n => n.notification_id === id)
            await deleteNotification(id)
            setNotifications(prev => prev.filter(n => n.notification_id !== id))
            if (item && !item.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1))
            }
        } catch { /* silent */ }
    }

    if (!isAuthenticated) return null

    return (
        <div className="notification-bell-wrapper" ref={panelRef}>
            {/* Bell button */}
            <button
                className="navbar-icon-btn notification-bell-btn"
                id="notification-bell"
                title="Notifications"
                onClick={() => setOpen(prev => !prev)}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="notification-badge" id="notification-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="notification-panel" id="notification-panel">
                    {/* Header */}
                    <div className="notification-panel-header">
                        <h3>Notifications</h3>
                        <div className="notification-panel-actions">
                            {unreadCount > 0 && (
                                <button
                                    className="notification-action-btn"
                                    onClick={handleMarkAllRead}
                                    title="Mark all as read"
                                    id="mark-all-read-btn"
                                >
                                    <CheckCheck size={16} />
                                    <span>Mark all read</span>
                                </button>
                            )}
                            <button
                                className="notification-close-btn"
                                onClick={() => setOpen(false)}
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="notification-panel-body">
                        {loading ? (
                            <div className="notification-empty">
                                <span className="spinner" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">
                                <Bell size={32} style={{ opacity: 0.3 }} />
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            <ul className="notification-list">
                                {notifications.map(n => (
                                    <li
                                        key={n.notification_id}
                                        className={`notification-item${n.is_read ? '' : ' unread'}`}
                                        id={`notif-${n.notification_id}`}
                                    >
                                        {/* Type badge */}
                                        <div
                                            className="notification-type-icon"
                                            style={{ background: `${TYPE_COLORS[n.type] || '#6b7280'}20`, color: TYPE_COLORS[n.type] || '#6b7280' }}
                                        >
                                            {TYPE_ICONS[n.type] || '🔔'}
                                        </div>

                                        {/* Content */}
                                        <div className="notification-content">
                                            <p className="notification-title">{n.title}</p>
                                            <p className="notification-message">{n.message}</p>
                                            <span className="notification-time">{timeAgo(n.created_at)}</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="notification-item-actions">
                                            {!n.is_read && (
                                                <button
                                                    className="notif-btn"
                                                    onClick={() => handleMarkRead(n.notification_id)}
                                                    title="Mark as read"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            <button
                                                className="notif-btn notif-btn-danger"
                                                onClick={() => handleDelete(n.notification_id)}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
