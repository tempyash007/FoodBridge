import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Leaf, Search, Filter, MapPin, Clock, Package, Tag,
    ChevronRight, ArrowRight, Heart, Star,
    CheckCircle2, XCircle, Truck,
    SlidersHorizontal, Grid3x3, Map,
    LogOut, User, Navigation, X, ShoppingBag, Trash2,
    Megaphone, AlertTriangle, Bell, Zap, Users,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { logout as logoutService } from '../services/auth.service'
import { fetchWithAuth } from '../services/api'
import { useAuth } from '../context/AuthContext'

/* ── Helpers ── */
function timeUntilExpiry(expiryTime) {
    const diff = new Date(expiryTime) - new Date()
    if (diff <= 0) return 'Expired'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
}

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

const DIETARY_FILTERS = [
    { label: 'Vegan', value: 'vegan' },
    { label: 'Vegetarian', value: 'vegetarian' },
    { label: 'Gluten-Free', value: 'gluten-free' },
    { label: 'Halal', value: 'halal' },
    { label: 'Kosher', value: 'kosher' },
    { label: 'Organic', value: 'organic' },
]

const STATUS_COLORS = {
    'available': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Available' },
    'reserved': { bg: 'rgba(251,191,36,0.12)', color: '#f59e0b', label: 'Reserved' },
    'picked-up': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Picked Up' },
    'picked_up': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Picked Up' },
    'in-transit': { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: 'In Transit' },
    'in_transit': { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: 'In Transit' },
    'delivered': { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Delivered' },
    'completed': { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Delivered' },
    'pending': { bg: 'rgba(251,191,36,0.12)', color: '#f59e0b', label: 'Pending' },
    'approved': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Awaiting Volunteer' },
    'cancelled': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Cancelled' },
}

/* ── Star Rating Component ── */
function StarRating({ value, onChange }) {
    const [hovered, setHovered] = useState(0)
    return (
        <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: n <= (hovered || value) ? '#f59e0b' : 'var(--text-muted)',
                        transition: 'color 0.15s',
                    }}
                >
                    <Star size={22} fill={n <= (hovered || value) ? '#f59e0b' : 'none'} />
                </button>
            ))}
        </div>
    )
}

