import { useState, useEffect, useRef } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { API_BASE_URL } from '../config';
import { getAuthToken } from '../utils/authStorage';

interface Document {
  id: number;
  fileHash: string;
  fileName: string;
  updateType: string;
  displayName?: string;
  createdAt?: string;
}

interface DocumentFilterProps {
  projectName: string;
  onDocumentChange: (documentId: number | null, documentType: string | null, displayName: string) => void;
  currentDocumentId?: number | null;
  /** Called when documents load and initial selection is set (for display only, no fetch) */
  onDisplayUpdate?: (documentId: number | null, displayName: string) => void;
}

export default function DocumentFilter({ projectName, onDocumentChange, currentDocumentId, onDisplayUpdate }: DocumentFilterProps) {
  const getDisplayName = (doc?: Partial<Document> | null) => {
    if (doc?.displayName && String(doc.displayName).trim()) return String(doc.displayName);
    if (doc?.updateType === "CORRIGENDUM") return "Corrigendum";
    if (doc?.updateType === "REFERENCE_UPDATE") return "Reference Update";
    return "Base RFP";
  };

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<{ id: number | null; type: string | null; displayName: string }>({
    id: null,
    type: null,
    displayName: "Base RFP" // Default, will be updated when documents load
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!projectName) {
        setIsLoading(false);
        return;
      }

      try {
        const token = getAuthToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/rfp/get-project-documents/${encodeURIComponent(projectName)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.documents) {
            setDocuments(data.documents);
            
            // If no current document selected, set default based on document count
            if (!currentDocumentId) {
              // If only one document (just Base RFP, no corrigendum), select it - no "Merged View"
              if (data.documents.length === 1) {
                const singleDoc = data.documents[0];
                const name = getDisplayName(singleDoc);
                setSelectedDocument({
                  id: singleDoc.id,
                  type: singleDoc.updateType,
                  displayName: name
                });
                onDisplayUpdate?.(singleDoc.id, name);
                // Don't call onDocumentChange - analysis is already loaded from upload
              } else if (data.documents.length > 1) {
                // Multiple documents - default to merged view
                setSelectedDocument({
                  id: null,
                  type: null,
                  displayName: "Merged View"
                });
                onDisplayUpdate?.(null, "Merged View");
              }
            } else {
              // If currentDocumentId is set, find and select that document
              const currentDoc = data.documents.find((d: Document) => d.id === currentDocumentId);
              if (currentDoc) {
                const name = getDisplayName(currentDoc);
                setSelectedDocument({
                  id: currentDoc.id,
                  type: currentDoc.updateType,
                  displayName: name
                });
                onDisplayUpdate?.(currentDoc.id, name);
              } else if (data.documents.length > 1) {
                // If current document not found but multiple exist, default to merged
                setSelectedDocument({
                  id: null,
                  type: null,
                  displayName: "Merged View"
                });
                onDisplayUpdate?.(null, "Merged View");
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [projectName, currentDocumentId]);

  // Update dropdown position when opened or window resizes
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 8,
            left: rect.left + window.scrollX,
          });
        }
      };
      
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const handleSelect = (doc: Document | null) => {
    if (doc) {
      const name = getDisplayName(doc);
      setSelectedDocument({
        id: doc.id,
        type: doc.updateType,
        displayName: name
      });
      onDocumentChange(doc.id, doc.updateType, name);
    } else {
      setSelectedDocument({
        id: null,
        type: null,
        displayName: "Merged View"
      });
      onDocumentChange(null, null, "Merged View (Latest)");
    }
    setIsOpen(false);
  };

  if (isLoading || documents.length === 0) {
    return null; // Don't show filter if no documents or still loading
  }

  // Check if there are multiple documents (needed for showing Merged View option)
  const hasMultipleDocuments = documents.length > 1;

  return (
    <div style={{ position: "relative", zIndex: 1000 }}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 18px",
          background: "#6FBEB2",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
          color: "#fff",
          transition: "all 0.2s ease",
          boxShadow: "0 4px 12px rgba(111,190,178,0.3)",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#34908B";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(111,190,178,0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#6FBEB2";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(111,190,178,0.3)";
        }}
      >
        <Filter size={14} />
        <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {(selectedDocument.displayName || "Base RFP") === "Merged View (Latest)" 
            ? "Merged View"
            : String(selectedDocument.displayName || "Base RFP").length > 18
            ? String(selectedDocument.displayName || "Base RFP").substring(0, 15) + "..."
            : String(selectedDocument.displayName || "Base RFP")}
        </span>
        <ChevronDown 
          size={14} 
          style={{ 
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            flexShrink: 0
          }} 
        />
      </button>

      {isOpen && buttonRef.current && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              background: "white",
              border: "2px solid rgba(111, 190, 178, 0.35)",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
              minWidth: "280px",
              maxWidth: "320px",
              maxHeight: "400px",
              overflowY: "auto",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                padding: "8px",
                borderBottom: "1px solid rgba(111, 190, 178, 0.2)",
                fontWeight: "700",
                fontSize: "12px",
                color: "#34908B",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Select Document View
            </div>
            
            {/* Merged View Option - Only show if there are multiple documents */}
            {hasMultipleDocuments && (
              <div
                onClick={() => handleSelect(null)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  background: selectedDocument.id === null ? "rgba(111, 190, 178, 0.15)" : "transparent",
                  borderLeft: selectedDocument.id === null ? "3px solid #34908B" : "3px solid transparent",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (selectedDocument.id !== null) {
                    e.currentTarget.style.background = "rgba(111, 190, 178, 0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDocument.id !== null) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ fontWeight: "600", color: "#1f2937", fontSize: "14px" }}>
                  📊 Merged View (Latest)
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                  Combined result of all documents
                </div>
              </div>
            )}

            {/* Individual Documents */}
            {documents.map((doc) => {
              const icon = doc.updateType === "BASE_RFP" ? "🛠️" : 
                          doc.updateType === "CORRIGENDUM" ? "📝" : "📚";
              
              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    background: selectedDocument.id === doc.id ? "rgba(111, 190, 178, 0.15)" : "transparent",
                    borderLeft: selectedDocument.id === doc.id ? "3px solid #34908B" : "3px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDocument.id !== doc.id) {
                      e.currentTarget.style.background = "rgba(111, 190, 178, 0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDocument.id !== doc.id) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div style={{ fontWeight: "600", color: "#1f2937", fontSize: "14px" }}>
                    {icon} {getDisplayName(doc)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "Recent"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

