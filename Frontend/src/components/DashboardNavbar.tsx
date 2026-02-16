import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
        <img src={womenOwnedLogo} alt="Women Owned" style={{ height: 110, width: "auto", display: "block" }} />
      </div>
      <button
        type="button"
        onClick={() => navigate("/home")}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "transparent",
          border: "none",
          padding: "8px 12px",
          cursor: "pointer",
          outline: "none",
          transition: "opacity 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        title="Go to Dashboard"
      >
        <Sparkles size={24} color="#5a6340" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", background: "linear-gradient(90deg, #E87878, #2d3319)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>Bid Intelligence</span>
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
              background: "rgba(255,179,179,0.5)",
              border: "1px solid rgba(255,143,143,0.4)",
              borderRadius: 14,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FFB3B3";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,143,143,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,179,179,0.5)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            title="Account & security"
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FF8F8F", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,143,143,0.3)" }}>
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2d3319" }}>{userDisplayName}</span>
          </button>
        ) : null}
        <img src={cacheLogo} alt="Cache" style={{ height: 105, width: "auto", display: "block", marginLeft: 8 }} />
      </div>
    </header>
  );
}
