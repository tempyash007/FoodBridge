import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
    Leaf,
    Utensils,
    Users,
    Truck,
    TrendingDown,
    Route,
    ShieldCheck,
    BarChart3,
    ArrowRight,
    ChevronRight,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

/* ─── Intersection Observer hook ─── */
function useReveal(threshold = 0.15) {
    const ref = useRef(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setVisible(true) },
            { threshold }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [threshold])

    return [ref, visible]
}

/* ─── Animated counter hook ─── */
function useCounter(target, duration = 2000, start = false) {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!start) return
        let startTime
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }, [start, target, duration])

    return count
}

/* ─── Stat Component ─── */
function StatCard({ value, suffix, label, delay }) {
    const [ref, visible] = useReveal(0.3)
    const count = useCounter(value, 2000, visible)

    return (
        <div
            ref={ref}
            className="stat-card"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(30px)',
                transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
            }}
        >
            <div className="stat-value">
                {count.toLocaleString()}
                <span className="stat-plus">{suffix}</span>
            </div>
            <div className="stat-label">{label}</div>
        </div>
    )
}

/* ─── Step Card ─── */
function StepCard({ number, icon: Icon, title, description, delay }) {
    const [ref, visible] = useReveal(0.2)

    return (
        <div
            ref={ref}
            className="step-card"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
            }}
        >
            <div className="step-number">{number}</div>
            <div className="step-icon">
                <Icon size={26} />
            </div>
            <h3 className="step-title">{title}</h3>
            <p className="step-description">{description}</p>
        </div>
    )
}

/* ─── Feature Card ─── */
function FeatureCard({ icon: Icon, color, title, description, delay }) {
    const [ref, visible] = useReveal(0.15)

    return (
        <div
            ref={ref}
            className="feature-card"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(40px)',
                transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
            }}
        >
            <div className={`feature-icon ${color}`}>
                <Icon size={24} />
            </div>
            <h3 className="feature-title">{title}</h3>
            <p className="feature-description">{description}</p>
        </div>
    )
}

