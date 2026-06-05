import { Archive, ArchiveRestore, ArrowRight, ChevronDown, ChevronRight, FileUp, FolderKanban, FolderOpen, LayoutDashboard, LogOut, Mail, Search, Star, UserCircle, Users, UserPlus, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
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

type ViewMode = "teams" | "personal" | "members" | "archived" | "create_user";

interface FlattenedMember {
  id: number;
  fullName: string;
  email: string;
  role: "Bid Manager" | "Technical Manager" | "Bid Admin";
  teamName: string;
}

export default function BidAdminDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bidManagers, setBidManagers] = useState<BidManagerCard[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("teams");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("Bid Admin");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [personalProjects, setPersonalProjects] = useState<ProjectItem[]>([]);
  const [personalProjectsLoading, setPersonalProjectsLoading] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<ProjectItem[]>([]);
  const [archivedProjectsLoading, setArchivedProjectsLoading] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [teamPage, setTeamPage] = useState(1);
  type CreateUserType = "bid_manager" | "technical_manager";
  const [createUserType, setCreateUserType] = useState<CreateUserType>("bid_manager");
  const [createUserForm, setCreateUserForm] = useState({ fullName: "", email: "", password: "" });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [activeToggle, setActiveToggle] = useState<"projects" | "people" | "personal" | null>(null);
  const [expandedBmIdForProjects, setExpandedBmIdForProjects] = useState<number | null>(null);
  const [showGrandTotalProjects, setShowGrandTotalProjects] = useState(false);
  const [expandedBmIdForPeople, setExpandedBmIdForPeople] = useState<number | null>(null);
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<ViewMode | null>(null);
  const [orgQuota, setOrgQuota] = useState<{ teamProjectsUsed: number; teamProjectsLimit: number; teamProjectsLeft: number; baseLimit?: number; purchasedQuota?: number } | null>(null);
  type TeamsViewFilter = "bid_manager" | "technical_manager" | "project" | "admin";
  const [teamsViewFilter, setTeamsViewFilter] = useState<TeamsViewFilter>("bid_manager");
  const [tmAssignments, setTmAssignments] = useState<Array<{ id: number; fullName: string; email: string; role: string; assignedProjects: Array<{ id: number; project_name: string; tender_id?: string; client_name?: string }> }>>([]);
  const [tmAssignmentsLoading, setTmAssignmentsLoading] = useState(false);
  const [projectsForFilter, setProjectsForFilter] = useState<Array<{ id: number; project_name: string; tender_id?: string; client_name?: string; user_id?: number; assigned_users?: Array<{ id: number; fullName: string; email: string; role: string }> }>>([]);
  const [projectsForFilterLoading, setProjectsForFilterLoading] = useState(false);
  const [assignModalProject, setAssignModalProject] = useState<string | null>(null);
  const [assignModalAssignedIds, setAssignModalAssignedIds] = useState<number[]>([]);
  const [assignableUsersForModal, setAssignableUsersForModal] = useState<Array<{ id: number; fullName: string; email: string; role?: string }>>([]);
  const [assignModalSaving, setAssignModalSaving] = useState(false);
  const [archiveConfirmProjectId, setArchiveConfirmProjectId] = useState<number | null>(null);
  const [archiveConfirmStep, setArchiveConfirmStep] = useState<0 | 1>(0);
  const [createUserSuccessPopup, setCreateUserSuccessPopup] = useState<{ fullName: string; roleLabel: string } | null>(null);
  const [createUserErrorPopup, setCreateUserErrorPopup] = useState<string | null>(null);
  const [finalBidModal, setFinalBidModal] = useState<{ projectId: number; projectName: string } | null>(null);
  const [finalBidFile, setFinalBidFile] = useState<File | null>(null);
  const [finalBidDescription, setFinalBidDescription] = useState("");
  const [finalBidUploading, setFinalBidUploading] = useState(false);
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
          : pendingViewMode === "members"
            ? !membersLoading
            : pendingViewMode === "archived"
              ? !archivedProjectsLoading
              : pendingViewMode === "create_user"
                ? true
                : true;
    if (dataReady) {
      setIsViewTransitioning(false);
      setPendingViewMode(null);
    }
  }, [isViewTransitioning, pendingViewMode, viewMode, loading, personalProjectsLoading, membersLoading, archivedProjectsLoading]);

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
    if (typeof (parsed as { email?: string }).email === "string") setCurrentUserEmail((parsed as { email?: string }).email);
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!dashRes.ok) {
          toast.error("Failed to load dashboard data");
          return;
        }
        const dashData = await dashRes.json();
        if (dashData.success && dashData.bidManagers) {
          setBidManagers(dashData.bidManagers);
        }
        if (dashData.success && dashData.orgQuota) {
          const oq = dashData.orgQuota;
          setOrgQuota({
            teamProjectsUsed: oq.teamProjectsUsed ?? 0,
            teamProjectsLimit: oq.teamProjectsLimit ?? 0,
            teamProjectsLeft: oq.teamProjectsLeft ?? 0,
            baseLimit: oq.baseLimit,
            purchasedQuota: oq.purchasedQuota ?? 0,
          });
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

  useEffect(() => {
    if (viewMode !== "archived") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const fetchArchived = async () => {
      setArchivedProjectsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/rfp/projects/archived`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          toast.error("Failed to load archived projects");
          return;
        }
        const data = await res.json();
        const projects: ProjectItem[] = data.success && Array.isArray(data.projects) ? data.projects : [];
        setArchivedProjects(projects);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load archived projects");
      } finally {
        setArchivedProjectsLoading(false);
      }
    };
    fetchArchived();
  }, [viewMode]);

  // Preload TM and Project data as soon as user is on Teams view so toggling doesn't show loading
  useEffect(() => {
    if (viewMode !== "teams") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setTmAssignmentsLoading(true);
    fetch(`${API_BASE_URL}/api/rfp/team-member-assignments`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.teamMembers)) setTmAssignments(d.teamMembers);
        else setTmAssignments([]);
      })
      .catch(() => setTmAssignments([]))
      .finally(() => setTmAssignmentsLoading(false));
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "teams") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setProjectsForFilterLoading(true);
    fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.projects)) setProjectsForFilter(d.projects);
        else setProjectsForFilter([]);
      })
      .catch(() => setProjectsForFilter([]))
      .finally(() => setProjectsForFilterLoading(false));
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

  const allMembersList: FlattenedMember[] =
    currentUserId != null
      ? [
          { id: currentUserId, fullName: userDisplayName, email: currentUserEmail || "", role: "Bid Admin", teamName: "—" },
          ...flattenedMembers,
        ]
      : flattenedMembers;

  const handleViewResult = (projectName: string) => {
    navigate(`/project-results/${encodeURIComponent(projectName)}`);
  };

  const openFinalBidModal = (projectId: number, projectName: string) => {
    setFinalBidModal({ projectId, projectName });
    setFinalBidFile(null);
    setFinalBidDescription("");
  };

  const submitFinalBidUpload = async () => {
    if (!finalBidModal || !finalBidFile) return;
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in again");
      return;
    }
    setFinalBidUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", finalBidFile);
      if (finalBidDescription.trim()) formData.append("description", finalBidDescription.trim());
      const res = await fetch(`${API_BASE_URL}/api/rfp/projects/${finalBidModal.projectId}/final-bid`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.detail || "Upload failed");
        return;
      }
      toast.success(data.message || "Final bid uploaded. Comparison complete.");
      setFinalBidModal(null);
      setFinalBidFile(null);
      setFinalBidDescription("");
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setFinalBidUploading(false);
    }
  };

  const openAssignModalForAdmin = async (projectName: string) => {
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
        setAssignableUsersForModal(Array.isArray(d.users) ? d.users : []);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load assignments");
    }
  };

  const saveAssignmentsForAdmin = async () => {
    if (!assignModalProject) return;
    setAssignModalSaving(true);
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
        const msg = typeof data.detail === "string" ? data.detail : typeof data.message === "string" ? data.message : "Failed to save";
        throw new Error(msg);
      }
      toast.success("Assignments saved.");
      setAssignModalProject(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save assignments");
    } finally {
      setAssignModalSaving(false);
    }
  };

  const handleArchive = async (projectId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/rfp/projects/${projectId}/archive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Failed to archive project");
        return;
      }
      toast.success("Project archived");
      setArchiveConfirmProjectId(null);
      setPersonalProjects((prev) => prev.filter((p) => p.id !== projectId));
      setAllProjects((prev) => prev.filter((p) => p.id !== projectId));
      setProjectsForFilter((prev) => prev.filter((p) => p.id !== projectId));
      if (data.orgQuota) {
        setOrgQuota({
          teamProjectsUsed: data.orgQuota.teamProjectsUsed ?? 0,
          teamProjectsLimit: data.orgQuota.teamProjectsLimit ?? 0,
          teamProjectsLeft: data.orgQuota.teamProjectsLeft ?? 0,
        });
      }
      if (viewMode === "archived") {
        const archRes = await fetch(`${API_BASE_URL}/api/rfp/projects/archived`, { headers: { Authorization: `Bearer ${token}` } });
        if (archRes.ok) {
          const archData = await archRes.json();
          setArchivedProjects(archData.success && Array.isArray(archData.projects) ? archData.projects : []);
        }
      }
      refreshDashboard();
    } catch (e) {
      console.error(e);
      toast.error("Failed to archive project");
    }
  };

  const handleUnarchive = async (projectId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/rfp/projects/${projectId}/unarchive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Failed to unarchive project");
        return;
      }
      toast.success("Project unarchived; quota left decreased by 1");
      setArchivedProjects((prev) => prev.filter((p) => p.id !== projectId));
      // Optimistic: decrease Quota left by 1 (18 -> 17) immediately
      setOrgQuota((prev) => {
        if (!prev) return prev;
        const newLeft = Math.max(0, (prev.teamProjectsLeft ?? 0) - 1);
        const newUsed = (prev.teamProjectsUsed ?? 0) + 1;
        return { ...prev, teamProjectsLeft: newLeft, teamProjectsUsed: newUsed };
      });
      // Then apply server values from unarchive response
      if (data.orgQuota) {
        setOrgQuota((prev) => ({
          ...(prev ?? {}),
          teamProjectsUsed: data.orgQuota.teamProjectsUsed ?? prev?.teamProjectsUsed ?? 0,
          teamProjectsLimit: data.orgQuota.teamProjectsLimit ?? prev?.teamProjectsLimit ?? 0,
          teamProjectsLeft: data.orgQuota.teamProjectsLeft ?? prev?.teamProjectsLeft ?? 0,
        }));
      }
      // Refetch dashboard so "Quota left" and team cards stay in sync with server
      const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const dashData = await dashRes.json();
      if (dashData.success && dashData.bidManagers) setBidManagers(dashData.bidManagers);
      if (dashData.success && dashData.orgQuota) {
        const oq = dashData.orgQuota;
        setOrgQuota((prev) => ({
          teamProjectsUsed: oq.teamProjectsUsed ?? 0,
          teamProjectsLimit: oq.teamProjectsLimit ?? 0,
          teamProjectsLeft: oq.teamProjectsLeft ?? 0,
          baseLimit: oq.baseLimit ?? prev?.baseLimit,
          purchasedQuota: prev?.purchasedQuota ?? oq.purchasedQuota ?? 0,
        }));
      }
      const projRes = await fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } });
      if (projRes.ok) {
        const projData = await projRes.json();
        const projects: ProjectItem[] = projData.success && Array.isArray(projData.projects) ? projData.projects : [];
        setPersonalProjects(projects);
        setAllProjects(projects);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to unarchive project");
    }
  };

  const refreshDashboard = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const d = await r.json();
      if (d.success && d.bidManagers) setBidManagers(d.bidManagers);
      if (d.success && d.orgQuota) {
        const oq = d.orgQuota;
        setOrgQuota({
          teamProjectsUsed: oq.teamProjectsUsed ?? 0,
          teamProjectsLimit: oq.teamProjectsLimit ?? 0,
          teamProjectsLeft: oq.teamProjectsLeft ?? 0,
          baseLimit: oq.baseLimit,
          purchasedQuota: oq.purchasedQuota ?? 0,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("analysisData");
    localStorage.removeItem("currentDocument");
    localStorage.removeItem("recentRfpAnalysis");
    toast.success("Logged out");
    navigate("/login");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!createUserForm.fullName.trim() || !createUserForm.email.trim() || !createUserForm.password.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    if (createUserForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreateUserLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: createUserForm.fullName.trim(),
          email: createUserForm.email.trim().toLowerCase(),
          password: createUserForm.password,
          role: createUserType,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const label = createUserType === "bid_manager" ? "Bid Manager" : "Technical Manager";
        setCreateUserSuccessPopup({ fullName: (data.user?.fullName ?? createUserForm.fullName.trim()) || "User", roleLabel: label });
        setCreateUserForm({ fullName: "", email: "", password: "" });
        const dashRes = await fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` } });
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          if (dashData.success && dashData.bidManagers) setBidManagers(dashData.bidManagers);
        }
      } else {
        setCreateUserErrorPopup(data.detail || data.message || "Failed to create user");
      }
    } catch (e) {
      console.error(e);
      setCreateUserErrorPopup("Request failed. Please try again.");
    } finally {
      setCreateUserLoading(false);
    }
  };

  const totalProjects = bidManagers.reduce((s, b) => s + b.teamProjectsUsed, 0);
  const totalPeople = bidManagers.reduce((s, b) => s + 1 + (b.technicalManagers?.length || 0), 0);
  const adminProjects = currentUserId != null ? personalProjects.filter((p) => p.user_id === currentUserId) : [];
  const totalProjectsWithAdmin = totalProjects + adminProjects.length;
  const totalQuotaLeft = orgQuota?.teamProjectsLeft ?? bidManagers.reduce((s, b) => s + (b.teamProjectsLeft ?? 0), 0);
  const totalQuotaLimit = orgQuota?.teamProjectsLimit ?? bidManagers.reduce((s, b) => s + (b.teamProjectsLimit ?? 0), 0);
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
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "archived" ? " active" : ""}`}
            onClick={() => handleViewChange("archived")}
            style={{
              ...navButtonBase,
              background: viewMode === "archived" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "archived" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "archived" ? 700 : 600,
              boxShadow: viewMode === "archived" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "archived" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="Archived projects"
          >
            <Archive size={20} style={{ flexShrink: 0 }} />
            <span>Archived</span>
          </button>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent 0%, rgba(255,143,143,0.4) 50%, transparent 100%)", margin: "12px 0" }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5a6340", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Actions
          </div>
          <button
            type="button"
            className={`sidebar-nav-toggle${viewMode === "create_user" ? " active" : ""}`}
            onClick={() => handleViewChange("create_user")}
            style={{
              ...navButtonBase,
              background: viewMode === "create_user" ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: viewMode === "create_user" ? "#fff" : "#2d3319",
              fontWeight: viewMode === "create_user" ? 700 : 600,
              boxShadow: viewMode === "create_user" ? "0 2px 8px rgba(255,143,143,0.3)" : "none",
              border: viewMode === "create_user" ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="Create Bid Manager or Technical Manager"
          >
            <UserPlus size={20} style={{ flexShrink: 0 }} />
            <span>Create User</span>
          </button>
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

      <div className="dashboard-bg-wrap" style={{ position: "fixed", inset: 0, top: NAVBAR_HEIGHT, left: SIDEBAR_WIDTH, right: 0, bottom: 0, zIndex: 0, overflow: "hidden" }}>
        <div className="dashboard-bg-base" style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(160deg, rgba(250,243,225,0.85) 0%, rgba(234,239,239,0.8) 50%, rgba(255,179,179,0.4) 100%)",
          animation: "dashboardBgPulse 8s ease-in-out infinite"
        }} />
        <div className="dashboard-bg-move" style={{
          position: "absolute",
          inset: -100,
          background: "linear-gradient(120deg, transparent 0%, rgba(255,179,179,0.2) 25%, rgba(255,143,143,0.15) 50%, rgba(234,239,239,0.2) 75%, transparent 100%)",
          backgroundSize: "200% 200%",
          animation: "dashboardBgMove 15s linear infinite"
        }} />
        <div className="dashboard-bg-shimmer" style={{
          position: "absolute",
          inset: -80,
          background: "radial-gradient(ellipse 70% 60% at 30% 30%, rgba(255,179,179,0.28) 0%, transparent 55%), radial-gradient(ellipse 50% 70% at 70% 70%, rgba(255,143,143,0.2) 0%, transparent 55%)",
          animation: "dashboardBgShimmer 14s ease-in-out infinite"
        }} />
        <div className="background-shape dashboard-float-1" style={{
          top: "8%", left: "12%", width: 380, height: 380,
          background: "rgba(255,179,179,0.45)", borderRadius: "50%", filter: "blur(50px)",
        }} />
        <div className="background-shape dashboard-float-2" style={{
          top: "55%", right: "5%", width: 320, height: 320,
          background: "rgba(255,143,143,0.35)", borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%", filter: "blur(45px)",
        }} />
        <div className="background-shape dashboard-float-3" style={{
          bottom: "10%", left: "20%", width: 280, height: 280,
          background: "rgba(234,239,239,0.6)", borderRadius: "50%", filter: "blur(40px)",
        }} />
        <div className="background-shape dashboard-float-4" style={{
          top: "30%", right: "20%", width: 220, height: 220,
          background: "rgba(13,148,136,0.12)", borderRadius: "50%", filter: "blur(38px)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(1px)"
        }} />
      </div>

      {(isViewTransitioning ||
          (viewMode === "teams" && loading) ||
          (viewMode === "personal" && personalProjectsLoading) ||
          (viewMode === "members" && membersLoading) ||
          (viewMode === "archived" && archivedProjectsLoading)) && (
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
                {viewMode === "teams" ? "Dashboard" : viewMode === "personal" ? "Admin projects" : viewMode === "members" ? "All members" : viewMode === "create_user" ? "Create User" : "Archived"}
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                {viewMode === "teams"
                  ? "Projects per team, people working on them, and view any project result."
                  : viewMode === "personal"
                    ? "Projects you created or own as Bid Admin. View results for any project."
                    : viewMode === "members"
                      ? "See every Bid Manager and Technical Manager, their team, and which projects they are working on."
                      : viewMode === "create_user"
                        ? "Add a new Bid Manager or Technical Manager. Choose the type below and fill in the details."
                        : "Archived projects are hidden from main lists. Unarchive to restore and add 1 to org quota."}
              </p>
            </div>
            {viewMode === "teams" && !loading && (bidManagers.length > 0 || currentUserId != null) && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
              </div>
            )}
          </div>

          {viewMode === "teams" && loading ? null : viewMode === "create_user" ? (
            <section style={{ maxWidth: 520, margin: "0 auto" }}>
              <div style={{
                background: "#fff",
                borderRadius: 20,
                border: "1px solid #EAEFEF",
                boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
                overflow: "hidden",
                padding: 28,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, rgba(255,143,143,0.25) 0%, rgba(234,239,239,0.8) 100%)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,143,143,0.4)" }}>
                    <UserPlus size={26} color="#c73e3e" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1e293b" }}>Create User</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>Choose role and enter details</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                  {(["bid_manager", "technical_manager"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCreateUserType(type)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: "2px solid " + (createUserType === type ? "#FF8F8F" : "#EAEFEF"),
                        background: createUserType === type ? "rgba(255,143,143,0.15)" : "#f8fafc",
                        color: createUserType === type ? "#c73e3e" : "#64748b",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {type === "bid_manager" ? "Bid Manager" : "Technical Manager"}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleCreateUser} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Full name</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={createUserForm.fullName}
                      onChange={(e) => setCreateUserForm((f) => ({ ...f, fullName: e.target.value }))}
                      required
                      autoComplete="off"
                      style={{ width: "100%", padding: "12px 14px", border: "1px solid #EAEFEF", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Email</label>
                    <input
                      type="email"
                      placeholder="Email"
                      value={createUserForm.email}
                      onChange={(e) => setCreateUserForm((f) => ({ ...f, email: e.target.value }))}
                      required
                      autoComplete="off"
                      style={{ width: "100%", padding: "12px 14px", border: "1px solid #EAEFEF", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Password (min 6 characters)</label>
                    <input
                      type="password"
                      placeholder="Password"
                      value={createUserForm.password}
                      onChange={(e) => setCreateUserForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      style={{ width: "100%", padding: "12px 14px", border: "1px solid #EAEFEF", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#fff", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={createUserLoading}
                    style={{
                      padding: "14px 24px",
                      background: "linear-gradient(135deg, #FF8F8F 0%, #E87878 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: createUserLoading ? "not-allowed" : "pointer",
                      opacity: createUserLoading ? 0.8 : 1,
                      boxShadow: "0 4px 14px rgba(255,143,143,0.35)",
                      transition: "all 0.2s",
                    }}
                  >
                    {createUserLoading ? "Creating…" : `Create ${createUserType === "bid_manager" ? "Bid Manager" : "Technical Manager"}`}
                  </button>
                </form>
              </div>
            </section>
          ) : viewMode === "personal" ? (
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
                            <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Action</th>
                            <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Upload final bid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminProjects.map((p) => (
                            <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                              <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.client_name || "—"}</td>
                              <td style={{ padding: "14px 16px", textAlign: "right", verticalAlign: "middle" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "nowrap" }}>
                                  <button type="button" onClick={() => handleViewResult(p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13, boxShadow: "0 2px 8px rgba(255,143,143,0.3)", whiteSpace: "nowrap" }}>View result</button>
                                  <button type="button" onClick={() => openAssignModalForAdmin(p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", background: "rgba(79,70,229,0.12)", color: "#4f46e5", border: "1px solid rgba(79,70,229,0.3)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }} title="Assign Bid Managers or Technical Managers">Assign</button>
                                  <button type="button" onClick={() => { setArchiveConfirmProjectId(p.id); setArchiveConfirmStep(0); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 14px", background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }} title="Archive project"><Archive size={14} /> Archive</button>
                                </div>
                              </td>
                              <td style={{ padding: "14px 16px", textAlign: "center", verticalAlign: "middle" }}>
                                <button type="button" onClick={() => openFinalBidModal(p.id, p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 14px", background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }} title="Upload final bid"><FileUp size={14} /> Upload final bid</button>
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
                All members ({allMembersList.length})
              </h2>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                {membersLoading ? null : allMembersList.length === 0 ? (
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
                          {allMembersList.map((m) => {
                            const memberProjects = allProjects.filter((p) => p.user_id === m.id);
                            return (
                              <tr key={m.role === "Bid Admin" ? `admin-${m.id}` : m.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                <td style={{ padding: "14px 16px" }}>
                                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{m.fullName}</div>
                                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                                    <Mail size={11} /> {m.email || "—"}
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
                                      background: m.role === "Bid Admin" ? "rgba(94, 114, 52, 0.2)" : m.role === "Bid Manager" ? "rgba(255,143,143,0.2)" : "rgba(255,179,179,0.3)",
                                      color: m.role === "Bid Admin" ? "#2d3319" : "#2d3319",
                                      border: m.role === "Bid Admin" ? "1px solid rgba(94, 114, 52, 0.5)" : m.role === "Bid Manager" ? "1px solid rgba(255,143,143,0.4)" : "1px solid rgba(255,179,179,0.5)",
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
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                      {memberProjects.map((p) => (
                                        <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                          <button
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
                                        </span>
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
          ) : viewMode === "archived" ? (
            <section>
              <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: "#EAEFEF", display: "inline-flex", alignItems: "center", justifyContent: "center", borderLeft: "3px solid #5a6340" }}>
                  <Archive size={18} color="#5a6340" />
                </span>
                Archived projects ({archivedProjects.length})
              </h2>
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                {archivedProjectsLoading ? null : archivedProjects.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                    No archived projects. Archive projects from Dashboard, Admin projects, or All members.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Project</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Tender ID</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Client</th>
                        <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Owner</th>
                        <th style={{ padding: "14px 16px", textAlign: "right", fontWeight: 600, color: "#475569" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedProjects.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                          <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                          <td style={{ padding: "14px 16px", color: "#64748b" }}>{p.client_name || "—"}</td>
                          <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>
                            {(p as { owner?: { full_name?: string } }).owner?.full_name ?? "—"}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => handleUnarchive(p.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 16px",
                                background: "#0d9488",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              <ArchiveRestore size={16} />
                              Unarchive
                            </button>
                          </td>
                        </tr>
                      ))}
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
                    onClick={() => {
                      if (activeToggle === "projects") {
                        setActiveToggle(null);
                        setExpandedBmIdForProjects(null);
                        setShowGrandTotalProjects(false);
                      } else {
                        setActiveToggle("projects");
                        setShowGrandTotalProjects(true);
                        setExpandedBmIdForProjects(null);
                      }
                    }}
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
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{totalProjectsWithAdmin}</div>
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
                    <div style={{ width: "100%", minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#2d3319", display: "flex", alignItems: "center", gap: 10 }}>
                          <FolderKanban size={20} />
                          Total Projects Breakdown
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setActiveToggle(null); setExpandedBmIdForProjects(null); setShowGrandTotalProjects(false); }}
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
                      {/* Name selector: click a name to show their projects in the stretch container below */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                        {bidManagers.map((bm) => {
                          const isSelected = expandedBmIdForProjects === bm.id;
                          return (
                            <button
                              key={bm.id}
                              type="button"
                              onClick={() => { setExpandedBmIdForProjects(isSelected ? null : bm.id); setShowGrandTotalProjects(false); }}
                              style={{
                                padding: "10px 18px",
                                background: isSelected ? "rgba(255,143,143,0.2)" : "#f8fafc",
                                border: isSelected ? "2px solid #FF8F8F" : "1px solid #EAEFEF",
                                borderRadius: 10,
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: 14,
                                color: isSelected ? "#2d3319" : "#64748b",
                                transition: "all 0.2s",
                                boxShadow: isSelected ? "0 2px 8px rgba(255,143,143,0.2)" : "none",
                              }}
                            >
                              {bm.fullName} ({bm.teamProjectsUsed})
                            </button>
                          );
                        })}
                      </div>
                      {/* Single stretch container: table fills full width; data changes when name changes */}
                      <div
                        style={{
                          width: "100%",
                          minWidth: 0,
                          padding: "20px",
                          background: "#fff",
                          borderRadius: 12,
                          border: "1px solid #EAEFEF",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                          overflow: "auto",
                        }}
                      >
                        {showGrandTotalProjects ? (() => {
                          const grandTotalProjects = personalProjects;
                          return (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 14 }}>All projects (Grand Total)</div>
                              {grandTotalProjects.length === 0 ? (
                                <div style={{ padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>No projects yet.</div>
                              ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
                                  <thead>
                                    <tr style={{ borderBottom: "2px solid #EAEFEF", background: "#f8fafc" }}>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Project</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Tender ID</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Client</th>
                                      <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569" }}>Action</th>
                                      <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Upload final bid</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {grandTotalProjects.map((p) => (
                                      <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>{p.project_name}</td>
                                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{p.tender_id || "—"}</td>
                                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{p.client_name || "—"}</td>
                                        <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "nowrap" }}>
                                            <button type="button" onClick={() => handleViewResult(p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>View result</button>
                                            <button type="button" onClick={() => { setArchiveConfirmProjectId(p.id); setArchiveConfirmStep(0); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 14px", background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Archive project"><Archive size={12} /> Archive</button>
                                          </div>
                                        </td>
                                        <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                                          <button type="button" onClick={() => openFinalBidModal(p.id, p.project_name)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Upload final bid"><FileUp size={12} /> Upload final bid</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </>
                          );
                        })() : expandedBmIdForProjects == null ? (
                          <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>Select a name above or click Grand Total to view all projects.</div>
                        ) : (() => {
                          const selectedBm = bidManagers.find((bm) => bm.id === expandedBmIdForProjects);
                          if (!selectedBm) return null;
                          const teamUserIds = [selectedBm.id, ...(selectedBm.technicalManagers || []).map((t: { id: number }) => t.id)];
                          const bmProjects = personalProjects.filter((p) => p.user_id != null && teamUserIds.includes(p.user_id));
                          return (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 14 }}>{selectedBm.fullName} – projects</div>
                              {bmProjects.length === 0 ? (
                                <div style={{ padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>No projects yet.</div>
                              ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                                  <thead>
                                    <tr style={{ borderBottom: "2px solid #EAEFEF", background: "#f8fafc" }}>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", width: "34%" }}>Project</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", width: "18%" }}>Tender ID</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", width: "24%" }}>Client</th>
                                      <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", width: "14%" }}>Action</th>
                                      <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#475569", whiteSpace: "nowrap", width: "10%" }}>Upload final bid</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bmProjects.map((p) => (
                                      <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a", overflowWrap: "anywhere", wordBreak: "break-word" }}>{p.project_name}</td>
                                        <td style={{ padding: "12px 16px", color: "#64748b", overflowWrap: "anywhere", wordBreak: "break-word" }}>{p.tender_id || "—"}</td>
                                        <td style={{ padding: "12px 16px", color: "#64748b", overflowWrap: "anywhere", wordBreak: "break-word" }}>{p.client_name || "—"}</td>
                                        <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "nowrap" }}>
                                            <button type="button" onClick={() => handleViewResult(p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>View result</button>
                                            <button type="button" onClick={() => { setArchiveConfirmProjectId(p.id); setArchiveConfirmStep(0); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 14px", background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Archive project"><Archive size={12} /> Archive</button>
                                          </div>
                                        </td>
                                        <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                                          <button type="button" onClick={() => openFinalBidModal(p.id, p.project_name)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Upload final bid"><FileUp size={12} /> Upload final bid</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowGrandTotalProjects(true); setExpandedBmIdForProjects(null); }}
                        style={{
                          marginTop: 16,
                          width: "100%",
                          padding: "12px 16px",
                          background: showGrandTotalProjects ? "rgba(255,143,143,0.25)" : "rgba(255,143,143,0.15)",
                          borderRadius: 12,
                          border: showGrandTotalProjects ? "2px solid #FF8F8F" : "1px solid rgba(255,143,143,0.3)",
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#2d3319",
                          textAlign: "left",
                          transition: "all 0.2s",
                          boxShadow: showGrandTotalProjects ? "0 2px 8px rgba(255,143,143,0.2)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!showGrandTotalProjects) {
                            e.currentTarget.style.background = "rgba(255,143,143,0.22)";
                            e.currentTarget.style.borderColor = "rgba(255,143,143,0.5)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showGrandTotalProjects) {
                            e.currentTarget.style.background = "rgba(255,143,143,0.15)";
                            e.currentTarget.style.borderColor = "rgba(255,143,143,0.3)";
                          }
                        }}
                      >
                        Grand Total: {totalProjectsWithAdmin} projects
                      </button>
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
                                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, whiteSpace: "nowrap" }}>Action</th>
                                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#475569", fontSize: 13, whiteSpace: "nowrap" }}>Upload final bid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminProjects.map((p) => (
                                <tr key={p.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a", fontSize: 13 }}>{p.project_name}</td>
                                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{p.tender_id || "—"}</td>
                                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{p.client_name || "—"}</td>
                                  <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "nowrap" }}>
                                      <button type="button" onClick={() => handleViewResult(p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, boxShadow: "0 2px 8px rgba(255,143,143,0.25)", whiteSpace: "nowrap" }}>View result</button>
                                      <button type="button" onClick={() => openAssignModalForAdmin(p.project_name)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 36, padding: "0 14px", background: "rgba(79,70,229,0.12)", color: "#4f46e5", border: "1px solid rgba(79,70,229,0.3)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Assign Bid Managers or Technical Managers">Assign</button>
                                      <button type="button" onClick={() => { setArchiveConfirmProjectId(p.id); setArchiveConfirmStep(0); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 14px", background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Archive project"><Archive size={12} /> Archive</button>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                                    <button type="button" onClick={() => openFinalBidModal(p.id, p.project_name)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }} title="Upload final bid"><FileUp size={12} /> Upload final bid</button>
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

              <section style={{ background: "#fff", borderRadius: 16, border: "1px solid #EAEFEF", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", marginBottom: 24, display: "flex", flexDirection: "column", height: 520, minHeight: 520, width: "100%", minWidth: "100%", flexShrink: 0 }}>
                <div style={{ padding: "18px 22px", borderBottom: "1px solid #EAEFEF", background: "#f8fafc", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, justifyContent: "space-between", flexShrink: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#FAF3E1", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #E87878" }}>
                      <FolderKanban size={18} color="#E87878" />
                    </span>
                    {teamsViewFilter === "bid_manager" ? "Bid Managers" : teamsViewFilter === "technical_manager" ? "Technical Managers" : teamsViewFilter === "admin" ? "Admin projects" : "Projects"}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {(["bid_manager", "technical_manager", "project", "admin"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTeamsViewFilter(f)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "1px solid " + (teamsViewFilter === f ? "#FF8F8F" : "#EAEFEF"),
                          background: teamsViewFilter === f ? "rgba(255,143,143,0.2)" : "#fff",
                          color: teamsViewFilter === f ? "#c73e3e" : "#64748b",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {f === "bid_manager" ? "Bid Manager" : f === "technical_manager" ? "Technical Manager" : f === "admin" ? "Admin" : "Project"}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative", minWidth: 220 }}>
                      <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        type="text"
                        placeholder={teamsViewFilter === "project" || teamsViewFilter === "admin" ? "Search projects..." : "Search by name or email..."}
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
                  </div>
                </div>

                <div style={{ height: 460, minHeight: 460, width: "100%", flexShrink: 0, overflowX: "auto", overflowY: "scroll", background: "#fff" }}>
                {teamsViewFilter === "bid_manager" && (bidManagers.length === 0 ? (
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
                ))}

                {teamsViewFilter === "technical_manager" && (
                  <div style={{ padding: "20px 22px", minHeight: 460, height: "100%", display: "flex", flexDirection: "column" }}>
                    {tmAssignmentsLoading ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#64748b" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
                        <span style={{ fontSize: 14 }}>Loading…</span>
                      </div>
                    ) : tmAssignments.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                        <UserCircle size={40} style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }} />
                        No Technical Managers found.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px", minWidth: 640 }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Technical Manager</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Email</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Bid Manager</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Assigned projects</th>
                              <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, width: 120 }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const bmByTmId: Record<number, string> = {};
                              bidManagers.forEach((bm) => {
                                (bm.technicalManagers || []).forEach((tm) => { bmByTmId[tm.id] = bm.fullName; });
                              });
                              const teamSearchLower = (teamSearch || "").toLowerCase();
                              const filtered = teamSearchLower
                                ? tmAssignments.filter((tm) =>
                                    (tm.fullName || "").toLowerCase().includes(teamSearchLower) ||
                                    (tm.email || "").toLowerCase().includes(teamSearchLower) ||
                                    (bmByTmId[tm.id] || "").toLowerCase().includes(teamSearchLower)
                                  )
                                : tmAssignments;
                              return filtered.map((tm) => (
                                <tr key={tm.id} style={{ borderBottom: "1px solid #EAEFEF" }}>
                                  <td style={{ padding: "14px 16px" }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{tm.fullName}</div>
                                  </td>
                                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#64748b" }}>{tm.email}</td>
                                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#475569" }}>{bmByTmId[tm.id] ?? "—"}</td>
                                  <td style={{ padding: "14px 16px" }}>
                                    {(tm.assignedProjects || []).length === 0 ? (
                                      <span style={{ fontSize: 13, color: "#94a3b8" }}>None</span>
                                    ) : (
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {(tm.assignedProjects || []).map((p) => (
                                          <span key={p.id} style={{ fontSize: 12, padding: "4px 8px", background: "#f1f5f9", borderRadius: 6, color: "#475569" }}>{p.project_name}</span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                    {(tm.assignedProjects || []).length === 0 ? (
                                      <span style={{ fontSize: 13, color: "#94a3b8" }}>None</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/team-projects/${bidManagers.find((bm) => (bm.technicalManagers || []).some((t) => t.id === tm.id))?.id ?? tm.id}`)}
                                        style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
                                      >
                                        View projects
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {teamsViewFilter === "project" && (
                  <div style={{ padding: "20px 22px", minHeight: 460, height: "100%", display: "flex", flexDirection: "column" }}>
                    {projectsForFilterLoading ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#64748b" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
                        <span style={{ fontSize: 14 }}>Loading…</span>
                      </div>
                    ) : projectsForFilter.length === 0 ? (
                      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                        <FolderKanban size={40} style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }} />
                        No projects found.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px", minWidth: 640 }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Project</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Tender ID</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Client</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Bid Manager</th>
                              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Technical Manager(s)</th>
                              <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, width: 100 }}>Archive</th>
                              <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, width: 120 }}>Action</th>
                              <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#475569", fontSize: 13, whiteSpace: "nowrap" }}>Upload final bid</th>
                            </tr>
                          </thead>
                        </table>
                        {(() => {
                          const bmById: Record<number, string> = {};
                          bidManagers.forEach((bm) => { bmById[bm.id] = bm.fullName; });
                          const teamSearchLower = (teamSearch || "").toLowerCase();
                          const filtered = teamSearchLower
                            ? projectsForFilter.filter((p) =>
                                (p.project_name || "").toLowerCase().includes(teamSearchLower) ||
                                (p.tender_id || "").toLowerCase().includes(teamSearchLower) ||
                                (p.client_name || "").toLowerCase().includes(teamSearchLower) ||
                                (bmById[p.user_id!] || "").toLowerCase().includes(teamSearchLower) ||
                                (p.assigned_users || []).some((u) => (u.fullName + " " + u.email).toLowerCase().includes(teamSearchLower))
                              )
                            : projectsForFilter;
                          const rowHeight = 86;
                          const listHeight = Math.min(520, Math.max(rowHeight, filtered.length * rowHeight));
                          return (
                            <div style={{ minWidth: 640, height: listHeight, contain: "strict" }}>
                              <List
                                height={listHeight}
                                itemCount={filtered.length}
                                itemSize={rowHeight}
                                width={"100%"}
                                overscanCount={6}
                              >
                                {({ index, style }: ListChildComponentProps) => {
                                  const p = filtered[index];
                                  return (
                                    <div style={{ ...style, display: "grid", gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1.2fr 1.6fr 0.9fr 0.9fr 1.1fr", alignItems: "center", borderBottom: "1px solid #EAEFEF", padding: "0 8px", background: "#fff" }}>
                                      <div style={{ padding: "0 8px", fontWeight: 600, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.project_name}>
                                        {p.project_name}
                                        {p.user_id === currentUserId && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "#16a34a" }}>[Admin]</span>}
                                      </div>
                                      <div style={{ padding: "0 8px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.tender_id ?? "—"}</div>
                                      <div style={{ padding: "0 8px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.client_name ?? "—"}</div>
                                      <div style={{ padding: "0 8px", fontSize: 13, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.user_id ? (bmById[p.user_id] ?? "—") : "—"}</div>
                                      <div style={{ padding: "0 8px", fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {(p.assigned_users || []).length === 0 ? "None" : (p.assigned_users || []).map((u) => u.fullName).join(", ")}
                                      </div>
                                      <div style={{ padding: "0 8px", textAlign: "right" }}>
                                        <button type="button" onClick={() => { setArchiveConfirmProjectId(p.id); setArchiveConfirmStep(0); }} title="Archive project" style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, background: "#64748b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                          <Archive size={14} /> Archive
                                        </button>
                                      </div>
                                      <div style={{ padding: "0 8px", textAlign: "right" }}>
                                        <button type="button" onClick={() => navigate(`/project-results/${encodeURIComponent(p.project_name)}`)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>View result</button>
                                      </div>
                                      <div style={{ padding: "0 8px", textAlign: "center" }}>
                                        <button type="button" onClick={() => openFinalBidModal(p.id, p.project_name)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="Upload final bid"><FileUp size={12} /> Upload final bid</button>
                                      </div>
                                    </div>
                                  );
                                }}
                              </List>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {teamsViewFilter === "admin" && (
                  <div style={{ padding: "20px 22px", minHeight: 460, height: "100%", display: "flex", flexDirection: "column" }}>
                    {projectsForFilterLoading ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#64748b" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
                        <span style={{ fontSize: 14 }}>Loading…</span>
                      </div>
                    ) : (() => {
                      const adminProjectsList = currentUserId != null ? projectsForFilter.filter((p) => p.user_id === currentUserId) : [];
                      const bmById: Record<number, string> = {};
                      bidManagers.forEach((bm) => { bmById[bm.id] = bm.fullName; });
                      const teamSearchLower = (teamSearch || "").toLowerCase();
                      const filtered = teamSearchLower
                        ? adminProjectsList.filter((p) =>
                            (p.project_name || "").toLowerCase().includes(teamSearchLower) ||
                            (p.tender_id || "").toLowerCase().includes(teamSearchLower) ||
                            (p.client_name || "").toLowerCase().includes(teamSearchLower) ||
                            (bmById[p.user_id!] || "").toLowerCase().includes(teamSearchLower) ||
                            (p.assigned_users || []).some((u) => (u.fullName + " " + u.email).toLowerCase().includes(teamSearchLower))
                          )
                        : adminProjectsList;
                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15 }}>
                            <FolderKanban size={40} style={{ margin: "0 auto 16px", display: "block", opacity: 0.5 }} />
                            No admin projects. Projects you create (e.g. from Upload & Analyze) appear here.
                          </div>
                        );
                      }
                      return (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px", minWidth: 640 }}>
                            <thead>
                              <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #EAEFEF" }}>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Project</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Tender ID</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Client</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Bid Manager</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Technical Manager(s)</th>
                                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, width: 100 }}>Archive</th>
                                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13, width: 120 }}>Action</th>
                                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#475569", fontSize: 13, whiteSpace: "nowrap" }}>Upload final bid</th>
                              </tr>
                            </thead>
                          </table>
                          <div style={{ minWidth: 640, height: Math.min(520, Math.max(86, filtered.length * 86)), contain: "strict" }}>
                            <List
                              height={Math.min(520, Math.max(86, filtered.length * 86))}
                              itemCount={filtered.length}
                              itemSize={86}
                              width={"100%"}
                              overscanCount={6}
                            >
                              {({ index, style }: ListChildComponentProps) => {
                                const p = filtered[index];
                                return (
                                  <div style={{ ...style, display: "grid", gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1.2fr 1.6fr 0.9fr 0.9fr 1.1fr", alignItems: "center", borderBottom: "1px solid #EAEFEF", padding: "0 8px", background: "#fff" }}>
                                    <div style={{ padding: "0 8px", fontWeight: 600, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.project_name}>
                                      {p.project_name} <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "#16a34a" }}>[Admin]</span>
                                    </div>
                                    <div style={{ padding: "0 8px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.tender_id ?? "—"}</div>
                                    <div style={{ padding: "0 8px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.client_name ?? "—"}</div>
                                    <div style={{ padding: "0 8px", fontSize: 13, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.user_id ? (bmById[p.user_id] ?? "—") : "—"}</div>
                                    <div style={{ padding: "0 8px", fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {(p.assigned_users || []).length === 0 ? "None" : (p.assigned_users || []).map((u) => u.fullName).join(", ")}
                                    </div>
                                    <div style={{ padding: "0 8px", textAlign: "right" }}>
                                      <button type="button" onClick={() => { setArchiveConfirmProjectId(p.id); setArchiveConfirmStep(0); }} title="Archive project" style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, background: "#64748b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        <Archive size={14} /> Archive
                                      </button>
                                    </div>
                                    <div style={{ padding: "0 8px", textAlign: "right" }}>
                                      <button type="button" onClick={() => navigate(`/project-results/${encodeURIComponent(p.project_name)}`)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>View result</button>
                                    </div>
                                    <div style={{ padding: "0 8px", textAlign: "center" }}>
                                      <button type="button" onClick={() => openFinalBidModal(p.id, p.project_name)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="Upload final bid"><FileUp size={12} /> Upload final bid</button>
                                    </div>
                                  </div>
                                );
                              }}
                            </List>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {createUserSuccessPopup && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 24 }} onClick={() => setCreateUserSuccessPopup(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>User created</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#475569" }}>
              {createUserSuccessPopup.roleLabel} {createUserSuccessPopup.fullName} has been created successfully.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setCreateUserSuccessPopup(null)} style={{ padding: "10px 20px", borderRadius: 10, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", cursor: "pointer" }}>OK</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {createUserErrorPopup && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 24 }} onClick={() => setCreateUserErrorPopup(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#b91c1c" }}>Cannot create user</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#475569" }}>{createUserErrorPopup}</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setCreateUserErrorPopup(null)} style={{ padding: "10px 20px", borderRadius: 10, fontWeight: 600, background: "#64748b", color: "#fff", border: "none", cursor: "pointer" }}>OK</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {archiveConfirmProjectId != null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 24 }} onClick={() => { setArchiveConfirmProjectId(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            {archiveConfirmStep === 0 ? (
              <>
                <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>⚠️ Archive Project</h3>
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#475569" }}>Are you sure you want to move this project to Archived?</p>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#b45309", fontWeight: 600 }}>⚠️ Warning: Unarchiving this project will consume 1 quota.</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setArchiveConfirmProjectId(null)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>Cancel</button>
                  <button type="button" onClick={() => setArchiveConfirmStep(1)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#64748b", color: "#fff", border: "none", cursor: "pointer" }}>Archive Project</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Archive Project</h3>
                <p style={{ margin: "0 0 20px", fontSize: 14, color: "#475569" }}>Are you sure you want to move this project to Archived?</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => { setArchiveConfirmProjectId(null); setArchiveConfirmStep(0); }} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>Cancel</button>
                  <button type="button" onClick={() => archiveConfirmProjectId != null && handleArchive(archiveConfirmProjectId)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#64748b", color: "#fff", border: "none", cursor: "pointer" }}>Continue</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {finalBidModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 24 }} onClick={() => !finalBidUploading && setFinalBidModal(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Upload final bid</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>Project: {finalBidModal.projectName}</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFinalBidFile(e.target.files?.[0] ?? null)}
              style={{ marginBottom: 16, display: "block", width: "100%" }}
            />
            {finalBidFile && <p style={{ margin: "0 0 16px", fontSize: 13, color: "#475569" }}>Selected: {finalBidFile.name}</p>}
            <label style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#475569" }}>What did you upload? <Star size={12} fill="#e11d48" color="#e11d48" /></label>
            <textarea value={finalBidDescription} onChange={(e) => setFinalBidDescription(e.target.value)} placeholder="e.g. Final commercial bid, signed version, annex A..." rows={3} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 16, resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => !finalBidUploading && setFinalBidModal(null)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>Cancel</button>
              <button type="button" disabled={finalBidUploading || !finalBidFile || !finalBidDescription.trim()} onClick={submitFinalBidUpload} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", cursor: finalBidUploading || !finalBidFile || !finalBidDescription.trim() ? "not-allowed" : "pointer" }}>{finalBidUploading ? "Uploading…" : "Upload"}</button>
            </div>
          </div>
        </div>
      )}

      {assignModalProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 24 }} onClick={() => !assignModalSaving && setAssignModalProject(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Assign users to project</h3>
              <button type="button" onClick={() => !assignModalSaving && setAssignModalProject(null)} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "#64748b", borderRadius: 8 }} aria-label="Close"><X size={22} /></button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>Project: "{assignModalProject}" — choose Bid Managers or Technical Managers who can work on this project.</p>
            {assignableUsersForModal.length > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {assignableUsersForModal.map((m) => (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: assignModalAssignedIds.includes(m.id) ? "rgba(255,143,143,0.12)" : "transparent", border: `1px solid ${assignModalAssignedIds.includes(m.id) ? "rgba(255,143,143,0.4)" : "#EAEFEF"}` }}>
                      <input type="checkbox" checked={assignModalAssignedIds.includes(m.id)} onChange={() => setAssignModalAssignedIds((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))} />
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{m.fullName}</span>
                      <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{m.role?.replace("_", " ") || ""}</span>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{m.email}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setAssignModalProject(null)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>Cancel</button>
                  <button type="button" disabled={assignModalSaving} onClick={saveAssignmentsForAdmin} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#FF8F8F", color: "#fff", border: "none", cursor: assignModalSaving ? "wait" : "pointer" }}>{assignModalSaving ? "Saving…" : "Save"}</button>
                </div>
              </>
            ) : (
              <div style={{ margin: 0 }}>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "#64748b" }}>No Bid Managers or Technical Managers yet.</p>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>Create <strong>Bid Managers</strong> and <strong>Technical Managers</strong> from <strong>Create User</strong> in the side navbar.</p>
                <button type="button" onClick={() => { setAssignModalProject(null); navigate("/team"); }} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "rgba(79,70,229,0.12)", color: "#4f46e5", border: "1px solid rgba(79,70,229,0.3)", cursor: "pointer", fontSize: 13 }}>Go to Manage Teams</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dashboardBgPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.82; filter: brightness(1.08); }
        }
        @keyframes dashboardBgMove {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes dashboardBgShimmer {
          0%, 100% { opacity: 0.7; transform: scale(1) translate(0, 0); }
          50% { opacity: 1; transform: scale(1.12) translate(6%, -4%); }
        }
        @keyframes dashboardFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(45px, -35px) scale(1.08); }
          66% { transform: translate(-30px, 40px) scale(0.95); }
        }
        @keyframes dashboardFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -25px) scale(1.1); }
        }
        @keyframes dashboardFloat3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(35px, -45px); }
        }
        @keyframes dashboardFloat4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(25px, -20px) scale(0.98); }
        }
        .dashboard-bg-wrap .background-shape {
          position: absolute;
          will-change: transform;
        }
        .dashboard-bg-wrap .dashboard-float-1 { animation: dashboardFloat1 22s ease-in-out infinite; }
        .dashboard-bg-wrap .dashboard-float-2 { animation: dashboardFloat2 26s ease-in-out infinite reverse; }
        .dashboard-bg-wrap .dashboard-float-3 { animation: dashboardFloat3 20s ease-in-out infinite 3s; }
        .dashboard-bg-wrap .dashboard-float-4 { animation: dashboardFloat4 24s ease-in-out infinite 1s reverse; }
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
