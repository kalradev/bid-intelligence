import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";

interface ComparisonResultItem {
  id: number;
  project_id: number;
  tool_document_id: number | null;
  final_bid_upload_id: number;
  comparison_output: {
    sections?: string[];
    differences?: Array<{
      section: string;
      field: string;
      tool_value: string;
      user_value: string;
      summary: string;
    }>;
    summary?: string;
  };
  created_at: string | null;
}

export default function ProjectComparisonPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ComparisonResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }
    if (!projectId) {
      setError("Project ID missing");
      setLoading(false);
      return;
    }
    const pid = parseInt(projectId, 10);
    if (Number.isNaN(pid)) {
      setError("Invalid project ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/api/rfp/projects/${pid}/comparison-results`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load comparison results");
        return res.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.results)) {
          setResults(data.results);
          if (data.results.length > 0 && !selectedId) setSelectedId(data.results[0].id);
        } else {
          setResults([]);
        }
      })
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  const selected = results.find((r) => r.id === selectedId);

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
          <ArrowLeft size={18} /> Back
        </button>
        <p style={{ color: "#dc2626" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <button type="button" onClick={() => navigate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
        <ArrowLeft size={18} /> Back
      </button>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#1e293b" }}>Comparison results</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Tool output vs uploaded final bid for this project.</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading…</div>
      ) : results.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "#f8fafc", borderRadius: 12, color: "#64748b" }}>
          No comparison results yet. Upload a final bid from the project row to run a comparison.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: selectedId === r.id ? "2px solid #6FBEB2" : "1px solid #e2e8f0",
                  background: selectedId === r.id ? "rgba(111,190,178,0.1)" : "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#1e293b",
                }}
              >
                {r.created_at ? new Date(r.created_at).toLocaleString() : `Result #${r.id}`}
              </button>
            ))}
          </div>
          {selected && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              {selected.comparison_output?.summary && (
                <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 14, color: "#475569" }}>
                  {selected.comparison_output.summary}
                </div>
              )}
              <div style={{ padding: 16 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Differences</h3>
                {(selected.comparison_output?.differences?.length ?? 0) === 0 ? (
                  <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>No section-level differences recorded.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                    {selected.comparison_output?.differences?.map((d, i) => (
                      <li key={i} style={{ borderLeft: "3px solid #6FBEB2", paddingLeft: 12, fontSize: 13 }}>
                        <strong style={{ color: "#475569" }}>{d.section}</strong> — {d.field}
                        {d.tool_value && (
                          <div style={{ marginTop: 4, color: "#64748b" }}>
                            <span style={{ fontWeight: 600 }}>Tool:</span> {d.tool_value.slice(0, 300)}{d.tool_value.length > 300 ? "…" : ""}
                          </div>
                        )}
                        {d.user_value && (
                          <div style={{ marginTop: 4, color: "#16a34a" }}>
                            <span style={{ fontWeight: 600 }}>User doc:</span> {d.user_value.slice(0, 300)}{d.user_value.length > 300 ? "…" : ""}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
