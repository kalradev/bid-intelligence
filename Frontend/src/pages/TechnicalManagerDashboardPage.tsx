import { ArrowRight, FileUp, FolderOpen, LayoutDashboard, LogOut, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import bidIntelligenceLogo from "../assets/bid-intelligence-logo.svg";
import cacheLogo from "../assets/Cache-Logo.png";
import womenOwnedLogo from "../assets/women-owned-logo.png";
import { API_BASE_URL } from "../config";

interface ProjectItem {
  id: number;
  project_name: string;
  tender_id: string | null;
  client_name: string | null;
  user_id: number | null;
  assigned_by_full_name?: string | null;
}

const SIDEBAR_WIDTH = 240;
const NAVBAR_HEIGHT = 88;

export default function TechnicalManagerDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [userDisplayName, setUserDisplayName] = useState<string>("Technical Manager");
  const [showByBidManager, setShowByBidManager] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(u);
      if ((parsed.role || "").toLowerCase() !== "technical_manager") {
        navigate("/home");
        return;
      }
      if (parsed.fullName) setUserDisplayName(parsed.fullName);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const fetchProjects = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rfp/projects`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Failed to load assigned projects");
        return;
      }
      const data = await res.json();
      const list = data.success && Array.isArray(data.projects) ? data.projects : [];
      setProjects(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out");
    navigate("/login");
  };

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
            title="Account & security"
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FF8F8F", color: "#fff", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,143,143,0.3)" }}>
              {(userDisplayName || "T").charAt(0).toUpperCase()}
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
          background: "rgba(248,250,252,0.7)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(226,232,240,0.6)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <nav style={{ flex: 1, padding: "20px 10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, background: "#FF8F8F", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Views
          </div>
          <button
            type="button"
            className={`sidebar-nav-toggle${!showByBidManager ? " active" : ""}`}
            onClick={() => setShowByBidManager(false)}
            style={{
              ...navButtonBase,
              background: !showByBidManager ? "#FF8F8F" : "rgba(255,179,179,0.4)",
              color: !showByBidManager ? "#fff" : "#2d3319",
              fontWeight: !showByBidManager ? 700 : 600,
              boxShadow: !showByBidManager ? "0 4px 12px rgba(255,143,143,0.3)" : "none",
              border: !showByBidManager ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="Assigned projects"
          >
            <LayoutDashboard size={20} style={{ flexShrink: 0 }} />
            <span>Assigned projects</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav-toggle${showByBidManager ? " active" : ""}`}
            onClick={() => setShowByBidManager(true)}
            style={{
              ...navButtonBase,
              background: showByBidManager ? "#FFB3B3" : "rgba(255,179,179,0.3)",
              color: showByBidManager ? "#fff" : "#2d3319",
              fontWeight: showByBidManager ? 700 : 600,
              boxShadow: showByBidManager ? "0 4px 12px rgba(255,143,143,0.3)" : "none",
              border: showByBidManager ? "none" : "1px solid rgba(255,143,143,0.3)",
            }}
            title="See how many projects you're on and which Bid Manager assigned each"
          >
            <Users size={20} style={{ flexShrink: 0 }} />
            <span>By Bid Manager</span>
            {projects.length > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>{projects.length} projects</span>
            )}
          </button>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent 0%, rgba(255,143,143,0.5) 50%, transparent 100%)", margin: "12px 0" }} />
          <div style={{ fontSize: 11, fontWeight: 700, background: "#FF8F8F", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase", letterSpacing: "0.05em", paddingLeft: 12, marginBottom: 6 }}>
            Actions
          </div>
          <button
            type="button"
            className="sidebar-nav-toggle"
            onClick={() => navigate("/upload")}
            style={{ ...navButtonBase, background: "rgba(255,179,179,0.4)", color: "#2d3319", border: "1px solid rgba(255,143,143,0.3)" }}
            title="Upload corrigendum or reference"
          >
            <FileUp size={20} style={{ flexShrink: 0 }} />
            <span>Upload Corrigendum / Reference</span>
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
        <div style={{ position: "absolute", inset: 0, background: "rgba(255, 255, 255, 0.35)", backdropFilter: "blur(2px)" }} />
      </div>

      <main style={{ position: "relative", zIndex: 1, marginLeft: SIDEBAR_WIDTH, padding: `${NAVBAR_HEIGHT + 28}px 28px 48px`, transition: "margin-left 0.25s ease" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {showByBidManager ? "By Bid Manager" : "Assigned projects"}
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                {showByBidManager
                  ? "See how many projects you're working on and which Bid Manager assigned each one."
                  : "Projects your Bid Manager assigned to you. You can upload corrigendum and reference documents only."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchProjects()}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                background: "linear-gradient(135deg, rgba(255,143,143,0.15) 0%, rgba(255,179,179,0.1) 100%)",
                border: "1px solid rgba(255,143,143,0.3)",
                borderRadius: 12,
                cursor: loading ? "wait" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                color: "#2d3319",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <RefreshCw size={18} style={{ opacity: loading ? 0.6 : 1 }} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: 80 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid #EAEFEF", borderTopColor: "#FF8F8F", animation: "spin 0.8s linear infinite" }} />
              <span style={{ color: "#64748b", fontSize: 15, fontWeight: 500 }}>Loading your assigned projects…</span>
            </div>
          ) : projects.length === 0 ? (
            <div
              style={{
                padding: 56,
                textAlign: "center",
                background: "rgba(255,255,255,0.9)",
                borderRadius: 20,
                border: "1px solid rgba(226,232,240,0.8)",
                boxShadow: "0 8px 32px rgba(139,92,246,0.08), 0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ width: 72, height: 72, borderRadius: 20, background: "#EAEFEF", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20, borderLeft: "4px solid #5a6340" }}>
                <FolderOpen size={36} color="#5a6340" />
              </div>
              <p style={{ margin: 0, color: "#1e293b", fontSize: 18, fontWeight: 700 }}>No projects assigned yet</p>
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 15, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                Your Bid Manager will assign you to projects so you can upload corrigendum and reference documents. Check back later or ask your Bid Manager.
              </p>
            </div>
          ) : showByBidManager ? (
            <section>
              <div style={{ marginBottom: 24, padding: "20px 24px", background: "rgba(255,255,255,0.95)", borderRadius: 16, border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 4px 16px rgba(139,92,246,0.06)" }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                  You're working on <strong>{projects.length}</strong> project{projects.length !== 1 ? "s" : ""}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>Grouped by the Bid Manager who assigned each project to you</p>
              </div>
              {(() => {
                const byBm = projects.reduce<Record<string, ProjectItem[]>>((acc, p) => {
                  const key = p.assigned_by_full_name || "Unknown";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(p);
                  return acc;
                }, {});
                const entries = Object.entries(byBm).sort((a, b) => b[1].length - a[1].length);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {entries.map(([bmName, bmProjects]) => (
                      <div
                        key={bmName}
                        style={{
                          background: "rgba(255,255,255,0.95)",
                          borderRadius: 20,
                          border: "1px solid rgba(226,232,240,0.8)",
                          boxShadow: "0 8px 32px rgba(139,92,246,0.06), 0 2px 8px rgba(0,0,0,0.04)",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ padding: "18px 24px", background: "linear-gradient(135deg, rgba(234,239,239,0.8) 0%, rgba(255,143,143,0.1) 100%)", borderBottom: "1px solid #EAEFEF", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(145deg, #FF8F8F 0%, #E87878 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(232,120,120,0.3)" }}>
                            <Users size={22} color="#fff" />
                          </div>
                          <div>
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{bmName}</h2>
                            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>{bmProjects.length} project{bmProjects.length !== 1 ? "s" : ""} assigned to you</p>
                          </div>
                        </div>
                        <div style={{ padding: "12px 24px 20px" }}>
                          {bmProjects.map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "14px 16px",
                                marginTop: 8,
                                background: "#f8fafc",
                                borderRadius: 12,
                                border: "1px solid #EAEFEF",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 15 }}>{p.project_name}</span>
                                <span style={{ marginLeft: 12, color: "#64748b", fontSize: 13 }}>{p.tender_id || "—"}</span>
                                {p.client_name && <span style={{ marginLeft: 8, color: "#94a3b8", fontSize: 13 }}> · {p.client_name}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate(`/project-results/${encodeURIComponent(p.project_name)}`)}
                                style={{
                                  padding: "8px 16px",
                                  background: "#FF8F8F",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 10,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  boxShadow: "0 4px 12px rgba(255,143,143,0.35)",
                                }}
                              >
                                View result <ArrowRight size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          ) : (
            <section>
              <div
                style={{
                  background: "rgba(255,255,255,0.95)",
                  borderRadius: 20,
                  border: "1px solid rgba(226,232,240,0.8)",
                  boxShadow: "0 8px 32px rgba(139,92,246,0.06), 0 2px 8px rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #EAEFEF", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EAEFEF", borderLeft: "4px solid #5a6340", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FolderOpen size={20} color="#5a6340" />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Your projects ({projects.length})</h2>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>Select a project to upload documents or view analysis</p>
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #EAEFEF" }}>
                      <th style={{ padding: "16px 24px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Project</th>
                      <th style={{ padding: "16px 24px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Tender ID</th>
                      <th style={{ padding: "16px 24px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Client</th>
                      <th style={{ padding: "16px 24px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 13 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: "1px solid #EAEFEF",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(139,92,246,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "16px 24px", fontWeight: 600, color: "#0f172a", fontSize: 15 }}>{p.project_name}</td>
                        <td style={{ padding: "16px 24px", color: "#64748b", fontSize: 14 }}>{p.tender_id || "—"}</td>
                        <td style={{ padding: "16px 24px", color: "#64748b", fontSize: 14 }}>{p.client_name || "—"}</td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => navigate(`/project-results/${encodeURIComponent(p.project_name)}`)}
                              style={{
                                padding: "10px 18px",
                                background: "#FF8F8F",
                                color: "#fff",
                                border: "none",
                                borderRadius: 10,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontSize: 13,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
                              }}
                            >
                              View result <ArrowRight size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sidebar-nav-toggle:hover:not(.active) { transform: translateX(4px); box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important; transition: all 0.3s ease; }
        .sidebar-nav-toggle.active:hover { opacity: 0.92; }
      `}</style>
    </div>
  );
}
