import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// Logo imports
import bidIntelligenceLogo from '../assets/bid-intelligence-logo.svg';
import cacheLogo from '../assets/Cache-Logo.png';
import womenOwnedLogo from '../assets/women-owned-logo.png';
import { API_BASE_URL } from '../config';
import { setAuthSession } from '../utils/authStorage';

export default function LoginPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const COLS = 12;
    const ROWS = 8;

    const handleGridCellEnter = (index: number) => setHoveredIndex(index);
    const handleGridCellLeave = () => setHoveredIndex(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const email = formData.email.trim();
            const password = formData.password.trim();

            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            // Check if response is JSON
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                // If response is not JSON, it might be a connection error
                throw new Error('Server returned an invalid response. Please check if the backend is running.');
            }

            if (response.ok && data.success) {
                // Store token if provided
                if (data.token) {
                    setAuthSession(data.token, data.user);
                }
                // BM/TM created by admin must change password before accessing the app
                if (data.user?.mustChangePassword) {
                    navigate("/change-password");
                } else {
                    navigate("/home");
                }
            } else {
                setError(data.message || data.detail || 'Login failed. Please check your credentials.');
            }
        } catch (error: any) {
            console.error('Login error:', error);

            // Provide more specific error messages
            if (error.message && error.message.includes('fetch')) {
                const apiHint = API_BASE_URL || `${window.location.origin} (via dev proxy)`;
                setError(`Cannot connect to server. Please make sure the backend is running — API: ${apiHint}`);
            } else if (error.message) {
                setError(error.message);
            } else {
                setError('Failed to connect to server. Please ensure the backend server is running and try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <div className="auth-page-wrapper">
            {/* Women Owned Logo - Top Left */}
            <div style={{ position: 'fixed', top: '8px', left: '32px', zIndex: 100 }}>
                <img src={womenOwnedLogo} alt="Women Owned" className="header-women-owned-logo" />
            </div>
            {/* Cache Logo - Top Right */}
            <div style={{ position: 'fixed', top: '8px', right: '32px', zIndex: 100 }}>
                <img src={cacheLogo} alt="Cache" style={{ height: 105, width: 'auto', display: 'block' }} />
            </div>

            {/* Dashboard-style background (same as Upload / Team / Team Quota) */}
            <div className="universal-background">
                <div className="universal-bg-gradient-1"></div>
                <div className="universal-bg-gradient-2"></div>
                <div className="universal-bg-gradient-3"></div>
            </div>

            {/* Light reflection overlay - login page only */}
            <div className="auth-light-reflection" aria-hidden="true" />

            {/* Interactive grid: current cell highlights immediately, no fade */}
            <div className="auth-interactive-grid" aria-hidden="true" onMouseLeave={handleGridCellLeave}>
                {Array.from({ length: COLS * ROWS }, (_, i) => (
                    <div
                        key={i}
                        className={`auth-grid-cell auth-grid-variant-${i % 8}${hoveredIndex === i ? " auth-grid-comet-active" : ""}`}
                        onMouseEnter={() => handleGridCellEnter(i)}
                    />
                ))}
            </div>

            {/* Login Form Container */}
            <div className="auth-container">
                <div className={`auth-card auth-card--no-hover ${isLoading ? "auth-card-loading" : ""}`}>
                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="auth-loading-overlay">
                            <div className="auth-loading-spinner" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </div>
                            <p className="auth-loading-text">Signing in...</p>
                        </div>
                    )}
                    {/* Header */}
                    <div className="auth-header">
                        <div className="auth-icon-wrapper auth-logo-only">
                            <img src={bidIntelligenceLogo} alt="Bid Intelligence" style={{ width: 72, height: 72 }} />
                        </div>
                        <h1 className="auth-title">
                            Welcome
                        </h1>
                        <p className="auth-subtitle">
                            Sign in to access your bid intelligence dashboard
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        {/* Email Input */}
                        <div className="form-group">
                            <label className="form-label">
                                <Mail size={18} />
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter your email"
                                required
                                className="input-box"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="form-group">
                            <label className="form-label">
                                <LockKeyhole size={18} />
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    required
                                    className="input-box"
                                    style={{ paddingRight: '48px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '4px',
                                        transition: 'color 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#6FBEB2'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <EyeOff style={{ width: '20px', height: '20px' }} />
                                    ) : (
                                        <Eye style={{ width: '20px', height: '20px' }} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="auth-error-box" style={{
                                padding: '12px 16px',
                                backgroundColor: 'rgba(239,68,68,0.1)',
                                color: '#b91c1c',
                                borderRadius: '12px',
                                fontSize: '14px',
                                textAlign: 'center',
                                border: '1px solid rgba(239,68,68,0.3)',
                                fontWeight: '500',
                                animation: 'authFadeIn 0.4s ease-out'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="auth-submit-btn"
                        >
                            Sign In
                            <ArrowRight size={22} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