/* ── Review Modal ── */
function ReviewModal({ item, onSubmitReview, onClose }) {
    const [rating, setRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (rating < 1) { setError('Please select a star rating.'); return }
        setSubmitting(true)
        setError('')
        try {
            const res = await fetchWithAuth('/recipient/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mission_id: item.mission_id,
                    rating,
                    comment: comment.trim() || undefined,
                }),
            })
            const json = await res.json()
            // line ~238 in ClaimModal
            if (res.status === 201 && json.success) {
                onSuccess(item.listing_id)   // ← pass the id
                setStep(2)
            } else {
                setError(json.message || 'Failed to submit review.')
            }
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!item) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <button className="modal-close" onClick={onClose}><XCircle size={24} /></button>
                <div className="modal-body">
                    <h2 className="claim-title" style={{ marginTop: 0 }}>Rate your volunteer</h2>
                    <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                        How was your delivery experience with <strong>{item.volunteer_name || 'the volunteer'}</strong>?
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <StarRating value={rating} onChange={setRating} />
                    </div>

                    <textarea
                        className="form-input"
                        placeholder="Leave a comment (optional)…"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={3}
                        style={{ resize: 'vertical', marginBottom: '16px', width: '100%' }}
                    />

                    {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 16px' }}>{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="btn btn-primary btn-lg btn-full"
                    >
                        {submitting ? 'Submitting…' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ── Claim Modal ── */
/* ── Claim Modal ── */
function ClaimModal({ item, onClose, onSuccess }) {
    const [step, setStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [claimError, setClaimError] = useState('')
    const [savedAddress, setSavedAddress] = useState(null)
    const [useNewAddress, setUseNewAddress] = useState(false)
    const [address, setAddress] = useState({
        street_address: '', city: '', state: '', postal_code: '',
    })

    // Load saved address from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('recipient_delivery_address')
        if (stored) setSavedAddress(JSON.parse(stored))
    }, [])

    // Reset state whenever a new item is opened
    useEffect(() => {
        setStep(1)
        setClaimError('')
        setSubmitting(false)
        setUseNewAddress(false)
        setAddress({ street_address: '', city: '', state: '', postal_code: '' })
    }, [item])

    if (!item) return null

    // Derive pickup_time: use donor's pickup_window start if available, else now
    const pickupTime = item.pickup_window_start
        ? new Date(item.pickup_window_start).toISOString()
        : new Date().toISOString()

    const handleConfirmClaim = async () => {
        setSubmitting(true)
        setClaimError('')

        const activeAddress = (savedAddress && !useNewAddress) ? savedAddress : address

        if (!activeAddress.street_address || !activeAddress.city || !activeAddress.state || !activeAddress.postal_code) {
            setClaimError('Please fill in all delivery address fields.')
            setSubmitting(false)
            return
        }

        // Save address to localStorage for future claims
        localStorage.setItem('recipient_delivery_address', JSON.stringify(activeAddress))
        setSavedAddress(activeAddress)

        try {
            const res = await fetchWithAuth('/recipient/claims', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listing_id: item.listing_id,
                    pickup_time: pickupTime,
                    street_address: activeAddress.street_address,
                    city: activeAddress.city,
                    state: activeAddress.state,
                    postal_code: activeAddress.postal_code,
                    country: 'India',
                    latitude: null,
                    longitude: null,
                }),
            })
            const json = await res.json()

            if (res.status === 409) {
                setClaimError('This item has already been claimed by someone else.')
                return
            }
            if (res.status === 201 && json.success) {
                onSuccess()
                setStep(2)
            } else {
                setClaimError(json.message || 'Failed to claim listing.')
            }
        } catch {
            setClaimError('Network error. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} id="claim-modal">
                <button className="modal-close" onClick={onClose}><XCircle size={24} /></button>

                {step === 1 && (
                    <>
                        <div className="claim-hero">
                            {item.primary_image_url
                                ? <img src={item.primary_image_url} alt={item.title} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px 12px 0 0' }} />
                                : <span className="claim-emoji">🍱</span>
                            }
                        </div>
                        <div className="modal-body">
                            <h2 className="claim-title">{item.title}</h2>
                            <div className="claim-donor">
                                {/* <MapPin size={16} /> {item.donor_org || item.donor_org_name || 'Anonymous Donor'} */}
                            </div>
                            <div className="claim-details-grid">
                                <div className="claim-detail"><Package size={16} /> <span>{item.quantity} {item.quantity_unit}</span></div>
                                <div className="claim-detail"><Clock size={16} /> <span>Expires in {timeUntilExpiry(item.expiry_time)}</span></div>
                                <div className="claim-detail"><Tag size={16} /> <span>{item.category}</span></div>
                            </div>
                            <div className="claim-tags">
                                {(() => {
                                    let tags = []

                                    if (Array.isArray(item.dietary_tags)) {
                                        tags = item.dietary_tags
                                    } else if (typeof item.dietary_tags === 'string') {
                                        tags = item.dietary_tags.split(',')
                                    }

                                    // fallback for demo (optional)
                                    if (tags.length === 0) {
                                        tags = ['general']
                                    }

                                    return tags.map(t => (
                                        <span key={t} className="rp-tag">{t}</span>
                                    ))
                                })()}
                            </div>

                            <h3 className="claim-section-title">Your Delivery Address</h3>
                            {savedAddress && !useNewAddress ? (
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-muted)' }}>Delivering to saved address:</p>
                                    <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {savedAddress.street_address}, {savedAddress.city}, {savedAddress.state} {savedAddress.postal_code}
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => setUseNewAddress(true)}
                                    >
                                        Use a different address
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                    {savedAddress && (
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            style={{ alignSelf: 'flex-start', marginBottom: '4px' }}
                                            onClick={() => setUseNewAddress(false)}
                                        >
                                            ← Use saved address
                                        </button>
                                    )}
                                    <input
                                        className="form-input"
                                        placeholder="Street address"
                                        value={address.street_address}
                                        onChange={e => setAddress(a => ({ ...a, street_address: e.target.value }))}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <input
                                            className="form-input"
                                            placeholder="City"
                                            value={address.city}
                                            onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                                        />
                                        <input
                                            className="form-input"
                                            placeholder="State"
                                            value={address.state}
                                            onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}
                                        />
                                    </div>
                                    <input
                                        className="form-input"
                                        placeholder="Postal code"
                                        value={address.postal_code}
                                        onChange={e => setAddress(a => ({ ...a, postal_code: e.target.value }))}
                                    />
                                </div>
                            )}

                            <h3 className="claim-section-title">Pickup Window</h3>
                            <div className="pickup-slots">
                                <div className="claim-detail">
                                    <Clock size={16} />
                                    <span>
                                        {item.pickup_window
                                            ? item.pickup_window
                                            : item.pickup_window_start && item.pickup_window_end
                                                ? `${new Date(item.pickup_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(item.pickup_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : 'Available now — pick up as soon as possible'
                                        }
                                    </span>
                                </div>
                            </div>

                            {claimError && (
                                <div style={{ margin: '12px 0 0', padding: '10px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '14px' }}>
                                    {claimError}
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-lg btn-full"
                                onClick={handleConfirmClaim}
                                disabled={submitting}
                                style={{ marginTop: '16px' }}
                            >
                                <Heart size={18} /> {submitting ? 'Claiming…' : 'Claim This Food'}
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div className="modal-body" style={{ textAlign: 'center', padding: '60px 40px' }}>
                        <div className="success-checkmark">
                            <CheckCircle2 size={64} />
                        </div>
                        <h2 className="claim-title" style={{ marginTop: '24px' }}>Food Claimed!</h2>
                        <p className="claim-donor" style={{ marginBottom: '32px' }}>
                            A volunteer will pick it up and deliver to you. Track the status in your claimed items.
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={onClose}>
                            Got it <ArrowRight size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Status Timeline ── */
function StatusTimeline({ status }) {
    const steps = ['reserved', 'picked-up', 'in-transit', 'delivered']
    const currentIndex = steps.indexOf(status)

    return (
        <div className="status-timeline">
            {steps.map((s, i) => (
                <div key={s} className={`timeline-step${i <= currentIndex ? ' completed' : ''}${i === currentIndex ? ' current' : ''}`}>
                    <div className="timeline-dot" />
                    <span>{STATUS_COLORS[s].label}</span>
                </div>
            ))}
        </div>
    )
}

/* ── Main Recipient Portal ── */
export default function RecipientPortal() {
    const [filterCat, setFilterCat] = useState('All')
    const [selectedDietary, setSelectedDietary] = useState([])
    const [showFilters, setShowFilters] = useState(false)
    const [claimItem, setClaimItem] = useState(null)
    const [sortBy, setSortBy] = useState('expiry')
    const [showClaimed, setShowClaimed] = useState(false)
    const [showBroadcasts, setShowBroadcasts] = useState(false)
    const navigate = useNavigate()
    const { user, logout: logoutContext } = useAuth()

    // ── API State ──
    const [foodListings, setFoodListings] = useState([])
    const [claimedItems, setClaimedItems] = useState([])
    const [broadcasts, setBroadcasts] = useState([])
    const [broadcastsLoading, setBroadcastsLoading] = useState(false)
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState('')
    const [categories, setCategories] = useState([])

    // Track which claims have been reviewed in this session (to hide button instantly)
    const [reviewedClaims, setReviewedClaims] = useState(() => {
        try {
            const stored = localStorage.getItem('reviewed_claims')
            return stored ? new Set(JSON.parse(stored)) : new Set()
        } catch {
            return new Set()
        }
    })
    // Track which claims have the review form open
    const [reviewingClaim, setReviewingClaim] = useState(null)
    // Track cancel in-progress per claim
    const [cancellingClaim, setCancellingClaim] = useState(null)

    // Fetch categories (public endpoint — no auth needed)
    useEffect(() => {
        fetchWithAuth('/categories')
            .then(r => r.json())
            .then(json => {
                if (json.success && json.data?.categories?.length > 0) {
                    setCategories(json.data.categories)
                }
            })
            .catch(() => { /* silently ignore */ })
    }, [])

    // ── Fetch available listings — backend handles filtering & sorting ──
    const fetchListings = useCallback(async () => {
        setApiError('')
        try {
            const params = new URLSearchParams()

            if (filterCat !== 'All') {
                const selectedCategory = categories.find(c => c.name === filterCat)
                if (selectedCategory) params.append('category_id', selectedCategory.category_id)
            }
            // if (selectedDietary.length > 0) {
            //     const normalizedTags = selectedDietary.map(t => t.toLowerCase())
            //     params.append('dietary_tags', normalizedTags.join(','))
            // }

            // Map frontend sort values → backend sort values
            const sortMap = { expiry: 'expiring_soon', rating: 'highest_rated', nearest: 'nearest' }
            params.append('sort', sortMap[sortBy] || 'expiring_soon')

            const res = await fetchWithAuth(`/recipient/browse?${params.toString()}`)
            const json = await res.json()

            if (json.success) setFoodListings(json.data.listings || [])
            else setApiError(json.message || 'Failed to load listings.')
        } catch {
            setApiError('Network error loading listings.')
        }
    }, [filterCat, selectedDietary, sortBy, categories])

    // ── Fetch my claimed items ──
    const fetchMyClaims = useCallback(async () => {
        try {
            const res = await fetchWithAuth('/recipient/claims')
            const json = await res.json()
            if (json.success) {
                const claims = json.data.claims || []
                setClaimedItems(claims)

                // Seed reviewedClaims from backend — any claim with has_reviewed: true
                const alreadyReviewed = claims
                    .filter(c => c.has_reviewed)
                    .map(c => c.claim_id)
                if (alreadyReviewed.length > 0) {
                    setReviewedClaims(prev => {
                        const updated = new Set([...prev, ...alreadyReviewed])
                        try {
                            localStorage.setItem('reviewed_claims', JSON.stringify([...updated]))
                        } catch { /* ignore */ }
                        return updated
                    })
                }
            }
        } catch {
            // silent
        }
    }, [])

    // Initial load
    useEffect(() => {
        setLoading(true)
        Promise.all([fetchListings(), fetchMyClaims()])
            .finally(() => setLoading(false))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Re-fetch when filters / sort change (after initial load)
    const isFirstRender = useState(true)
    useEffect(() => {
        if (isFirstRender[0]) { isFirstRender[1](false); return }
        fetchListings()
    }, [filterCat, selectedDietary, sortBy]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── After a successful claim: refresh both lists ──
    // ── After a successful claim: optimistically remove from list, then refresh ──
    const handleClaimSuccess = (claimedListingId) => {
        // Immediately remove the claimed item from the displayed list
        if (claimedListingId) {
            setFoodListings(prev => prev.filter(l => l.listing_id !== claimedListingId))
        }
        // Then refresh both lists from server
        fetchListings()
        fetchMyClaims()
    }

    // ── Cancel a pending claim ──
    const handleCancel = async (claimId) => {
        setCancellingClaim(claimId)
        try {
            const res = await fetchWithAuth(`/recipient/claims/${claimId}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success) {
                await fetchMyClaims()
                await fetchListings()
            } else {
                alert(json.message || 'Could not cancel claim.')
            }
        } catch {
            alert('Network error. Please try again.')
        } finally {
            setCancellingClaim(null)
        }
    }

    // ── After successful review submission ──
    const handleReviewSubmitted = (claimId) => {
        setReviewedClaims(prev => {
            const updated = new Set([...prev, claimId])
            try {
                localStorage.setItem('reviewed_claims', JSON.stringify([...updated]))
            } catch { /* ignore */ }
            return updated
        })
        setReviewingClaim(null)
    }

    const fetchBroadcasts = useCallback(async () => {
        setBroadcastsLoading(true)
        try {
            const res = await fetchWithAuth('/notifications/broadcasts')
            const json = await res.json()
            if (json.success) setBroadcasts(json.data?.broadcasts || [])
        } catch { /* silent */ }
        finally { setBroadcastsLoading(false) }
    }, [])

    const handleLogout = async () => {
        await logoutService()
        logoutContext()
        navigate('/login', { replace: true })
    }

    const toggleDietary = (tag) => {
        setSelectedDietary(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        )
    }

    const filteredListings = foodListings.filter(item => {
        // No filter selected → show all
        if (selectedDietary.length === 0) return true

        // If backend doesn't send tags → DON'T FILTER OUT
        if (!item.dietary_tags) return true

        let itemTags = []

        if (Array.isArray(item.dietary_tags)) {
            itemTags = item.dietary_tags
        } else if (typeof item.dietary_tags === 'string') {
            itemTags = item.dietary_tags.split(',')
        }

        itemTags = itemTags.map(t => t.trim().toLowerCase())

        return selectedDietary.some(tag => itemTags.includes(tag))
    })
    // console.log("Listings:", foodListings)

    return (
        <div className="recipient-page" id="recipient-page">
            {/* ── Sticky Top Nav ── */}
            <header className="rp-topbar" id="rp-topbar">
                <div className="rp-topbar-inner">
                    <Link to="/" className="rp-brand">
                        <div className="brand-icon"><Leaf size={18} color="#fff" /></div>
                        <span>FoodBridge</span>
                    </Link>

                    <div className="rp-nav-actions">
                        <span className="rp-welcome-text">
                            Welcome{user?.first_name ? `, ${user.first_name}` : ''}!
                        </span>
                        <ThemeToggle />
                        <button
                            className={`rp-icon-btn${showClaimed ? ' active' : ''}`}
                            onClick={() => setShowClaimed(!showClaimed)}
                            title="My Claimed Items"
                        >
                            <ShoppingBag size={20} />
                            {claimedItems.length > 0 && (
                                <span className="rp-badge">{claimedItems.length}</span>
                            )}
                        </button>
                        <button
                            className={`rp-icon-btn${showBroadcasts ? ' active' : ''}`}
                            onClick={() => { setShowBroadcasts(!showBroadcasts); if (!showBroadcasts && broadcasts.length === 0) fetchBroadcasts(); }}
                            title="Announcements"
                        >
                            <Megaphone size={20} />
                        </button>
                        <button onClick={handleLogout} className="rp-icon-btn" title="Sign Out" id="rp-logout-btn">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Hero Banner ── */}
            <section className="rp-hero">
                <div className="rp-hero-content">
                    <h1>Find Available Food Near You</h1>
                    <p>Browse surplus food from local donors, claim what you need, and a volunteer will deliver it to your door.</p>
                    <div className="rp-hero-stats">
                        <div className="rp-hero-stat">
                            <span className="rp-stat-value">{loading ? '…' : foodListings.length}</span>
                            <span className="rp-stat-label">Available Now</span>
                        </div>
                        <div className="rp-hero-stat">
                            <span className="rp-stat-value">Free</span>
                            <span className="rp-stat-label">Always</span>
                        </div>
                        <div className="rp-hero-stat">
                            <span className="rp-stat-value">{foodListings.length}</span>
                            <span className="rp-stat-label">Showing</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Filter Bar ── */}
            <div className="rp-filters-bar" id="rp-filters-bar">
                <div className="rp-filters-inner">
                    <div className="rp-category-tabs">
                        {['All', ...categories.map(c => c.name)].map(c => (
                            <button
                                key={c}
                                className={`rp-cat-btn${filterCat === c ? ' active' : ''}`}
                                onClick={() => setFilterCat(c)}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <div className="rp-filter-actions">
                        <select
                            className="rp-sort-select"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                        >
                            <option value="expiry">Expiring Soon</option>
                            <option value="rating">Highest Rated</option>
                        </select>
                        <button
                            className={`rp-filter-btn${showFilters ? ' active' : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <SlidersHorizontal size={16} /> Filters
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="rp-diet-filters animate-slide-down">
                        <span className="rp-dfil-label">Dietary:</span>
                        {DIETARY_FILTERS.map(tag => (
                            <button
                                key={tag.value}
                                className={`rp-diet-btn${selectedDietary.includes(tag.value) ? ' active' : ''}`}
                                onClick={() => toggleDietary(tag.value)}
                            >
                                {tag.label}
                            </button>
                        ))}
                        {selectedDietary.length > 0 && (
                            <button className="rp-diet-clear" onClick={() => setSelectedDietary([])}>
                                Clear all
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Results ── */}
            <div className="rp-content">
                {apiError && (
                    <div style={{ margin: '16px 0', padding: '12px 16px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px' }}>
                        {apiError}
                    </div>
                )}
                <div className="rp-results-bar">
                    <span className="rp-count">{filteredListings.length} items available</span>
                </div>

                {loading && (
                    <div className="rp-grid">
                        {Array(6).fill(0).map((_, i) => (
                            <div key={i} style={{ background: 'var(--card-bg)', borderRadius: '16px', height: '280px', opacity: 0.6 }} />
                        ))}
                    </div>
                )}

                {/* ── Food Cards Grid ── */}
                <div className="rp-grid" id="rp-food-grid">
                    {!loading && filteredListings.map((item, i) => (
                        <div
                            key={item.listing_id}
                            className="rp-food-card"
                            style={{ animationDelay: `${i * 0.04}s` }}
                            id={`rp-food-${item.listing_id}`}
                        >
                            <div className="rp-card-photo">
                                {item.image_url || item.primary_image_url ? (
                                    <img
                                        src={item.image_url || item.primary_image_url}
                                        alt={item.title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '40px'
                                    }}>
                                        🍱
                                    </div>
                                )}
                                <div className="rp-card-expiry"><Clock size={12} /> {timeUntilExpiry(item.expiry_time)}</div>
                            </div>
                            <div className="rp-card-body">
                                {/* <div className="rp-card-donor">{item.donor_org || item.donor_org_name || 'Anonymous Donor'}</div> */}
                                <h3 className="rp-card-title">{item.title}</h3>
                                <div className="rp-card-meta">
                                    <span><Package size={14} /> {item.quantity} {item.quantity_unit}</span>
                                </div>
                                <div className="rp-card-tags">
                                    {(() => {
                                        let tags = []

                                        if (Array.isArray(item.dietary_tags)) {
                                            tags = item.dietary_tags
                                        } else if (typeof item.dietary_tags === 'string') {
                                            tags = item.dietary_tags.split(',')
                                        }

                                        // fallback for demo (optional)
                                        if (tags.length === 0) {
                                            tags = ['general']
                                        }

                                        return tags.map(t => (
                                            <span key={t} className="rp-tag">{t}</span>
                                        ))
                                    })()}
                                </div>
                                <button
                                    className="btn btn-primary btn-full btn-sm rp-claim-btn"
                                    onClick={() => setClaimItem(item)}
                                >
                                    <Heart size={14} /> Claim Food
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {!loading && filteredListings.length === 0 && (
                    <div className="rp-empty">
                        <Search size={48} />
                        <h3>No food items found</h3>
                        <p>Try adjusting your filters.</p>
                        <button
                            className="btn btn-outline"
                            onClick={() => { setFilterCat('All'); setSelectedDietary([]); }}
                        >
                            Reset Filters
                        </button>
                    </div>
                )}
            </div>

            {/* ── Claimed Items Slide-over ── */}
            {showClaimed && (
                <div className="rp-claimed-overlay" onClick={() => setShowClaimed(false)}>
                    <div className="rp-claimed-panel" onClick={e => e.stopPropagation()}>
                        <div className="rp-claimed-header">
                            <h2><ShoppingBag size={20} /> My Claimed Items</h2>
                            <button className="rp-claimed-close" onClick={() => setShowClaimed(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="rp-claimed-list">
                            {claimedItems.map(item => {
                                const statusKey = item.claim_status || item.status || 'pending'
                                const statusMeta = STATUS_COLORS[statusKey] || STATUS_COLORS['pending']
                                // Disable cancel if a volunteer has already been assigned (mission exists)
                                const isPending = (statusKey === 'pending' || statusKey === 'approved') && !item.mission_id
                                const isDelivered = statusKey === 'delivered' || statusKey === 'completed' || item.mission_status === 'delivered'
                                const alreadyReviewed = reviewedClaims.has(item.claim_id)
                                const isReviewing = reviewingClaim === item.claim_id

                                return (
                                    <div
                                        key={item.claim_id}
                                        className="rp-claimed-card"
                                        style={{ position: 'relative' }}
                                        id={`claimed-${item.claim_id}`}
                                    >
                                        {/* Top row */}
                                        <div className="rp-claimed-left">
                                            {item.primary_image_url ? (
                                                <img
                                                    src={item.primary_image_url}
                                                    alt={item.listing_title}
                                                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }}
                                                />
                                            ) : (
                                                <span className="rp-claimed-emoji">🍱</span>
                                            )}
                                            <div className="rp-claimed-info">
                                                <h4>{item.listing_title || item.title}</h4>
                                                <p>
                                                    {item.quantity ? `${item.quantity} ${item.quantity_unit}` : ''}

                                                </p>
                                                <div className="rp-claimed-vol">
                                                    <Truck size={14} />
                                                    {item.volunteer_name || 'Awaiting volunteer'}
                                                    {isDelivered ? (
                                                        <span className="rp-claimed-eta" style={{ color: '#10b981' }}>
                                                            <CheckCircle2 size={12} />
                                                            Status: Delivered
                                                        </span>
                                                    ) : (
                                                        <span className="rp-claimed-eta">
                                                            <Clock size={12} />
                                                            {item.mission_status ? `Status: ${item.mission_status.replace('_', ' ')}` : 'Awaiting pickup'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status badge */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            padding: '4px 10px',
                                            borderRadius: '999px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            background: statusMeta.bg,
                                            color: statusMeta.color
                                        }}>
                                            {statusMeta.label}
                                        </div>

                                        {/* Action buttons row */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '8px',
                                            marginTop: '10px'
                                        }}>
                                            {/* Cancel button — only for pending/approved claims (not yet picked up) */}
                                            {isPending && (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => handleCancel(item.claim_id)}
                                                    disabled={cancellingClaim === item.claim_id}
                                                >
                                                    <Trash2 size={14} />
                                                    {cancellingClaim === item.claim_id ? 'Cancelling…' : 'Cancel Claim'}
                                                </button>
                                            )}

                                            {/* Rate volunteer — only for delivered claims not yet reviewed */}
                                            {isDelivered && !alreadyReviewed && item.mission_id && (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => setReviewingClaim(item.claim_id)}
                                                >
                                                    <Star size={14} />
                                                    Rate Volunteer
                                                </button>
                                            )}

                                            {/* Reviewed indicator */}
                                            {isDelivered && alreadyReviewed && (
                                                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle2 size={14} /> Reviewed
                                                </span>
                                            )}
                                        </div>


                                    </div>
                                )
                            })}

                            {claimedItems.length === 0 && (
                                <div className="rp-claimed-empty">
                                    <ShoppingBag size={40} />
                                    <p>No claimed items yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Broadcasts Slide-over ── */}
            {showBroadcasts && (
                <div className="rp-claimed-overlay" onClick={() => setShowBroadcasts(false)}>
                    <div className="rp-claimed-panel" onClick={e => e.stopPropagation()}>
                        <div className="rp-claimed-header">
                            <h2><Megaphone size={20} /> Announcements</h2>
                            <button className="rp-claimed-close" onClick={() => setShowBroadcasts(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="rp-claimed-list">
                            {broadcastsLoading && (
                                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>Loading…</div>
                            )}

                            {!broadcastsLoading && broadcasts.length === 0 && (
                                <div className="rp-claimed-empty">
                                    <Megaphone size={40} />
                                    <p>No announcements yet</p>
                                </div>
                            )}

                            {!broadcastsLoading && broadcasts.map(b => (
                                <div key={b.broadcast_id} className="rp-broadcast-card">
                                    <div className="rp-broadcast-header">
                                        <h4 className="rp-broadcast-title">
                                            {b.title}
                                        </h4>
                                        <span className="rp-broadcast-time">
                                            <Clock size={12} /> {timeAgo(b.created_at)}
                                        </span>
                                    </div>
                                    <p className="rp-broadcast-message">{b.message}</p>
                                    <div className="rp-broadcast-meta">
                                        <span className="rp-broadcast-target">
                                            <Users size={12} />
                                            {b.target_role ? capitalise(b.target_role) : 'All Users'}
                                        </span>
                                        <span className="rp-broadcast-author">
                                            By {b.admin_name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <ClaimModal
                item={claimItem}
                onClose={() => setClaimItem(null)}
                onSuccess={handleClaimSuccess}
            />

            <ReviewModal
                item={claimedItems.find(c => c.claim_id === reviewingClaim)}
                onClose={() => setReviewingClaim(null)}
                onSubmitReview={handleReviewSubmitted}
            />
        </div>
    )
}