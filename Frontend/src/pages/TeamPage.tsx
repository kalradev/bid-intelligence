import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";
import { API_BASE_URL } from "../config";

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
  teamProjectsOverQuota?: boolean;
  actualProjectCount?: number;
}

export default function TeamPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: number; role?: string; fullName?: string } | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [bidManagerDashboard, setBidManagerDashboard] = useState<BidManagerDashboard[]>([]);
  const [quota, setQuota] = useState<{ teamProjectsUsed?: number; teamProjectsLimit?: number; teamProjectsLeft?: number; appliesToTeam?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", role: "" });
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
    const token = localStorage.getItem("token");
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
        // Fetch regular team and quota for Bid Manager / Technical Manager
        const [teamRes, quotaRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/my-team`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/auth/team-quota`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (teamRes.ok) {
          const d = await teamRes.json();
          if (d.success) setTeam(d.team || []);
        }
        if (quotaRes.ok) {
          const d = await quotaRes.json();
          if (d.appliesToTeam) setQuota({ teamProjectsUsed: d.teamProjectsUsed, teamProjectsLimit: d.teamProjectsLimit, teamProjectsLeft: d.teamProjectsLeft, appliesToTeam: true });
          else setQuota(null);
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
  const canCreateBidManager = false; // Bid Managers are created by Bid Admin from admin dashboard
  const canCreateTechnicalManager = role === "bid_manager";

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.error("Fill all fields");
      return;
    }
    const targetRole = canCreateBidManager ? "bid_manager" : canCreateTechnicalManager ? "technical_manager" : "";
    if (!targetRole) return;
    setCreateLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: createForm.fullName.trim(), email: createForm.email.trim(), password: createForm.password, role: targetRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "User created");
        setCreateForm({ fullName: "", email: "", password: "", role: "" });
        await fetchTeamAndQuota();
      } else {
        toast.error(data.detail || data.message || "Failed to create user");
      }
    } catch (e) {
      toast.error("Request failed");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }
    const token = localStorage.getItem("token");
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

      {(isBidAdmin || isBidManager) && (
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
      )}

      <div className="universal-background">
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: isBidAdmin ? 1000 : 800, margin: "0 auto 40px", padding: 24, paddingTop: NAVBAR_HEIGHT + 24 }}>
        <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 20, padding: 28, marginBottom: 24, boxShadow: "0 20px 50px rgba(99,102,241,0.12)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, color: "#111827" }}>
            {isBidAdmin ? "Dashboard - Organization Overview" : "Team & Quota"}
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            {isBidAdmin ? "Monitor all Bid Managers, Technical Managers, and team quotas" : `Role: ${user.role || "—"} · ${user.fullName || ""}`}
          </p>

          {quota && quota.appliesToTeam && (
            <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: quota.teamProjectsLeft === 0 ? "rgba(239,68,68,0.1)" : "rgba(79,70,229,0.08)", border: `1px solid ${quota.teamProjectsLeft === 0 ? "rgba(239,68,68,0.3)" : "rgba(79,70,229,0.2)"}` }}>
              <strong>Team quota:</strong> {quota.teamProjectsUsed} / {quota.teamProjectsLimit} used — <strong>{quota.teamProjectsLeft} left</strong>
            </div>
          )}

          {loading ? (
            <p style={{ marginTop: 20, color: "#6b7280" }}>Loading dashboard…</p>
          ) : (
            <>
              {isBidAdmin && (
                <section style={{ marginTop: 24 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#4f46e5" }}>Bid Managers Dashboard</h2>
                  {bidManagerDashboard.length === 0 ? <p style={{ color: "#6b7280", margin: 0 }}>No Bid Managers yet.</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {bidManagerDashboard.map((bm) => (
                        <div key={bm.id} style={{ padding: 16, borderRadius: 12, background: "rgba(79,70,229,0.05)", border: "1px solid rgba(79,70,229,0.2)" }}>
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
                          <div style={{ padding: "10px 14px", borderRadius: 8, background: bm.teamProjectsLeft === 0 ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${bm.teamProjectsLeft === 0 ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`, marginBottom: 12, fontSize: 14 }}>
                            <strong>Team quota:</strong> {Math.min(bm.teamProjectsUsed, bm.teamProjectsLimit)} / {bm.teamProjectsLimit} used — <strong>{bm.teamProjectsLeft} left</strong>
                            {bm.teamProjectsOverQuota && bm.actualProjectCount != null && (
                              <span style={{ marginLeft: 8, color: "#b45309", fontWeight: 600 }}>· Over quota ({bm.actualProjectCount} projects)</span>
                            )}
                          </div>
                          {bm.technicalManagers.length > 0 ? (
                            <div>
                              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Technical Managers ({bm.technicalManagers.length}):</p>
                              <ul style={{ listStyle: "none", padding: 0, margin: 0, paddingLeft: 12 }}>
                                {bm.technicalManagers.map((tm) => (
                                  <li key={tm.id} style={{ padding: "6px 0", fontSize: 14, color: "#374151", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>• {tm.fullName} · {tm.email}</span>
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
              {canCreateTechnicalManager && (
                <section style={{ marginTop: 24 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#4f46e5" }}>Your Technical Managers</h2>
                  {team.length === 0 ? <p style={{ color: "#6b7280", margin: 0 }}>No Technical Managers yet.</p> : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {team.map((t) => (
                        <li key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{t.fullName} · {t.email}</span>
                          <button
                            onClick={() => handleDeleteUser(t.id, t.fullName)}
                            disabled={deletingUserId === t.id}
                            style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: deletingUserId === t.id ? "not-allowed" : "pointer", opacity: deletingUserId === t.id ? 0.6 : 1 }}
                          >
                            {deletingUserId === t.id ? "Deleting..." : "Remove"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {canCreateTechnicalManager && (
                <section style={{ marginTop: 28 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#4f46e5" }}>Create Technical Manager</h2>
                  <form
                    onSubmit={handleCreateUser}
                    autoComplete="off"
                    style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}
                  >
                    <input
                      type="text"
                      placeholder="Full name"
                      value={createForm.fullName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                      required
                      autoComplete="chrome-off"
                      style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                      required
                      autoComplete="chrome-off"
                      style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                    />
                    <input
                      type="password"
                      placeholder="Password (min 6)"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
                    />
                    <button type="submit" disabled={createLoading} style={{ padding: "12px 20px", background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: createLoading ? "not-allowed" : "pointer" }}>
                      {createLoading ? "Creating…" : "Create Technical Manager"}
                    </button>
                  </form>
                </section>
              )}

              {role === "technical_manager" && team.length === 0 && !loading && (
                <p style={{ marginTop: 20, color: "#6b7280" }}>You are a Technical Manager. Team quota is shown above.</p>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
