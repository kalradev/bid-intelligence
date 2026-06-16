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
    <header className="department-navbar department-navbar--inline">
      {/* CENTER TITLE */}
      <h2 className="department-navbar-title department-navbar-title-center">
        {pageTitle}
      </h2>

      {/* RIGHT SIDE BUTTONS */}
      <div className="department-navbar-actions">
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
            className="department-navbar-btn department-navbar-btn--secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            title="Download as PDF"
          >
            <Download size={20} />
          </button>
        )}

        {/* HOME BUTTON */}
        <button
          className="department-navbar-btn"
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
        >
          Home
        </button>
      </div>
    </header>
  );
};

export default NavbarBidManagement;
