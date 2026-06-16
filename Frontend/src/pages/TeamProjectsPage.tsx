import { Archive, ArrowLeft, ArrowRight, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";

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
}

interface AssignedUser {
  id: number;
  fullName: string;
  email?: string;
  role?: string;
}

interface ProjectItem {
  id: number;
  project_name: string;
  tender_id: string | null;
  client_name: string | null;
  user_id: number | null;
  assigned_user_ids?: number[];
  assigned_users?: AssignedUser[];
}

export default function TeamProjectsPage() {
  const { bidManagerId } = useParams<{ bidManagerId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bm, setBm] = useState<BidManagerCard | null>(null);
  const [teamProjects, setTeamProjects] = useState<ProjectItem[]>([]);
  const [archiveConfirmId, setArchiveConfirmId] = useState<number | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) {
      navigate("/login");
      return;
    }
    let parsed: { role?: string };
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
  }, [navigate]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !bidManagerId) return;

    const bmId = parseInt(bidManagerId, 10);
    if (isNaN(bmId)) {
      navigate("/home");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashRes, projectsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/admin-dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!dashRes.ok || !projectsRes.ok) {
          toast.error("Failed to load team data");
          navigate("/home");
          return;
        }

        const dashData = await dashRes.json();
        const projectsData = await projectsRes.json();

        const bidManagers: BidManagerCard[] = dashData.success ? dashData.bidManagers || [] : [];
        const found = bidManagers.find((b: BidManagerCard) => b.id === bmId);
        if (!found) {
          toast.error("Team not found");
          navigate("/home");
          return;
        }
        setBm(found);

        const projects: ProjectItem[] = projectsData.success && Array.isArray(projectsData.projects) ? projectsData.projects : [];
        const teamIds = [found.id, ...(found.technicalManagers || []).map((t: TeamMember) => t.id)];
        const filtered = projects.filter((p) => p.user_id != null && teamIds.includes(p.user_id));
        setTeamProjects(filtered);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load team projects");
        navigate("/home");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bidManagerId, navigate]);

  const handleViewResult = (projectName: string) => {
    navigate(`/project-results/${encodeURIComponent(projectName)}`);
  };

  const handleArchive = async (projectId: number) => {
    const token = getAuthToken();
    if (!token) return;
    setArchiving(true);
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
      setTeamProjects((prev) => prev.filter((p) => p.id !== projectId));
      setArchiveConfirmId(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to archive project");
    } finally {
      setArchiving(false);
    }
  };

  const getWorkingOnLabel = (p: ProjectItem): string => {
    const assigned = p.assigned_users;
    if (assigned && assigned.length > 0) {
      return assigned.map((u) => `${u.fullName} (Technical Manager)`).join(", ");
    }
    const userId = p.user_id;
    if (userId == null || !bm) return "—";
    if (userId === bm.id) return `${bm.fullName} (Bid Manager)`;
    const tm = (bm.technicalManagers || []).find((t) => t.id === userId);
    return tm ? `${tm.fullName} (Technical Manager)` : `User #${userId}`;
  };

  return (
    <div className="universal-page-wrapper" style={{ minHeight: "100vh" }}>
      <DashboardNavbar />

      <div className="universal-background">
        <div className="universal-bg-gradient-1" />
        <div className="universal-bg-gradient-2" />
        <div className="universal-bg-gradient-3" />
      </div>

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
          background: "linear-gradient(135deg, #34908B 0%, #6FBEB2 100%)",
          border: "1px solid rgba(52,144,139,0.4)",
          borderRadius: 12,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
          color: "#fff",
          boxShadow: "0 4px 12px rgba(52,144,139,0.3)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(52,144,139,0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(52,144,139,0.3)";
        }}
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div style={{ maxWidth: 960, margin: "0 auto", paddingTop: NAVBAR_HEIGHT + 24, paddingBottom: 48, paddingLeft: 24, paddingRight: 24 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60, background: "rgba(255,255,255,0.95)", borderRadius: 18, border: "1px solid #D4F0EB", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #D4F0EB", borderTopColor: "#6FBEB2", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "#64748b", fontSize: 15, fontWeight: 500 }}>Loading team projects…</span>
          </div>
        ) : bm ? (
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 18, padding: 0, boxShadow: "0 8px 24px rgba(15,23,42,0.08)", border: "1px solid #D4F0EB", overflow: "hidden" }}>
            <div style={{ padding: "24px 28px", borderBottom: "1px solid #D4F0EB", background: "linear-gradient(135deg, rgba(232,248,245,0.8) 0%, rgba(212,240,235,0.5) 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E8F8F5", border: "1px solid rgba(111,190,178,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(232,248,245,0.8)" }}>
                  <UserCircle size={26} color="#6FBEB2" />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
                    {bm.fullName} – Team projects
                  </h1>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b", fontWeight: 500 }}>
                    {teamProjects.length} {teamProjects.length === 1 ? "project" : "projects"}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ overflow: "auto" }}>
              {teamProjects.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontSize: 15, background: "#f8fafc" }}>
                  No projects yet for this team.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #D4F0EB" }}>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Project</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Client</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Bid Manager</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Working on it</th>
                      <th style={{ padding: "14px 20px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamProjects.map((p) => (
                      <tr key={p.id} className="team-project-row">
                        <td style={{ padding: "14px 20px", fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.project_name}</td>
                        <td style={{ padding: "14px 20px", color: "#64748b", fontSize: 14 }}>{p.client_name || "—"}</td>
                        <td style={{ padding: "14px 20px", color: "#475569", fontSize: 14 }}>{bm.fullName}</td>
                        <td style={{ padding: "14px 20px", color: "#34908B", fontSize: 14, fontWeight: 500 }}>{getWorkingOnLabel(p)}</td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => handleViewResult(p.project_name)}
                              className="team-project-btn team-project-btn--view"
                            >
                              View result <ArrowRight size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchiveConfirmId(p.id)}
                              className="team-project-btn team-project-btn--archive"
                            >
                              <Archive size={15} />
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {archiveConfirmId != null && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 24 }}
          onClick={() => !archiving && setArchiveConfirmId(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Archive project?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#475569" }}>
              This project will be moved to Archived. You can restore it later from the Archived view.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" disabled={archiving} onClick={() => setArchiveConfirmId(null)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" disabled={archiving} onClick={() => handleArchive(archiveConfirmId)} style={{ padding: "10px 18px", borderRadius: 10, fontWeight: 600, background: "#64748b", color: "#fff", border: "none", cursor: archiving ? "not-allowed" : "pointer", opacity: archiving ? 0.7 : 1 }}>
                {archiving ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .team-project-row:hover { background: #f8fafc; }
        .team-project-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .team-project-btn--view {
          background: linear-gradient(135deg, #6FBEB2 0%, #34908B 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(111,190,178,0.3);
        }
        .team-project-btn--view:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(111,190,178,0.4); }
        .team-project-btn--archive {
          background: #fff;
          color: #64748b;
          border: 1px solid #D4F0EB;
        }
        .team-project-btn--archive:hover { background: #f8fafc; transform: translateY(-1px); }
      `}</style>
    </div>
  );
}
