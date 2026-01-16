import { ArrowRight, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
            const response = await fetch('http://localhost:3000/api/auth/login', {
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e8ba3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            {/* Elegant Background Pattern */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `
                    radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.08) 0%, transparent 50%)
                `,
                opacity: 0.4
            }} />
            
            {/* Subtle Grid Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `
                    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px'
            }} />

            {/* Login Form Container */}
            <div style={{
                position: 'relative',
                zIndex: 10,
                width: '100%',
                maxWidth: '450px',
                animation: 'fadeInUp 0.6s ease-out'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    padding: '48px 40px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                    {/* Header */}
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '36px'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
                        }}>
                            <Lock style={{ width: '28px', height: '28px', color: '#fff' }} />
                        </div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: '#1f2937',
                            margin: '0 0 8px 0',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            Welcome Back
                        </h1>
                        <p style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            margin: 0,
                            fontWeight: '500'
                        }}>
                            Sign in to access your bid intelligence dashboard
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                                    placeholder="Enter your password"
                                    required
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
                                    Signing In...
                                </>
                            ) : (
                                <>
                                    Sign In
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
                            Don't have an account?{" "}
                            <button
                                onClick={() => navigate("/signup")}
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
                                Sign Up
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
