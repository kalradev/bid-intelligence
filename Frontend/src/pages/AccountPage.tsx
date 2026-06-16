import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";
import { UserCircle, KeyRound, ArrowLeft } from "lucide-react";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";

export default function AccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ id: number; fullName?: string; email?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        const data = await res.json();
        if (data.success && data.user) setUser(data.user);
        else {
          const stored = localStorage.getItem("user");
          if (stored) {
            try {
              setUser(JSON.parse(stored));
            } catch {
              setUser(null);
            }
          }
        }
      } catch {
        const stored = localStorage.getItem("user");
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch {
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  useEffect(() => {
    const hash = location.hash.replace("#", "") || "profile";
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Password changed successfully");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        toast.error(data.detail || data.message || "Failed to change password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="universal-page-wrapper">
        <DashboardNavbar />
        <div className="universal-background">
          <div className="universal-bg-gradient-1" />
          <div className="universal-bg-gradient-2" />
          <div className="universal-bg-gradient-3" />
        </div>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: NAVBAR_HEIGHT }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #D4F0EB", borderTopColor: "#6FBEB2", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="universal-page-wrapper">
      <DashboardNavbar />

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
          background: "linear-gradient(135deg, #6FBEB2 0%, #34908B 100%)",
          border: "1px solid rgba(111,190,178,0.4)",
          borderRadius: 12,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
          color: "#fff",
          boxShadow: "0 4px 12px rgba(111,190,178,0.3)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(111,190,178,0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(111,190,178,0.3)";
        }}
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="universal-background">
        <div className="universal-bg-gradient-1" />
        <div className="universal-bg-gradient-2" />
        <div className="universal-bg-gradient-3" />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto", padding: 24, paddingTop: NAVBAR_HEIGHT + 24 }}>
        <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 20, padding: 28, marginBottom: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.06)", border: "1px solid rgba(226,232,240,0.8)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 800, color: "#1e293b" }}>Account & security</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Manage your profile and password.</p>
        </div>

        {/* Profile */}
        <section id="profile" style={{ background: "rgba(255,255,255,0.95)", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#E8F8F5", border: "1px solid rgba(111,190,178,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCircle size={24} color="#6FBEB2" />
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Profile</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Full name</label>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#1e293b" }}>{user?.fullName ?? "—"}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Email</label>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#1e293b" }}>{user?.email ?? "—"}</div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Role</label>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#1e293b", textTransform: "capitalize" }}>{(user?.role ?? "—").replace("_", " ")}</div>
            </div>
          </div>
        </section>

        {/* Change password */}
        <section id="password" style={{ background: "rgba(255,255,255,0.95)", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, rgba(111,190,178,0.2) 0%, rgba(165,233,221,0.25) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={24} color="#6FBEB2" />
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Change password</h2>
          </div>
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Current password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                required
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>New password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="At least 6 characters"
                required
                minLength={6}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Confirm new password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
                required
                minLength={6}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none" }}
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #6FBEB2 0%, #34908B 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: changingPassword ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(111,190,178,0.3)",
              }}
            >
              {changingPassword ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
