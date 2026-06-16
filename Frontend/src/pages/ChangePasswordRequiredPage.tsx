import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { LockKeyhole } from "lucide-react";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";

export default function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    const token = getAuthToken();
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      toast.error("Session expired. Please log in again.");
      navigate("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const user = JSON.parse(userStr);
        localStorage.setItem("user", JSON.stringify({ ...user, mustChangePassword: false }));
        toast.success("Password changed. You can now use the app.");
        navigate("/home");
      } else {
        toast.error(data.detail || data.message || "Failed to change password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", padding: 24 }}>
      {/* Non-dismissible: no close button, backdrop click does nothing */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", border: "2px solid rgba(111,190,178,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(111,190,178,0.15)", border: "1px solid rgba(111,190,178,0.4)", color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>
          You must change your password before you can use the app. This step cannot be skipped.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(111,190,178,0.2)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(111,190,178,0.4)" }}>
            <LockKeyhole size={26} color="#c73e3e" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b" }}>Change password required</h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>Set a new password to continue</p>
          </div>
        </div>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
          For your security, you must set a new password before you can access the app. Use the temporary password you received, then choose a new one.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Current password (temporary)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter the password you logged in with"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "14px 20px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              background: loading ? "#94a3b8" : "#6FBEB2",
              color: "#fff",
              border: "none",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 14px rgba(111,190,178,0.35)",
            }}
          >
            {loading ? "Updating…" : "Set new password and continue"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
