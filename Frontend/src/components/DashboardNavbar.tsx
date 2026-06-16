import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import bidIntelligenceLogo from "../assets/bid-intelligence-logo.svg";
import cacheLogo from "../assets/Cache-Logo.png";
import womenOwnedLogo from "../assets/women-owned-logo.png";

export const NAVBAR_HEIGHT = 88;

export default function DashboardNavbar() {
  const navigate = useNavigate();
  const [userDisplayName, setUserDisplayName] = useState<string>("");

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const parsed = JSON.parse(u);
        if (parsed.fullName && typeof parsed.fullName === "string") {
          setUserDisplayName(parsed.fullName);
        } else if (parsed.role) {
          const role = (parsed.role || "").toLowerCase();
          if (role === "bid_admin") setUserDisplayName("Bid Admin");
          else if (role === "bid_manager") setUserDisplayName("Bid Manager");
          else if (role === "technical_manager") setUserDisplayName("Technical Manager");
          else setUserDisplayName("User");
        }
      } catch {
        setUserDisplayName("");
      }
    } else {
      setUserDisplayName("");
    }
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: NAVBAR_HEIGHT,
        zIndex: 120,
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
        borderBottom: "1px solid rgba(255,255,255,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px 0 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img src={womenOwnedLogo} alt="Women Owned" className="header-women-owned-logo" />
      </div>
      <button
        type="button"
        onClick={() => navigate("/home")}
        className="header-brand-center header-brand-center--clickable"
        style={{
          position: "absolute",
          left: "50%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        title="Go to Dashboard"
      >
        <img src={bidIntelligenceLogo} alt="" style={{ height: 44, width: 44, flexShrink: 0 }} />
        <span className="dashboard-top-header__title">Bid Intelligence</span>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {userDisplayName ? (
          <button
            type="button"
            onClick={() => navigate("/account")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px 8px 8px",
              background: "rgba(165,233,221,0.5)",
              border: "1px solid rgba(111,190,178,0.4)",
              borderRadius: 14,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#A5E9DD";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(111,190,178,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(165,233,221,0.5)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            title="Account & security"
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#6FBEB2", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(111,190,178,0.3)" }}>
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e4a47" }}>{userDisplayName}</span>
          </button>
        ) : null}
        <img src={cacheLogo} alt="Cache" className="header-cache-logo" style={{ marginLeft: 8 }} />
      </div>
    </header>
  );
}