/* ─── Main Landing Page ─── */
export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false)
    const [ctaRef, ctaVisible] = useReveal(0.2)
    const [howRef, howVisible] = useReveal(0.15)
    const [featRef, featVisible] = useReveal(0.15)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <>
            {/* ──── Navbar ──── */}
            <nav className={`navbar${scrolled ? ' scrolled' : ''}`} id="navbar">
                <div className="container">
                    <Link to="/" className="navbar-brand" id="navbar-brand">
                        <div className="brand-icon">
                            <Leaf size={20} color="#fff" />
                        </div>
                        <span>FoodBridge</span>
                    </Link>
                    <div className="navbar-actions">
                        <ThemeToggle />
                        <Link to="/login" className="btn btn-ghost" id="login-btn">Login</Link>
                        <Link to="/register" className="btn btn-primary" id="get-started-btn">
                            Get Started
                            <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ──── Hero ──── */}
            <section className="hero" id="hero-section">
                <div className="hero-grid-bg" />
                <div className="particle" style={{ top: '20%', left: '10%' }} />
                <div className="particle" style={{ top: '60%', left: '85%' }} />
                <div className="particle" style={{ top: '75%', left: '25%' }} />
                <div className="particle" style={{ top: '15%', right: '15%' }} />
                <div className="particle" style={{ bottom: '20%', right: '30%' }} />

                <div className="container">
                    <div className="hero-badge" id="hero-badge">
                        <span className="badge-dot" />
                        Reducing food waste, one meal at a time
                    </div>

                    <h1 className="hero-title" id="hero-title">
                        Connect <span className="highlight">Surplus Food</span>
                        <br />with Those in Need
                    </h1>

                    <p className="hero-description" id="hero-description">
                        Join FoodBridge to reduce food waste, combat hunger, and build a
                        sustainable community. Connect donors, recipients, and volunteers
                        in one powerful platform.
                    </p>

                    <div className="hero-cta">
                        <Link to="/register" className="btn btn-primary btn-lg" id="join-hero-btn">
                            Join FoodBridge
                            <ArrowRight size={18} />
                        </Link>
                        <button className="btn btn-outline btn-lg" id="learn-more-btn">
                            Learn More
                        </button>
                    </div>

                    <div className="hero-stats" id="hero-stats">
                        <StatCard value={50} suffix="K+" label="Meals Saved" delay={0} />
                        <StatCard value={15} suffix="K+" label="Active Users" delay={0.1} />
                        <StatCard value={25} suffix=" Tons" label="CO₂ Reduced" delay={0.2} />
                    </div>
                </div>
            </section>

            {/* ──── How It Works ──── */}
            <section className="how-it-works" id="how-it-works-section">
                <div className="container">
                    <div
                        ref={howRef}
                        className="section-header"
                        style={{
                            opacity: howVisible ? 1 : 0,
                            transform: howVisible ? 'translateY(0)' : 'translateY(30px)',
                            transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)',
                        }}
                    >
                        <div className="section-label">Process</div>
                        <h2 className="section-title" id="how-it-works-title">How FoodBridge Works</h2>
                        <p className="section-subtitle">
                            Three simple steps to rescue food and make a real impact in your community.
                        </p>
                    </div>

                    <div className="steps-grid" id="steps-grid">
                        <StepCard number={1} icon={Utensils} title="Donors List Food" description="Restaurants and stores list surplus food with photos, quantities, and pickup times." delay={0} />
                        <StepCard number={2} icon={Users} title="Recipients Claim" description="NGOs, shelters, and individuals browse and claim food that meets their needs." delay={0.15} />
                        <StepCard number={3} icon={Truck} title="Volunteers Deliver" description="Verified volunteers pick up and deliver food with optimized routes and real-time tracking." delay={0.3} />
                    </div>
                </div>
            </section>

            {/* ──── Features ──── */}
            <section className="features" id="features-section">
                <div className="container">
                    <div
                        ref={featRef}
                        className="section-header"
                        style={{
                            opacity: featVisible ? 1 : 0,
                            transform: featVisible ? 'translateY(0)' : 'translateY(30px)',
                            transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)',
                        }}
                    >
                        <div className="section-label">Features</div>
                        <h2 className="section-title" id="features-title">Platform Features</h2>
                        <p className="section-subtitle">
                            Powerful tools designed to maximize food rescue impact.
                        </p>
                    </div>

                    <div className="features-grid" id="features-grid">
                        <FeatureCard icon={TrendingDown} color="green" title="Reduce Waste" description="Track and minimize food waste with real-time analytics and impact reports." delay={0} />
                        <FeatureCard icon={Route} color="orange" title="Smart Routing" description="AI-optimized delivery routes for efficient food rescue operations." delay={0.1} />
                        <FeatureCard icon={ShieldCheck} color="blue" title="Verified Users" description="Trust and safety with verified badges for all platform participants." delay={0.2} />
                        <FeatureCard icon={BarChart3} color="purple" title="Impact Tracking" description="Visualize your contribution with meals saved, CO₂ reduced, and more." delay={0.3} />
                    </div>
                </div>
            </section>

            {/* ──── CTA ──── */}
            <section className="cta-section" id="cta-section">
                <div className="container">
                    <div
                        ref={ctaRef}
                        className="cta-inner"
                        style={{
                            opacity: ctaVisible ? 1 : 0,
                            transform: ctaVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.98)',
                            transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
                        }}
                    >
                        <h2 className="cta-title" id="cta-title">Ready to Make a Difference?</h2>
                        <p className="cta-description">
                            Join thousands of donors, recipients, and volunteers in the fight
                            against food waste and hunger.
                        </p>
                        <div className="cta-btn-wrap">
                            <Link to="/register" className="btn btn-primary btn-lg" id="join-cta-btn">
                                Join FoodBridge Today
                                <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ──── Footer ──── */}
            <footer className="footer" id="footer">
                <div className="container">
                    <div className="footer-brand">
                        <div className="brand-icon">
                            <Leaf size={18} color="#fff" />
                        </div>
                        FoodBridge
                    </div>
                    <p className="footer-tagline">
                        Connecting communities to reduce food waste and combat hunger
                    </p>
                    <div className="footer-divider" />
                    <p className="footer-copy">© 2026 FoodBridge. All rights reserved.</p>
                </div>
            </footer>
        </>
    )
}
