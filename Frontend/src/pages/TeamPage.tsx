import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";
import DashboardSidebar, { getDashboardSidebarWidth } from "../components/DashboardSidebar";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";

interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
  technicalManagersCount?: number;
}

interface BidManagerDashboard {
  id: number;
  fullName: string;
  email: string;
  role: string;
  technicalManagers: TeamMember[];
  teamProjectsUsed: number;
  teamProjectsLimit: number;
  teamProjectsLeft: number;
}

export default function TeamPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: number; role?: string; fullName?: string } | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [bidManagerDashboard, setBidManagerDashboard] = useState<BidManagerDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) {
      navigate("/login");
      return;
    }
    try {
      setUser(JSON.parse(u));
    } catch {
      navigate("/login");
      return;
    }
  }, [navigate]);

  const fetchTeamAndQuota = async () => {
    const token = getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const u = localStorage.getItem("user");
      const userRole = u ? JSON.parse(u).role?.toLowerCase() : "";

      if (userRole === "bid_admin") {
        // Fetch Bid Admin dashboard with all Bid Managers and their teams
        const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` } });
        if (dashRes.ok) {
          const d = await dashRes.json();
          if (d.success) setBidManagerDashboard(d.bidManagers || []);
        }
      } else {
        // Bid Manager: fetch all TMs (team-member-assignments).
        const assignRes = await fetch(`${API_BASE_URL}/api/rfp/team-member-assignments`, { headers: { Authorization: `Bearer ${token}` } });
        if (assignRes.ok && userRole === "bid_manager") {
          const d = await assignRes.json();
          if (d.success && Array.isArray(d.teamMembers)) setTeam(d.teamMembers || []);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchTeamAndQuota();
  }, [user]);

  const role = (user?.role || "").toLowerCase();
  const isBidAdmin = role === "bid_admin";
  const isBidManager = role === "bid_manager";
  const showSidebar = isBidAdmin || isBidManager;
  const sidebarWidth = getDashboardSidebarWidth(role);
  const userDisplayName =
    user?.fullName ||
    (isBidAdmin ? "Bid Admin" : isBidManager ? "Bid Manager" : user?.role || "User");
  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    setDeletingUserId(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/delete-user/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "User deleted");
        await fetchTeamAndQuota();
      } else {
        toast.error(data.detail || data.message || "Failed to delete user");
      }
    } catch (e) {
      toast.error("Request failed");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="universal-page-wrapper">
      <DashboardNavbar />

      {showSidebar && (
        <DashboardSidebar activeItem="team" userRole={role} userDisplayName={userDisplayName} />
      )}

      <div className="universal-background">
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: isBidAdmin ? 1000 : 800,
          margin: "0 auto 40px",
          marginLeft: showSidebar ? sidebarWidth : undefined,
          padding: 24,
          paddingTop: NAVBAR_HEIGHT + 28,
          paddingBottom: 48,
          transition: "margin-left 0.25s ease",
          boxSizing: "border-box",
        }}
      >
        <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 20, padding: 28, marginBottom: 24, boxShadow: "0 20px 50px rgba(99,102,241,0.12)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, color: "#111827" }}>
            Team overview
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            {isBidAdmin
              ? "See which Bid Managers have which Technical Managers on their team."
              : isBidManager
                ? "Your Technical Managers — assign them to projects from the dashboard or upload page."
                : `Role: ${user.role || "—"} · ${user.fullName || ""}`}
          </p>

          {loading ? (
            <p style={{ marginTop: 20, color: "#6b7280" }}>Loading team overview…</p>
          ) : (
            <>
              {isBidAdmin && (
                <section style={{ marginTop: 24 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#4f46e5" }}>Bid Managers & team members</h2>
                  {bidManagerDashboard.length === 0 ? <p style={{ color: "#6b7280", margin: 0 }}>No Bid Managers yet.</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {bidManagerDashboard.map((bm) => (
                        <div key={bm.id} style={{ padding: 18, borderRadius: 14, background: "#fff", border: "1px solid rgba(111,190,178,0.35)", boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)" }}>
                          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ fontSize: 16, color: "#111827" }}>{bm.fullName}</strong>
                              <span style={{ color: "#6b7280", fontSize: 14, marginLeft: 8 }}>· {bm.email}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteUser(bm.id, bm.fullName)}
                              disabled={deletingUserId === bm.id}
                              style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: deletingUserId === bm.id ? "not-allowed" : "pointer", opacity: deletingUserId === bm.id ? 0.6 : 1 }}
                            >
                              {deletingUserId === bm.id ? "Deleting..." : "Remove"}
                            </button>
                          </div>
                          {bm.technicalManagers.length > 0 ? (
                            <div>
                              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Technical Managers ({bm.technicalManagers.length}):</p>
                              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                {bm.technicalManagers.map((tm) => (
                                  <li key={tm.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(226,232,240,0.9)", background: "#f8fafc", fontSize: 14, color: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ display: "flex", flexDirection: "column" }}>
                                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{tm.fullName}</span>
                                      <span style={{ fontSize: 12, color: "#64748b" }}>{tm.email}</span>
                                    </span>
                                    <button
                                      onClick={() => handleDeleteUser(tm.id, tm.fullName)}
                                      disabled={deletingUserId === tm.id}
                                      style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: deletingUserId === tm.id ? "not-allowed" : "pointer", opacity: deletingUserId === tm.id ? 0.6 : 1 }}
                                    >
                                      {deletingUserId === tm.id ? "..." : "Remove"}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>No Technical Managers yet</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {isBidManager && (
                <section style={{ marginTop: 24 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#4f46e5" }}>All Technical Managers</h2>
                  <p style={{ margin: "0 0 12px", fontSize: 14, color: "#6b7280" }}>Choose which Technical Manager to assign to your projects from your dashboard or when uploading.</p>
                  {team.length === 0 ? <p style={{ color: "#6b7280", margin: 0 }}>No Technical Managers yet. Bid Admin can create them.</p> : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {team.map((t) => (
                        <li key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{t.fullName} · {t.email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {role === "technical_manager" && team.length === 0 && !loading && (
                <p style={{ marginTop: 20, color: "#6b7280" }}>You are a Technical Manager.</p>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
