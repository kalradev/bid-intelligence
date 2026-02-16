import { ArrowRight, ChevronDown, ChevronRight, FileUp, FolderKanban, FolderOpen, LayoutDashboard, LogOut, Mail, Search, Sparkles, UserCircle, Users, UserPlus, X } from "lucide-react";
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
  const [showCreateBidManagerForm, setShowCreateBidManagerForm] = useState(false);
  const [createBidManagerForm, setCreateBidManagerForm] = useState({ fullName: "", email: "", password: "" });
  const [createBidManagerLoading, setCreateBidManagerLoading] = useState(false);
  const [activeToggle, setActiveToggle] = useState<"projects" | "people" | "personal" | null>(null);
  const [expandedBmIdForProjects, setExpandedBmIdForProjects] = useState<number | null>(null);
  const [expandedBmIdForPeople, setExpandedBmIdForPeople] = useState<number | null>(null);
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<ViewMode | null>(null);
  const TEAMS_PER_PAGE = 8;
  const SIDEBAR_WIDTH = 240;

  const handleViewChange = (nextMode: ViewMode) => {
    if (nextMode === viewMode) return;
    setPendingViewMode(nextMode);
    setIsViewTransitioning(true);
    setTimeout(() => {
      setViewMode(nextMode);
    }, 350);
  };

  // Hide blur overlay only when the switched-to view's data has finished loading
  useEffect(() => {
    if (!isViewTransitioning || pendingViewMode === null) return;
    if (viewMode !== pendingViewMode) return;
    const dataReady =
      pendingViewMode === "teams"
        ? !loading
        : pendingViewMode === "personal"
          ? !personalProjectsLoading
          : !membersLoading;
    if (dataReady) {
      setIsViewTransitioning(false);
      setPendingViewMode(null);
    }
  }, [isViewTransitioning, pendingViewMode, viewMode, loading, personalProjectsLoading, membersLoading]);

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
        // Full list fetched; Admin projects view filters to projects owned by current user (user_id === currentUserId)
        setPersonalProjects(projects);
      } catch (e) {
        console.error(e);
        if (viewMode === "personal") toast.error("Failed to load your projects");
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

  const handleCreateBidManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    
    if (!createBidManagerForm.fullName.trim() || !createBidManagerForm.email.trim() || !createBidManagerForm.password.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    
    if (createBidManagerForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setCreateBidManagerLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: createBidManagerForm.fullName.trim(),
          email: createBidManagerForm.email.trim(),
          password: createBidManagerForm.password,
          role: "bid_manager"
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Bid Manager created successfully");
        setCreateBidManagerForm({ fullName: "", email: "", password: "" });
        setShowCreateBidManagerForm(false);
        // Refresh dashboard data
        const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` } });
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          if (dashData.success && dashData.bidManagers) {
            setBidManagers(dashData.bidManagers);
          }
        }
      } else {
        toast.error(data.detail || data.message || "Failed to create Bid Manager");
      }
    } catch (e) {
      console.error(e);
      toast.error("Request failed");
    } finally {
      setCreateBidManagerLoading(false);
    }
  };


  const totalProjects = bidManagers.reduce((s, b) => s + b.teamProjectsUsed, 0);
  const totalPeople = bidManagers.reduce((s, b) => s + 1 + (b.technicalManagers?.length || 0), 0);
  const adminProjects = currentUserId != null ? personalProjects.filter((p) => p.user_id === currentUserId) : [];
  const totalQuotaLeft = bidManagers.reduce((s, b) => s + (b.teamProjectsLeft ?? 0), 0);
  const totalQuotaLimit = bidManagers.reduce((s, b) => s + (b.teamProjectsLimit ?? 0), 0);
  const quotaLeftPercent = totalQuotaLimit > 0 ? (totalQuotaLeft / totalQuotaLimit) * 100 : 100;
  const isQuotaLow = totalQuotaLeft === 0 || quotaLeftPercent < 50;

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
    color: "#2d3319",
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
          background: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
          borderBottom: "1px solid rgba(255,255,255,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px 0 20px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={womenOwnedLogo} alt="Women Owned" style={{ height: 110, width: "auto", display: "block" }} />
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <Sparkles size={24} color="#5a6340" style={{ flexShrink: 0 }} />
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
            title="Account & security – Profile, two-step verification, change password"
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FF8F8F", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,143,143,0.3)" }}>
              {(userDisplayName || "A").charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2d3319" }}>{userDisplayName}</span>
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
          background: "rgba(234,239,239,0.95)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,143,143,0.2)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.04)",
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
            className={`sidebar-nav-toggle${viewMode === "teams" ? " active" : ""}`}
            onClick={() => handleViewChange("teams")}
            style={{
              ...navButtonBase,
              background: viewMode === "teams" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "teams" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "teams" ? 700 : 600,
              boxShadow: viewMode === "teams" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "teams" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="Dashboard"
          >
            <LayoutDashboard size={20} style={{ flexShrink: 0 }} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "personal" ? " active" : ""}`}
            onClick={() => handleViewChange("personal")}
            style={{
              ...navButtonBase,
              background: viewMode === "personal" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "personal" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "personal" ? 700 : 600,
              boxShadow: viewMode === "personal" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "personal" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="Admin projects"
          >
            <FolderOpen size={20} style={{ flexShrink: 0 }} />
            <span>Admin projects</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "members" ? " active" : ""}`}
            onClick={() => handleViewChange("members")}
            style={{
              ...navButtonBase,
              background: viewMode === "members" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "members" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "members" ? 700 : 600,
              boxShadow: viewMode === "members" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "members" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="All members and their projects"
          >
            <UserCircle size={20} style={{ flexShrink: 0 }} />
            <span>All members</span>
          </button>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent 0%, rgba(255,143,143,0.4) 50%, transparent 100%)", margin: "12px 0" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5a6340", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Actions
          </div>
          <button
            type="button"
            className="sidebar-nav-toggle"
            onClick={() => navigate("/upload")}
            style={{
              ...navButtonBase,
              background: "rgba(255,179,179,0.4)",
              color: "#2d3319",
              border: "1px solid rgba(255,143,143,0.3)",
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
              background: "rgba(255,179,179,0.4)",
              color: "#2d3319",
              border: "1px solid rgba(255,143,143,0.3)",
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
              background: "rgba(255,179,179,0.4)",
              color: "#2d3319",
              border: "1px solid rgba(255,143,143,0.3)",
            }}
            title="View total quota usage"
          >
            <FolderKanban size={20} style={{ flexShrink: 0 }} />
            <span>Team Quota</span>
          </button>
        </nav>
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,143,143,0.2)", display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...navButtonBase,
              color: "#6b5344",
            }}
            title="Logout"
          >
            <LogOut size={20} style={{ flexShrink: 0 }} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div style={{ position: "fixed", inset: 0, top: NAVBAR_HEIGHT, left: SIDEBAR_WIDTH, right: 0, bottom: 0, zIndex: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(160deg, rgba(250,243,225,0.6) 0%, rgba(234,239,239,0.5) 50%, rgba(255,179,179,0.2) 100%)",
          animation: "pulse 8s ease-in-out infinite"
        }} />
        <div className="background-shape" style={{
          top: "10%", left: "15%", width: 300, height: 300,
          background: "rgba(255,179,179,0.35)", borderRadius: "50%", filter: "blur(40px)",
          animation: "float 20s ease-in-out infinite"
        }} />
        <div className="background-shape" style={{
          top: "60%", right: "10%", width: 250, height: 250,
          background: "rgba(255,143,143,0.2)", borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%", filter: "blur(35px)",
          animation: "floatSlow 25s ease-in-out infinite reverse"
        }} />
        <div className="background-shape" style={{
          bottom: "15%", left: "25%", width: 200, height: 200,
          background: "rgba(234,239,239,0.5)", borderRadius: "50%", filter: "blur(30px)",
          animation: "float 18s ease-in-out infinite 5s"
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(255, 255, 255, 0.25)",
          backdropFilter: "blur(2px)"
        }} />
      </div>

      {(isViewTransitioning ||
          (viewMode === "teams" && loading) ||
          (viewMode === "personal" && personalProjectsLoading) ||
          (viewMode === "members" && membersLoading)) && (
        <div
          style={{
            position: "fixed",
            top: NAVBAR_HEIGHT,
            left: SIDEBAR_WIDTH,
            right: 0,
            bottom: 0,
            zIndex: 50,
            background: "rgba(250, 243, 225, 0.6)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
          aria-live="polite"
          aria-busy="true"
        >
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: "#5a6340" }}>Loading…</span>
        </div>
      )}

      <main style={{ position: "relative", zIndex: 1, marginLeft: SIDEBAR_WIDTH, padding: `${NAVBAR_HEIGHT + 28}px 28px 48px` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          {/* Page title - CoachPro style; Dashboard view: title left, Quota left right */}
          <div style={{
            marginBottom: 28,
            textAlign: "left",
            ...(viewMode === "teams" && !loading && (bidManagers.length > 0 || currentUserId != null)
              ? { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }
              : {}),
          }}>
            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {viewMode === "teams" ? "Dashboard" : viewMode === "personal" ? "Admin projects" : "All members"}
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                {viewMode === "teams"
                  ? "Projects per team, people working on them, and view any project result."
                  : viewMode === "personal"
                    ? "Projects you created or own as Bid Admin. View results for any project."
                    : "See every Bid Manager and Technical Manager, their team, and which projects they are working on."}
              </p>
            </div>
            {viewMode === "teams" && !loading && (bidManagers.length > 0 || currentUserId != null) && (
              <button
                type="button"
                onClick={() => navigate("/team-quota")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 20px",
                  background: isQuotaLow ? "rgba(180,120,100,0.2)" : "rgba(255,143,143,0.35)",
                  border: isQuotaLow ? "1px solid rgba(150,90,70,0.3)" : "1px solid rgba(255,143,143,0.5)",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 15,
                  color: isQuotaLow ? "#6b5344" : "#2d3319",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  transition: "all 0.2s",
                  outline: "none",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                }}
                title="View team quota details"
              >
                <span style={{ opacity: 0.9 }}>Quota left</span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{totalQuotaLeft}</span>
              </button>
            )}
          </div>

          {viewMode === "teams" && loading ? null : viewMode === "personal" ? (
            <section>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: "#EAEFEF", display: "inline-flex", alignItems: "center", justifyContent: "center", borderLeft: "3px solid #5a6340" }}>
                  <FolderOpen size={18} color="#5a6340" />
                </span>
                Admin projects ({adminProjects.length})
              </h2>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                {personalProjectsLoading ? null : adminProjects.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                        No admin-owned projects yet. Upload & analyze to create projects as Bid Admin.
                      </div>
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
                          {adminProjects.map((p) => (
                            <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                              <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.client_name || "—"}</td>
                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
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
                                    boxShadow: "0 2px 8px rgba(255,143,143,0.3)",
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
          ) : viewMode === "members" ? (
            <section>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: "#FAF3E1", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,143,143,0.4)" }}>
                  <UserCircle size={18} color="#FF8F8F" />
                </span>
                All members ({flattenedMembers.length})
              </h2>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                {membersLoading ? null : flattenedMembers.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                        No Bid Managers or Technical Managers yet. Create them from this dashboard (Add Bid Manager).
                      </div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
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
                              <tr key={m.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
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
                                      background: m.role === "Bid Manager" ? "rgba(255,143,143,0.2)" : "rgba(255,179,179,0.3)",
                                      color: "#2d3319",
                                      border: m.role === "Bid Manager" ? "1px solid rgba(255,143,143,0.4)" : "1px solid rgba(255,179,179,0.5)",
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
                                            background: "#FF8F8F",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: 6,
                                            fontWeight: 600,
                                            fontSize: 12,
                                            cursor: "pointer",
                                            boxShadow: "0 2px 8px rgba(255,143,143,0.25)",
                                            transition: "transform 0.2s, box-shadow 0.2s",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "translateY(-1px)";
                                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.35)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,143,143,0.25)";
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
          ) : (
            <>
              {/* Metric cards - CoachPro style */}
              {(bidManagers.length > 0 || currentUserId != null) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 28 }}>
                  <button
                    type="button"
                    onClick={() => setActiveToggle(null)}
                    style={{
                      padding: "22px 20px",
                      background: activeToggle === null ? "rgba(255,143,143,0.15)" : "#fff",
                      borderRadius: 16,
                      border: activeToggle === null ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                      boxShadow: activeToggle === null ? "0 4px 16px rgba(255,143,143,0.2)" : "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      outline: "none",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (activeToggle !== null) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.15)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeToggle !== null) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                      }
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(145deg, #FF8F8F 0%, #E87878 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(232,120,120,0.4)" }}>
                      <Users size={26} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{bidManagers.length}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Teams</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveToggle(activeToggle === "projects" ? null : "projects")}
                    style={{
                      padding: "22px 20px",
                      background: activeToggle === "projects" ? "rgba(255,143,143,0.15)" : "#fff",
                      borderRadius: 16,
                      border: activeToggle === "projects" ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                      boxShadow: activeToggle === "projects" ? "0 4px 16px rgba(255,143,143,0.2)" : "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      outline: "none",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (activeToggle !== "projects") {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.15)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeToggle !== "projects") {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                      }
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FAF3E1", border: "2px solid #E87878", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(232,120,120,0.15)" }}>
                      <FolderKanban size={26} color="#E87878" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{totalProjects}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Total projects</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveToggle(activeToggle === "people" ? null : "people")}
                    style={{
                      padding: "22px 20px",
                      background: activeToggle === "people" ? "rgba(255,179,179,0.2)" : "#fff",
                      borderRadius: 16,
                      border: activeToggle === "people" ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                      boxShadow: activeToggle === "people" ? "0 4px 16px rgba(255,143,143,0.2)" : "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      outline: "none",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (activeToggle !== "people") {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.15)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeToggle !== "people") {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                      }
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FAF3E1", border: "1px solid rgba(255,143,143,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(250,243,225,0.8)" }}>
                      <UserCircle size={26} color="#FF8F8F" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{totalPeople}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>People</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveToggle(activeToggle === "personal" ? null : "personal")}
                    style={{
                      padding: "22px 20px",
                      background: activeToggle === "personal" ? "rgba(255,179,179,0.2)" : "#fff",
                      borderRadius: 16,
                      border: activeToggle === "personal" ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                      boxShadow: activeToggle === "personal" ? "0 4px 16px rgba(255,143,143,0.2)" : "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      outline: "none",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (activeToggle !== "personal") {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.15)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeToggle !== "personal") {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                      }
                    }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#EAEFEF", borderLeft: "4px solid #5a6340", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(90,99,64,0.12)" }}>
                      <FolderOpen size={26} color="#5a6340" />
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{adminProjects.length}</div>
                      <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>Admin projects</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Toggle Details Section */}
              {activeToggle && (
                <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "20px 24px", marginBottom: 24, position: "relative" }}>
                  {activeToggle === "projects" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#2d3319", display: "flex", alignItems: "center", gap: 10 }}>
                          <FolderKanban size={20} />
                          Total Projects Breakdown
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setActiveToggle(null); setExpandedBmIdForProjects(null); }}
                          style={{
                            padding: "6px",
                            background: "transparent",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f1f5f9";
                            e.currentTarget.style.color = "#475569";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#64748b";
                          }}
                          title="Close"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                        {bidManagers.map((bm) => {
                          const teamUserIds = [bm.id, ...(bm.technicalManagers || []).map((t) => t.id)];
                          const bmProjects = personalProjects.filter((p) => p.user_id != null && teamUserIds.includes(p.user_id));
                          const isExpanded = expandedBmIdForProjects === bm.id;
                          return (
                            <div key={bm.id}>
                              <button
                                type="button"
                                onClick={() => setExpandedBmIdForProjects(isExpanded ? null : bm.id)}
                                style={{
                                  width: "100%",
                                  padding: "14px 16px",
                                  background: isExpanded ? "rgba(255,143,143,0.12)" : "#f8fafc",
                                  borderRadius: 12,
                                  border: isExpanded ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  outline: "none",
                                  boxShadow: isExpanded ? "0 4px 12px rgba(255,143,143,0.15)" : "none",
                                }}
                              >
                                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{bm.fullName}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{bm.teamProjectsUsed}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>projects {isExpanded ? "▼" : "▶"}</div>
                              </button>
                              {isExpanded && (
                                <div style={{ marginTop: 12, padding: "16px", background: "#fff", borderRadius: 12, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 12 }}>{bm.fullName} – projects</div>
                                  {bmProjects.length === 0 ? (
                                    <div style={{ padding: "16px 0", color: "#94a3b8", fontSize: 13 }}>No projects yet.</div>
                                  ) : (
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                      <thead>
                                        <tr style={{ borderBottom: "2px solid #EAEFEF" }}>
                                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Project</th>
                                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Tender ID</th>
                                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#475569" }}>Action</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bmProjects.map((p) => (
                                          <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                            <td style={{ padding: "10px 12px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                              <button type="button" onClick={() => handleViewResult(p.project_name)} style={{ padding: "6px 12px", background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>View result</button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,143,143,0.15)", borderRadius: 12, border: "1px solid rgba(255,143,143,0.3)" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#2d3319" }}>Grand Total: {totalProjects} projects</div>
                      </div>
                    </div>
                  )}
                  {activeToggle === "people" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#b45309", display: "flex", alignItems: "center", gap: 10 }}>
                          <UserCircle size={20} />
                          Total People Breakdown
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setActiveToggle(null); setExpandedBmIdForPeople(null); }}
                          style={{
                            padding: "6px",
                            background: "transparent",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f1f5f9";
                            e.currentTarget.style.color = "#475569";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#64748b";
                          }}
                          title="Close"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                        {bidManagers.map((bm) => {
                          const peopleCount = 1 + (bm.technicalManagers?.length || 0);
                          const isExpanded = expandedBmIdForPeople === bm.id;
                          return (
                            <div key={bm.id}>
                              <button
                                type="button"
                                onClick={() => setExpandedBmIdForPeople(isExpanded ? null : bm.id)}
                                style={{
                                  width: "100%",
                                  padding: "14px 16px",
                                  background: isExpanded ? "rgba(255,179,179,0.15)" : "#f8fafc",
                                  borderRadius: 12,
                                  border: isExpanded ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  outline: "none",
                                  boxShadow: isExpanded ? "0 4px 12px rgba(255,143,143,0.15)" : "none",
                                }}
                              >
                                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{bm.fullName}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>{peopleCount}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                  {peopleCount === 1 ? "person" : "people"} {isExpanded ? "▼" : "▶"}
                                  <span style={{ marginLeft: 4, fontSize: 10, color: "#cbd5e1" }}>
                                    (1 BM + {bm.technicalManagers?.length || 0} TM)
                                  </span>
                                </div>
                              </button>
                              {isExpanded && (
                                <div style={{ marginTop: 12, padding: "16px", background: "#fff", borderRadius: 12, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 12 }}>{bm.fullName} – people</div>
                                  <ul style={{ margin: 0, paddingLeft: 20, color: "#0f172a", fontSize: 13 }}>
                                    <li style={{ marginBottom: 6 }}><strong>{bm.fullName}</strong> (Bid Manager)</li>
                                    {(bm.technicalManagers || []).map((tm) => (
                                      <li key={tm.id} style={{ marginBottom: 6 }}>{tm.fullName} – {tm.email} (Technical Manager)</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,179,179,0.2)", borderRadius: 12, border: "1px solid rgba(255,143,143,0.3)" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#2d3319" }}>Grand Total: {totalPeople} people</div>
                      </div>
                    </div>
                  )}
                  {activeToggle === "personal" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#be185d", display: "flex", alignItems: "center", gap: 10 }}>
                          <FolderOpen size={20} />
                          Admin projects
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveToggle(null)}
                          style={{
                            padding: "6px",
                            background: "transparent",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f1f5f9";
                            e.currentTarget.style.color = "#475569";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#64748b";
                          }}
                          title="Close"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      {personalProjectsLoading ? null : adminProjects.length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 14 }}>No admin-owned projects yet. Upload & analyze to create projects as Bid Admin.</div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Project</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Tender ID</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Client</th>
                                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13 }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminProjects.map((p) => (
                                <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a", fontSize: 13 }}>{p.project_name}</td>
                                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{p.tender_id || "—"}</td>
                                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{p.client_name || "—"}</td>
                                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleViewResult(p.project_name)}
                                      style={{
                                        padding: "8px 14px",
                                        background: "#FF8F8F",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontSize: 12,
                                        boxShadow: "0 2px 8px rgba(255,143,143,0.25)",
                                      }}
                                    >
                                      View result
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <section style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", marginBottom: 24 }}>
                <div style={{ padding: "18px 22px", borderBottom: "1px solid #EAEFEF", background: "#f8fafc", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#FAF3E1", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #E87878" }}>
                      <FolderKanban size={18} color="#E87878" />
                    </span>
                    Teams
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                          border: "1px solid #EAEFEF",
                          borderRadius: 10,
                          fontSize: 14,
                          color: "#0f172a",
                          background: "#fff",
                          outline: "none",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateBidManagerForm(!showCreateBidManagerForm);
                        // Reset form when toggling
                        if (!showCreateBidManagerForm) {
                          setCreateBidManagerForm({ fullName: "", email: "", password: "" });
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 16px",
                        background: showCreateBidManagerForm ? "#FF8F8F" : "rgba(255,179,179,0.6)",
                        color: showCreateBidManagerForm ? "#fff" : "#2d3319",
                        border: "1px solid rgba(255,143,143,0.4)",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        transition: "all 0.2s",
                        boxShadow: showCreateBidManagerForm ? "0 4px 12px rgba(255,143,143,0.3)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!showCreateBidManagerForm) {
                          e.currentTarget.style.background = "rgba(255,143,143,0.15)";
                          e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,143,143,0.15)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!showCreateBidManagerForm) {
                          e.currentTarget.style.background = "rgba(255,179,179,0.6)";
                          e.currentTarget.style.boxShadow = "none";
                        }
                      }}
                    >
                      <UserPlus size={16} />
                      {showCreateBidManagerForm ? "Cancel" : "Create Bid Manager"}
                    </button>
                  </div>
                </div>

                {showCreateBidManagerForm && (
                  <div style={{ padding: "20px 22px", borderBottom: "1px solid #EAEFEF", background: "rgba(234,239,239,0.6)" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#2d3319", display: "flex", alignItems: "center", gap: 8 }}>
                      <UserPlus size={18} />
                      Create New Bid Manager
                    </h3>
                    <form onSubmit={handleCreateBidManager} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500 }}>
                      <input
                        type="text"
                        name="bid-manager-fullname"
                        placeholder="Full Name"
                        value={createBidManagerForm.fullName}
                        onChange={(e) => setCreateBidManagerForm((f) => ({ ...f, fullName: e.target.value }))}
                        autoComplete="off"
                        data-form-type="other"
                        required
                        style={{
                          padding: "10px 14px",
                          border: "1px solid #EAEFEF",
                          borderRadius: 8,
                          fontSize: 14,
                          color: "#0f172a",
                          background: "#fff",
                          outline: "none",
                        }}
                      />
                      <input
                        type="text"
                        name="bid-manager-email"
                        placeholder="Email"
                        value={createBidManagerForm.email}
                        onChange={(e) => setCreateBidManagerForm((f) => ({ ...f, email: e.target.value }))}
                        autoComplete="off"
                        data-form-type="other"
                        required
                        style={{
                          padding: "10px 14px",
                          border: "1px solid #EAEFEF",
                          borderRadius: 8,
                          fontSize: 14,
                          color: "#0f172a",
                          background: "#fff",
                          outline: "none",
                        }}
                      />
                      <input
                        type="password"
                        name="bid-manager-password"
                        placeholder="Password (minimum 6 characters)"
                        value={createBidManagerForm.password}
                        onChange={(e) => setCreateBidManagerForm((f) => ({ ...f, password: e.target.value }))}
                        autoComplete="new-password"
                        data-form-type="other"
                        required
                        minLength={6}
                        style={{
                          padding: "10px 14px",
                          border: "1px solid #EAEFEF",
                          borderRadius: 8,
                          fontSize: 14,
                          color: "#0f172a",
                          background: "#fff",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="submit"
                          disabled={createBidManagerLoading}
                          style={{
                            padding: "10px 20px",
                            background: "#FF8F8F",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: createBidManagerLoading ? "not-allowed" : "pointer",
                            opacity: createBidManagerLoading ? 0.7 : 1,
                            boxShadow: "0 4px 12px rgba(255,143,143,0.3)",
                            transition: "all 0.2s",
                          }}
                        >
                          {createBidManagerLoading ? "Creating..." : "Create Bid Manager"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateBidManagerForm(false);
                            setCreateBidManagerForm({ fullName: "", email: "", password: "" });
                          }}
                          style={{
                            padding: "10px 20px",
                            background: "#fff",
                            color: "#64748b",
                            border: "1px solid #EAEFEF",
                            borderRadius: 8,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {bidManagers.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                    <UserCircle size={40} style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }} />
                    No Bid Managers yet. Create them from this dashboard (Add Bid Manager).
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px", minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
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
                                    borderBottom: "1px solid #EAEFEF",
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
                                          background: "#FF8F8F",
                                          color: "#fff",
                                          fontSize: 14,
                                          fontWeight: 700,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          boxShadow: "0 2px 8px rgba(255,143,143,0.2)",
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
                                      <div style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 3, background: "#EAEFEF", overflow: "hidden" }}>
                                        <div
                                          style={{
                                            height: "100%",
                                            width: `${pct}%`,
                                            borderRadius: 3,
                                            background: bm.teamProjectsLeft === 0 ? "linear-gradient(90deg, #b8956b, #a08050)" : "linear-gradient(90deg, #FF8F8F, #E87878)",
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
                                        background: isExpanded ? "rgba(255,143,143,0.15)" : "rgba(250,243,225,0.9)",
                                        border: "1px solid rgba(255,143,143,0.4)",
                                        borderRadius: 10,
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: 13,
                                        color: "#2d3319",
                                        transition: "all 0.2s",
                                        boxShadow: isExpanded ? "0 2px 8px rgba(255,143,143,0.15)" : "0 1px 3px rgba(255,143,143,0.1)",
                                      }}
                                      title={isExpanded ? "Hide who's working" : "Show who's working on this team"}
                                    >
                                      <span style={{ color: "#3730a3", fontWeight: 700 }}>{peopleCount}</span>
                                      <span style={{ color: "#2d3319", fontSize: 12 }}>people</span>
                                      {isExpanded ? <ChevronDown size={14} color="#5a6340" /> : <ChevronRight size={14} color="#5a6340" />}
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
                                        background: "#FF8F8F",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(255,143,143,0.3)",
                                        transition: "transform 0.2s, box-shadow 0.2s",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "translateY(-1px)";
                                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(255,143,143,0.4)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.3)";
                                      }}
                                    >
                                      View projects <ArrowRight size={14} />
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #EAEFEF" }}>
                                    <td colSpan={4} style={{ padding: "12px 16px 16px 56px" }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>People on this team</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #EAEFEF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                                          <UserCircle size={16} color="#5a6340" />
                                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{bm.fullName}</span>
                                          <span style={{ fontSize: 11, color: "#64748b" }}>Bid Manager</span>
                                        </div>
                                        {(bm.technicalManagers || []).map((tm) => (
                                          <div key={tm.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #EAEFEF", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
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
                      <div style={{ padding: "14px 20px", borderTop: "1px solid #EAEFEF", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
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
                              border: "1px solid #EAEFEF",
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
                              border: "1px solid #EAEFEF",
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
          background: rgba(255,179,179,0.4) !important;
          border-color: rgba(255,143,143,0.5) !important;
          box-shadow: 0 4px 12px rgba(255,143,143,0.2) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
