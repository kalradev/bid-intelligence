import { Download, LogOut, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DepartmentCard from "../components/DepartmentCard";
import FeatureCard from "../components/FeatureCard";
import InteractiveBackground from "../components/InteractiveBackground";
import DocumentFilter from "../components/DocumentFilter";
import { departments, features } from "../data/uiData";
import { generateSummaryPDF } from "../utils/summaryPdfExport";
import { fetchProjectAnalysis, updateAnalysisData } from "../utils/documentAnalysis";
import toast from "react-hot-toast";

export default function InsightsPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState<string>("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const showTeamLink = userRole === "bid_admin" || userRole === "bid_manager" || userRole === "technical_manager";

  // Get project name and user from localStorage
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

    const u = localStorage.getItem("user");
    if (u) {
      try {
        const parsed = JSON.parse(u);
        setUserRole((parsed.role || "").toLowerCase());
      } catch {
        setUserRole(null);
      }
    } else {
      setUserRole(null);
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
      
      // Reload the page to update all department pages
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Failed to load document analysis");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSummary = () => {
    const analysisData = localStorage.getItem("analysisData");
    if (analysisData) {
      generateSummaryPDF(JSON.parse(analysisData));
    } else {
      alert("No analysis data available to download");
    }
  };

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('analysisData');
    localStorage.removeItem('currentDocument');
    localStorage.removeItem('recentRfpAnalysis');
    
    toast.success("Logged out successfully!");
    navigate("/login");
  };

  return (
    <div className="universal-page-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 🌟 NAVBAR START */}
      <nav className="insights-navbar" style={{ zIndex: 20, position: 'relative' }}>
        {/* Left spacer to balance right buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', visibility: 'hidden' }}>
          <button style={{ padding: '10px 16px' }}><span style={{ width: '20px', display: 'inline-block' }}></span></button>
          <button style={{ padding: '10px 24px' }}>Analysis</button>
        </div>

        <div className="navbar-title">Bid Intelligence.AI</div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Document Filter */}
          {projectName && (
            <DocumentFilter
              projectName={projectName}
              onDocumentChange={handleDocumentChange}
              currentDocumentId={selectedDocumentId}
            />
          )}
          
          {/* Download Summary Button */}
          <button
            className="navbar-btn-icon"
            onClick={handleDownloadSummary}
            title="Download Summary PDF"
            style={{
              background: '#0891b2',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: '0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#0e7490')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#0891b2')}
          >
            <Download size={20} />
          </button>

          {/* Analysis Button */}
          <button className="navbar-btn" onClick={() => {
            window.scrollTo({ top: 0, behavior: "instant" });
            navigate("/upload");
          }}>
            Analysis
          </button>

          {showTeamLink && (
            <button
              className="navbar-btn"
              onClick={() => navigate("/team")}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Users size={18} /> Team
            </button>
          )}

          {/* Logout Button */}
          <button
            className="navbar-btn-icon"
            onClick={handleLogout}
            title="Logout"
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: '0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#b91c1c')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#dc2626')}
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>
      {/* 🌟 NAVBAR END */}

      {/* 🌈 Animated Background */}
      <div className="universal-background" style={{ zIndex: 0 }}>
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      {/* 🕸️ Interactive Particle Background */}
      <InteractiveBackground />

      {/* 🌟 MAIN CONTENT */}
      <div
        className="min-h-screen hero-background"
        style={{ position: "relative", zIndex: 10 }}
      >
        <div className="w-full max-w-screen-xl mx-auto px-4 lg:px-8 py-16">
          {/* ===== HEADER ===== */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-blue-100 rounded-full">
              <span className="text-blue-600 font-semibold text-sm">
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
                background: "rgba(99, 102, 241, 0.1)",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#4f46e5",
                marginTop: "16px"
              }}>
                <span>📄</span>
                <span>
                  {selectedDocumentId 
                    ? `Viewing: ${localStorage.getItem("currentDocument") ? JSON.parse(localStorage.getItem("currentDocument") || "{}").displayName || "Document" : "Document"}`
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
