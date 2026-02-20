import { ArrowRight, FileUp, FolderKanban, FolderOpen, LayoutDashboard, LogOut, Mail, UserCircle, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import bidIntelligenceLogo from "../assets/bid-intelligence-logo.svg";
import cacheLogo from "../assets/Cache-Logo.png";
import womenOwnedLogo from "../assets/women-owned-logo.png";
import { API_BASE_URL } from "../config";

interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

interface ProjectItem {
  id: number;
  project_name: string;
  tender_id: string | null;
  client_name: string | null;
  user_id: number | null;
}

type ViewMode = "dashboard" | "personal";

export default function BidManagerDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [quota, setQuota] = useState<{ teamProjectsUsed: number; teamProjectsLimit: number; teamProjectsLeft: number; appliesToTeam: boolean } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("Bid Manager");
  const [personalProjects, setPersonalProjects] = useState<ProjectItem[]>([]);
  const [personalProjectsLoading, setPersonalProjectsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [assignModalProject, setAssignModalProject] = useState<string | null>(null);
  const [assignModalAssignedIds, setAssignModalAssignedIds] = useState<number[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<{ id: number; fullName: string; email: string; role?: string }[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [addTMForm, setAddTMForm] = useState({ fullName: "", email: "", password: "" });
  const [addTMLoading, setAddTMLoading] = useState(false);
  const [showAddTMInModal, setShowAddTMInModal] = useState(false);
  const SIDEBAR_WIDTH = 240;
  const NAVBAR_HEIGHT = 88;

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) {
      navigate("/login");
      return;
    }
    let parsed: { role?: string; id?: number; fullName?: string };
    try {
      parsed = JSON.parse(u);
    } catch {
      navigate("/login");
      return;
    }
    const role = (parsed.role || "").toLowerCase();
    if (role !== "bid_manager") {
      navigate("/home");
      return;
    }
    if (typeof parsed.id === "number") setCurrentUserId(parsed.id);
    if (parsed.fullName && typeof parsed.fullName === "string") setUserDisplayName(parsed.fullName);
  }, [navigate]);

  const fetchTeam = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const teamRes = await fetch(`${API_BASE_URL}/api/auth/my-team`, { headers: { Authorization: `Bearer ${token}` } });
    if (teamRes.ok) {
      const d = await teamRes.json();
      if (d.success && Array.isArray(d.team)) setTeam(d.team);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [teamRes, quotaRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/my-team`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/auth/team-quota`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (teamRes.ok) {
          const d = await teamRes.json();
          if (d.success && Array.isArray(d.team)) setTeam(d.team);
        }
        if (quotaRes.ok) {
          const d = await quotaRes.json();
          if (d.appliesToTeam) setQuota({ teamProjectsUsed: d.teamProjectsUsed, teamProjectsLimit: d.teamProjectsLimit, teamProjectsLeft: d.teamProjectsLeft, appliesToTeam: true });
          else setQuota(null);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (currentUserId == null) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const fetchPersonalProjects = async () => {
      setPersonalProjectsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          if (viewMode === "personal") toast.error("Failed to load your projects");
          return;
        }
        const data = await res.json();
        const projects: ProjectItem[] = data.success && Array.isArray(data.projects) ? data.projects : [];
        // Bid Manager sees all team projects (created by them or their TMs) in "All projects"
        setPersonalProjects(projects);
      } catch (e) {
        console.error(e);
        if (viewMode === "personal") toast.error("Failed to load your projects");
      } finally {
        setPersonalProjectsLoading(false);
      }
    };
    fetchPersonalProjects();
  }, [currentUserId, viewMode]);

  const handleViewResult = (projectName: string) => {
    navigate(`/project-results/${encodeURIComponent(projectName)}`);
  };

  const openAssignModal = async (projectName: string) => {
    setAssignModalProject(projectName);
    setAssignModalAssignedIds([]);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const [assignRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/rfp/project-assignments/${encodeURIComponent(projectName)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/rfp/assignable-users`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (assignRes.ok) {
        const d = await assignRes.json();
        setAssignModalAssignedIds(d.assignedUserIds || []);
      }
      if (usersRes.ok) {
        const d = await usersRes.json();
        setAssignableUsers(Array.isArray(d.users) ? d.users : []);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load assignments");
    }
  };

  const saveAssignments = async () => {
    if (!assignModalProject) return;
    setAssignSaving(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const userIds = assignModalAssignedIds.map((id) => Number(id));
      const res = await fetch(`${API_BASE_URL}/api/rfp/project-assignments/${encodeURIComponent(assignModalProject)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data.detail === "string" ? data.detail : typeof data.message === "string" ? data.message : Array.isArray(data.detail) ? data.detail.map((d: any) => d?.msg || d).join(", ") : "Failed to save";
        throw new Error(msg);
      }
      toast.success("Assignments saved.");
      setAssignModalProject(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to save assignments");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleAddTMInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!addTMForm.fullName.trim() || !addTMForm.email.trim() || !addTMForm.password.trim()) {
      toast.error("Fill name, email and password");
      return;
    }
    if (addTMForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAddTMLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: addTMForm.fullName.trim(),
          email: addTMForm.email.trim().toLowerCase(),
          password: addTMForm.password,
          role: "technical_manager",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Technical Manager added. You can assign them to this project below.");
        setAddTMForm({ fullName: "", email: "", password: "" });
        setShowAddTMInModal(false);
        const usersRes = await fetch(`${API_BASE_URL}/api/rfp/assignable-users`, { headers: { Authorization: `Bearer ${token}` } });
        if (usersRes.ok) {
          const d = await usersRes.json();
          setAssignableUsers(Array.isArray(d.users) ? d.users : []);
        }
      } else {
        toast.error(data.detail || data.message || "Failed to add");
      }
    } catch (e: any) {
      toast.error(e.message || "Request failed");
    } finally {
      setAddTMLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("analysisData");
    localStorage.removeItem("currentDocument");
    localStorage.removeItem("recentRfpAnalysis");
    toast.success("Logged out");
    navigate("/login");
  };

  const peopleCount = team.length;
  const teamQuotaUsed = quota?.teamProjectsUsed ?? 0;
  const teamQuotaLimit = quota?.teamProjectsLimit ?? 10;
  const teamQuotaLeft = quota?.teamProjectsLeft ?? 0;
  const isQuotaLow = teamQuotaLeft === 0 || (teamQuotaLimit > 0 && (teamQuotaLeft / teamQuotaLimit) * 100 < 50);

  const navButtonBase = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 16px",
    justifyContent: "flex-start",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    background: "transparent",
    color: "#3730a3",
    transition: "all 0.2s",
  } as const;

  return (
    <div className="universal-page-wrapper" style={{ minHeight: "100vh" }}>
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
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={bidIntelligenceLogo} alt="" style={{ height: 44, width: 44, flexShrink: 0 }} />
          <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", background: "linear-gradient(90deg, #E87878, #2d3319)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>Bid Intelligence</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="header-profile-btn"
            onClick={() => navigate("/account")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px 8px 8px",
              background: "rgba(255,179,179,0.3)",
              border: "1px solid rgba(255,143,143,0.3)",
              borderRadius: 14,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(79,172,254,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,179,179,0.3)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            title="Account"
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FF8F8F", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(255,143,143,0.3)" }}>
              {(userDisplayName || "B").charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2d3319" }}>{userDisplayName}</span>
          </button>
          <img src={cacheLogo} alt="Cache" style={{ height: 105, width: "auto", display: "block", marginLeft: 8 }} />
        </div>
      </header>

      <aside
        style={{
          position: "fixed",
          top: NAVBAR_HEIGHT,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          zIndex: 110,
          background: "rgba(234,239,239,0.95)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,143,143,0.2)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
        }}
      >
        <nav style={{ flex: 1, padding: "20px 10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5a6340", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Views
          </div>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "dashboard" ? " active" : ""}`}
            onClick={() => setViewMode("dashboard")}
            style={{
              ...navButtonBase,
              background: viewMode === "dashboard" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "dashboard" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "dashboard" ? 700 : 600,
              boxShadow: viewMode === "dashboard" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "dashboard" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="Dashboard"
          >
            <LayoutDashboard size={20} style={{ flexShrink: 0 }} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "personal" ? " active" : ""}`}
            onClick={() => setViewMode("personal")}
            style={{
              ...navButtonBase,
              background: viewMode === "personal" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "personal" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "personal" ? 700 : 600,
              boxShadow: viewMode === "personal" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "personal" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="All projects"
          >
            <FolderOpen size={20} style={{ flexShrink: 0 }} />
            <span>All projects</span>
          </button>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent 0%, rgba(255,143,143,0.4) 50%, transparent 100%)", margin: "12px 0" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5a6340", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Actions
          </div>
          <button type="button" className="sidebar-nav-toggle" onClick={() => navigate("/upload")} style={{ ...navButtonBase, background: "rgba(255,179,179,0.4)", color: "#2d3319", border: "1px solid rgba(255,143,143,0.3)" }} title="Upload & Analyze">
            <FileUp size={20} style={{ flexShrink: 0 }} />
            <span>Upload & Analyze</span>
          </button>
          <button type="button" className="sidebar-nav-toggle" onClick={() => navigate("/team")} style={{ ...navButtonBase, background: "rgba(255,179,179,0.4)", color: "#2d3319", border: "1px solid rgba(255,143,143,0.3)" }} title="Manage Teams">
            <Users size={20} style={{ flexShrink: 0 }} />
            <span>Manage Teams</span>
          </button>
        </nav>
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,143,143,0.2)", display: "flex", flexDirection: "column", gap: 4 }}>
          <button type="button" onClick={handleLogout} style={{ ...navButtonBase, color: "#6b5344" }} title="Logout">
            <LogOut size={20} style={{ flexShrink: 0 }} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div style={{ position: "fixed", inset: 0, top: NAVBAR_HEIGHT, left: SIDEBAR_WIDTH, right: 0, bottom: 0, zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(250,243,225,0.5) 0%, rgba(234,239,239,0.4) 50%, rgba(255,179,179,0.3) 100%)", animation: "pulse 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(255, 255, 255, 0.3)", backdropFilter: "blur(2px)" }} />
      </div>

      <main style={{ position: "relative", zIndex: 1, marginLeft: SIDEBAR_WIDTH, padding: `${NAVBAR_HEIGHT + 28}px 28px 48px`, transition: "margin-left 0.25s ease" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          {viewMode === "dashboard" && (
            <>
              <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Dashboard</h1>
                  <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Your team, quota, and projects at a glance.</p>
                </div>
                {!loading && quota?.appliesToTeam && (
                  <button
                    type="button"
                    onClick={() => navigate("/team-quota")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 20px",
                      background: isQuotaLow ? "rgba(184,115,51,0.2)" : "rgba(255,143,143,0.2)",
                      border: isQuotaLow ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(34,197,94,0.35)",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 15,
                      color: isQuotaLow ? "#b91c1c" : "#15803d",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      transition: "all 0.2s",
                      outline: "none",
                      flexShrink: 0,
                    }}
                    title="View team quota"
                  >
                    <span style={{ opacity: 0.9 }}>Quota left</span>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{teamQuotaLeft}</span>
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ color: "#64748b", fontSize: 15 }}>Loading dashboard…</span>
                </div>
              ) : (
                <>
                  <div className="bm-dashboard-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 32, minWidth: 0 }}>
                    <div style={{ padding: "22px 20px", background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FAF3E1", border: "2px solid #E87878", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(232,120,120,0.15)", flexShrink: 0 }}>
                        <FolderKanban size={26} color="#E87878" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{quota?.appliesToTeam ? `${teamQuotaUsed}/${teamQuotaLimit}` : "—"}</div>
                        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Team projects</div>
                      </div>
                    </div>
                    <div style={{ padding: "22px 20px", background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FAF3E1", border: "1px solid rgba(255,143,143,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(250,243,225,0.8)", flexShrink: 0 }}>
                        <UserCircle size={26} color="#FF8F8F" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{peopleCount}</div>
                        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>People</div>
                      </div>
                    </div>
                    <div style={{ padding: "22px 20px", background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: "#EAEFEF", borderLeft: "4px solid #5a6340", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(90,99,64,0.12)", flexShrink: 0 }}>
                        <FolderOpen size={26} color="#5a6340" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{personalProjects.length}</div>
                        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>All projects</div>
                      </div>
                    </div>
                  </div>

                  <section style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                    <div style={{ padding: "20px 24px", borderBottom: "1px solid #EAEFEF", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(145deg, #FF8F8F 0%, #E87878 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(232,120,120,0.3)" }}>
                          <Users size={18} color="#fff" />
                        </span>
                        Your team
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigate("/team")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 16px",
                          background: "#FF8F8F",
                          color: "#fff",
                          border: "none",
                          borderRadius: 10,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          boxShadow: "0 4px 12px rgba(255,143,143,0.3)",
                        }}
                      >
                        Manage Teams <ArrowRight size={14} />
                      </button>
                    </div>
                    <div style={{ padding: "24px 24px" }}>
                      {team.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>No Technical Managers yet. Add them from Manage Teams.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {team.map((tm) => (
                            <div key={tm.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #EAEFEF" }}>
                              <UserCircle size={20} color="#5a6340" />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{tm.fullName}</div>
                                <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                                  <Mail size={11} /> {tm.email}
                                </div>
                              </div>
                              <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(255,143,143,0.2)", color: "#2d3319", border: "1px solid rgba(255,143,143,0.35)" }}>Technical Manager</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {viewMode === "personal" && (
            <>
              <div style={{ marginBottom: 28, textAlign: "left" }}>
                <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 }}>All projects</h1>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Projects in your team. View results for any project.</p>
              </div>
              {personalProjectsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ color: "#64748b", fontSize: 15 }}>Loading your projects…</span>
                </div>
              ) : (
                <section>
                  <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#EAEFEF", display: "inline-flex", alignItems: "center", justifyContent: "center", borderLeft: "3px solid #5a6340" }}>
                      <FolderOpen size={18} color="#5a6340" />
                    </span>
                    All projects ({personalProjects.length})
                  </h2>
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                    {personalProjects.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>No team projects yet. Upload & analyze from the sidebar to create one.</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Project</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Tender ID</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Client</th>
                            <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "#475569" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalProjects.map((p) => (
                            <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                              <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.client_name || "—"}</td>
                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => openAssignModal(p.project_name)}
                                    style={{
                                      padding: "8px 14px",
                                      background: "rgba(99, 102, 241, 0.12)",
                                      color: "#5a6340",
                                      border: "1px solid rgba(99, 102, 241, 0.4)",
                                      borderRadius: 8,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: 13,
                                    }}
                                  >
                                    Assign TMs
                                  </button>
                                  <button
                                    onClick={() => handleViewResult(p.project_name)}
                                    style={{
                                      padding: "8px 16px",
                                      background: "#FF8F8F",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: 8,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      fontSize: 13,
                                      boxShadow: "0 4px 12px rgba(255,143,143,0.3)",
                                    }}
                                  >
                                    View result
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

        </div>
      </main>

      {assignModalProject && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
          }}
          onClick={() => {
            if (assignSaving || addTMLoading) return;
            setAssignModalProject(null);
            setShowAddTMInModal(false);
            setAddTMForm({ fullName: "", email: "", password: "" });
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 460,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Assign Technical Managers</h3>
              <button
                type="button"
                onClick={() => { setAssignModalProject(null); setShowAddTMInModal(false); setAddTMForm({ fullName: "", email: "", password: "" }); }}
                style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "#64748b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>Project: “{assignModalProject}”</p>

            {assignableUsers.length > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {assignableUsers.map((m) => (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: assignModalAssignedIds.includes(m.id) ? "rgba(255,143,143,0.15)" : "transparent", border: `1px solid ${assignModalAssignedIds.includes(m.id) ? "rgba(255,143,143,0.4)" : "#EAEFEF"}` }}>
                      <input
                        type="checkbox"
                        checked={assignModalAssignedIds.includes(m.id)}
                        onChange={() => setAssignModalAssignedIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                      />
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{m.fullName}</span>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{m.email}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => { setAssignModalProject(null); setShowAddTMInModal(false); setAddTMForm({ fullName: "", email: "", password: "" }); }} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>Cancel</button>
                  <button disabled={assignSaving} onClick={saveAssignments} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", cursor: assignSaving ? "wait" : "pointer" }}>{assignSaving ? "Saving…" : "Save"}</button>
                </div>
              </>
            ) : (
              <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>No Technical Managers yet. Bid Admin can create them from the dashboard.</p>
            )}

            {assignableUsers.length === 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button onClick={() => { setAssignModalProject(null); setShowAddTMInModal(false); setAddTMForm({ fullName: "", email: "", password: "" }); }} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sidebar-nav-toggle:hover:not(.active) {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          transition: all 0.3s ease;
        }
        .sidebar-nav-toggle.active:hover { opacity: 0.92; transform: translateY(-1px); }
        .sidebar-nav-toggle { transition: all 0.3s ease; }
        .header-profile-btn:focus, .header-profile-btn:focus-visible { outline: none !important; box-shadow: none !important; }
        @media (max-width: 768px) {
          .bm-dashboard-cards { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
