import { useEffect, useRef } from "react";
import { X, ExternalLink, FileText } from "lucide-react";

interface SourceReference {
  pageNumber?: string;
  fileName?: string;
  snippet?: string;
  relevance?: number;
}

interface SourceReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceReference[];
  query?: string;
  isLoading?: boolean;
}

export default function SourceReferenceModal({
  isOpen,
  onClose,
  sources,
  query,
  isLoading = false,
}: SourceReferenceModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePageClick = (pageNumber: string, fileName?: string) => {
    const currentDoc = localStorage.getItem("currentDocument");
    let fileHash = null;
    let docFileName = fileName;
    
    if (currentDoc) {
      try {
        const doc = JSON.parse(currentDoc);
        fileHash = doc.fileHash;
        docFileName = docFileName || doc.fileName;
      } catch (e) {
        console.error("Error parsing currentDocument:", e);
      }
    }
    
    // Try recentRfpAnalysis if currentDocument didn't work
    if (!fileHash) {
      const recentRfp = localStorage.getItem("recentRfpAnalysis");
      if (recentRfp) {
        try {
          const rfp = JSON.parse(recentRfp);
          fileHash = rfp.fileHash;
          docFileName = docFileName || rfp.fileName || "document.pdf";
        } catch (e) {
          console.error("Error parsing recentRfpAnalysis:", e);
        }
      }
    }
    
    // Try analysisData as last resort
    if (!fileHash) {
      const analysisData = localStorage.getItem("analysisData");
      if (analysisData) {
        try {
          const data = JSON.parse(analysisData);
          fileHash = data?.data?.fileHash;
          docFileName = docFileName || data?.data?.fileName || "document.pdf";
        } catch (e) {
          console.error("Error parsing analysisData:", e);
        }
      }
    }
    
    if (fileHash) {
      // Open PDF directly in browser's native viewer with page anchor
      const directPdfUrl = `http://localhost:3000/api/rfp/document/${fileHash}?fileName=${encodeURIComponent(docFileName || "document.pdf")}#page=${pageNumber}`;
      window.open(directPdfUrl, "_blank", "noopener,noreferrer");
    } else {
      console.error("No document found in localStorage");
      alert("No document found. Please upload and analyze an RFP document first.");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Modal */}
        <div
          ref={modalRef}
          style={{
            background: "white",
            borderRadius: "12px",
            width: "90%",
            maxWidth: "500px",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            animation: "slideUp 0.3s ease-out",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={20} color="white" />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#1f2937",
                  }}
                >
                  Sources
                </h3>
                {query && (
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    References for: "{query.substring(0, 50)}
                    {query.length > 50 ? "..." : ""}"
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6b7280",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.color = "#374151";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#6b7280";
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px",
              background: "#ffffff",
            }}
          >
            {isLoading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid #e5e7eb",
                    borderTopColor: "#3b82f6",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
                  Searching for references...
                </p>
              </div>
            ) : sources.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "#6b7280",
                }}
              >
                <FileText size={48} style={{ marginBottom: "12px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "14px" }}>
                  No source references found for this item.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {sources.map((source, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "16px",
                      background: "#f9fafb",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f3f4f6";
                      e.currentTarget.style.borderColor = "#d1d5db";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f9fafb";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  >
                    {/* Source Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#6b7280",
                            background: "#e5e7eb",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          Source {idx + 1}
                        </span>
                        {source.fileName && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#6b7280",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <FileText size={12} />
                            {source.fileName}
                          </span>
                        )}
                      </div>
                      {source.pageNumber && (
                        <button
                          onClick={() => handlePageClick(source.pageNumber!, source.fileName)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            background: "#eff6ff",
                            border: "1px solid #dbeafe",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#3b82f6",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#dbeafe";
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          title="Open page in document viewer"
                        >
                          Page {source.pageNumber}
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>

                    {/* Snippet */}
                    {source.snippet && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#374151",
                          lineHeight: "1.6",
                        }}
                      >
                        {source.snippet}
                      </p>
                    )}

                    {/* Relevance Score */}
                    {source.relevance !== undefined && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "11px",
                          color: "#6b7280",
                        }}
                      >
                        Relevance: {Math.round(source.relevance)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

