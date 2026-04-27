import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Leaf, Plus, Package, Clock, TrendingDown,
    Utensils, Camera, MapPin, Tag, AlertCircle,
    ChevronRight, ArrowRight, BarChart3, Truck,
    CheckCircle2, XCircle, Trash2, Pencil,
    LogOut, Home, Menu, X,
    Download, Star, Megaphone, Users,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import { logout as logoutService } from '../services/auth.service'
import { fetchWithAuth } from '../services/api'
import { useAuth } from '../context/AuthContext'

/* ── Status colours ── */
const STATUS_COLORS = {
    'available': { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Available' },
    'reserved': { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', label: 'Reserved' },
    'in-transit': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', label: 'In Transit' },
    'delivered': { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Delivered' },
    'expired': { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: 'Expired' },
    'cancelled': { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: 'Cancelled' },
}

// categories are fetched dynamically from /api/categories

/* ── Helpers ── */
function timeUntilExpiry(expiryTime) {
    const diff = new Date(expiryTime) - new Date()
    if (diff <= 0) return 'Expired'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

/* ── Create Listing Modal ── */
function CreateListingModal({ isOpen, onClose, categories = [] }) {
    const [formData, setFormData] = useState({
        title: '', quantity: '', category_id: '', description: '',
        expiryHours: '4', dietary: [],
        pickup_start: '',
        pickup_end: '',
        street_address: '', city: '', state: '', postal_code: '', country: ''
    })
    // Pre-select first category when list loads
    useEffect(() => {
        if (isOpen && categories.length > 0 && !formData.category_id) {
            setFormData(p => ({ ...p, category_id: categories[0].category_id }))
        }
    }, [isOpen, categories])
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [step, setStep] = useState(1)
    const [errorMsg, setErrorMsg] = useState('')
    const [computedExpiry, setComputedExpiry] = useState(null)

    if (!isOpen) return null

    const handleNextStep1 = () => {
        if (!formData.title.trim()) return setErrorMsg('Food Title is required.')
        if (!formData.quantity || isNaN(formData.quantity) || Number(formData.quantity) <= 0)
            return setErrorMsg('Quantity must be a valid positive number.')
        if (Number(formData.quantity) > 10000)
            return setErrorMsg('Quantity cannot exceed 10,000 servings.')
        setErrorMsg('')
        setStep(2)
    }

    const handleNextStep2 = () => {
        if (!formData.street_address.trim()) return setErrorMsg('Street Address is required.')
        if (!formData.city.trim()) return setErrorMsg('City is required.')
        if (!formData.state.trim()) return setErrorMsg('State/Province is required.')
        if (!formData.postal_code.trim()) return setErrorMsg('Postal Code is required.')
        if (!formData.country.trim()) return setErrorMsg('Country is required.')
        if (!formData.pickup_start || !formData.pickup_end)
            return setErrorMsg('Pickup start and end time are required.')

        const now = new Date()
        const pickupStart = new Date(formData.pickup_start)
        const pickupEnd = new Date(formData.pickup_end)

        const expiryTime = new Date(now)
        expiryTime.setHours(expiryTime.getHours() + parseInt(formData.expiryHours || 4))

        if (pickupStart <= now)
            return setErrorMsg('Pickup start time must be in the future.')
        if (pickupEnd <= pickupStart)
            return setErrorMsg('Pickup end time must be after pickup start time.')
        if (pickupEnd > expiryTime)
            return setErrorMsg(
                `Pickup window must end before the listing expires (within ${formData.expiryHours}h from now).`
            )

        setComputedExpiry(expiryTime)   // ← lock it in
        setErrorMsg('')
        setStep(3)
    }

    const dietaryOptions = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'Kosher', 'Organic', 'Nut-Free', 'Dairy-Free']

    const toggleDietary = (tag) => {
        setFormData(prev => ({
            ...prev,
            dietary: prev.dietary.includes(tag)
                ? prev.dietary.filter(t => t !== tag)
                : [...prev.dietary, tag]
        }))
    }

    const handleSubmit = async () => {
        try {
            let uploadedImageUrl = ''

            if (imageFile) {
                setIsUploading(true)
                const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
                const fd = new FormData()
                fd.append('file', imageFile)
                fd.append('upload_preset', uploadPreset)
                const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                    method: 'POST', body: fd
                })
                const cData = await cRes.json()
                if (cData.secure_url) uploadedImageUrl = cData.secure_url
                else alert('Image upload failed, creating listing without image.')
                setIsUploading(false)
            }

            const expiryTime = computedExpiry ?? (() => {
                const t = new Date()
                t.setHours(t.getHours() + parseInt(formData.expiryHours || 4))
                return t
            })()
            // No second setHours call — expiry is already correct

            const payload = {
                title: formData.title,
                description: formData.description || 'No description provided',
                quantity: parseInt(formData.quantity) || 1,
                quantity_unit: 'servings',
                estimated_servings: parseInt(formData.quantity) || 1,  // ← ADD THIS
                expiry_time: expiryTime.toISOString(),
                pickup_start: new Date(formData.pickup_start).toISOString(),
                pickup_end: new Date(formData.pickup_end).toISOString(),
                category_id: formData.category_id || null,
                street_address: formData.street_address,
                city: formData.city,
                state: formData.state,
                postal_code: formData.postal_code,
                country: formData.country,
                image_urls: uploadedImageUrl ? [uploadedImageUrl] : [],
            }

            const response = await fetchWithAuth('/listings', {
                method: 'POST',
                body: JSON.stringify(payload)
            })
            const data = await response.json()

            if (data.success) {
                alert('Listing created successfully!')
                setFormData({
                    title: '',
                    quantity: '',
                    category_id: categories[0]?.category_id || '',
                    description: '',
                    expiryHours: '4',
                    dietary: [],
                    pickup_start: '',
                    pickup_end: '',
                    street_address: '',
                    city: '',
                    state: '',
                    postal_code: '',
                    country: ''
                })
                setImageFile(null)
                setImagePreview('')
                setErrorMsg('')
                setStep(1)
                onClose()
            } else {
                alert('Failed to create listing: ' + (data.message || 'Unknown error'))
            }
        } catch (error) {
            console.error('Error creating listing:', error)
            alert('A network error occurred. Check the console.')
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} id="create-listing-modal">
                <button className="modal-close" onClick={onClose}><XCircle size={24} /></button>

                <div className="modal-header">
                    <h2>Create Food Listing</h2>
                    <p className="modal-subtitle">Share your surplus food with those in need</p>
                </div>

                <div className="modal-steps">
                    <div className={`modal-step${step >= 1 ? ' active' : ''}`}><span>1</span> Details</div>
                    <div className="modal-step-line" />
                    <div className={`modal-step${step >= 2 ? ' active' : ''}`}><span>2</span> Pickup</div>
                    <div className="modal-step-line" />
                    <div className={`modal-step${step >= 3 ? ' active' : ''}`}><span>3</span> Review</div>
                </div>

                {errorMsg && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 15px', borderRadius: '6px', margin: '0 24px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={16} /> {errorMsg}
                    </div>
                )}

                {step === 1 && (
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label">Food Image</label>
                            {imagePreview ? (
                                <div style={{ position: 'relative', marginBottom: '10px', borderRadius: '8px', overflow: 'hidden' }}>
                                    <img src={imagePreview} alt="Food preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', cursor: 'pointer' }}
                                        onClick={() => { setImagePreview(''); setImageFile(null) }}
                                        type="button"
                                        title="Remove Image"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="photo-upload-area" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '30px', border: '2px dashed var(--border-color, #e2e8f0)', borderRadius: '8px', cursor: 'pointer' }}>
                                    <Camera size={32} style={{ marginBottom: '10px', color: 'var(--text-secondary, #64748b)' }} />
                                    <p style={{ color: 'var(--text-secondary, #64748b)' }}>Click or drag to upload an image</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                        onChange={e => {
                                            const file = e.target.files[0]
                                            if (file) {
                                                setImageFile(file)
                                                setImagePreview(URL.createObjectURL(file))
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Food Title</label>
                            <input
                                className="form-input"
                                placeholder="e.g. Fresh Vegetable Platter"
                                value={formData.title}
                                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Quantity</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. 25"
                                    value={formData.quantity}
                                    onChange={e => setFormData(p => ({ ...p, quantity: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select
                                    className="form-input form-select"
                                    value={formData.category_id}
                                    onChange={e => setFormData(p => ({ ...p, category_id: e.target.value }))}
                                    style={{ colorScheme: 'dark light' }}
                                >
                                    {categories.length === 0 && <option value="">Loading...</option>}
                                    {categories.map(c => (
                                        <option key={c.category_id} value={c.category_id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-input form-textarea"
                                placeholder="Describe the food items, condition, and any allergen info..."
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Dietary Tags</label>
                            <div className="tag-grid">
                                {dietaryOptions.map(tag => (
                                    <button
                                        key={tag}
                                        className={`diet-tag${formData.dietary.includes(tag) ? ' selected' : ''}`}
                                        onClick={() => toggleDietary(tag)}
                                        type="button"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-primary btn-lg btn-full" onClick={handleNextStep1}>
                            Next: Set Pickup Time <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Expiry Window (hours from now)</label>
                            <div className="expiry-selector">
                                {['2', '4', '6', '8', '12', '24'].map(h => (
                                    <button
                                        key={h}
                                        className={`expiry-option${formData.expiryHours === h ? ' selected' : ''}`}
                                        onClick={() => setFormData(p => ({ ...p, expiryHours: h }))}
                                    >
                                        {h}h
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Pickup Location</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input
                                    className="form-input"
                                    placeholder="Street Address (e.g. 123 Main St)"
                                    value={formData.street_address}
                                    onChange={e => setFormData(p => ({ ...p, street_address: e.target.value }))}
                                />
                                <div className="form-row">
                                    <input
                                        className="form-input"
                                        placeholder="City"
                                        value={formData.city}
                                        onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="State/Province"
                                        value={formData.state}
                                        onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
                                    />
                                </div>
                                <div className="form-row">
                                    <input
                                        className="form-input"
                                        placeholder="Postal Code"
                                        value={formData.postal_code}
                                        onChange={e => setFormData(p => ({ ...p, postal_code: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="Country"
                                        value={formData.country}
                                        onChange={e => setFormData(p => ({ ...p, country: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Pickup Start Time</label>
                            <input
                                type="datetime-local"
                                className="form-input"
                                value={formData.pickup_start}
                                onChange={e => setFormData(p => ({ ...p, pickup_start: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Pickup End Time</label>
                            <input
                                type="datetime-local"
                                className="form-input"
                                value={formData.pickup_end}
                                onChange={e => setFormData(p => ({ ...p, pickup_end: e.target.value }))}
                            />
                        </div>

                        <div className="form-row">
                            <button className="btn btn-outline btn-lg" onClick={() => { setErrorMsg(''); setStep(1) }}>Back</button>
                            <button className="btn btn-primary btn-lg btn-full" onClick={handleNextStep2}>
                                Next: Review <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="modal-body">
                        <div className="review-card">
                            <div className="review-emoji">&#x1F957;</div>
                            <h3>{formData.title || 'Untitled Listing'}</h3>
                            <div className="review-details">
                                <div className="review-item"><Package size={16} /> {formData.quantity || 'Not specified'} servings</div>
                                <div className="review-item"><Tag size={16} /> {categories.find(c => c.category_id === formData.category_id)?.name || 'No Category'}</div>
                                <div className="review-item"><Clock size={16} /> Expires in {formData.expiryHours}h</div>
                                <div className="review-item"><MapPin size={16} /> {formData.city}, {formData.state}</div>
                            </div>
                            {formData.dietary.length > 0 && (
                                <div className="review-tags">
                                    {formData.dietary.map(t => <span key={t} className="review-tag">{t}</span>)}
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <button className="btn btn-outline btn-lg" onClick={() => { setErrorMsg(''); setStep(2) }}>Back</button>
                            <button className="btn btn-primary btn-lg btn-full" onClick={handleSubmit} disabled={isUploading}>
                                {isUploading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Clock size={18} style={{ animation: 'spin 2s linear infinite' }} /> Uploading & Publishing...
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 size={18} /> Publish Listing
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Edit Listing Modal ── */
function EditListingModal({ listing, onClose, onUpdated, categories = [] }) {
    if (!listing) return null

    // ✅ FIX: Proper local datetime formatter (NO toISOString)
    const formatDateTimeLocal = (dateString) => {
        if (!dateString) return ''

        const date = new Date(dateString)
        const pad = (n) => String(n).padStart(2, '0')

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    const hasPickupWindow = listing?.pickup_start && listing?.pickup_end;
    const originalPickupStart = listing?.pickup_start
        ? formatDateTimeLocal(listing.pickup_start)
        : ''

    const fallbackTime = formatDateTimeLocal(listing?.expiry_time)

    const [formData, setFormData] = useState({
        title: listing?.title || '',
        description: listing?.description || '',
        quantity: listing?.quantity || '',

        pickup_start: hasPickupWindow
            ? formatDateTimeLocal(listing.pickup_start)
            : fallbackTime,

        pickup_end: hasPickupWindow
            ? formatDateTimeLocal(listing.pickup_end)
            : fallbackTime,

        quantity_unit: listing?.quantity_unit || 'servings',
        estimated_servings: listing?.estimated_servings || '',
        category_id: listing?.category_id || '',
        expiry_time: fallbackTime,
    })

    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const handleSave = async () => {
        if (!formData.title.trim())
            return setErrorMsg('Title is required.')
        if (!formData.quantity || isNaN(formData.quantity) || Number(formData.quantity) <= 0)
            return setErrorMsg('Quantity must be a positive number.')
        if (Number(formData.quantity) > 10000)
            return setErrorMsg('Quantity cannot exceed 10,000.')
        if (!formData.expiry_time)
            return setErrorMsg('Expiry time is required.')

        const now = new Date()
        const expiryTime = new Date(formData.expiry_time)

        if (expiryTime <= now)
            return setErrorMsg('Expiry time must be in the future.')

        if (hasPickupWindow) {
            if (!formData.pickup_start || !formData.pickup_end)
                return setErrorMsg('Pickup start and end time are required.')

            const pickupStart = new Date(formData.pickup_start)
            const pickupEnd = new Date(formData.pickup_end)
            const now = new Date()

            // Only enforce "must be future" if the user actually changed pickup start
            const pickupStartChanged = formData.pickup_start !== originalPickupStart
            if (pickupStartChanged && pickupStart <= now)
                return setErrorMsg('Pickup start time must be in the future.')

            if (pickupEnd <= pickupStart)
                return setErrorMsg('Pickup end time must be after pickup start time.')
            if (pickupEnd > expiryTime)
                return setErrorMsg('Pickup window must end before or at the expiry time.')
            if (pickupStart >= expiryTime)
                return setErrorMsg('Pickup start time must be before the expiry time.')
        }

        setSaving(true)
        setErrorMsg('')

        try {
            const res = await fetchWithAuth(`/listings/${listing.listing_id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description || null,
                    quantity: Number(formData.quantity),
                    quantity_unit: formData.quantity_unit,
                    estimated_servings: formData.estimated_servings
                        ? Number(formData.estimated_servings)
                        : undefined,
                    category_id: formData.category_id || null,

                    expiry_time: new Date(formData.expiry_time).toISOString(),

                    // ✅ Send pickup only if exists
                    pickup_start: hasPickupWindow
                        ? new Date(formData.pickup_start).toISOString()
                        : null,
                    pickup_end: hasPickupWindow
                        ? new Date(formData.pickup_end).toISOString()
                        : null,
                }),
            })

            const json = await res.json()

            if (json.success) {
                onUpdated()
                onClose()
            } else {
                setErrorMsg(json.message || 'Update failed.')
            }
        } catch {
            setErrorMsg('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <XCircle size={24} />
                </button>

                <div className="modal-header">
                    <h2>Edit Listing</h2>
                    <p className="modal-subtitle">
                        Update the details of your food listing
                    </p>
                </div>

                {errorMsg && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '10px 15px',
                        borderRadius: '6px',
                        margin: '0 24px 16px',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <AlertCircle size={16} /> {errorMsg}
                    </div>
                )}

                <div className="modal-body">

                    <div className="form-group">
                        <label className="form-label">Food Title</label>
                        <input
                            className="form-input"
                            value={formData.title}
                            onChange={e =>
                                setFormData(p => ({ ...p, title: e.target.value }))
                            }
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Quantity</label>
                            <input
                                className="form-input"
                                type="number"
                                min="1"
                                value={formData.quantity}
                                onChange={e =>
                                    setFormData(p => ({ ...p, quantity: e.target.value }))
                                }
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Unit</label>
                            <select
                                className="form-input form-select"
                                value={formData.quantity_unit}
                                onChange={e =>
                                    setFormData(p => ({ ...p, quantity_unit: e.target.value }))
                                }
                            >
                                {['servings', 'kg', 'lbs', 'items', 'boxes', 'bags', 'litres'].map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select
                                className="form-input form-select"
                                value={formData.category_id}
                                onChange={e =>
                                    setFormData(p => ({ ...p, category_id: e.target.value }))
                                }
                            >
                                <option value="">None</option>
                                {categories.map(c => (
                                    <option key={c.category_id} value={c.category_id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Estimated Servings</label>
                            <input
                                className="form-input"
                                type="number"
                                min="1"
                                placeholder="optional"
                                value={formData.estimated_servings}
                                onChange={e =>
                                    setFormData(p => ({ ...p, estimated_servings: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    {/* Expiry */}
                    <div className="form-group">
                        <label className="form-label">Expiry Date & Time</label>
                        <input
                            type="datetime-local"
                            className="form-input"
                            value={formData.expiry_time}
                            onChange={e =>
                                setFormData(p => ({ ...p, expiry_time: e.target.value }))
                            }
                        />
                    </div>

                    {/* Pickup window (only if exists in DB) */}
                    {hasPickupWindow && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Pickup Start Time</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={formData.pickup_start}
                                    onChange={e =>
                                        setFormData(p => ({ ...p, pickup_start: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Pickup End Time</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    value={formData.pickup_end}
                                    onChange={e =>
                                        setFormData(p => ({ ...p, pickup_end: e.target.value }))
                                    }
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-input form-textarea"
                            rows={3}
                            value={formData.description}
                            onChange={e =>
                                setFormData(p => ({ ...p, description: e.target.value }))
                            }
                        />
                    </div>

                    <div className="form-row">
                        <button className="btn btn-outline btn-lg" onClick={onClose}>
                            Cancel
                        </button>

                        <button
                            className="btn btn-primary btn-lg btn-full"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ── Skeleton loader ── */
function SkeletonCard() {
    return (
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '20px', opacity: 0.6 }}>
            <div style={{ height: '16px', background: 'var(--border-color)', borderRadius: '4px', marginBottom: '12px', width: '60%' }} />
            <div style={{ height: '12px', background: 'var(--border-color)', borderRadius: '4px', width: '40%' }} />
        </div>
    )
}

/* ── Main Donor Dashboard ── */
export default function DonorDashboard() {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editListing, setEditListing] = useState(null)   // listing object being edited
    const [activeTab, setActiveTab] = useState('overview')
    const [filterCat, setFilterCat] = useState('All')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const navigate = useNavigate()
    const { user, logout: logoutContext } = useAuth()

    // ── API state ──
    const [dashData, setDashData] = useState(null)
    const [myListings, setMyListings] = useState([])
    const [historyData, setHistoryData] = useState([])
    const [impactData, setImpactData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState('')
    const [categories, setCategories] = useState([])
    const [broadcasts, setBroadcasts] = useState([])
    const [broadcastsLoading, setBroadcastsLoading] = useState(false)   // from /api/categories

    // Fetch categories (public endpoint — no auth)
    useEffect(() => {
        fetchWithAuth('/categories')
            .then(r => r.json())
            .then(json => {
                if (json.success && json.data?.categories?.length > 0)
                    setCategories(json.data.categories)
            })
            .catch(() => { })
    }, [])

    const handleLogout = async () => {
        await logoutService()
        logoutContext()
        navigate('/login', { replace: true })
    }

    const fetchBroadcasts = async () => {
        setBroadcastsLoading(true)
        try {
            const res = await fetchWithAuth('/notifications/broadcasts')
            const json = await res.json()
            if (json.success) setBroadcasts(json.data?.broadcasts || [])
        } catch { /* silent */ }
        finally { setBroadcastsLoading(false) }
    }

    const fetchDashboard = async () => {
        try {
            const res = await fetchWithAuth('/donor/dashboard')
            const json = await res.json()
            if (json.success) setDashData(json.data)
            else setApiError(json.message)
        } catch { setApiError('Failed to load dashboard data.') }
    }

    const fetchMyListings = async () => {
        try {
            const res = await fetchWithAuth('/listings/my')
            const json = await res.json()
            if (json.success) setMyListings(json.data.listings || [])
        } catch { /* silent */ }
    }

    const fetchHistory = async () => {
        try {
            const res = await fetchWithAuth('/donor/history')
            const json = await res.json()
            if (json.success) setHistoryData(json.data.history || [])
        } catch { /* silent */ }
    }

    const fetchImpact = async () => {
        try {
            const res = await fetchWithAuth('/donor/impact')
            const json = await res.json()
            if (json.success) setImpactData(json.data)
        } catch { /* silent */ }
    }

    useEffect(() => {
        setLoading(true)
        Promise.all([fetchDashboard(), fetchMyListings(), fetchHistory(), fetchImpact()])
            .finally(() => setLoading(false))
    }, [])

    const handleListingCreated = () => {
        fetchDashboard()
        fetchMyListings()
    }

    const handleDeleteListing = async (listingId) => {
        if (!window.confirm('Are you sure you want to cancel this listing?')) return
        try {
            const res = await fetchWithAuth(`/listings/${listingId}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success) {
                fetchDashboard()
                fetchMyListings()
            } else {
                alert(json.message || 'Could not cancel listing.')
            }
        } catch { alert('Network error while cancelling listing.') }
    }

    const handleExportHistory = async () => {
        try {
            const res = await fetchWithAuth('/donor/history/export')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'donation_history.csv'
            a.click()
            URL.revokeObjectURL(url)
        } catch { alert('Export failed.') }
    }


    // ── Metric cards ──
    const metricCards = [
        {
            label: 'Meals Quantity Saved', value:
                (dashData?.stats?.meals_saved > 0)
                    ? dashData.stats.meals_saved
                    : (historyData?.filter(h => h.status === 'delivered').length || 0), suffix: '', icon: Utensils, color: 'green'
        },
        { label: 'CO\u2082 Prevented', value: ((dashData?.stats?.co2_prevented_kg ?? 0) / 1000).toFixed(2), suffix: ' tons', icon: TrendingDown, color: 'blue' },
        { label: 'Active Listings', value: dashData?.stats?.active_listings ?? 0, suffix: '', icon: Package, color: 'orange' },
        { label: 'Waste Diverted', value: dashData?.stats?.waste_diverted_kg ?? 0, suffix: ' kg', icon: BarChart3, color: 'purple' },
    ]

    // ── Filter listings by category tab ──
    // Listings with no category_name are treated as matching 'All' only
    const filteredListings = filterCat === 'All'
        ? myListings
        : myListings.filter(l => (l.category_name || 'Uncategorized') === filterCat)

    return (
        <div className="dashboard-page">
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} id="donor-sidebar">
                <Link to="/" className="sidebar-brand">
                    <div className="brand-icon"><Leaf size={18} color="#fff" /></div>
                    <span>FoodBridge</span>
                </Link>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Main</div>
                    <button className={`sidebar-link${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}><Home size={20} /> Overview</button>
                    <button className={`sidebar-link${activeTab === 'listings' ? ' active' : ''}`} onClick={() => setActiveTab('listings')}><Package size={20} /> My Listings</button>
                    <button className={`sidebar-link${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}><Clock size={20} /> History</button>
                    <button className={`sidebar-link${activeTab === 'impact' ? ' active' : ''}`} onClick={() => setActiveTab('impact')}><BarChart3 size={20} /> Impact</button>
                    <button className={`sidebar-link${activeTab === 'announcements' ? ' active' : ''}`} onClick={() => { setActiveTab('announcements'); if (broadcasts.length === 0) fetchBroadcasts(); }}><Megaphone size={20} /> Announcements</button>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="user-avatar">{user?.first_name?.[0] ?? '?'}</div>
                        <div className="user-info">
                            <span className="user-name">{user?.first_name} {user?.last_name}</span>
                            <span className="user-role">{user?.role}</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="sidebar-link logout-link"><LogOut size={20} /> Sign Out</button>
                </div>
            </aside>

            <main className="dashboard-main" id="donor-main">
                <header className="dashboard-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                        <div>
                            <h1 className="dashboard-title">
                                {activeTab === 'overview' && 'Dashboard Overview'}
                                {activeTab === 'listings' && 'My Food Listings'}
                                {activeTab === 'history' && 'Donation History'}
                                {activeTab === 'impact' && 'Impact Dashboard'}
                                {activeTab === 'announcements' && 'Announcements'}
                            </h1>
                            <p className="dashboard-subtitle">Welcome back, {user?.first_name ?? 'Donor'}! &#x1F44B;</p>
                        </div>
                    </div>
                    <div className="topbar-actions">
                        <ThemeToggle />
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} id="create-listing-btn">
                            <Plus size={18} /> Create Listing
                        </button>
                    </div>
                </header>

                {apiError && (
                    <div style={{ margin: '16px 24px', padding: '12px 16px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', display: 'flex', gap: '8px' }}>
                        <AlertCircle size={18} /> {apiError}
                    </div>
                )}

                {/* ── Overview Tab ── */}
                {activeTab === 'overview' && (
                    <div className="dashboard-content animate-page-in">
                        {/* Metric Cards */}
                        <div className="metrics-grid" id="donor-metrics">
                            {loading
                                ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                                : metricCards.map((m, i) => {
                                    const Icon = m.icon
                                    return (
                                        <div key={i} className={`metric-card metric-${m.color}`} style={{ animationDelay: `${i * 0.08}s` }}>
                                            <div className="metric-icon-wrap"><Icon size={22} /></div>
                                            <div className="metric-info">
                                                <div className="metric-value">{typeof m.value === 'number' && m.value > 100 ? m.value.toLocaleString() : m.value}{m.suffix}</div>
                                                <div className="metric-label">{m.label}</div>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>

                        <div className="dashboard-grid-2">
                            {/* Active Listings */}
                            <div className="card" id="active-listings-card">
                                <div className="card-header">
                                    <h2 className="card-title"><Package size={20} /> Active Listings</h2>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('listings')}>
                                        View All <ChevronRight size={16} />
                                    </button>
                                </div>
                                <div className="listing-list">
                                    {loading && <SkeletonCard />}
                                    {!loading && (dashData?.active_listings || []).length === 0 && (
                                        <div className="empty-state"><Package size={32} /><p>No active listings yet.</p></div>
                                    )}
                                    {!loading && (dashData?.active_listings || []).map(item => (
                                        <div key={item.listing_id} className="listing-row" id={`listing-${item.listing_id}`}>
                                            <div className="listing-photo">
                                                {item.primary_image_url ? (
                                                    <img
                                                        src={item.primary_image_url}
                                                        alt={item.title}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            borderRadius: '8px'
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: '28px' }}>🍱</span>
                                                )}
                                            </div>
                                            <div className="listing-info">
                                                <div className="listing-name">{item.title}</div>
                                                <div className="listing-meta">
                                                    <span>{item.quantity} {item.quantity_unit}</span>
                                                    <span className="dot">&bull;</span>
                                                    <span className="expiry-badge"><Clock size={12} /> {timeUntilExpiry(item.expiry_time)}</span>
                                                </div>
                                            </div>
                                            <div className="status-badge" style={{
                                                background: (STATUS_COLORS[item.status] || STATUS_COLORS['available']).bg,
                                                color: (STATUS_COLORS[item.status] || STATUS_COLORS['available']).color,
                                            }}>
                                                {(STATUS_COLORS[item.status] || STATUS_COLORS['available']).label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pickup Requests */}
                            <div className="card" id="pickup-requests-card">
                                <div className="card-header">
                                    <h2 className="card-title"><Truck size={20} /> Active Deliveries</h2>
                                </div>
                                <div className="pickup-list">
                                    {loading && <SkeletonCard />}
                                    {!loading && (dashData?.pickup_requests || []).length === 0 && (
                                        <div className="empty-state"><Truck size={40} /><p>No active deliveries yet</p></div>
                                    )}
                                    {!loading && (dashData?.pickup_requests || []).map((p, i) => (
                                        <div key={i} className="pickup-item">
                                            <div className="pickup-avatar">{p.volunteer_name?.charAt(0) || 'V'}</div>
                                            <div className="pickup-info">
                                                <div className="pickup-volunteer">{p.volunteer_name}</div>
                                                <div className="pickup-food">{p.listing_title}</div>
                                            </div>
                                            <div className="pickup-eta">
                                                <Clock size={14} /> {p.est_duration_min ? `~${p.est_duration_min} min` : '-'}
                                            </div>
                                            <div className={`pickup-status ${p.mission_status}`}>
                                                {p.mission_status === 'picked_up' ? 'Food Picked Up'
                                                    : p.mission_status === 'in_transit' ? 'Heading to Pickup'
                                                        : p.mission_status === 'delivered' ? 'Delivered'
                                                            : 'Assigned'}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="impact-mini-chart">
                                    <h3 className="mini-chart-title">Last 7 Days Impact</h3>
                                    <div className="mini-bars">
                                        {(impactData?.weekly_trend?.length > 0
                                            ? impactData.weekly_trend
                                            : [{ day: 'M', meals_saved: 0 }, { day: 'T', meals_saved: 0 }, { day: 'W', meals_saved: 0 }, { day: 'T', meals_saved: 0 }, { day: 'F', meals_saved: 0 }, { day: 'S', meals_saved: 0 }, { day: 'S', meals_saved: 0 }]
                                        ).map((d, i) => {
                                            const maxMeals = Math.max(...(impactData?.weekly_trend || [{ meals_saved: 1 }]).map(x => x.meals_saved), 1)
                                            const h = Math.round((d.meals_saved / maxMeals) * 100)
                                            return (
                                                <div key={i} className="mini-bar-col">
                                                    <div className="mini-bar" style={{ height: `${h || 5}%`, animationDelay: `${i * 0.1}s` }} />
                                                    <span>{d.day?.slice(0, 1)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Listings Tab ── */}
                {activeTab === 'listings' && (
                    <div className="dashboard-content animate-page-in">
                        <div className="filter-bar">
                            <div className="filter-tabs">
                                {['All', ...categories.map(c => c.name)].map(c => (
                                    <button
                                        key={c}
                                        className={`filter-tab${filterCat === c ? ' active' : ''}`}
                                        onClick={() => setFilterCat(c)}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                                {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {loading && (
                            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
                                {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
                            </div>
                        )}

                        {!loading && filteredListings.length === 0 && (
                            <div className="empty-state" style={{ marginTop: '60px' }}>
                                <Package size={48} />
                                <h3>No listings found</h3>
                                <p>{filterCat === 'All' ? 'Create your first listing using the button above!' : `No listings in category "${filterCat}".`}</p>
                            </div>
                        )}

                        <div className="food-cards-grid">
                            {!loading && filteredListings.map(item => {
                                const sc = STATUS_COLORS[item.status] || STATUS_COLORS['available']
                                return (
                                    <div key={item.listing_id} className="food-card" id={`food-card-${item.listing_id}`}>
                                        <div className="food-card-photo">
                                            {/* The fix ensures we check for primary_image_url specifically */}
                                            {item.primary_image_url ? (
                                                <img
                                                    src={item.primary_image_url}
                                                    alt={item.title}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                    // Fallback if image fails to load
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = 'https://via.placeholder.com/300?text=No+Image';
                                                    }}
                                                />
                                            ) : (
                                                <div className="food-emoji-placeholder">
                                                    <span className="food-emoji-large">🍱</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="food-card-body">
                                            <div className="status-badge-container" style={{ marginBottom: '8px' }}>
                                                <span className="status-badge" style={{
                                                    background: sc.bg,
                                                    color: sc.color,
                                                    fontSize: '10px',
                                                    padding: '2px 8px'
                                                }}>
                                                    {sc.label}
                                                </span>
                                            </div>
                                            <h3 className="food-card-title">{item.title}</h3>
                                            <div className="food-card-meta">
                                                <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                                                    <Clock size={12} /> Pickup:{" "}
                                                    {item.pickup_start ? new Date(item.pickup_start).toLocaleString() : '-'} -{" "}
                                                    {item.pickup_end ? new Date(item.pickup_end).toLocaleString() : '-'}
                                                </div>
                                                <span><Package size={14} /> {item.quantity} {item.quantity_unit}</span>
                                                <span><Clock size={14} /> {timeUntilExpiry(item.expiry_time)}</span>
                                            </div>
                                            {item.city && (
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                    <MapPin size={12} /> {item.city}{item.state ? `, ${item.state}` : ''}
                                                </div>
                                            )}
                                            <div className="food-card-tags">
                                                {(item.dietary_tags || []).map(t => <span key={t} className="food-tag">{t}</span>)}
                                                {item.category_name && (
                                                    <span className="food-tag" style={{ opacity: 0.7 }}>{item.category_name}</span>
                                                )}
                                            </div>
                                            <div className="food-card-actions">
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setEditListing(item)}
                                                    disabled={['delivered', 'cancelled', 'expired'].includes(item.status)}
                                                    title="Edit listing"
                                                >
                                                    <Pencil size={14} /> Edit
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm btn-danger"
                                                    onClick={() => handleDeleteListing(item.listing_id)}
                                                    disabled={['delivered', 'cancelled'].includes(item.status)}
                                                >
                                                    <Trash2 size={14} /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ── History Tab ── */}
                {activeTab === 'history' && (
                    <div className="dashboard-content animate-page-in">
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Donation History</h2>
                                <button className="btn btn-outline btn-sm" onClick={handleExportHistory}>
                                    <Download size={14} /> Export CSV
                                </button>
                            </div>
                            {loading && <SkeletonCard />}
                            {!loading && historyData.length === 0 && (
                                <div className="empty-state" style={{ padding: '40px' }}>
                                    <Clock size={40} /><p>No completed donations yet.</p>
                                </div>
                            )}
                            {!loading && historyData.length > 0 && (
                                <div className="history-table">
                                    <div className="history-header-row">
                                        <span>Item</span><span>Date</span><span>Quantity</span><span>Recipient</span><span>Volunteer</span>
                                    </div>
                                    {historyData.map((h, i) => (
                                        <div key={i} className="history-row">
                                            <span className="history-item-name">{h.listing_title}</span>
                                            <span className="history-date">{formatDate(h.date)}</span>
                                            <span>{h.quantity} {h.quantity_unit}</span>
                                            <span className="history-recipient">{h.recipient_org || '-'}</span>

                                            <span className="history-volunteer">
                                                {h.volunteer_name || '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Impact Tab ── */}
                {activeTab === 'impact' && (
                    <div className="dashboard-content animate-page-in">
                        <div className="impact-hero-grid">
                            <div className="impact-big-card green">
                                <div className="impact-big-icon"><Utensils size={32} /></div>
                                <div className="impact-big-value">{loading ? '...' : (impactData?.totals?.meals_saved ?? 0).toLocaleString()}</div>
                                <div className="impact-big-label">Total Meals Saved</div>
                                <div className="impact-big-sub">Equivalent to feeding {Math.floor((impactData?.totals?.meals_saved ?? 0) / 20)} families for a month</div>
                            </div>
                            <div className="impact-big-card blue">
                                <div className="impact-big-icon"><TrendingDown size={32} /></div>
                                <div className="impact-big-value">{loading ? '...' : ((impactData?.totals?.co2_prevented_kg ?? 0) / 1000).toFixed(2)} tons</div>
                                <div className="impact-big-label">CO&#x2082; Emissions Prevented</div>
                                <div className="impact-big-sub">Helping fight climate change one meal at a time</div>
                            </div>
                            <div className="impact-big-card orange">
                                <div className="impact-big-icon"><Package size={32} /></div>
                                <div className="impact-big-value">{loading ? '...' : (impactData?.totals?.waste_diverted_kg ?? 0)} kg</div>
                                <div className="impact-big-label">Food Waste Diverted</div>
                                <div className="impact-big-sub">From landfills to plates that need it most</div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title"><BarChart3 size={20} /> Weekly Impact Trend</h2>
                            </div>
                            <div className="chart-area">
                                <div className="chart-bars">
                                    {loading
                                        ? Array(7).fill(0).map((_, i) => (
                                            <div key={i} className="chart-bar-group">
                                                <div className="chart-bar-wrap"><div className="chart-bar chart-bar-green" style={{ height: '20%' }} /></div>
                                                <span className="chart-bar-label">-</span>
                                            </div>
                                        ))
                                        : (impactData?.weekly_trend?.length > 0
                                            ? impactData.weekly_trend
                                            : [{ day: 'Mon', meals_saved: 0, waste_diverted_kg: 0 }]
                                        ).map((d, i) => {
                                            const maxM = Math.max(...(impactData?.weekly_trend || []).map(x => x.meals_saved), 1)
                                            const maxW = Math.max(...(impactData?.weekly_trend || []).map(x => x.waste_diverted_kg), 1)
                                            return (
                                                <div key={i} className="chart-bar-group">
                                                    <div className="chart-bar-wrap">
                                                        <div className="chart-bar chart-bar-green" style={{ height: `${Math.round(d.meals_saved / maxM * 100)}%`, animationDelay: `${i * 0.1}s` }} title={`${d.meals_saved} meals`} />
                                                        <div className="chart-bar chart-bar-orange" style={{ height: `${Math.round(d.waste_diverted_kg / maxW * 100)}%`, animationDelay: `${i * 0.1 + 0.05}s` }} title={`${d.waste_diverted_kg} kg`} />
                                                    </div>
                                                    <span className="chart-bar-label">{d.day?.slice(0, 3)}</span>
                                                </div>
                                            )
                                        })
                                    }
                                </div>
                                <div className="chart-legend">
                                    <div className="legend-item"><span className="legend-dot green" /> Meals Saved</div>
                                    <div className="legend-item"><span className="legend-dot orange" /> Waste Diverted (kg)</div>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title"><Star size={20} /> Achievement Milestones</h2>
                            </div>
                            <div className="milestones-grid">
                                {[
                                    { title: 'First Donation', desc: 'Made your first food listing', threshold: 1, icon: '&#x1F331;' },
                                    { title: '100 Meals Saved', desc: 'Helped feed 100 people', threshold: 100, icon: '&#x1F3AF;' },
                                    { title: '500 Meals Saved', desc: 'Half a thousand meals rescued', threshold: 500, icon: '&#x1F3C6;' },
                                    { title: '1000 Meals Saved', desc: 'A true food rescue hero', threshold: 1000, icon: '&#x1F31F;' },
                                    { title: '1 Ton Diverted', desc: 'Diverted 1000 kg of food waste', threshold: 1000, icon: '&#x267B;&#xFE0F;', useWaste: true },
                                    { title: '5000 Meals Club', desc: 'Elite donor status', threshold: 5000, icon: '&#x1F525;' },
                                ].map((m, i) => {
                                    const current = m.useWaste
                                        ? (impactData?.totals?.waste_diverted_kg ?? 0)
                                        : (impactData?.totals?.meals_saved ?? 0)
                                    const earned = current >= m.threshold
                                    const progress = Math.min(Math.round(current / m.threshold * 100), 100)
                                    return (
                                        <div key={i} className={`milestone-card${earned ? ' earned' : ''}`}>
                                            <div className="milestone-icon" dangerouslySetInnerHTML={{ __html: m.icon }} />
                                            <h4>{m.title}</h4>
                                            <p>{m.desc}</p>
                                            {!earned && (
                                                <div className="milestone-progress">
                                                    <div className="milestone-progress-bar" style={{ width: `${progress}%` }} />
                                                </div>
                                            )}
                                            {earned && <div className="milestone-earned">&#x2714; Earned</div>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Announcements Tab ── */}
                {activeTab === 'announcements' && (
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
                )}
            </main>

            <button className="fab" onClick={() => setShowCreateModal(true)} id="fab-create-listing" title="Create new listing">
                <Plus size={24} />
            </button>

            <CreateListingModal
                isOpen={showCreateModal}
                categories={categories}
                onClose={() => {
                    setShowCreateModal(false)
                    handleListingCreated()
                }}
            />

            {editListing && (
                <EditListingModal
                    listing={editListing}
                    categories={categories}
                    onClose={() => setEditListing(null)}
                    onUpdated={() => {
                        setEditListing(null)
                        fetchMyListings()
                    }}
                />
            )}
        </div>
    )
}
