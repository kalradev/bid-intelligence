import { ArrowRight, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// Logo imports
import womenOwnedLogo from '../assets/women-owned-logo.png';
import cacheLogo from '../assets/Cache-Logo.png';
import { API_BASE_URL } from '../config';

export default function LoginPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                }),
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
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
                // Navigate to landing page after successful login
                navigate("/home");
            } else {
                setError(data.message || data.detail || 'Login failed. Please check your credentials.');
            }
        } catch (error: any) {
            console.error('Login error:', error);
            
            // Provide more specific error messages
            if (error.message && error.message.includes('fetch')) {
                setError(`Cannot connect to server. Please make sure the backend is running on ${API_BASE_URL}`);
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
            <div style={{ position: 'fixed', top: '4px', left: '32px', zIndex: 100, display: 'flex', alignItems: 'flex-start' }}>
                <img src={womenOwnedLogo} alt="Women Owned" style={{ height: '114px', width: 'auto', display: 'block' }} />
            </div>
            {/* Cache Logo - Top Right */}
            <div style={{ position: 'fixed', top: '4px', right: '32px', zIndex: 100, display: 'flex', alignItems: 'flex-start' }}>
                <img src={cacheLogo} alt="Cache" style={{ height: '104px', width: 'auto', display: 'block' }} />
            </div>

            {/* Animated Background */}
            <div className="auth-background">
                <div className="auth-bg-gradient-1"></div>
                <div className="auth-bg-gradient-2"></div>
                <div className="auth-bg-gradient-3"></div>
            </div>
            
            {/* Floating Shapes */}
            <div className="floating-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            {/* Login Form Container */}
            <div className="auth-container">
                <div className="auth-card">
                    {/* Header */}
                    <div className="auth-header">
                        <div className="auth-icon-wrapper">
                            <Lock size={32} />
                        </div>
                        <h1 className="auth-title">
                            Welcome Back
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
                                <Lock size={18} />
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
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#6366f1'}
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
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                borderRadius: '10px',
                                fontSize: '14px',
                                textAlign: 'center',
                                border: '1px solid #fecaca',
                                fontWeight: '500'
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
                            {isLoading ? (
                                <>
                                    <div className="animate-spin" style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid #fff',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%'
                                    }} />
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={22} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="auth-footer">
                        <p className="auth-footer-text">
                            Don't have an account?{" "}
                            <button
                                onClick={() => navigate("/signup")}
                                className="auth-link"
                            >
                                Sign Up
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
