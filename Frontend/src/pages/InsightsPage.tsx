import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import bidIntelligenceLogo from "../assets/bid-intelligence-logo.svg";
import DepartmentCard from "../components/DepartmentCard";
import FeatureCard from "../components/FeatureCard";
import DocumentFilter from "../components/DocumentFilter";
import { departments, features } from "../data/uiData";
import { generateSummaryPDF } from "../utils/summaryPdfExport";
import { fetchProjectAnalysis, updateAnalysisData } from "../utils/documentAnalysis";
import toast from "react-hot-toast";

export default function InsightsPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState<string>("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [viewingDisplayName, setViewingDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Get project name from localStorage
  useEffect(() => {
    const currentDoc = localStorage.getItem("currentDocument");
    if (currentDoc) {
      try {
        const doc = JSON.parse(currentDoc);
        setProjectName(doc.projectName || "");
        setSelectedDocumentId(doc.documentId || null);
      } catch (e) {
        console.error("Error parsing currentDocument:", e);
      }
    }
    
    // Also check analysisData for project name
    const analysisData = localStorage.getItem("analysisData");
    if (analysisData && !projectName) {
      try {
        const data = JSON.parse(analysisData);
        if (data.data?.projectName) {
          setProjectName(data.data.projectName);
        }
      } catch (e) {
        console.error("Error parsing analysisData:", e);
      }
    }

  }, []);

  // Handle scroll to section on page load if hash is present
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#departments-section") {
      setTimeout(() => {
        const element = document.getElementById("departments-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, []);

  const handleDocumentChange = async (documentId: number | null, documentType: string | null, displayName: string) => {
    if (!projectName) return;
    
    setIsLoading(true);
    try {
      const result = await fetchProjectAnalysis(projectName, documentId, documentType);
      updateAnalysisData(result, projectName);
      setSelectedDocumentId(documentId);
      setViewingDisplayName(displayName);
      
      // Reload the page to update all department pages
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to load document analysis");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisplayUpdate = (documentId: number | null, displayName: string) => {
    setSelectedDocumentId(documentId);
    setViewingDisplayName(displayName);
  };

  const handleDownloadSummary = () => {
    const analysisData = localStorage.getItem("analysisData");
    if (analysisData) {
      generateSummaryPDF(JSON.parse(analysisData));
    } else {
      alert("No analysis data available to download");
    }
  };

  const NAVBAR_HEIGHT = 72;

  return (
    <div className="universal-page-wrapper insights-page" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Navbar: Bid Intelligence + 3 toggles only (no Women Owned, CACHE, profile) */}
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
          padding: "0 24px",
        }}
      >
        <div style={{ minWidth: 200, display: "flex", justifyContent: "flex-start" }} />
        <button
          type="button"
          onClick={() => navigate("/home")}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "transparent",
            border: "none",
            padding: "8px 12px",
            cursor: "pointer",
            outline: "none",
            transition: "opacity 0.2s ease",
          }}
          title="Go to Dashboard"
        >
          <img src={bidIntelligenceLogo} alt="" style={{ height: 44, width: 44, flexShrink: 0 }} />
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", background: "linear-gradient(90deg, #E87878, #2d3319)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>Bid Intelligence</span>
        </button>
        <div style={{ minWidth: 200, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          {projectName && (
            <DocumentFilter
              projectName={projectName}
              onDocumentChange={handleDocumentChange}
              currentDocumentId={selectedDocumentId}
              onDisplayUpdate={handleDisplayUpdate}
            />
          )}
          <button
            onClick={handleDownloadSummary}
            title="Download Summary PDF"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "rgba(255,179,179,0.5)",
              color: "#2d3319",
              border: "1px solid rgba(255,143,143,0.4)",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FFB3B3";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(255,143,143,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,179,179,0.5)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Download size={20} /> Download
          </button>
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "instant" }); navigate("/upload"); }}
            style={{
              padding: "10px 22px",
              background: "#FF8F8F",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(255,143,143,0.3)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E87878";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(255,143,143,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#FF8F8F";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,143,143,0.3)";
            }}
          >
            Analysis
          </button>
        </div>
      </header>

      {/* Spacer for fixed navbar */}
      <div style={{ height: NAVBAR_HEIGHT }} />

      {/* 🌈 Animated Background */}
      <div className="universal-background" style={{ zIndex: 0 }}>
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      {/* 🌟 MAIN CONTENT - same light pinkish-white as dashboard */}
      <div
        className="min-h-screen"
        style={{ position: "relative", zIndex: 10, background: "rgba(255, 255, 255, 0.12)", overflow: "hidden" }}
      >
        <div className="w-full max-w-screen-xl mx-auto px-4 lg:px-8 py-16">
          {/* ===== HEADER ===== */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 rounded-full" style={{ background: 'rgba(255,179,179,0.45)', border: '1px solid rgba(255,143,143,0.4)' }}>
              <span className="font-semibold text-sm" style={{ color: '#5a6340' }}>
                AI-Powered Bid Intelligence
              </span>
            </div>

            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Your AI Insights Are Ready
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Explore detailed intelligence across departments, identify Make in
              India opportunities, and dive deeper into product mapping, global
              research, and cost estimation.
            </p>
            
            {/* Document Type Indicator */}
            {projectName && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "rgba(255,179,179,0.35)",
                border: "1px solid rgba(255,143,143,0.4)",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#2d3319",
                marginTop: "16px"
              }}>
                <span>📄</span>
                <span>
                  {viewingDisplayName != null
                    ? `Viewing: ${viewingDisplayName}`
                    : selectedDocumentId
                      ? `Viewing: ${(() => {
                          try {
                            const raw = localStorage.getItem("currentDocument");
                            if (!raw) return "Document";
                            const doc = JSON.parse(raw);
                            return doc.displayName || doc.projectName || "Document";
                          } catch { return "Document"; }
                        })()}`
                      : "Viewing: Merged View"}
                </span>
              </div>
            )}
          </div>

          {/* ===== FEATURE CARDS ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {features.map((feature, idx) => (
              <FeatureCard
                key={idx}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "instant" });
                  navigate(feature.route);
                }}
              />
            ))}
          </div>

          {/* ===== DEPARTMENTS ===== */}
          <div id="departments-section" className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">
              Complete Department Coverage
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {departments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  icon={dept.icon}
                  name={dept.name}
                  textClass={dept.textClass}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
