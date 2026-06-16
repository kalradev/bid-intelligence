import { ChevronRight, Cpu, FileSearch, Globe2, LineChart, LogOut, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
// Logo imports
import cacheLogo from '../assets/Cache-Logo.png';
import womenOwnedLogo from '../assets/women-owned-logo.png';
import BidAdminDashboardPage from "./BidAdminDashboardPage";
import BidManagerDashboardPage from "./BidManagerDashboardPage";
import TechnicalManagerDashboardPage from "./TechnicalManagerDashboardPage";

export default function LandingPage() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) return (JSON.parse(u).role || "").toLowerCase();
    } catch { }
    return null;
  });

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const parsed = JSON.parse(u);
        setUserRole((parsed.role || "").toLowerCase());
      } catch {
        setUserRole(null);
      }
    } else {
      setUserRole(null);
    }
  }, []);

  if (userRole === "bid_admin") {
    return <BidAdminDashboardPage />;
  }

  if (userRole === "bid_manager") {
    return <BidManagerDashboardPage />;
  }

  if (userRole === "technical_manager") {
    return <TechnicalManagerDashboardPage />;
  }

  const showTeamLink = userRole === "bid_manager";

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('analysisData');
    localStorage.removeItem('currentDocument');
    localStorage.removeItem('recentRfpAnalysis');

    toast.success("Logged out successfully!");
    navigate("/login");
  };

  return (
    <div className="universal-page-wrapper">
      {/* Women Owned Logo - Top Left */}
      <div style={{ position: 'fixed', top: '4px', left: '32px', zIndex: 100, display: 'flex', alignItems: 'flex-start' }}>
        <img src={womenOwnedLogo} alt="Women Owned" className="header-women-owned-logo" />
      </div>

      {/* Cache Logo - Top Right */}
      <div style={{ position: 'fixed', top: '4px', right: '32px', zIndex: 100, display: 'flex', alignItems: 'flex-start' }}>
        <img src={cacheLogo} alt="Cache" style={{ height: 105, width: 'auto', display: 'block' }} />
      </div>

      {/* Background Animation */}
      <div className="universal-background">
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      {/* Hero Section */}
      <div className="landing-container">
        <div className="text-center hero-section">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-100 rounded-full shadow-sm">
            <span className="text-blue-600 font-semibold text-sm ">
              AI-Powered Bidding Evolution
            </span>
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-snug">
            Transform Complex RFPs into
            <span className="text-blue-600"> Winning Bids</span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Experience the next generation of bid intelligence — automated analysis,
            AI-driven insights, and real-time opportunity mapping — all in one intuitive platform.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => navigate("/upload")} className="modern-button">
              Get Started <ChevronRight className="w-5 h-5" />
            </button>
            {showTeamLink && (
              <button
                onClick={() => navigate("/team")}
                className="modern-button"
                style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "white", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)" }}
              >
                <Users className="w-5 h-5" /> Team & Quota
              </button>
            )}
          </div>
        </div>

        {/* Interactive Feature Highlights */}
        <div className="hover-feature-section">
          <h2>What Makes Us Different?</h2>

          <div className="hover-grid">
            <div className="hover-card">
              <div className="hover-icon bg-gradient-blue">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <h3>AI Bid Engine</h3>
              <p>
                Our AI interprets RFP documents to identify crucial patterns
                and pricing advantages in seconds.
              </p>
            </div>

            <div className="hover-card">
              <div className="hover-icon bg-gradient-cyan">
                <Globe2 className="w-8 h-8 text-white" />
              </div>
              <h3>Global Bid Intelligence</h3>
              <p>
                Stay ahead with live updates on global tenders, competitor activity, and
                market bidding trends to optimize every submission.
              </p>
            </div>

            <div className="hover-card">
              <div className="hover-icon bg-gradient-purple">
                <FileSearch className="w-8 h-8 text-white" />
              </div>
              <h3>Smart Document Insights</h3>
              <p>
                Automatically extract key details, timelines, and tender specifics from
                lengthy bid documents — no manual effort needed.
              </p>
            </div>

            <div className="hover-card">
              <div className="hover-icon bg-gradient-green">
                <LineChart className="w-8 h-8 text-white" />
              </div>
              <h3>Predictive Cost Estimation</h3>
              <p>
                Leverage machine learning to forecast costs and bid
                success probabilities with stunning accuracy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Button - Bottom Right Corner */}
      <button
        onClick={handleLogout}
        title="Logout"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          background: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 20px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#b91c1c';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#dc2626';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
        }}
      >
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </div>
  );
}
