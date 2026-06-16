import { ArrowLeft, ArrowRight, UserCircle } from "lucide-react";
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
  teamProjectsLimit: number;
  teamProjectsLeft: number;
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
        toast.error("Failed to load team quota data");
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

      <div style={{ maxWidth: 960, margin: "0 auto", paddingTop: NAVBAR_HEIGHT + 24, paddingBottom: 48, paddingLeft: 24, paddingRight: 24 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60, background: "rgba(255,255,255,0.95)", borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "#64748b", fontSize: 15, fontWeight: 500 }}>Loading team quota data…</span>
          </div>
        ) : bm ? (
          <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 18, padding: 0, boxShadow: "0 8px 24px rgba(15,23,42,0.08)", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "24px 28px", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(135deg, rgba(238,242,255,0.6) 0%, rgba(224,231,255,0.4) 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E8F8F5", border: "1px solid rgba(111,190,178,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(232,248,245,0.8)" }}>
                  <UserCircle size={26} color="#6FBEB2" />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
                    {bm.fullName} – Team quota
                  </h1>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b", fontWeight: 500 }}>
                    Projects: {bm.teamProjectsUsed} / {bm.teamProjectsLimit} — <strong>{bm.teamProjectsLeft} left</strong>
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
                    <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Project</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Client</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Bid Manager</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Working on it</th>
                      <th style={{ padding: "14px 20px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamProjects.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }} onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}>
                        <td style={{ padding: "14px 20px", fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.project_name}</td>
                        <td style={{ padding: "14px 20px", color: "#64748b", fontSize: 14 }}>{p.client_name || "—"}</td>
                        <td style={{ padding: "14px 20px", color: "#475569", fontSize: 14 }}>{bm.fullName}</td>
                        <td style={{ padding: "14px 20px", color: "#4338ca", fontSize: 14, fontWeight: 500 }}>{getWorkingOnLabel(p)}</td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          <button
                            onClick={() => handleViewResult(p.project_name)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "10px 18px",
                              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 10,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: 13,
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
                            View result <ArrowRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        <button
          onClick={() => navigate("/home")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 32,
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
          <ArrowLeft size={20} /> Back to Dashboard
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
