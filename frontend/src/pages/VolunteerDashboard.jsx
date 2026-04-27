import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Leaf, MapPin, Clock, Package, Truck, Navigation,
    ChevronRight, ArrowRight, Star, Calendar,
    LogOut, Home, Trophy, Shield, Menu, X,
    CheckCircle2, XCircle, Phone, Play, Pause,
    BarChart3, TrendingUp, Route, Zap, Award, Target,
    Map, User, Timer, Flag, Megaphone, Users, Bell,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { logout as logoutService } from '../services/auth.service'
import { useAuth } from '../context/AuthContext'
import { volunteerService } from '../services/volunteer.service'
import { fetchWithAuth } from '../services/api'

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return days === 1 ? '1 day ago' : `${days} days ago`
}

function capitalise(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

const ACHIEVEMENTS = [
    { title: 'First Delivery', desc: 'Completed your first rescue', icon: '🚀', earned: true },
    { title: 'Speed Demon', desc: '10 deliveries under 20 min', icon: '⚡', earned: true },
    { title: '100 Club', desc: 'Completed 100 deliveries', icon: '💯', earned: true },
    { title: 'Early Bird', desc: '20 deliveries before 9 AM', icon: '🌅', earned: true },
    { title: 'Marathon Runner', desc: '50 km total distance', icon: '🏃', earned: true },
    { title: 'Night Owl', desc: '10 deliveries after 8 PM', icon: '🦉', earned: false, progress: 70 },
    { title: 'Team Player', desc: '5 multi-stop routes', icon: '🤝', earned: false, progress: 40 },
    { title: 'Legendary', desc: '500 deliveries milestone', icon: '🔥', earned: false, progress: 51 },
]

const STATUS_STEPS = ['assigned', 'in_transit', 'picked_up', 'delivered']
const STATUS_LABELS = {
    'assigned': 'Awaiting Pickup',
    'in_transit': 'Heading to Pickup',
    'picked_up': 'Food Picked Up — Delivering',
    'delivered': 'Delivered',
}
const STATUS_BUTTON_LABELS = {
    'in_transit': 'Mark Heading to Pickup',
    'picked_up': 'Mark Food Picked Up',
    'delivered': 'Mark Delivered',
}

/* ── Route Card ── */
function MissionCard({ mission, onUpdateStatus }) {
    const currentStep = STATUS_STEPS.indexOf(mission.status)
    const nextStep = currentStep > -1 && currentStep < STATUS_STEPS.length - 1 ? STATUS_STEPS[currentStep + 1] : null

    // Decide which address to navigate to based on current status
    // assigned/in_transit → go to pickup, picked_up → go to delivery
    const navigateAddress = currentStep <= 1
        ? mission.pickup.address
        : mission.delivery.address

    const handleNavigate = () => {
        if (!navigateAddress) return
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navigateAddress)}`
        window.open(url, '_blank')
    }

    return (
        <div className={`mission-card${mission.is_urgent ? ' urgent' : ''}`} id={`mission-${mission.mission_id}`}>
            {mission.is_urgent && <div className="urgent-badge"><Zap size={12} /> Urgent</div>}
            <div className="mission-route">
                <div className="mission-point pickup-point">
                    <div className="point-dot pickup" />
                    <div className="point-info">
                        <span className="point-label">Pickup</span>
                        <span className="point-name">{mission.pickup.org_name || 'Donor Location'}</span>
                        <span className="point-address">{mission.pickup.address}</span>
                        <span className="point-items">{mission.pickup.quantity} {mission.pickup.quantity_unit} - {mission.pickup.listing_title}</span>
                    </div>
                </div>
                <div className="mission-line" />
                <div className="mission-point delivery-point">
                    <div className="point-dot delivery" />
                    <div className="point-info">
                        <span className="point-label">Deliver to</span>
                        <span className="point-name">{mission.delivery.org_name || 'Recipient Location'}</span>
                        <span className="point-address">{mission.delivery.address}</span>
                    </div>
                </div>
            </div>

            <div className="mission-meta">
                <div className="mission-meta-item"><Route size={14} /> {mission.distance_km != null && mission.distance_km > 0 ? `${parseFloat(mission.distance_km).toFixed(1)} km` : 'N/A'}</div>
                <div className="mission-meta-item"><Timer size={14} /> ETA: {mission.est_duration_min != null && mission.est_duration_min > 0 ? `${Math.round(mission.est_duration_min)} min` : 'N/A'}</div>
                <div className="mission-meta-item" style={{ color: currentStep <= 1 ? '#fbbf24' : '#34d399' }}>
                    <Flag size={14} /> {STATUS_LABELS[mission.status] || mission.status}
                </div>
            </div>

            {/* Status progress bar */}
            <div className="mission-progress">
                {STATUS_STEPS.map((s, i) => (
                    <div key={s} className={`progress-step${i <= currentStep ? ' done' : ''}${i === currentStep ? ' current' : ''}`}>
                        <div className="progress-dot" />
                    </div>
                ))}
                <div className="progress-line-bg" />
                <div className="progress-line-fill" style={{ width: `${Math.max(0, (currentStep / (STATUS_STEPS.length - 1)) * 100)}%` }} />
            </div>

            <div className="mission-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleNavigate}>
                    <Navigation size={14} /> Navigate
                </button>
                {nextStep && (
                    <button className="btn btn-primary btn-sm" onClick={() => onUpdateStatus(mission.mission_id, nextStep)}>
                        <ArrowRight size={14} /> {STATUS_BUTTON_LABELS[nextStep] || `Mark ${STATUS_LABELS[nextStep]}`}
                    </button>
                )}
            </div>
        </div>
    )
}

/* ── Main Volunteer Dashboard ── */
export default function VolunteerDashboard() {
    const [activeTab, setActiveTab] = useState('missions')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const navigate = useNavigate()
    const { user, logout: logoutContext } = useAuth()

    // Remote state
    const [loading, setLoading] = useState(false)
    const [dashboardStats, setDashboardStats] = useState(null)
    const [availableMissions, setAvailableMissions] = useState([])
    const [schedule, setSchedule] = useState([])
    const [leaderboard, setLeaderboard] = useState(null)
    const [broadcasts, setBroadcasts] = useState([])
    const [broadcastsLoading, setBroadcastsLoading] = useState(false)

    // Schedule edit state
    const [editingDay, setEditingDay] = useState(null)
    const [editingSlots, setEditingSlots] = useState([])

    const handleEditDay = (d) => {
        setEditingDay(d.day_of_week)
        setEditingSlots(d.slots ? JSON.parse(JSON.stringify(d.slots)) : [])
    }

    const handleAddSlot = () => {
        setEditingSlots([...editingSlots, { start_time: '09:00', end_time: '17:00' }])
    }

    const handleUpdateSlot = (index, field, value) => {
        const newSlots = [...editingSlots]
        newSlots[index][field] = value
        setEditingSlots(newSlots)
    }

    const handleRemoveSlot = (index) => {
        const newSlots = [...editingSlots]
        newSlots.splice(index, 1)
        setEditingSlots(newSlots)
    }

    const handleSaveSchedule = async () => {
        try {
            setLoading(true)
            const updatedData = await volunteerService.updateSchedule({
                day_of_week: editingDay,
                slots: editingSlots
            })
            setSchedule(updatedData.schedule || [])
            setEditingDay(null)
        } catch (err) {
            console.error('Error updating schedule', err)
            alert('Failed to update schedule: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await logoutService()
        logoutContext()
        navigate('/login', { replace: true })
    }

    const fetchTabContent = async () => {
        setLoading(true)
        try {
            if (activeTab === 'missions') {
                const data = await volunteerService.getDashboard()
                setDashboardStats(data)
            } else if (activeTab === 'available') {
                const data = await volunteerService.getAvailableMissions()
                setAvailableMissions(data.missions || [])
            } else if (activeTab === 'schedule') {
                const data = await volunteerService.getSchedule()
                setSchedule(data.schedule || [])
            } else if (activeTab === 'leaderboard') {
                const data = await volunteerService.getLeaderboard()
                setLeaderboard(data)
            } else if (activeTab === 'achievements') {
                const data = await volunteerService.getDashboard()
                setDashboardStats(data)
            } else if (activeTab === 'announcements') {
                setBroadcastsLoading(true)
                try {
                    const res = await fetchWithAuth('/notifications/broadcasts')
                    const json = await res.json()
                    if (json.success) setBroadcasts(json.data?.broadcasts || [])
                } catch { /* silent */ }
                finally { setBroadcastsLoading(false) }
            }
        } catch (err) {
            console.error('Error fetching tab data', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTabContent()
    }, [activeTab])

    const updateMissionStatus = async (id, newStatus) => {
        try {
            await volunteerService.updateMissionStatus(id, newStatus)
            // Force re-fetch dashboard data directly instead of relying on tab state
            setLoading(true)
            const data = await volunteerService.getDashboard()
            setDashboardStats(data)
        } catch (err) {
            console.error('Failed to update status', err)
            alert('Failed to update status')
        } finally {
            setLoading(false)
        }
    }

    const handleAcceptMission = async (claimId) => {
        try {
            await volunteerService.acceptMission(claimId)
            setActiveTab('missions') // Switch back to active missions after accepting
        } catch (err) {
            console.error('Failed to accept mission', err)
            alert('Failed to accept mission')
        }
    }

    const stats = [
        { label: 'Total Deliveries', value: dashboardStats?.stats?.total_deliveries || 0, icon: Truck, color: 'green' },
        { label: 'This Week', value: dashboardStats?.stats?.this_week_deliveries || 0, icon: TrendingUp, color: 'blue' },
        { label: 'Points Earned', value: dashboardStats?.stats?.points_earned || 0, icon: Star, color: 'orange' },
        { label: 'Avg Rating', value: dashboardStats?.stats?.avg_rating || 'N/A', icon: Award, color: 'purple' },
    ]

    return (
        <div className="dashboard-page">
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} id="volunteer-sidebar">
                <Link to="/" className="sidebar-brand">
                    <div className="brand-icon"><Leaf size={18} color="#fff" /></div>
                    <span>FoodBridge</span>
                </Link>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Navigation</div>
                    <button className={`sidebar-link${activeTab === 'missions' ? ' active' : ''}`} onClick={() => setActiveTab('missions')}>
                        <Truck size={20} /> Active Missions
                    </button>
                    <button className={`sidebar-link${activeTab === 'available' ? ' active' : ''}`} onClick={() => setActiveTab('available')}>
                        <Map size={20} /> Available
                    </button>
                    <button className={`sidebar-link${activeTab === 'schedule' ? ' active' : ''}`} onClick={() => setActiveTab('schedule')}>
                        <Calendar size={20} /> Schedule
                    </button>
                    <button className={`sidebar-link${activeTab === 'leaderboard' ? ' active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
                        <Trophy size={20} /> Leaderboard
                    </button>
                    <button className={`sidebar-link${activeTab === 'achievements' ? ' active' : ''}`} onClick={() => setActiveTab('achievements')}>
                        <Award size={20} /> Achievements
                    </button>
                    <button className={`sidebar-link${activeTab === 'announcements' ? ' active' : ''}`} onClick={() => setActiveTab('announcements')}>
                        <Megaphone size={20} /> Announcements
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>{user?.first_name ? user.first_name[0] : 'V'}</div>
                        <div className="user-info">
                            <span className="user-name">{user?.first_name || 'Volunteer'}</span>
                            <span className="user-role">Volunteer</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="sidebar-link logout-link"><LogOut size={20} /> Sign Out</button>
                </div>
            </aside>

            <main className="dashboard-main" id="volunteer-main">

                {/* ── Active Missions ── */}
                {activeTab === 'missions' && (
                    <>
                        <header className="dashboard-topbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <div>
                                    <h1 className="dashboard-title">Active Missions</h1>
                                    <p className="dashboard-subtitle">Your current food rescue deliveries</p>
                                </div>
                            </div>
                            <div className="topbar-actions">
                                <ThemeToggle />
                            </div>
                        </header>
                        <div className="dashboard-content animate-page-in">
                            {/* Quick Stats */}
                            <div className="metrics-grid vol-metrics">
                                {stats.map((s, i) => {
                                    const Icon = s.icon
                                    return (
                                        <div key={i} className={`metric-card metric-${s.color}`} style={{ animationDelay: `${i * 0.08}s` }}>
                                            <div className="metric-icon-wrap"><Icon size={22} /></div>
                                            <div className="metric-info">
                                                <div className="metric-value">{loading ? '...' : s.value}</div>
                                                <div className="metric-label">{s.label}</div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Route Map Placeholder */}
                            {dashboardStats?.optimized_route?.stops?.length > 0 && (
                                <div className="card route-map-card" id="route-map">
                                    <div className="card-header">
                                        <h2 className="card-title"><Route size={20} /> Optimized Route</h2>
                                        <button className="btn btn-primary btn-sm" onClick={() => {
                                            const firstStop = dashboardStats?.optimized_route?.stops?.[0]
                                            if (firstStop?.address) {
                                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(firstStop.address)}`, '_blank')
                                            }
                                        }}><Navigation size={14} /> Start Navigation</button>
                                    </div>
                                    <div className="route-map-placeholder">
                                        <div className="route-map-visual">
                                            <div className="route-node start"><span>📍</span> You</div>
                                            {dashboardStats.optimized_route.stops.map((stop, i) => (
                                                <div key={i} style={{ display: 'contents' }}>
                                                    <div className="route-line-h" />
                                                    <div className={`route-node ${stop.type === 'PICKUP' ? 'pickup-node' : 'delivery-node'}`}>
                                                        <span>{stop.type === 'PICKUP' ? '🥗' : '🏠'}</span> {stop.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="route-summary">
                                            <div className="route-stat"><Route size={16} /> Total: {parseFloat(dashboardStats.optimized_route.total_km || 0).toFixed(1)} km</div>
                                            <div className="route-stat"><Timer size={16} /> ~{Math.round(dashboardStats.optimized_route.est_duration_min || 0)} min</div>
                                            <div className="route-stat"><Package size={16} /> {dashboardStats.optimized_route.total_stops} stops</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mission Cards */}
                            <h2 className="section-heading">Current Deliveries</h2>
                            {loading ? (
                                <p style={{ color: 'var(--text-muted)' }}>Loading active missions...</p>
                            ) : (
                                dashboardStats?.current_deliveries?.map(m => (
                                    <MissionCard key={m.mission_id} mission={m} onUpdateStatus={updateMissionStatus} />
                                ))
                            )}

                            {!loading && (!dashboardStats?.current_deliveries || dashboardStats.current_deliveries.length === 0) && (
                                <div className="empty-state-card">
                                    <Truck size={48} />
                                    <h3>No active missions</h3>
                                    <p>Check available missions to start delivering!</p>
                                    <button className="btn btn-primary" onClick={() => setActiveTab('available')}>
                                        Browse Available <ArrowRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── Available Missions ── */}
                {activeTab === 'available' && (
                    <>
                        <header className="dashboard-topbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <div>
                                    <h1 className="dashboard-title">Available Missions</h1>
                                    <p className="dashboard-subtitle">Accept food rescue deliveries near you</p>
                                </div>
                            </div>
                        </header>
                        <div className="dashboard-content animate-page-in">
                            <div className="available-missions-grid">
                                {loading ? (
                                    <p style={{ color: 'var(--text-muted)' }}>Loading missions near you...</p>
                                ) : (
                                    availableMissions.map((m, i) => (
                                        <div key={m.claim_id} className="available-card" style={{ animationDelay: `${i * 0.08}s` }} id={`avail-${m.claim_id}`}>
                                            <div className="avail-header">
                                                <div className="avail-route">
                                                    <span className="avail-from">{m.donor_org || 'Pickup'}</span>
                                                    <ArrowRight size={16} />
                                                    <span className="avail-to">{m.recipient_org || 'Delivery'}</span>
                                                </div>
                                                <div className="avail-reward">+{m.points} pts</div>
                                            </div>
                                            <div className="avail-details">
                                                <span><Package size={14} /> {m.quantity} {m.quantity_unit} - {m.listing_title}</span>
                                                <span><Route size={14} /> {m.distance_km != null ? `${parseFloat(m.distance_km).toFixed(1)} km` : 'N/A km'}</span>
                                                {m.is_urgent ? (
                                                    <span className="avail-expiry" style={{ color: 'var(--danger)' }}><Clock size={14} /> Urgent</span>
                                                ) : (
                                                    <span className="avail-expiry"><Clock size={14} /> {m.minutes_until_expiry != null ? `${Math.round(m.minutes_until_expiry)} min left` : 'Unknown'}</span>
                                                )}
                                            </div>
                                            <button className="btn btn-primary btn-full btn-sm" onClick={() => handleAcceptMission(m.claim_id)}>
                                                <Play size={14} /> Accept Mission
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                            {!loading && availableMissions.length === 0 && (
                                <div className="empty-state-card" style={{ marginTop: '20px' }}>
                                    <MapPin size={48} />
                                    <h3>No available missions right now</h3>
                                    <p>Check back later or turn on notifications.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── Schedule ── */}
                {activeTab === 'schedule' && (
                    <>
                        <header className="dashboard-topbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <div>
                                    <h1 className="dashboard-title">Availability Schedule</h1>
                                    <p className="dashboard-subtitle">Set your available time slots for the week</p>
                                </div>
                            </div>
                        </header>
                        <div className="dashboard-content animate-page-in">
                            <div className="schedule-week" id="schedule-calendar">
                                {loading ? (
                                    <p style={{ color: 'var(--text-muted)' }}>Loading schedule...</p>
                                ) : (
                                    schedule.map((d, i) => (
                                        <div key={i} className={`schedule-day${d.slots?.length > 0 ? ' has-slots' : ''}`}>
                                            <div className="schedule-day-header">
                                                <span className="schedule-day-name">{d.day_name}</span>
                                            </div>
                                            {editingDay === d.day_of_week ? (
                                                <div className="schedule-edit-form" style={{ flex: 1 }}>
                                                    {editingSlots.map((s, j) => (
                                                        <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                            <input 
                                                                type="time" 
                                                                value={s.start_time} 
                                                                onChange={(e) => handleUpdateSlot(j, 'start_time', e.target.value)} 
                                                                style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                                            />
                                                            <span>to</span>
                                                            <input 
                                                                type="time" 
                                                                value={s.end_time} 
                                                                onChange={(e) => handleUpdateSlot(j, 'end_time', e.target.value)}
                                                                style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                                            />
                                                            <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveSlot(j)} style={{ padding: '4px', color: 'var(--danger)' }}>
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={handleAddSlot}>+ Add Time</button>
                                                        <button className="btn btn-primary btn-sm" onClick={handleSaveSchedule}>Save</button>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingDay(null)}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="schedule-slots">
                                                        {d.slots?.length > 0 ? d.slots.map((s, j) => (
                                                            <div key={j} className="schedule-slot">{s.start_time} - {s.end_time}</div>
                                                        )) : (
                                                            <div className="schedule-empty">Off</div>
                                                        )}
                                                    </div>
                                                    <button className="btn btn-ghost btn-sm schedule-edit-btn" onClick={() => handleEditDay(d)}>Edit</button>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Leaderboard ── */}
                {activeTab === 'leaderboard' && (
                    <>
                        <header className="dashboard-topbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <div>
                                    <h1 className="dashboard-title">Volunteer Leaderboard</h1>
                                    <p className="dashboard-subtitle">Top food rescue heroes this month</p>
                                </div>
                            </div>
                        </header>
                        <div className="dashboard-content animate-page-in">
                            {loading ? (
                                <p style={{ color: 'var(--text-muted)' }}>Loading leaderboard...</p>
                            ) : (
                                <>
                                    {/* Top 3 podium */}
                                    <div className="podium" id="leaderboard-podium">
                                        {leaderboard?.top3 && [leaderboard.top3[1], leaderboard.top3[0], leaderboard.top3[2]].filter(Boolean).map((p, i) => {
                                            const displayRank = leaderboard.top3.indexOf(p) + 1;
                                            return (
                                                <div key={p.name} className={`podium-card rank-${displayRank}${p.is_current_user ? ' is-you' : ''}`} style={{ animationDelay: `${i * 0.15}s` }}>
                                                    <div className="podium-badge">{displayRank === 1 ? '🏆' : displayRank === 2 ? '🥈' : '🥉'}</div>
                                                    <div className="podium-avatar">{p.name.charAt(0)}</div>
                                                    <div className="podium-name">{p.name}</div>
                                                    <div className="podium-points">{p.points.toLocaleString()} pts</div>
                                                    <div className="podium-deliveries">{p.total_deliveries} deliveries</div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Full list */}
                                    {leaderboard?.rankings && (
                                        <div className="card">
                                            <div className="card-header">
                                                <h2 className="card-title"><Trophy size={20} /> Rankings</h2>
                                            </div>
                                            <div className="leaderboard-list">
                                                {leaderboard.rankings.map(p => (
                                                    <div key={p.rank} className={`leaderboard-row${p.is_current_user ? ' is-you' : ''}`}>
                                                        <span className="lb-rank">#{p.rank}</span>
                                                        <div className="lb-avatar">{p.name.charAt(0)}</div>
                                                        <span className="lb-name">{p.name}</span>
                                                        <span className="lb-deliveries">{p.total_deliveries} deliveries</span>
                                                        <span className="lb-points">{p.points.toLocaleString()} pts</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* ── Achievements ── */}
                {activeTab === 'achievements' && (() => {
                    const userAchievements = dashboardStats?.achievements || ACHIEVEMENTS;
                    return (
                        <>
                            <header className="dashboard-topbar">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                                    </button>
                                    <div>
                                        <h1 className="dashboard-title">Achievements & Badges</h1>
                                        <p className="dashboard-subtitle">Your earned rewards and milestones</p>
                                    </div>
                                </div>
                            </header>
                            <div className="dashboard-content animate-page-in">
                                <div className="achievements-summary">
                                    <div className="achiev-stat"><span>{userAchievements.filter(a => a.earned).length}</span> Earned</div>
                                    <div className="achiev-stat"><span>{userAchievements.length}</span> Total</div>
                                    <div className="achiev-stat"><span>{Math.round((userAchievements.filter(a => a.earned).length / userAchievements.length) * 100) || 0}%</span> Complete</div>
                                </div>

                                <div className="milestones-grid achievements-grid">
                                    {userAchievements.map((a, i) => (
                                        <div key={i} className={`milestone-card achievement-card${a.earned ? ' earned' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
                                            <div className="milestone-icon">{a.icon}</div>
                                            <h4>{a.title}</h4>
                                            <p>{a.desc}</p>
                                            {!a.earned && a.progress !== undefined && (
                                                <div className="milestone-progress">
                                                    <div className="milestone-progress-bar" style={{ width: `${a.progress}%` }} />
                                                </div>
                                            )}
                                            {a.earned && <div className="milestone-earned">✓ Earned</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    );
                })()}

                {/* ── Announcements Tab ── */}
                {activeTab === 'announcements' && (
                    <>
                        <header className="dashboard-topbar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                    {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                                <div>
                                    <h1 className="dashboard-title">Announcements</h1>
                                    <p className="dashboard-subtitle">Updates from the admin team</p>
                                </div>
                            </div>
                            <div className="topbar-actions">
                                <ThemeToggle />
                            </div>
                        </header>
                        <div className="dashboard-content animate-page-in">
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title"><Megaphone size={20} /> Admin Announcements</h2>
                                </div>

                                {broadcastsLoading && (
                                    <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>Loading…</div>
                                )}

                                {!broadcastsLoading && broadcasts.length === 0 && (
                                    <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>
                                        <Megaphone size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                                        <p>No announcements yet</p>
                                    </div>
                                )}

                                {!broadcastsLoading && broadcasts.length > 0 && (
                                    <div className="broadcast-history-list">
                                        {broadcasts.map(b => (
                                            <div key={b.broadcast_id} className="broadcast-history-item">
                                                <div className="broadcast-history-header">
                                                    <h3 className="broadcast-history-title">{b.title}</h3>
                                                    <span className="broadcast-history-time"><Clock size={12} /> {timeAgo(b.created_at)}</span>
                                                </div>
                                                <p className="broadcast-history-message">{b.message}</p>
                                                <div className="broadcast-history-meta">
                                                    <span className="broadcast-history-target">
                                                        <Users size={12} />
                                                        {b.target_role ? capitalise(b.target_role) : 'All Users'}
                                                    </span>
                                                    <span className="broadcast-history-author">By {b.admin_name}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
