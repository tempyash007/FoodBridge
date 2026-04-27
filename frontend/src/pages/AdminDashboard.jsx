import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Leaf, Users, Package, Truck, BarChart3, TrendingUp, TrendingDown,
    Shield, AlertTriangle, CheckCircle2, XCircle, Eye, Search,
    LogOut, Home, Settings, Database, Menu, X,
    FileText, Map, Megaphone, Filter, Download, RefreshCw,
    ChevronRight, ArrowRight, Star, Clock, Activity,
    UserCheck, UserX, ShieldCheck, Globe, Layers, Zap, Bell,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { logout as logoutService } from '../services/auth.service'
import { useAuth } from '../context/AuthContext'

// ─── API base (adjust if using a proxy or env var) ───────────────────────────
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const API = `${API_URL}/api/admin`

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    })

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
        throw new Error(`Server returned HTML instead of JSON — check your API proxy config (status: ${res.status})`)
    }

    const json = await res.json()
    if (!res.ok) throw new Error(json.message || `API error ${res.status}`)
    return json
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function fmtNum(n) {
    if (n == null) return '—'
    return Number(n).toLocaleString()
}
function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m} min ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}
function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
    return <div className="spinner" />
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ msg, onRetry }) {
    return (
        <div className="error-banner">
            <AlertTriangle size={16} /> {msg}
            {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const navigate = useNavigate()
    const { logout: logoutContext } = useAuth()

    const handleLogout = async () => {
        await logoutService()
        logoutContext()
        navigate('/login', { replace: true })
    }

    return (
        <div className="dashboard-page">
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            <aside className={`sidebar admin-sidebar${sidebarOpen ? ' open' : ''}`} id="admin-sidebar">
                <Link to="/" className="sidebar-brand">
                    <div className="brand-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                        <Leaf size={18} color="#fff" />
                    </div>
                    <span>FoodBridge <span className="admin-badge-text">Admin</span></span>
                </Link>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Dashboard</div>
                    <button className={`sidebar-link${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>
                        <Home size={20} /> Overview
                    </button>
                    <button className={`sidebar-link${activeTab === 'analytics' ? ' active' : ''}`} onClick={() => setActiveTab('analytics')}>
                        <BarChart3 size={20} /> Analytics
                    </button>

                    <div className="sidebar-section-label" style={{ marginTop: '24px' }}>Management</div>
                    <button className={`sidebar-link${activeTab === 'moderation' ? ' active' : ''}`} onClick={() => setActiveTab('moderation')}>
                        <AlertTriangle size={20} /> Moderation
                    </button>
                    <button className={`sidebar-link${activeTab === 'users' ? ' active' : ''}`} onClick={() => setActiveTab('users')}>
                        <Users size={20} /> Users
                    </button>

                    <div className="sidebar-section-label" style={{ marginTop: '24px' }}>System</div>
                    <button className={`sidebar-link${activeTab === 'categories' ? ' active' : ''}`} onClick={() => setActiveTab('categories')}>
                        <Layers size={20} /> Categories
                    </button>
                    <button className={`sidebar-link${activeTab === 'broadcast' ? ' active' : ''}`} onClick={() => setActiveTab('broadcast')}>
                        <Megaphone size={20} /> Broadcast
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>AD</div>
                        <div className="user-info">
                            <span className="user-name">Admin</span>
                            <span className="user-role">System Admin</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="sidebar-link logout-link"><LogOut size={20} /> Sign Out</button>
                </div>
            </aside>

            <main className="dashboard-main" id="admin-main">
                {activeTab === 'overview' && <OverviewTab sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
                {activeTab === 'analytics' && <AnalyticsTab sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
                {activeTab === 'moderation' && <ModerationTab sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
                {activeTab === 'users' && <UsersTab sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
                {activeTab === 'categories' && <CategoriesTab sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
                {activeTab === 'broadcast' && <BroadcastTab sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />}
            </main>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   1. OVERVIEW TAB  →  GET /api/admin/overview
══════════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ sidebarOpen, setSidebarOpen }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const json = await apiFetch('/overview')
            setData(json.data)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const stats = data?.stats || {}
    const weeklyActivity = data?.weekly_activity || []
    const liveActivity = data?.live_activity || []
    const quickStats = data?.quick_stats || {}

    const derivedMealsRescued =
        stats.meals_rescued > 0
            ? stats.meals_rescued
            : weeklyActivity.reduce((sum, d) => sum + (d.deliveries || 0), 0)
    const SYSTEM_STATS = [
        {
            label: 'Total Users',
            value: fmtNum(stats.total_users),
            icon: Users,
            color: 'green',
            change: `+${fmtNum(stats.users_this_week)} this week`,
            trend: 'up',
        },
        {
            label: 'Active Listings',
            value: fmtNum(stats.active_listings),
            icon: Package,
            color: 'blue',
            change: `+${fmtNum(stats.listings_today)} today`,
            trend: 'up',
        },
        {
            label: 'Deliveries Today',
            value: fmtNum(stats.deliveries_today),
            icon: Truck,
            color: 'orange',
            change: `${stats.deliveries_vs_yesterday_pct >= 0 ? '+' : ''}${stats.deliveries_vs_yesterday_pct ?? 0}% vs yesterday`,
            trend: stats.deliveries_vs_yesterday_pct >= 0 ? 'up' : 'down',
        },
        {
            label: 'Meals Item Rescued',
            value: fmtNum(derivedMealsRescued),
            icon: BarChart3,
            color: 'purple',
            change: `+${fmtNum(stats.meals_this_week)} this week`,
            trend: 'up',
        },
    ]

    // Normalise chart bars — scale relative to max
    const chartMax = weeklyActivity.length
        ? Math.max(...weeklyActivity.map(d => Math.max(d.donors || 0, d.recipients || 0, d.deliveries || 0)), 1)
        : 1

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">System Overview</h1>
                        <p className="dashboard-subtitle">Real-time platform analytics and metrics</p>
                    </div>
                </div>
                <div className="topbar-actions">
                    <ThemeToggle />
                    <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
                    <button className="btn btn-outline btn-sm" onClick={() => window.open(`${API}/analytics/export`, '_blank')}>
                        <Download size={14} /> Export
                    </button>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {error && <ErrorBanner msg={error} onRetry={load} />}
                {loading && <Spinner />}

                {!loading && (
                    <>
                        {/* Stats */}
                        <div className="metrics-grid">
                            {SYSTEM_STATS.map((s, i) => {
                                const Icon = s.icon
                                return (
                                    <div key={i} className={`metric-card metric-${s.color}`} style={{ animationDelay: `${i * 0.08}s` }}>
                                        <div className="metric-icon-wrap"><Icon size={22} /></div>
                                        <div className="metric-info">
                                            <div className="metric-value">{s.value}</div>
                                            <div className="metric-label">{s.label}</div>
                                        </div>
                                        <div className={`metric-change ${s.trend === 'up' ? 'positive' : 'negative'}`}>
                                            {s.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {s.change}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="dashboard-grid-2">
                            {/* Weekly chart */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title"><BarChart3 size={20} /> Weekly Activity</h2>
                                </div>
                                <div className="chart-area">
                                    <div className="chart-bars">
                                        {weeklyActivity.map((d, i) => (
                                            <div key={i} className="chart-bar-group">
                                                <div className="chart-bar-wrap">
                                                    <div className="chart-bar chart-bar-green" style={{ height: `${Math.round(((d.donors || 0) / chartMax) * 100)}%`, animationDelay: `${i * 0.08}s` }} />
                                                    <div className="chart-bar chart-bar-blue" style={{ height: `${Math.round(((d.recipients || 0) / chartMax) * 100)}%`, animationDelay: `${i * 0.08 + 0.04}s` }} />
                                                    <div className="chart-bar chart-bar-orange" style={{ height: `${Math.round(((d.deliveries || 0) / chartMax) * 100)}%`, animationDelay: `${i * 0.08 + 0.08}s` }} />
                                                </div>
                                                <span className="chart-bar-label">{d.day}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="chart-legend">
                                        <div className="legend-item"><span className="legend-dot green" /> Donors</div>
                                        <div className="legend-item"><span className="legend-dot blue" /> Recipients</div>
                                        <div className="legend-item"><span className="legend-dot orange" /> Deliveries</div>
                                    </div>
                                </div>
                            </div>

                            {/* Live Activity from audit_logs */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title"><Activity size={20} /> Live Activity</h2>
                                    <span className="live-dot">● Live</span>
                                </div>
                                <div className="activity-list">
                                    {liveActivity.length === 0 && <p style={{ padding: '12px', opacity: 0.5 }}>No recent activity</p>}
                                    {liveActivity.map((a, i) => {
                                        const typeMap = {
                                            'BROADCAST_SENT': 'alert',
                                            'VERIFICATION_APPROVED': 'verify',
                                            'VERIFICATION_REJECTED': 'alert',
                                            'CONTENT_DISMISSED': 'listing',
                                            'CONTENT_REMOVED': 'alert',
                                            'USER_SUSPENDED': 'user',
                                            'USER_REACTIVATED': 'user',
                                        }
                                        const t = typeMap[a.type] || 'listing'
                                        return (
                                            <div key={i} className="activity-item" style={{ animationDelay: `${i * 0.06}s` }}>
                                                <div className={`activity-icon ${t}`}>
                                                    {t === 'user' && <Users size={14} />}
                                                    {t === 'verify' && <ShieldCheck size={14} />}
                                                    {t === 'alert' && <AlertTriangle size={14} />}
                                                    {t === 'listing' && <Package size={14} />}
                                                </div>
                                                <div className="activity-info">
                                                    <span className="activity-action">{a.type?.replace(/_/g, ' ') ?? '—'}</span>
                                                    <span className="activity-detail">{a.message}</span>
                                                </div>
                                                <span className="activity-time">{timeAgo(a.created_at)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="quick-actions-grid">
                            {[
                                { label: 'Flagged Content', count: quickStats.flagged_content, icon: AlertTriangle, color: 'orange', tab: 'moderation' },
                                { label: 'Send Broadcast', count: null, icon: Megaphone, color: 'purple', tab: 'broadcast' },
                                { label: 'System Health', count: quickStats.system_health ?? '99.9%', icon: Activity, color: 'green', tab: 'overview' },
                            ].map((q, i) => {
                                const Icon = q.icon
                                return (
                                    <button key={i} className={`quick-action-card ${q.color}`} onClick={() => { }}>
                                        <Icon size={24} />
                                        <span className="qa-label">{q.label}</span>
                                        {q.count !== null && <span className="qa-count">{q.count}</span>}
                                        <ChevronRight size={16} className="qa-arrow" />
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. ANALYTICS TAB  →  GET /api/admin/analytics
                        GET /api/admin/analytics/export  (CSV download)
══════════════════════════════════════════════════════════════════════════════ */
function AnalyticsTab({ sidebarOpen, setSidebarOpen }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const json = await apiFetch('/analytics')
            setData(json.data)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const impact = data?.total_impact || {}
    const perf = data?.performance || {}
    const heatmap = data?.heatmap || []
    const targetPct = impact.target_pct ?? 0

    const perfCards = [
        { label: 'Avg Delivery Time', value: perf.avg_delivery_time_min ? `${perf.avg_delivery_time_min} min` : '—', icon: Clock, change: perf.delivery_time_change_min != null ? `${perf.delivery_time_change_min > 0 ? '+' : ''}${perf.delivery_time_change_min} min` : '—', positive: (perf.delivery_time_change_min ?? 0) <= 0 },
        { label: 'User Retention', value: perf.user_retention_pct != null ? `${perf.user_retention_pct}%` : '—', icon: Users, change: perf.retention_change_pct != null ? `+${perf.retention_change_pct}%` : '—', positive: true },
        { label: 'Listing Success Rate', value: perf.listing_success_rate_pct != null ? `${perf.listing_success_rate_pct}%` : '—', icon: CheckCircle2, change: perf.success_rate_change_pct != null ? `+${perf.success_rate_change_pct}%` : '—', positive: true },
        { label: 'Waste Reduction', value: perf.waste_reduction_pct != null ? `${perf.waste_reduction_pct}%` : '—', icon: TrendingDown, change: perf.waste_reduction_change_pct != null ? `+${perf.waste_reduction_change_pct}%` : '—', positive: true },
    ]

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">Platform Analytics</h1>
                        <p className="dashboard-subtitle">Deep dive into platform performance metrics</p>
                    </div>
                </div>
                <div className="topbar-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => window.open(`${API}/analytics/export`, '_blank')}>
                        <Download size={14} /> Export Report
                    </button>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {error && <ErrorBanner msg={error} onRetry={load} />}
                {loading && <Spinner />}

                {!loading && (
                    <>
                        <div className="analytics-hero-grid">
                            <div className="analytics-big-card">
                                <h3>Total Impact</h3>
                                <div className="analytics-big-stat">
                                    <div className="analytics-ring">
                                        <svg viewBox="0 0 120 120">
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ring-grad)" strokeWidth="8"
                                                strokeDasharray={`${(targetPct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                                                strokeLinecap="round" transform="rotate(-90 60 60)"
                                                className="ring-animated"
                                            />
                                            <defs>
                                                <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#34d399" />
                                                    <stop offset="100%" stopColor="#10b981" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div className="ring-text">
                                            <span className="ring-value">{targetPct}%</span>
                                            <span className="ring-label">Target</span>
                                        </div>
                                    </div>
                                    <div className="analytics-breakdown">
                                        <div className="breakdown-item"><span className="bd-dot green" /> {fmtNum(impact.meals_rescued)} meals rescued</div>
                                        <div className="breakdown-item"><span className="bd-dot blue" /> {impact.co2_saved_tons ?? '—'} tons CO₂ saved</div>
                                        <div className="breakdown-item"><span className="bd-dot orange" /> {impact.waste_diverted_tons ?? '—'} tons waste diverted</div>
                                        <div className="breakdown-item"><span className="bd-dot purple" /> {fmtNum(impact.active_users)}+ active users</div>
                                    </div>
                                </div>
                            </div>

                            <div className="analytics-side-stats">
                                {perfCards.map((s, i) => {
                                    const Icon = s.icon
                                    return (
                                        <div key={i} className="analytics-side-card" style={{ animationDelay: `${i * 0.1}s` }}>
                                            <Icon size={20} />
                                            <div>
                                                <div className="asc-value">{s.value}</div>
                                                <div className="asc-label">{s.label}</div>
                                            </div>
                                            <span className={`asc-change ${s.positive ? 'positive' : 'negative'}`}>{s.change}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Heatmap */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title"><Map size={20} /> Activity Heatmap</h2>
                            </div>
                            {heatmap.length > 0 ? (
                                <div className="heatmap-table" style={{ padding: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ padding: '8px 12px' }}>City</th>
                                                <th style={{ padding: '8px 12px' }}>Activity</th>
                                                <th style={{ padding: '8px 12px' }}>Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {heatmap.slice(0, 10).map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <td style={{ padding: '8px 12px' }}>{row.city}</td>
                                                    <td style={{ padding: '8px 12px' }}>{fmtNum(row.activity_count)}</td>
                                                    <td style={{ padding: '8px 12px' }}>
                                                        <span className={`hl-item ${row.level?.replace('_', '-')}`}>{capitalise(row.level?.replace('_', ' '))}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="heatmap-placeholder">
                                    <Globe size={48} />
                                    <h3>Regional Activity Map</h3>
                                    <p>No location data available yet.</p>
                                    <div className="heatmap-legend">
                                        <span className="hl-item low">Low</span>
                                        <span className="hl-item medium">Medium</span>
                                        <span className="hl-item high">High</span>
                                        <span className="hl-item very-high">Very High</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. VERIFICATION TAB  →  GET  /api/admin/verification
                           PATCH /api/admin/verification/:org_id
══════════════════════════════════════════════════════════════════════════════ */
function VerificationTab({ sidebarOpen, setSidebarOpen }) {
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const json = await apiFetch('/verification')
            setQueue(json.data.verifications || [])
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const handleVerification = async (org_id, action) => {
        setActionLoading(org_id)
        try {
            await apiFetch(`/verification/${org_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ action }),
            })
            setQueue(prev => prev.filter(v => v.org_id !== org_id))
        } catch (e) {
            alert(`Failed: ${e.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">User Verification</h1>
                        <p className="dashboard-subtitle">{queue.length} pending verification request{queue.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {error && <ErrorBanner msg={error} onRetry={load} />}
                {loading && <Spinner />}

                {!loading && (
                    <div className="verification-list">
                        {queue.map((v, i) => (
                            <div key={v.org_id} className="verification-card" style={{ animationDelay: `${i * 0.06}s` }}>
                                <div className="verify-left">
                                    <div className={`verify-type-badge ${(v.role || 'donor').toLowerCase()}`}>{capitalise(v.role)}</div>
                                    <div className="verify-info">
                                        <h3>{v.org_name}</h3>
                                        <p>{v.email}</p>
                                        <div className="verify-meta">
                                            <span><Clock size={14} /> Submitted {timeAgo(v.submitted_at)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="verify-actions">
                                    <button className="btn btn-ghost btn-sm"><Eye size={14} /> Review</button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={actionLoading === v.org_id}
                                        onClick={() => handleVerification(v.org_id, 'approve')}
                                    >
                                        <CheckCircle2 size={14} /> {actionLoading === v.org_id ? 'Saving…' : 'Approve'}
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm btn-danger"
                                        disabled={actionLoading === v.org_id}
                                        onClick={() => handleVerification(v.org_id, 'reject')}
                                    >
                                        <XCircle size={14} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                        {queue.length === 0 && !loading && (
                            <div className="empty-state-card">
                                <CheckCircle2 size={48} />
                                <h3>All caught up!</h3>
                                <p>No pending verification requests.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. MODERATION TAB  →  GET  /api/admin/moderation
                          PATCH /api/admin/moderation/:listing_id
══════════════════════════════════════════════════════════════════════════════ */
function ModerationTab({ sidebarOpen, setSidebarOpen }) {
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const json = await apiFetch('/moderation')
            setListings(json.data.flagged_listings || [])
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const handleModeration = async (listing_id, action) => {
        setActionLoading(listing_id)
        try {
            await apiFetch(`/moderation/${listing_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ action }),
            })
            if (action === 'remove') {
                setListings(prev => prev.filter(l => l.listing_id !== listing_id))
            } else {
                // dismiss → unflagged, remove from queue
                setListings(prev => prev.filter(l => l.listing_id !== listing_id))
            }
        } catch (e) {
            alert(`Failed: ${e.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">Content Moderation</h1>
                        <p className="dashboard-subtitle">Review flagged listings and reports</p>
                    </div>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {error && <ErrorBanner msg={error} onRetry={load} />}
                {loading && <Spinner />}

                {!loading && (
                    <>
                        {listings.map((f, i) => (
                            <div key={f.listing_id} className="flagged-card" style={{ animationDelay: `${i * 0.08}s` }}>
                                <div className="flagged-icon"><AlertTriangle size={20} /></div>
                                <div className="flagged-info">
                                    <h3>{f.title}</h3>
                                    <p className="flagged-donor">By: {f.donor_name}</p>
                                    <p className="flagged-reason">{f.reason}</p>
                                    <div className="flagged-meta">
                                        {f.report_count > 0 && <span className="flagged-reports">{f.report_count} report{f.report_count > 1 ? 's' : ''}</span>}
                                        <span><Clock size={12} /> {timeAgo(f.flagged_at)}</span>
                                    </div>
                                </div>
                                <div className="flagged-actions">
                                    <button className="btn btn-ghost btn-sm"><Eye size={14} /> View</button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={actionLoading === f.listing_id}
                                        onClick={() => handleModeration(f.listing_id, 'dismiss')}
                                    >
                                        <CheckCircle2 size={14} /> {actionLoading === f.listing_id ? '…' : 'Dismiss'}
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm btn-danger"
                                        disabled={actionLoading === f.listing_id}
                                        onClick={() => handleModeration(f.listing_id, 'remove')}
                                    >
                                        <XCircle size={14} /> Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                        {listings.length === 0 && (
                            <div className="empty-state-card">
                                <CheckCircle2 size={48} />
                                <h3>All clear!</h3>
                                <p>No flagged listings at the moment.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. USERS TAB  →  GET  /api/admin/users?search=&role=&page=&limit=
                    PATCH /api/admin/users/:user_id  (suspend / reactivate)
══════════════════════════════════════════════════════════════════════════════ */
function UsersTab({ sidebarOpen, setSidebarOpen }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [page, setPage] = useState(1)
    const [actionLoading, setActionLoading] = useState(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const params = new URLSearchParams({ page, limit: 10 })
            if (search) params.set('search', search)
            if (roleFilter) params.set('role', roleFilter)
            const json = await apiFetch(`/users?${params}`)
            setData(json.data)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [search, roleFilter, page])

    useEffect(() => { load() }, [load])

    const handleUserToggle = async (user_id, currentActive) => {
        setActionLoading(user_id)
        try {
            await apiFetch(`/users/${user_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !currentActive }),
            })
            load()
        } catch (e) {
            alert(`Failed: ${e.message}`)
        } finally {
            setActionLoading(null)
        }
    }

    const counts = data?.counts || {}
    const users = data?.recent_users || []
    const pagination = data?.pagination || {}

    const roleSummary = [
        { type: 'Donors', count: counts.donors, icon: Package, color: 'green', verified: counts.donors_verified },
        { type: 'Recipients', count: counts.recipients, icon: Users, color: 'orange', verified: counts.recipients_verified },
        { type: 'Volunteers', count: counts.volunteers, icon: Truck, color: 'blue', verified: counts.volunteers_verified },
    ]

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">User Management</h1>
                        <p className="dashboard-subtitle">Manage all platform users</p>
                    </div>
                </div>
                <div className="topbar-actions">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            placeholder="Search users..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                        />
                    </div>
                    <select className="form-input form-select topbar-select" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}>
                        <option value="">All Roles</option>
                        <option value="donor">Donors</option>
                        <option value="recipient">Recipients</option>
                        <option value="volunteer">Volunteers</option>
                    </select>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {error && <ErrorBanner msg={error} onRetry={load} />}
                {loading && <Spinner />}

                {!loading && (
                    <>
                        <div className="user-type-cards">
                            {roleSummary.map((u, i) => {
                                const Icon = u.icon
                                return (
                                    <div key={i} className={`user-type-card ${u.color}`}>
                                        <Icon size={28} />
                                        <div className="utc-count">{fmtNum(u.count)}</div>
                                        <div className="utc-type">{u.type}</div>
                                        <div className="utc-verified"><ShieldCheck size={12} /> {fmtNum(u.verified)} verified</div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Recent Users</h2>
                            </div>
                            <div className="history-table">
                                <div className="history-header-row user-row-header">
                                    <span>User</span><span>Role</span><span>Joined</span><span>Status</span><span>Actions</span>
                                </div>
                                {users.map((u, i) => (
                                    <div key={u.user_id} className="history-row user-row">
                                        <span className="user-row-name">
                                            <div className="mini-avatar">{u.name?.charAt(0) || '?'}</div>
                                            {u.name}
                                        </span>
                                        <span className={`user-type-label ${(u.role || '').toLowerCase()}`}>{capitalise(u.role)}</span>
                                        <span className="history-date">{timeAgo(u.joined)}</span>
                                        <span>
                                            {u.is_verified ? (
                                                <span className="user-verified"><ShieldCheck size={14} /> Verified</span>
                                            ) : (
                                                <span className="user-pending"><Clock size={14} /> Pending</span>
                                            )}
                                        </span>
                                        <span className="user-actions-mini">
                                            <button
                                                className={`btn btn-ghost btn-xs ${u.is_active ? 'btn-danger' : ''}`}
                                                disabled={actionLoading === u.user_id}
                                                onClick={() => handleUserToggle(u.user_id, u.is_active)}
                                                title={u.is_active ? 'Suspend' : 'Reactivate'}
                                            >
                                                {u.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                                            </button>
                                        </span>
                                    </div>
                                ))}
                                {users.length === 0 && <div style={{ padding: '16px', opacity: 0.5 }}>No users found.</div>}
                            </div>

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="pagination-row" style={{ display: 'flex', gap: '8px', padding: '12px 16px', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                                    <span style={{ lineHeight: '32px', fontSize: '13px' }}>Page {pagination.page} / {pagination.totalPages}</span>
                                    <button className="btn btn-ghost btn-sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   6. CATEGORIES TAB  →  GET   /api/admin/categories
                          POST  /api/admin/categories
                          PATCH /api/admin/categories/:category_id
══════════════════════════════════════════════════════════════════════════════ */
function CategoriesTab({ sidebarOpen, setSidebarOpen }) {
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [newCatName, setNewCatName] = useState('')
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editName, setEditName] = useState('')

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const json = await apiFetch('/categories')
            setCategories(json.data.categories || [])
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const handleAdd = async () => {
        if (!newCatName.trim()) return
        setAdding(true)
        try {
            await apiFetch('/categories', {
                method: 'POST',
                body: JSON.stringify({ name: newCatName.trim() }),
            })
            setNewCatName('')
            load()
        } catch (e) { alert(e.message) }
        finally { setAdding(false) }
    }

    const handleEdit = async (category_id) => {
        if (!editName.trim()) return
        try {
            await apiFetch(`/categories/${category_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: editName.trim() }),
            })
            setEditingId(null); setEditName('')
            load()
        } catch (e) { alert(e.message) }
    }

    const handleToggleActive = async (cat) => {
        try {
            await apiFetch(`/categories/${cat.category_id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !cat.is_active }),
            })
            load()
        } catch (e) { alert(e.message) }
    }

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">Food Categories & Regions</h1>
                        <p className="dashboard-subtitle">Manage food categories and coverage regions</p>
                    </div>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {error && <ErrorBanner msg={error} onRetry={load} />}
                {loading && <Spinner />}

                {!loading && (
                    <div className="dashboard-grid-2">
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title"><Layers size={20} /> Food Categories</h2>
                            </div>

                            {/* Add new category */}
                            <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <input
                                    className="form-input"
                                    placeholder="New category name..."
                                    value={newCatName}
                                    onChange={e => setNewCatName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    style={{ flex: 1 }}
                                />
                                <button className="btn btn-primary btn-sm" disabled={adding || !newCatName.trim()} onClick={handleAdd}>
                                    {adding ? '…' : '+ Add'}
                                </button>
                            </div>

                            <div className="category-list">
                                {categories.map((c, i) => (
                                    <div key={c.category_id} className={`category-item${c.is_active === false ? ' inactive' : ''}`}>
                                        {editingId === c.category_id ? (
                                            <>
                                                <input
                                                    className="form-input"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    style={{ flex: 1, padding: '4px 8px' }}
                                                />
                                                <button className="btn btn-primary btn-xs" onClick={() => handleEdit(c.category_id)}>Save</button>
                                                <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="cat-name" style={{ opacity: c.is_active === false ? 0.5 : 1 }}>{c.name}</span>
                                                <span className="cat-count">{fmtNum(c.listing_count)} listings</span>
                                                <button className="btn btn-ghost btn-xs" onClick={() => { setEditingId(c.category_id); setEditName(c.name) }}>Edit</button>
                                                <button className="btn btn-ghost btn-xs" onClick={() => handleToggleActive(c)} title={c.is_active ? 'Deactivate' : 'Activate'}>
                                                    {c.is_active ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {categories.length === 0 && <div style={{ padding: '16px', opacity: 0.5 }}>No categories yet.</div>}
                            </div>
                        </div>


                    </div>
                )}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════════
   7. BROADCAST TAB  →  GET  /api/admin/broadcast  (history)
                         POST /api/admin/broadcast  (send)
══════════════════════════════════════════════════════════════════════════════ */
function BroadcastTab({ sidebarOpen, setSidebarOpen }) {
    const [title, setTitle] = useState('')
    const [message, setBroadcastMessage] = useState('')
    const [targetRole, setTargetRole] = useState('')
    const [priority, setPriority] = useState('info')
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState(null)

    const [history, setHistory] = useState([])
    const [histLoading, setHistLoading] = useState(true)

    const loadHistory = useCallback(async () => {
        setHistLoading(true)
        try {
            const json = await apiFetch('/broadcast')
            setHistory(json.data.broadcasts || [])
        } catch {
            // history is non-critical
        } finally {
            setHistLoading(false)
        }
    }, [])

    useEffect(() => { loadHistory() }, [loadHistory])

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            alert('Title and message are required.')
            return
        }
        setSending(true); setSendResult(null)
        try {
            const json = await apiFetch('/broadcast', {
                method: 'POST',
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim(),
                    target_role: targetRole || null,
                    priority,
                }),
            })
            setSendResult(json.data.broadcast)
            setTitle(''); setBroadcastMessage(''); setTargetRole(''); setPriority('info')
            loadHistory()
        } catch (e) {
            alert(`Failed to send: ${e.message}`)
        } finally {
            setSending(false)
        }
    }

    return (
        <>
            <header className="dashboard-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div>
                        <h1 className="dashboard-title">Emergency Broadcast</h1>
                        <p className="dashboard-subtitle">Send urgent notifications to all platform users</p>
                    </div>
                </div>
            </header>

            <div className="dashboard-content animate-page-in">
                {sendResult && (
                    <div className="success-banner">
                        <CheckCircle2 size={16} /> Broadcast sent to {fmtNum(sendResult.recipients_count)} user{sendResult.recipients_count !== 1 ? 's' : ''}.
                    </div>
                )}

                <div className="card broadcast-card">
                    <div className="card-header">
                        <h2 className="card-title"><Megaphone size={20} /> Compose Broadcast</h2>
                    </div>
                    <div className="broadcast-form">
                        {/* Title */}
                        <div className="form-group">
                            <label className="form-label">Title</label>
                            <input
                                className="form-input"
                                placeholder="Broadcast title..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        {/* Priority */}
                        <div className="form-group">
                            <label className="form-label">Priority Level</label>
                            <div className="broadcast-priority">
                                {['info', 'warning', 'urgent'].map(p => (
                                    <button
                                        key={p}
                                        className={`priority-btn ${p}${priority === p ? ' selected' : ''}`}
                                        onClick={() => setPriority(p)}
                                    >
                                        {p === 'info' && <Bell size={16} />}
                                        {p === 'warning' && <AlertTriangle size={16} />}
                                        {p === 'urgent' && <Zap size={16} />}
                                        {capitalise(p)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target Audience — maps to target_role in controller */}
                        <div className="form-group">
                            <label className="form-label">Target Audience</label>
                            <div className="tag-grid">
                                {[
                                    { label: 'All Users', value: '' },
                                    { label: 'Donors', value: 'donor' },
                                    { label: 'Recipients', value: 'recipient' },
                                    { label: 'Volunteers', value: 'volunteer' },
                                    { label: 'Admins', value: 'admin' },
                                ].map(t => (
                                    <button
                                        key={t.label}
                                        className={`diet-tag${targetRole === t.value ? ' selected' : ''}`}
                                        onClick={() => setTargetRole(t.value)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>



                        {/* Message */}
                        <div className="form-group">
                            <label className="form-label">Message</label>
                            <textarea
                                className="form-input form-textarea"
                                rows={4}
                                placeholder="Type your broadcast message here..."
                                value={message}
                                onChange={e => setBroadcastMessage(e.target.value)}
                            />
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            disabled={sending || !title.trim() || !message.trim()}
                            onClick={handleSend}
                        >
                            <Megaphone size={18} /> {sending ? 'Sending…' : 'Send Broadcast'}
                        </button>
                    </div>
                </div>

                {/* Broadcast history */}
                <div className="card" style={{ marginTop: '24px' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Clock size={20} /> Broadcast History</h2>
                    </div>
                    {histLoading && <Spinner />}
                    {!histLoading && history.length === 0 && <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5 }}>No broadcasts yet.</div>}
                    {!histLoading && history.length > 0 && (
                        <div className="broadcast-history-list">
                            {history.map((b) => (
                                <div key={b.broadcast_id} className="broadcast-history-item">
                                    <div className="broadcast-history-header">
                                        <h3 className="broadcast-history-title">
                                            {b.priority === 'urgent' && <Zap size={16} className="priority-icon urgent" style={{ color: '#f87171' }} />}
                                            {b.priority === 'warning' && <AlertTriangle size={16} className="priority-icon warning" style={{ color: '#fbbf24' }} />}
                                            {b.priority === 'info' && <Bell size={16} className="priority-icon info" style={{ color: '#60a5fa' }} />}
                                            {b.title}
                                        </h3>
                                        <span className="broadcast-history-time"><Clock size={12} /> {timeAgo(b.created_at)}</span>
                                    </div>
                                    <p className="broadcast-history-message">{b.message}</p>
                                    <div className="broadcast-history-meta">
                                        <span className="broadcast-history-target">
                                            <Users size={12} />
                                            {b.target_role ? capitalise(b.target_role) : 'All Users'}
                                        </span>
                                        <span className="broadcast-history-author">
                                            By {b.admin_name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

function Edit3(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    )
}