import { Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import DocumentFilter from "./DocumentFilter";
import { fetchProjectAnalysis, updateAnalysisData } from "../utils/documentAnalysis";
import toast from "react-hot-toast";

const NavbarBidManagement = ({ pageTitle = "Bid Management", onDownloadPDF }) => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

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

  const handleDocumentChange = async (documentId, documentType, displayName) => {
    if (!projectName) return;
    
    try {
      const result = await fetchProjectAnalysis(projectName, documentId, documentType);
      updateAnalysisData(result, projectName);
      setSelectedDocumentId(documentId);
      
      // Reload the page to update all department pages
      window.location.reload();
    } catch (error) {
      toast.error(error.message || "Failed to load document analysis");
    }
  };

  return (
    <header
      style={{
        background: "linear-gradient(90deg, #002f5e, #0056a6)",
        padding: "20px 40px",
        display: "flex",
        alignItems: "center",
        color: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        position: "relative",
      }}
    >
      {/* CENTER TITLE */}
      <h2
        style={{
          margin: "0 auto",
          fontSize: "26px",
          fontWeight: "600",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {pageTitle}
      </h2>

      {/* RIGHT SIDE BUTTONS */}
      <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
        {/* DOCUMENT FILTER */}
        {projectName && (
          <DocumentFilter
            projectName={projectName}
            onDocumentChange={handleDocumentChange}
            currentDocumentId={selectedDocumentId}
          />
        )}
        
        {/* DOWNLOAD PDF BUTTON */}
        {onDownloadPDF && (
          <button
            onClick={onDownloadPDF}
            style={{
              background: "#0891b2",
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "18px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "0.3s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#0e7490")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#0891b2")}
            title="Download as PDF"
          >
            <Download size={20} />
          </button>
        )}

        {/* HOME BUTTON */}
        <button
          onClick={() => {
            navigate("/insights#departments-section");
            // Small delay to ensure page loads before scrolling
            setTimeout(() => {
              const element = document.getElementById("departments-section");
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }, 100);
          }}
          style={{
            background: "#00a878",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "10px 22px",
            fontSize: "18px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.target.style.background = "#008f64")}
          onMouseOut={(e) => (e.target.style.background = "#00a878")}
        >
          Home
        </button>

        {/* LOGOUT BUTTON */}
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "10px 22px",
            fontSize: "18px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.target.style.background = "#b91c1c")}
          onMouseOut={(e) => (e.target.style.background = "#dc2626")}
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default NavbarBidManagement;
