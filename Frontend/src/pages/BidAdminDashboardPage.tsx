import { ArrowRight, ChevronDown, ChevronRight, FileUp, FolderKanban, FolderOpen, LayoutDashboard, LogOut, Mail, Search, Sparkles, UserCircle, Users } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import cacheLogo from "../assets/Cache-Logo.png";
import womenOwnedLogo from "../assets/women-owned-logo.png";
import { API_BASE_URL } from "../config";

interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

interface BidManagerCard {
  id: number;
  fullName: string;
  email: string;
  role: string;
  technicalManagers: TeamMember[];
  teamProjectsUsed: number;
  teamProjectsLimit: number;
  teamProjectsLeft: number;
}

interface ProjectItem {
  id: number;
  project_name: string;
  tender_id: string | null;
  client_name: string | null;
  user_id: number | null;
}

type ViewMode = "teams" | "personal" | "members";

interface FlattenedMember {
  id: number;
  fullName: string;
  email: string;
  role: "Bid Manager" | "Technical Manager";
  teamName: string;
}

export default function BidAdminDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bidManagers, setBidManagers] = useState<BidManagerCard[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("teams");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("Bid Admin");
  const [personalProjects, setPersonalProjects] = useState<ProjectItem[]>([]);
  const [personalProjectsLoading, setPersonalProjectsLoading] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [teamPage, setTeamPage] = useState(1);
  const TEAMS_PER_PAGE = 8;
  const SIDEBAR_WIDTH = 240;

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
    if (role !== "bid_admin") {
      navigate("/home");
      return;
    }
    if (typeof parsed.id === "number") setCurrentUserId(parsed.id);
    if (parsed.fullName && typeof parsed.fullName === "string") setUserDisplayName(parsed.fullName);
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` } });
        if (!dashRes.ok) {
          toast.error("Failed to load dashboard data");
          return;
        }
        const dashData = await dashRes.json();
        if (dashData.success && dashData.bidManagers) {
          setBidManagers(dashData.bidManagers);
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
    setTeamPage(1);
  }, [teamSearch]);

  useEffect(() => {
    if (viewMode !== "personal" || currentUserId == null) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchPersonalProjects = async () => {
      setPersonalProjectsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          toast.error("Failed to load your projects");
          return;
        }
        const data = await res.json();
        const projects: ProjectItem[] = data.success && Array.isArray(data.projects) ? data.projects : [];
        setPersonalProjects(projects.filter((p) => p.user_id === currentUserId));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load your projects");
      } finally {
        setPersonalProjectsLoading(false);
      }
    };

    fetchPersonalProjects();
  }, [viewMode, currentUserId]);

  useEffect(() => {
    if (viewMode !== "members") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchAllProjects = async () => {
      setMembersLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          toast.error("Failed to load projects");
          return;
        }
        const data = await res.json();
        const projects: ProjectItem[] = data.success && Array.isArray(data.projects) ? data.projects : [];
        setAllProjects(projects);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load projects");
      } finally {
        setMembersLoading(false);
      }
    };

    fetchAllProjects();
  }, [viewMode]);

  const flattenedMembers: FlattenedMember[] = bidManagers.flatMap((bm) => {
    const bmEntry: FlattenedMember = {
      id: bm.id,
      fullName: bm.fullName,
      email: bm.email,
      role: "Bid Manager",
      teamName: bm.fullName,
    };
    const tms: FlattenedMember[] = (bm.technicalManagers || []).map((tm) => ({
      id: tm.id,
      fullName: tm.fullName,
      email: tm.email,
      role: "Technical Manager" as const,
      teamName: bm.fullName,
    }));
    return [bmEntry, ...tms];
  });

  const handleViewResult = (projectName: string) => {
    navigate(`/project-results/${encodeURIComponent(projectName)}`);
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


  const totalProjects = bidManagers.reduce((s, b) => s + b.teamProjectsUsed, 0);
  const totalPeople = bidManagers.reduce((s, b) => s + 1 + (b.technicalManagers?.length || 0), 0);

  const teamSearchLower = teamSearch.trim().toLowerCase();
  const filteredTeams = teamSearchLower
    ? bidManagers.filter(
      (bm) =>
        (bm.fullName || "").toLowerCase().includes(teamSearchLower) ||
        (bm.email || "").toLowerCase().includes(teamSearchLower)
    )
    : bidManagers;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredTeams.length / TEAMS_PER_PAGE));
  const paginatedTeams = filteredTeams.slice(
    (teamPage - 1) * TEAMS_PER_PAGE,
    teamPage * TEAMS_PER_PAGE
  );

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

  const NAVBAR_HEIGHT = 88;

  return (
    <div className="universal-page-wrapper" style={{ minHeight: "100vh" }}>
      {/* Top header - CoachPro style: Welcome left, Search/Bell/User right */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: NAVBAR_HEIGHT,
          zIndex: 120,
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.4) inset",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px 0 20px",
          borderBottom: "1px solid rgba(255,255,255,0.2)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={womenOwnedLogo} alt="Women Owned" style={{ height: 110, width: "auto", display: "block" }} />
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(102,126,234,0.4), 0 0 0 4px rgba(102,126,234,0.1)", animation: "pulse 3s ease-in-out infinite" }}>
            <Sparkles size={24} color="#fff" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }} />
          </div>
          <span style={{ fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em", filter: "drop-shadow(0 2px 4px rgba(102,126,234,0.1))" }}>Bid Intelligence</span>
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
              background: "linear-gradient(135deg, rgba(79,172,254,0.1) 0%, rgba(0,242,254,0.08) 100%)",
              border: "1px solid rgba(79,172,254,0.2)",
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
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(79,172,254,0.1) 0%, rgba(0,242,254,0.08) 100%)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            title="Account & security – Profile, two-step verification, change password"
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(79,172,254,0.3)" }}>
              {(userDisplayName || "A").charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0369a1" }}>{userDisplayName}</span>
          </button>
          <img src={cacheLogo} alt="Cache" style={{ height: 105, width: "auto", display: "block", marginLeft: 8 }} />
        </div>
      </header>

      {/* Side navbar - starts below top navbar */}
      <aside
        style={{
          position: "fixed",
          top: NAVBAR_HEIGHT,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          zIndex: 110,
          background: "rgba(248,250,252,0.7)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(226,232,240,0.6)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
        }}
      >
        <nav style={{ flex: 1, padding: "20px 10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Views
          </div>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "teams" ? " active" : ""}`}
            onClick={() => setViewMode("teams")}
            style={{
              ...navButtonBase,
              background: viewMode === "teams" ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.08) 100%)",
              color: viewMode === "teams" ? "#fff" : "#5b21b6",
              fontWeight: viewMode === "teams" ? 700 : 600,
              boxShadow: viewMode === "teams" ? "0 4px 12px rgba(102,126,234,0.3)" : "none",
              border: viewMode === "teams" ? "none" : "1px solid rgba(102,126,234,0.2)",
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
              background: viewMode === "personal" ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" : "linear-gradient(135deg, rgba(240,147,251,0.1) 0%, rgba(245,87,108,0.08) 100%)",
              color: viewMode === "personal" ? "#fff" : "#be185d",
              fontWeight: viewMode === "personal" ? 700 : 600,
              boxShadow: viewMode === "personal" ? "0 4px 12px rgba(240,147,251,0.3)" : "none",
              border: viewMode === "personal" ? "none" : "1px solid rgba(240,147,251,0.2)",
            }}
            title="My personal projects"
          >
            <FolderOpen size={20} style={{ flexShrink: 0 }} />
            <span>My personal projects</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "members" ? " active" : ""}`}
            onClick={() => setViewMode("members")}
            style={{
              ...navButtonBase,
              background: viewMode === "members" ? "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" : "linear-gradient(135deg, rgba(79,172,254,0.1) 0%, rgba(0,242,254,0.08) 100%)",
              color: viewMode === "members" ? "#fff" : "#0369a1",
              fontWeight: viewMode === "members" ? 700 : 600,
              boxShadow: viewMode === "members" ? "0 4px 12px rgba(79,172,254,0.3)" : "none",
              border: viewMode === "members" ? "none" : "1px solid rgba(79,172,254,0.2)",
            }}
            title="All members and their projects"
          >
            <UserCircle size={20} style={{ flexShrink: 0 }} />
            <span>All members</span>
          </button>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent 0%, rgba(102,126,234,0.5) 50%, transparent 100%)", margin: "12px 0" }} />
          <div style={{ fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Actions
          </div>
          <button
            type="button"
            className="sidebar-nav-toggle"
            onClick={() => navigate("/upload")}
            style={{
              ...navButtonBase,
              background: "linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.08) 100%)",
              color: "#b45309",
              border: "1px solid rgba(251,191,36,0.2)",
            }}
            title="Upload & Analyze"
          >
            <FileUp size={20} style={{ flexShrink: 0 }} />
            <span>Upload & Analyze</span>
          </button>
          <button
            type="button"
            className="sidebar-nav-toggle"
            onClick={() => navigate("/team")}
            style={{
              ...navButtonBase,
              background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(22,163,74,0.08) 100%)",
              color: "#15803d",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
            title="Manage Teams"
          >
            <Users size={20} style={{ flexShrink: 0 }} />
            <span>Manage Teams</span>
          </button>
          <button
            type="button"
            className="sidebar-nav-toggle"
            onClick={() => navigate("/team-quota")}
            style={{
              ...navButtonBase,
              background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.1) 100%)",
              color: "#7c3aed",
              border: "1px solid rgba(139,92,246,0.25)",
            }}
            title="View total quota usage"
          >
            <FolderKanban size={20} style={{ flexShrink: 0 }} />
            <span>Team Quota</span>
          </button>
        </nav>
        <div style={{ padding: "12px 10px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...navButtonBase,
              color: "#b91c1c",
            }}
            title="Logout"
          >
            <LogOut size={20} style={{ flexShrink: 0 }} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div style={{ position: "fixed", inset: 0, top: NAVBAR_HEIGHT, left: SIDEBAR_WIDTH, right: 0, bottom: 0, zIndex: 0, overflow: "hidden" }}>
        {/* Animated gradient overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(160deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.12) 25%, rgba(240,147,251,0.15) 50%, rgba(79,172,254,0.12) 75%, rgba(0,242,254,0.15) 100%)",
          animation: "pulse 8s ease-in-out infinite"
        }} />

        {/* Floating geometric shapes */}
        <div className="background-shape" style={{
          top: "10%",
          left: "15%",
          width: 300,
          height: 300,
          background: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.1) 100%)",
          borderRadius: "50%",
          filter: "blur(40px)",
          animation: "float 20s ease-in-out infinite"
        }} />

        <div className="background-shape" style={{
          top: "60%",
          right: "10%",
          width: 250,
          height: 250,
          background: "linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(219,39,119,0.1) 100%)",
          borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
          filter: "blur(35px)",
          animation: "floatSlow 25s ease-in-out infinite reverse"
        }} />

        <div className="background-shape" style={{
          bottom: "15%",
          left: "25%",
          width: 200,
          height: 200,
          background: "linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(6,182,212,0.15) 100%)",
          borderRadius: "50%",
          filter: "blur(30px)",
          animation: "float 18s ease-in-out infinite 5s"
        }} />

        <div className="background-shape" style={{
          top: "30%",
          right: "30%",
          width: 180,
          height: 180,
          background: "linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.1) 100%)",
          transform: "rotate(45deg)",
          filter: "blur(25px)",
          animation: "rotate 40s linear infinite"
        }} />

        {/* Particle effects */}
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="background-particle"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              background: `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.3})`,
              animation: `float ${Math.random() * 10 + 15}s ease-in-out infinite ${Math.random() * 5}s`,
              filter: "blur(1px)"
            }}
          />
        ))}

        {/* Glassmorphic overlay for better content readability */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255, 255, 255, 0.3)",
          backdropFilter: "blur(2px)"
        }} />
      </div>

      <main style={{ position: "relative", zIndex: 1, marginLeft: SIDEBAR_WIDTH, padding: `${NAVBAR_HEIGHT + 28}px 28px 48px`, transition: "margin-left 0.25s ease" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          {/* Page title - CoachPro style left-aligned */}
          <div style={{ marginBottom: 28, textAlign: "left" }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {viewMode === "teams" ? "Dashboard" : viewMode === "personal" ? "My personal projects" : "All members"}
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              {viewMode === "teams"
                ? "Projects per team, people working on them, and view any project result."
                : viewMode === "personal"
                  ? "Projects you created or own. View results for any project."
                  : "See every Bid Manager and Technical Manager, their team, and which projects they are working on."}
            </p>
          </div>

          {viewMode === "teams" && loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
              <span style={{ color: "#64748b", fontSize: 15 }}>Loading dashboard…</span>
            </div>
          ) : viewMode === "personal" ? (
            <>
              {personalProjectsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ color: "#64748b", fontSize: 15 }}>Loading your projects…</span>
                </div>
              ) : (
                <section>
                  <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(20,184,166,0.12) 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(13,148,136,0.25)" }}>
                      <FolderOpen size={18} color="#0d9488" />
                    </span>
                    My personal projects ({personalProjects.length})
                  </h2>
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                    {personalProjects.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                        You have no personal projects yet. Upload & analyze from the sidebar to create one.
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Project</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Tender ID</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Client</th>
                            <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "#475569" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalProjects.map((p) => (
                            <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.client_name || "—"}</td>
                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <button
                                  onClick={() => handleViewResult(p.project_name)}
                                  style={{
                                    padding: "8px 16px",
                                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: 13,
                                    boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
                                  }}
                                >
                                  View result
                                </button>
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
          ) : viewMode === "members" ? (
            <>
              {membersLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
                  <span style={{ color: "#64748b", fontSize: 15 }}>Loading members and projects…</span>
                </div>
              ) : (
                <section>
                  <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(20,184,166,0.12) 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(13,148,136,0.25)" }}>
                      <UserCircle size={18} color="#0d9488" />
                    </span>
                    All members ({flattenedMembers.length})
                  </h2>
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                    {flattenedMembers.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                        No Bid Managers or Technical Managers yet. They can sign up from the signup page.
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Member</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13, width: 140 }}>Role</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13, width: 160 }}>Team</th>
                            <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Projects</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flattenedMembers.map((m) => {
                            const memberProjects = allProjects.filter((p) => p.user_id === m.id);
                            return (
                              <tr key={m.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "14px 16px" }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{m.fullName}</div>
                                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                                    <Mail size={11} /> {m.email}
                                  </div>
                                </td>
                                <td style={{ padding: "14px 16px" }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: m.role === "Bid Manager" ? "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(99,102,241,0.1) 100%)" : "linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(16,185,129,0.1) 100%)",
                                      color: m.role === "Bid Manager" ? "#4338ca" : "#047857",
                                      border: m.role === "Bid Manager" ? "1px solid rgba(79,70,229,0.25)" : "1px solid rgba(5,150,105,0.25)",
                                    }}
                                  >
                                    {m.role}
                                  </span>
                                </td>
                                <td style={{ padding: "14px 16px", fontSize: 13, color: "#475569" }}>{m.teamName}</td>
                                <td style={{ padding: "14px 16px" }}>
                                  {memberProjects.length === 0 ? (
                                    <span style={{ fontSize: 13, color: "#94a3b8" }}>No projects</span>
                                  ) : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {memberProjects.map((p) => (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => handleViewResult(p.project_name)}
                                          style={{
                                            padding: "6px 12px",
                                            background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: 6,
                                            fontWeight: 600,
                                            fontSize: 12,
                                            cursor: "pointer",
                                            boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
                                            transition: "transform 0.2s, box-shadow 0.2s",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "translateY(-1px)";
                                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(79,70,229,0.35)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(79,70,229,0.25)";
                                          }}
                                        >
                                          {p.project_name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              {/* Metric cards - CoachPro style */}
              {bidManagers.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 28 }}>
                  <div style={{ padding: "22px 20px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(13,148,136,0.3)" }}>
                      <Users size={26} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{bidManagers.length}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Teams</div>
                    </div>
                  </div>
                  <div style={{ padding: "22px 20px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                      <FolderKanban size={26} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{totalProjects}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Total projects</div>
                    </div>
                  </div>
                  <div style={{ padding: "22px 20px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(245,158,11,0.3)" }}>
                      <UserCircle size={26} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{totalPeople}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>People</div>
                    </div>
                  </div>
                </div>
              )}

              <section style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                <div style={{ padding: "18px 22px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(20,184,166,0.12) 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(13,148,136,0.25)" }}>
                      <FolderKanban size={18} color="#0d9488" />
                    </span>
                    Teams
                  </h2>
                  <div style={{ position: "relative", minWidth: 220 }}>
                    <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 40px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        fontSize: 14,
                        color: "#0f172a",
                        background: "#fff",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {bidManagers.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                    <UserCircle size={40} style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }} />
                    No Bid Managers yet. They can sign up at the signup page.
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px", minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Team</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13, width: "20%" }}>Projects</th>
                            <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "#475569", fontSize: 13, width: 140 }}>People</th>
                            <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, width: 160 }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTeams.map((bm) => {
                            const pct = Math.min(100, (bm.teamProjectsUsed / bm.teamProjectsLimit) * 100);
                            const initial = (bm.fullName || "?").charAt(0).toUpperCase();
                            const peopleCount = 1 + (bm.technicalManagers?.length || 0);
                            const isExpanded = expandedTeamId === bm.id;
                            return (
                              <Fragment key={bm.id}>
                                <tr
                                  style={{
                                    borderBottom: "1px solid #e2e8f0",
                                    background: isExpanded ? "#f8fafc" : undefined,
                                    transition: "background 0.15s",
                                  }}
                                >
                                  <td style={{ padding: "16px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTeamId(isExpanded ? null : bm.id)}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          padding: 4,
                                          cursor: "pointer",
                                          color: "#64748b",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                        aria-label={isExpanded ? "Collapse" : "Expand"}
                                      >
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                      </button>
                                      <div
                                        style={{
                                          width: 36,
                                          height: 36,
                                          borderRadius: 10,
                                          background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                          color: "#fff",
                                          fontSize: 14,
                                          fontWeight: 700,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          boxShadow: "0 2px 8px rgba(79,70,229,0.2)",
                                        }}
                                      >
                                        {initial}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{bm.fullName}</div>
                                        <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                                          <Mail size={11} /> {bm.email}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: "16px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}>
                                        <div
                                          style={{
                                            height: "100%",
                                            width: `${pct}%`,
                                            borderRadius: 3,
                                            background: bm.teamProjectsLeft === 0 ? "linear-gradient(90deg, #ef4444, #dc2626)" : "linear-gradient(90deg, #10b981, #059669)",
                                          }}
                                        />
                                      </div>
                                      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
                                        {bm.teamProjectsUsed}/{bm.teamProjectsLimit}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{bm.teamProjectsLeft} left</div>
                                  </td>
                                  <td style={{ padding: "16px 20px 16px 24px", textAlign: "center", paddingRight: 32, minWidth: 140 }}>
                                    <button
                                      type="button"
                                      className="people-toggle-btn"
                                      onClick={() => setExpandedTeamId(isExpanded ? null : bm.id)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "8px 14px",
                                        background: isExpanded ? "linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(99,102,241,0.12) 100%)" : "linear-gradient(135deg, rgba(238,242,255,0.9) 0%, rgba(224,231,255,0.8) 100%)",
                                        border: "1px solid rgba(99,102,241,0.35)",
                                        borderRadius: 10,
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: 13,
                                        color: "#4338ca",
                                        transition: "all 0.2s",
                                        boxShadow: isExpanded ? "0 2px 8px rgba(79,70,229,0.15)" : "0 1px 3px rgba(79,70,229,0.08)",
                                      }}
                                      title={isExpanded ? "Hide who's working" : "Show who's working on this team"}
                                    >
                                      <span style={{ color: "#3730a3", fontWeight: 700 }}>{peopleCount}</span>
                                      <span style={{ color: "#4338ca", fontSize: 12 }}>people</span>
                                      {isExpanded ? <ChevronDown size={14} color="#4f46e5" /> : <ChevronRight size={14} color="#4f46e5" />}
                                    </button>
                                  </td>
                                  <td style={{ padding: "16px 24px 16px 32px", textAlign: "right", minWidth: 160 }}>
                                    <button
                                      onClick={() => navigate(`/team-projects/${bm.id}`)}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "8px 14px",
                                        background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
                                        transition: "transform 0.2s, box-shadow 0.2s",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "translateY(-1px)";
                                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(79,70,229,0.4)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(79,70,229,0.3)";
                                      }}
                                    >
                                      View projects <ArrowRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                    <td colSpan={4} style={{ padding: "12px 16px 16px 56px" }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>People on this team</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                                          <UserCircle size={16} color="#4f46e5" />
                                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{bm.fullName}</span>
                                          <span style={{ fontSize: 11, color: "#64748b" }}>Bid Manager</span>
                                        </div>
                                        {(bm.technicalManagers || []).map((tm) => (
                                          <div key={tm.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                                            <UserCircle size={16} color="#059669" />
                                            <span style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>{tm.fullName}</span>
                                            <span style={{ fontSize: 11, color: "#64748b" }}>{tm.email}</span>
                                          </div>
                                        ))}
                                        {(bm.technicalManagers || []).length === 0 && (
                                          <span style={{ fontSize: 13, color: "#94a3b8" }}>No Technical Managers yet</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {totalFilteredPages > 1 && (
                      <div style={{ padding: "14px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "#64748b" }}>
                          Showing {(teamPage - 1) * TEAMS_PER_PAGE + 1}–{Math.min(teamPage * TEAMS_PER_PAGE, filteredTeams.length)} of {filteredTeams.length} teams
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                            disabled={teamPage <= 1}
                            style={{
                              padding: "8px 14px",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              background: teamPage <= 1 ? "#f1f5f9" : "#fff",
                              color: teamPage <= 1 ? "#94a3b8" : "#475569",
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: teamPage <= 1 ? "not-allowed" : "pointer",
                            }}
                          >
                            Previous
                          </button>
                          <span style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#475569" }}>
                            Page {teamPage} of {totalFilteredPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTeamPage((p) => Math.min(totalFilteredPages, p + 1))}
                            disabled={teamPage >= totalFilteredPages}
                            style={{
                              padding: "8px 14px",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              background: teamPage >= totalFilteredPages ? "#f1f5f9" : "#fff",
                              color: teamPage >= totalFilteredPages ? "#94a3b8" : "#475569",
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: teamPage >= totalFilteredPages ? "not-allowed" : "pointer",
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sidebar-nav-toggle:hover:not(.active) {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          transition: all 0.3s ease;
        }
        .sidebar-nav-toggle.active:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .sidebar-nav-toggle {
          transition: all 0.3s ease;
        }
        .header-profile-btn:focus,
        .header-profile-btn:focus-visible { outline: none !important; box-shadow: none !important; }
        .people-toggle-btn:hover {
          background: linear-gradient(135deg, rgba(102,126,234,0.25) 0%, rgba(118,75,162,0.2) 100%) !important;
          border-color: rgba(102,126,234,0.5) !important;
          box-shadow: 0 4px 12px rgba(102,126,234,0.25) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
