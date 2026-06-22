import { FileText, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";

type RefDoc = {
  id: number;
  label: string;
  file_name: string;
  has_text: boolean;
  created_at: string | null;
};

export default function EligibilityReferenceDocsPanel() {
  const [docs, setDocs] = useState<RefDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rfp/eligibility-reference-documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {
      toast.error("Could not load eligibility documents");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (file: File) => {
    const token = getAuthToken();
    if (!token) {
      toast.error("Please log in");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (label.trim()) form.append("label", label.trim());
      const res = await fetch(`${API_BASE_URL}/api/rfp/eligibility-reference-documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).join(", ") : data.message || `Upload failed (${res.status})`;
        throw new Error(msg);
      }
      toast.success("Document uploaded for eligibility checking");
      setLabel("");
      await fetchDocs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this eligibility reference document?")) return;
    const token = getAuthToken();
    if (!token) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rfp/eligibility-reference-documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Document removed");
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("Could not delete document");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="upload-eligibility-panel">
      <h1 className="upload-title">Eligibility reference documents</h1>
      <p style={{ margin: 0, textAlign: "center", color: "#64748b", fontSize: 14, maxWidth: 480 }}>
        Upload company certificates, registrations, turnover proofs, and similar documents. When you analyze an RFP,
        each eligibility criterion is auto-marked Yes or No where possible. Remaining points can be filled manually in Bid Management.
      </p>

      <div
        style={{
          width: "100%",
          background: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(232,247,244,0.6) 100%)",
          padding: 24,
          borderRadius: 16,
          border: "2px solid rgba(111,190,178,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
            Document label (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. GST certificate, Turnover FY24"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "2px solid rgba(99, 102, 241, 0.25)",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: uploading ? "#94a3b8" : "linear-gradient(180deg, #6FBEB2 0%, #34908B 100%)",
            color: "#fff",
            fontWeight: 700,
            cursor: uploading ? "wait" : "pointer",
            fontSize: 15,
          }}
        >
          <Upload size={18} />
          {uploading ? "Uploading…" : "Add document"}
        </button>
      </div>

      <div style={{ width: "100%", marginTop: 8 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
          Stored documents ({docs.length})
        </h3>
        {loading ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>Loading…</p>
        ) : docs.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14, padding: 24, textAlign: "center", background: "#f8fafc", borderRadius: 12 }}>
            No reference documents yet. Add certificates and company proofs above.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {docs.map((doc) => (
              <li
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #D4F0EB",
                }}
              >
                <FileText size={20} color="#34908B" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{doc.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.file_name}
                    {!doc.has_text && " · text extraction pending"}
                  </div>
                </div>
                <button
                  type="button"
                  title="Delete"
                  disabled={deletingId === doc.id}
                  onClick={() => handleDelete(doc.id)}
                  style={{
                    padding: 8,
                    border: "none",
                    borderRadius: 8,
                    background: "#fee2e2",
                    color: "#dc2626",
                    cursor: deletingId === doc.id ? "wait" : "pointer",
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
