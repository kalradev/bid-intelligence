import { ArrowLeft, PieChart as PieChartIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";
import { API_BASE_URL } from "../config";

interface BidManagerQuota {
    id: number;
    fullName: string;
    email: string;
    teamProjectsUsed: number;
    teamProjectsLimit: number;
    teamProjectsLeft: number;
}

export default function TeamQuotaPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [bidManagers, setBidManagers] = useState<BidManagerQuota[]>([]);
    const [hoveredTeam, setHoveredTeam] = useState<number | null>(null);

    useEffect(() => {
        const u = localStorage.getItem("user");
        if (!u) {
            navigate("/login");
            return;
        }
        try {
            const parsed = JSON.parse(u);
            const role = (parsed.role || "").toLowerCase();
            if (role !== "bid_admin") {
                navigate("/home");
                return;
            }
        } catch {
            navigate("/login");
            return;
        }
    }, [navigate]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!dashRes.ok) {
                    toast.error("Failed to load quota data");
                    return;
                }
                const dashData = await dashRes.json();
                if (dashData.success && dashData.bidManagers) {
                    setBidManagers(dashData.bidManagers);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load quota data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Use quota-used (capped per team) so total never exceeds total limit
    const totalUsed = bidManagers.reduce((s, b) => s + Math.min(b.teamProjectsUsed, b.teamProjectsLimit ?? 10), 0);
    const totalLimit = bidManagers.reduce((s, b) => s + (b.teamProjectsLimit ?? 0), 0);
    const totalLeft = totalLimit - totalUsed;
    const usagePercentage = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

    // Generate colors for each team
    const colors = [
        { start: "#8b5cf6", end: "#a855f7", name: "Purple" },
        { start: "#3b82f6", end: "#60a5fa", name: "Blue" },
        { start: "#ec4899", end: "#f472b6", name: "Pink" },
        { start: "#f59e0b", end: "#fbbf24", name: "Amber" },
        { start: "#10b981", end: "#34d399", name: "Green" },
        { start: "#06b6d4", end: "#22d3ee", name: "Cyan" },
        { start: "#f97316", end: "#fb923c", name: "Orange" },
        { start: "#6366f1", end: "#818cf8", name: "Indigo" },
    ];

    // Calculate pie chart segments including used by each team AND remaining available
    const chartData = bidManagers.map((bm, index) => {
        const percentage = totalLimit > 0 ? (bm.teamProjectsUsed / totalLimit) * 100 : 0;
        return {
            id: bm.id,
            name: bm.fullName,
            email: bm.email,
            used: bm.teamProjectsUsed,
            limit: bm.teamProjectsLimit,
            left: bm.teamProjectsLeft,
            percentage,
            color: colors[index % colors.length],
            isAvailable: false,
        };
    });

    const activeTeamSegments = chartData.filter(s => s.percentage > 0);
    const availablePercentage = totalLimit > 0 ? (totalLeft / totalLimit) * 100 : 100;

    const allSegments = [
        ...activeTeamSegments,
        ...(availablePercentage > 0 ? [{
            id: -1,
            name: "Available Quota",
            email: "",
            used: totalLeft,
            limit: totalLimit,
            left: totalLeft,
            percentage: availablePercentage,
            color: { start: "#f1f5f9", end: "#e2e8f0", name: "Gray" },
            isAvailable: true,
        }] : [])
    ];

    // Calculate cumulative angles for pie chart
    let cumulativeAngle = 0;
    const pieSegments = allSegments.map((data) => {
        const startAngle = cumulativeAngle;
        const angle = (data.percentage / 100) * 360;
        cumulativeAngle += angle;
        return { ...data, startAngle, angle };
    });

    // SVG pie chart helper - create path for pie segment
    const createPieSegment = (startAngle: number, angle: number, radius: number) => {
        if (angle >= 360) {
            // Return a full circle if there's only one segment (e.g. 100% available)
            return `M 150 150 m -${radius} 0 a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 -${radius * 2} 0`;
        }
        const start = polarToCartesian(150, 150, radius, startAngle);
        const end = polarToCartesian(150, 150, radius, startAngle + angle);
        const largeArcFlag = angle > 180 ? 1 : 0;
        return `M 150 150 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
    };

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians),
        };
    };

    return (
        <div className="universal-page-wrapper" style={{ minHeight: "100vh" }}>
            <DashboardNavbar />

            {/* Back Button */}
            <button
                type="button"
                onClick={() => navigate("/home")}
                style={{
                    position: "fixed",
                    bottom: 20,
                    left: 20,
                    zIndex: 1000,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 20px",
                    background: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
                    border: "1px solid rgba(13,148,136,0.4)",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#fff",
                    boxShadow: "0 4px 12px rgba(13,148,136,0.3)",
                    transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(13,148,136,0.4)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(13,148,136,0.3)";
                }}
            >
                <ArrowLeft size={18} /> Back to Dashboard
            </button>

            {/* Background */}
            <div className="universal-background">
                <div className="universal-bg-gradient-1"></div>
                <div className="universal-bg-gradient-2"></div>
                <div className="universal-bg-gradient-3"></div>
            </div>

            {/* Main Content */}
            <div style={{ maxWidth: 1200, margin: "0 auto 40px", padding: 24, paddingTop: NAVBAR_HEIGHT + 32, position: "relative", zIndex: 1 }}>
                {/* Header */}
                <div
                    style={{
                        background: "rgba(255,255,255,0.95)",
                        borderRadius: 20,
                        padding: 32,
                        marginBottom: 32,
                        boxShadow: "0 20px 50px rgba(99,102,241,0.12)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 8px 20px rgba(139,92,246,0.4)",
                            }}
                        >
                            <PieChartIcon size={28} color="#fff" />
                        </div>
                        <div>
                            <h1 style={{ margin: "0 0 4px", fontSize: 32, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
                                Team Quota Overview
                            </h1>
                            <p style={{ margin: 0, color: "#6b7280", fontSize: 15 }}>
                                Visualize quota distribution and usage across all teams
                            </p>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 24 }}>
                        <div
                            style={{
                                padding: "16px 20px",
                                borderRadius: 14,
                                background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(168,85,247,0.08) 100%)",
                                border: "1px solid rgba(139,92,246,0.2)",
                            }}
                        >
                            <div style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600, marginBottom: 6 }}>Total Limit</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{totalLimit}</div>
                        </div>
                        <div
                            style={{
                                padding: "16px 20px",
                                borderRadius: 14,
                                background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(96,165,250,0.08) 100%)",
                                border: "1px solid rgba(59,130,246,0.2)",
                            }}
                        >
                            <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, marginBottom: 6 }}>Total Used</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{totalUsed}</div>
                        </div>
                        <div
                            style={{
                                padding: "16px 20px",
                                borderRadius: 14,
                                background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(52,211,153,0.08) 100%)",
                                border: "1px solid rgba(34,197,94,0.2)",
                            }}
                        >
                            <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, marginBottom: 6 }}>Available</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{totalLeft}</div>
                        </div>
                        <div
                            style={{
                                padding: "16px 20px",
                                borderRadius: 14,
                                background:
                                    usagePercentage >= 90
                                        ? "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(248,113,113,0.08) 100%)"
                                        : "linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,191,36,0.08) 100%)",
                                border: usagePercentage >= 90 ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(245,158,11,0.2)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 13,
                                    color: usagePercentage >= 90 ? "#dc2626" : "#d97706",
                                    fontWeight: 600,
                                    marginBottom: 6,
                                }}
                            >
                                Utilization
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{usagePercentage.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 32,
                        }}
                    >
                        <div
                            style={{
                                background: "rgba(255,255,255,0.95)",
                                borderRadius: 20,
                                padding: 40,
                                boxShadow: "0 20px 50px rgba(99,102,241,0.12)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: 400,
                            }}
                        >
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: "50%",
                                    border: "3px solid #e2e8f0",
                                    borderTopColor: "#8b5cf6",
                                    animation: "spin 0.8s linear infinite",
                                }}
                            />
                            <span style={{ color: "#64748b", fontSize: 15, marginTop: 16 }}>Loading chart…</span>
                        </div>
                        <div
                            style={{
                                background: "rgba(255,255,255,0.95)",
                                borderRadius: 20,
                                padding: 32,
                                boxShadow: "0 20px 50px rgba(99,102,241,0.12)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: 400,
                            }}
                        >
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: "50%",
                                    border: "3px solid #e2e8f0",
                                    borderTopColor: "#8b5cf6",
                                    animation: "spin 0.8s linear infinite",
                                }}
                            />
                            <span style={{ color: "#64748b", fontSize: 15, marginTop: 16 }}>Loading teams…</span>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        {/* Pie Chart Section */}
                        <div
                            style={{
                                background: "rgba(255,255,255,0.95)",
                                borderRadius: 20,
                                padding: 40,
                                boxShadow: "0 20px 50px rgba(99,102,241,0.12)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <h2
                                style={{
                                    margin: "0 0 32px",
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: "#1e293b",
                                    textAlign: "center",
                                }}
                            >
                                Quota Distribution by Team
                            </h2>
                            <div style={{ position: "relative", width: 320, height: 320 }}>
                                <svg width="320" height="320" viewBox="0 0 300 300">
                                    {/* Pie Chart Segments */}
                                    {pieSegments.map((segment) => (
                                        <g key={segment.id}>
                                            <defs>
                                                <linearGradient id={`gradient-${segment.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor={segment.color.start} />
                                                    <stop offset="100%" stopColor={segment.color.end} />
                                                </linearGradient>
                                            </defs>
                                            <path
                                                d={createPieSegment(segment.startAngle, segment.angle, 120)}
                                                fill={`url(#gradient-${segment.id})`}
                                                stroke="#fff"
                                                strokeWidth="3"
                                                style={{
                                                    cursor: "pointer",
                                                    transition: "all 0.3s ease",
                                                    filter: hoveredTeam === segment.id ? "brightness(1.2) drop-shadow(0 8px 16px rgba(0,0,0,0.2))" : "none",
                                                    transform: hoveredTeam === segment.id ? "scale(1.05)" : "scale(1)",
                                                    transformOrigin: "150px 150px",
                                                }}
                                                onMouseEnter={() => setHoveredTeam(segment.id)}
                                                onMouseLeave={() => setHoveredTeam(null)}
                                            />
                                        </g>
                                    ))}
                                    {/* Center Circle */}
                                    <circle cx="150" cy="150" r="60" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
                                    <text
                                        x="150"
                                        y="140"
                                        textAnchor="middle"
                                        style={{ fontSize: 14, fontWeight: 600, fill: "#64748b" }}
                                    >
                                        Total
                                    </text>
                                    <text
                                        x="150"
                                        y="165"
                                        textAnchor="middle"
                                        style={{ fontSize: 32, fontWeight: 800, fill: "#1e293b" }}
                                    >
                                        {totalUsed}/{totalLimit}
                                    </text>
                                </svg>
                            </div>
                        </div>

                        {/* Team List Section */}
                        <div
                            style={{
                                background: "rgba(255,255,255,0.95)",
                                borderRadius: 20,
                                padding: 32,
                                boxShadow: "0 20px 50px rgba(99,102,241,0.12)",
                            }}
                        >
                            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
                                Team Breakdown ({bidManagers.length} Teams)
                            </h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 500, overflowY: "auto", paddingRight: 8 }}>
                                {chartData.map((team) => (
                                    <div
                                        key={team.id}
                                        style={{
                                            padding: 16,
                                            borderRadius: 12,
                                            background: hoveredTeam === team.id ? "rgba(139,92,246,0.08)" : "rgba(248,250,252,0.8)",
                                            border: `2px solid ${hoveredTeam === team.id ? "rgba(139,92,246,0.3)" : "#e2e8f0"}`,
                                            transition: "all 0.3s ease",
                                            cursor: "pointer",
                                            transform: hoveredTeam === team.id ? "translateX(8px)" : "translateX(0)",
                                            boxShadow: hoveredTeam === team.id ? "0 8px 20px rgba(139,92,246,0.2)" : "none",
                                        }}
                                        onMouseEnter={() => setHoveredTeam(team.id)}
                                        onMouseLeave={() => setHoveredTeam(null)}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                            <div
                                                style={{
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: 4,
                                                    background: `linear-gradient(135deg, ${team.color.start} 0%, ${team.color.end} 100%)`,
                                                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                                                }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{team.name}</div>
                                                <div style={{ fontSize: 12, color: "#64748b" }}>{team.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>Used</div>
                                                <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{team.used}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>Limit</div>
                                                <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{team.limit}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 }}>Available</div>
                                                <div
                                                    style={{
                                                        fontSize: 18,
                                                        fontWeight: 700,
                                                        color: team.left === 0 ? "#dc2626" : "#16a34a",
                                                    }}
                                                >
                                                    {team.left}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div style={{ marginTop: 12, position: "relative", height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    left: 0,
                                                    top: 0,
                                                    height: "100%",
                                                    width: `${team.limit > 0 ? (team.used / team.limit) * 100 : 0}%`,
                                                    background: `linear-gradient(90deg, ${team.color.start} 0%, ${team.color.end} 100%)`,
                                                    borderRadius: 4,
                                                    transition: "width 0.5s ease",
                                                }}
                                            />
                                        </div>
                                        <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", fontWeight: 600, textAlign: "right" }}>
                                            {team.limit > 0 ? ((team.used / team.limit) * 100).toFixed(1) : 0}% utilized
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
