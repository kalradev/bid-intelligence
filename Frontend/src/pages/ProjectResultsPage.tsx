import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { ArrowLeft, FileText } from "lucide-react";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";

export default function ProjectResultsPage() {
  const { projectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<{
    projectName: string;
    departmentalSummaries: { projectOverview?: Record<string, string> };
    metadata?: { lastUpdated?: string; updateType?: string; fileName?: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (!u) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  useEffect(() => {
    if (!projectName) return;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/rfp/get-project-analysis/${encodeURIComponent(projectName)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.detail || "Project or analysis not found");
          setAnalysis(null);
          return;
        }
        const data = await res.json();
        if (data.success && data.data) {
          setAnalysis({
            projectName: data.data.projectName,
            departmentalSummaries: data.data.departmentalSummaries || {},
            metadata: data.data.metadata,
          });
        } else {
          setError("No analysis data");
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load project result");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [projectName, navigate]);

  const handleViewFullAnalysis = () => {
    if (!analysis) return;
    const payload = {
      success: true,
      project_centric: true,
      data: {
        projectName: analysis.projectName,
        departmentalSummaries: analysis.departmentalSummaries,
        metadata: analysis.metadata,
      },
    };
    localStorage.setItem("analysisData", JSON.stringify(payload));
    localStorage.setItem("currentDocument", JSON.stringify({ projectName: analysis.projectName }));
    navigate("/insights");
  };

  const projectOverview = analysis?.departmentalSummaries?.projectOverview || {};
  const details = [
    { label: "Project Name", value: projectOverview.projectName || "N/A" },
    { label: "Client", value: projectOverview.client || "N/A" },
    { label: "Tender ID", value: projectOverview.tenderId || "N/A" },
    { label: "Bid Value", value: projectOverview.bidValue || "N/A" },
    { label: "EMD", value: projectOverview.emd || "N/A" },
    { label: "Completion Period", value: projectOverview.completionPeriod || "N/A" },
    { label: "Last Date of Submission", value: projectOverview.lastSubmissionDate || "N/A" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, rgba(250,243,225,0.6) 0%, rgba(234,239,239,0.5) 50%, rgba(255,179,179,0.2) 100%)" }}>
      <DashboardNavbar />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: `${NAVBAR_HEIGHT + 24}px 24px 32px` }}>
        {loading && <div style={{ textAlign: "center", padding: 48, color: "#5a6340" }}>Loading project result…</div>}
        {error && !loading && (
          <div style={{ padding: 24, background: "rgba(254,226,226,0.8)", color: "#dc2626", borderRadius: 12, marginBottom: 24, border: "1px solid rgba(255,143,143,0.3)" }}>
            {error}
          </div>
        )}
        {analysis && !loading && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", border: "1px solid rgba(255,143,143,0.2)" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={24} style={{ color: "#FF8F8F" }} /> {analysis.projectName} – Result (read-only)
            </h1>
            {analysis.metadata?.lastUpdated && (
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Last updated: {new Date(analysis.metadata.lastUpdated).toLocaleString()}</p>
            )}

            <div style={{ marginTop: 24 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#5a6340" }}>Project overview</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {details.map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,179,179,0.08)", borderRadius: 10, border: "1px solid rgba(255,143,143,0.15)" }}>
                    <span style={{ fontWeight: 600, color: "#475569" }}>{label}</span>
                    <span style={{ color: "#1e293b" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <button
                onClick={handleViewFullAnalysis}
                style={{
                  padding: "12px 24px",
                  background: "#FF8F8F",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 15,
                  boxShadow: "0 2px 8px rgba(255,143,143,0.3)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E87878";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#FF8F8F";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,143,143,0.3)";
                }}
              >
                View full analysis (departments & insights)
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <button
            onClick={() => navigate("/home")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              background: "rgba(255,179,179,0.5)",
              border: "1px solid rgba(255,143,143,0.4)",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#2d3319",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FFB3B3";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,179,179,0.5)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
            }}
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
