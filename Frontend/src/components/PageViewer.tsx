import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { API_BASE_URL } from '../config';

interface PageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileHash: string;
  pageNumber: number;
  query?: string;
}

export default function PageViewer({
  isOpen,
  onClose,
  fileHash,
  pageNumber,
  query,
}: PageViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [zoom, setZoom] = useState(100);
  const [fileName, setFileName] = useState<string>("document.pdf");

  // Update currentPage when pageNumber prop changes
  useEffect(() => {
    if (isOpen && pageNumber > 0) {
      setCurrentPage(pageNumber);
    }
  }, [isOpen, pageNumber]);

  // Get fileName from localStorage
  useEffect(() => {
    if (isOpen && fileHash) {
      const currentDoc = localStorage.getItem("currentDocument");
      if (currentDoc) {
        try {
          const doc = JSON.parse(currentDoc);
          if (doc.fileName) {
            setFileName(doc.fileName);
          }
        } catch (e) {
          console.error("Error parsing currentDocument:", e);
        }
      }
    }
  }, [isOpen, fileHash]);

  // Load PDF in iframe
  useEffect(() => {
    if (isOpen && fileHash && iframeRef.current && currentPage > 0) {
      const baseUrl = `${API_BASE_URL}/api/rfp/document/${fileHash}?fileName=${encodeURIComponent(fileName)}`;
      const viewerUrl = `${baseUrl}#page=${currentPage}`;
      
      iframeRef.current.src = viewerUrl;
    }
  }, [isOpen, fileHash, currentPage, fileName]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
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

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        isOpen
      ) {
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

  if (!isOpen || !fileHash || currentPage <= 0) return null;

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(currentPage + 1);
  };

  const handleZoomIn = () => {
    if (zoom < 200) {
      setZoom(zoom + 10);
    }
  };

  const handleZoomOut = () => {
    if (zoom > 50) {
      setZoom(zoom - 10);
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
          background: "rgba(0, 0, 0, 0.9)",
          zIndex: 20000,
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
            width: "95%",
            height: "95%",
            background: "#1f2937",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            animation: "slideUp 0.3s ease-out",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#111827",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#1f2937",
                  padding: "6px 12px",
                  borderRadius: "6px",
                }}
              >
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage <= 1}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    border: "none",
                    color: currentPage <= 1 ? "#4b5563" : "#9ca3af",
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage > 1) {
                      e.currentTarget.style.background = "#374151";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span
                  style={{
                    color: "#e5e7eb",
                    fontSize: "14px",
                    fontWeight: 500,
                    minWidth: "80px",
                    textAlign: "center",
                  }}
                >
                  Page {currentPage}
                </span>
                <button
                  onClick={handleNextPage}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    border: "none",
                    color: "#9ca3af",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#1f2937",
                  padding: "6px 12px",
                  borderRadius: "6px",
                }}
              >
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    border: "none",
                    color: zoom <= 50 ? "#4b5563" : "#9ca3af",
                    cursor: zoom <= 50 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (zoom > 50) {
                      e.currentTarget.style.background = "#374151";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <ZoomOut size={18} />
                </button>
                <span
                  style={{
                    color: "#e5e7eb",
                    fontSize: "14px",
                    fontWeight: 500,
                    minWidth: "50px",
                    textAlign: "center",
                  }}
                >
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  style={{
                    padding: "4px",
                    background: "transparent",
                    border: "none",
                    color: zoom >= 200 ? "#4b5563" : "#9ca3af",
                    cursor: zoom >= 200 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (zoom < 200) {
                      e.currentTarget.style.background = "#374151";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <ZoomIn size={18} />
                </button>
              </div>
              {query && (
                <div
                  style={{
                    padding: "6px 12px",
                    background: "#1e40af",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: "#dbeafe",
                  }}
                >
                  Query: "{query.substring(0, 30)}
                  {query.length > 30 ? "..." : ""}"
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#9ca3af",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#374151";
                e.currentTarget.style.color = "#e5e7eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#9ca3af";
              }}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* PDF Viewer */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              background: "#525252",
              position: "relative",
            }}
          >
            <iframe
              ref={iframeRef}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top left",
                transition: "transform 0.2s ease",
              }}
              title="PDF Viewer"
            />
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
      `}</style>
    </>
  );
}

