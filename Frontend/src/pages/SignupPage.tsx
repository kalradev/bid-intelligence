import { ArrowRight, Lock, Mail, User, UserCircle2, UserPlus, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
// Logo imports
import womenOwnedLogo from '../assets/women-owned-logo.png';
import cacheLogo from '../assets/Cache-Logo.png';

export default function SignupPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "bid_manager",
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match!");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName: formData.fullName,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
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
                // Navigate to home page after successful registration
                navigate("/home");
            } else {
                setError(data.message || data.detail || 'Registration failed. Please try again.');
            }
        } catch (error: any) {
            console.error('Signup error:', error);
            
            // Provide more specific error messages
            if (error.message && error.message.includes('fetch')) {
                setError('Cannot connect to server. Please make sure the backend is running on http://localhost:3000');
            } else if (error.message) {
                setError(error.message);
            } else {
                setError('Failed to connect to server. Please ensure the backend server is running and try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

            {/* Signup Form Container */}
            <div className="auth-container">
                <div className="auth-card">
                    {/* Header */}
                    <div className="auth-header">
                        <div className="auth-icon-wrapper">
                            <UserPlus size={32} />
                        </div>
                        <h1 className="auth-title">
                            Create Account
                        </h1>
                        <p className="auth-subtitle">
                            Join us to streamline your bidding process
                        </p>
                    </div>

                    {/* Signup Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        {/* Full Name Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <User style={{ width: '16px', height: '16px' }} />
                                Full Name
                            </label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid rgba(99, 102, 241, 0.2)',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '15px',
                                    color: '#111827',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#6366f1';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Email Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Mail style={{ width: '16px', height: '16px' }} />
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter your email"
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid rgba(99, 102, 241, 0.2)',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '15px',
                                    color: '#111827',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#6366f1';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Password Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Lock style={{ width: '16px', height: '16px' }} />
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Create a password"
                                    required
                                    minLength={6}
                                    style={{
                                        width: '100%',
                                        padding: '14px 45px 14px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid rgba(99, 102, 241, 0.2)',
                                        background: 'rgba(255, 255, 255, 0.9)',
                                        fontSize: '15px',
                                        color: '#111827',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
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

                        {/* Confirm Password Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Lock style={{ width: '16px', height: '16px' }} />
                                Confirm Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm your password"
                                    required
                                    minLength={6}
                                    style={{
                                        width: '100%',
                                        padding: '14px 45px 14px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid rgba(99, 102, 241, 0.2)',
                                        background: 'rgba(255, 255, 255, 0.9)',
                                        fontSize: '15px',
                                        color: '#111827',
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#6366f1';
                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff style={{ width: '20px', height: '20px' }} />
                                    ) : (
                                        <Eye style={{ width: '20px', height: '20px' }} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Role Selection */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <UserCircle2 style={{ width: '16px', height: '16px' }} />
                                Select Your Role
                            </label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '2px solid rgba(99, 102, 241, 0.2)',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '15px',
                                    color: '#111827',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#6366f1';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <option value="bid_manager">Bid Manager</option>
                                <option value="technical_manager">Technical Manager</option>
                            </select>
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
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '12px',
                                border: 'none',
                                background: isLoading 
                                    ? '#9ca3af' 
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: '#fff',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.3s ease',
                                boxShadow: isLoading 
                                    ? 'none' 
                                    : '0 8px 24px rgba(102, 126, 234, 0.4)',
                                marginTop: '8px'
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
                                }
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        border: '2px solid #fff',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    Creating Account...
                                </>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight style={{ width: '20px', height: '20px' }} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div style={{
                        marginTop: '28px',
                        textAlign: 'center',
                        paddingTop: '24px',
                        borderTop: '1px solid rgba(99, 102, 241, 0.1)'
                    }}>
                        <p style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            margin: 0
                        }}>
                            Already have an account?{" "}
                            <button
                                onClick={() => navigate("/login")}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6366f1',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    padding: 0,
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '2px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#4f46e5'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#6366f1'}
                            >
                                Sign In
                            </button>
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
