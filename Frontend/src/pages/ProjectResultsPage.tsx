import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { ArrowLeft, FileText } from "lucide-react";

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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%)", padding: 24 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <button
          onClick={() => navigate("/home")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, padding: "10px 16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#374151" }}
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        {loading && <div style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>Loading project result…</div>}
        {error && !loading && (
          <div style={{ padding: 24, background: "#fee2e2", color: "#dc2626", borderRadius: 12, marginBottom: 24 }}>
            {error}
          </div>
        )}
        {analysis && !loading && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={24} /> {analysis.projectName} – Result (read-only)
            </h1>
            {analysis.metadata?.lastUpdated && (
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Last updated: {new Date(analysis.metadata.lastUpdated).toLocaleString()}</p>
            )}

            <div style={{ marginTop: 24 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "#4f46e5" }}>Project overview</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {details.map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f9fafb", borderRadius: 8 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{label}</span>
                    <span style={{ color: "#111827" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <button
                onClick={handleViewFullAnalysis}
                style={{ padding: "12px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 15 }}
              >
                View full analysis (departments & insights)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
