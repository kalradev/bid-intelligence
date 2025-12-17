import { useState, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function UploadPage() {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ✅ File upload validation
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Allowed file types
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/excel",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/bmp",
      "image/tiff",
      "image/webp"
    ];

    const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(fileExtension)) {
      toast.error("Invalid file type. Please upload PDF, Word, Excel, or Image files.", {
        duration: 3000,
        position: "top-right",
        style: {
          border: "1px solid #ef4444",
          padding: "12px",
          color: "#b91c1c",
          background: "#fee2e2",
          fontWeight: "500",
        },
        iconTheme: {
          primary: "#dc2626",
          secondary: "#fff",
        },
      });

      event.target.value = "";
      setUploadedFile(null);
      return;
    }

    // Valid file
    setUploadedFile(file);
    const fileTypeName = file.type.startsWith("image/") ? "Image" : 
                         file.type.includes("spreadsheet") || file.type.includes("excel") ? "Excel" :
                         file.type.includes("word") || file.type.includes("msword") ? "Word" : "PDF";
    console.log(`✅ ${fileTypeName} File Uploaded:`, file.name);
  };

  // ✅ Cancel analysis
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAnalyzing(false);
      
      toast.success("Analysis cancelled", {
        duration: 2000,
        position: "top-right",
        style: {
          border: "1px solid #f59e0b",
          padding: "12px",
          color: "#92400e",
          background: "#fef3c7",
          fontWeight: "500",
        },
        iconTheme: {
          primary: "#f59e0b",
          secondary: "#fff",
        },
      });
    }
  };

  // ✅ Backend API Integration → Send file to localhost:3000
  const handleAnalyze = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a file first!");
      return;
    }

    setIsAnalyzing(true);

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      // ✅ Call backend API with abort signal
      const apiUrl = "http://localhost:3000/api/rfp/analyze";

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
        signal: signal, // Add abort signal
      });

      // Check if request was aborted
      if (signal.aborted) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "API request failed");
      }

      const result = await response.json();
      
      // Check again if request was aborted during JSON parsing
      if (signal.aborted) {
        return;
      }

      console.log("✅ API Response:", result);

      // 🚀 Store data in localStorage for global access
      localStorage.setItem("analysisData", JSON.stringify(result));
      
      // 🚀 Store fileHash for chatbot document-specific queries and document viewing
      if (result.data && result.data.fileHash) {
        const documentInfo = {
          fileHash: result.data.fileHash,
          fileName: result.data.fileName || uploadedFile.name
        };
        localStorage.setItem("recentRfpAnalysis", JSON.stringify(documentInfo));
        localStorage.setItem("currentDocument", JSON.stringify(documentInfo)); // For document viewer
        console.log("✅ Document ID stored for chatbot:", result.data.fileHash);
      }

      toast.success("RFP successfully analyzed!", {
        duration: 1500,
        position: "top-right",
        style: {
          border: "1px solid #10b981",
          padding: "12px",
          color: "#065f46",
          background: "#ecfdf5",
          fontWeight: "500",
        },
      });

      // ✅ Redirect to insights page
      setTimeout(() => {
        navigate("/insights");
      }, 1500);

    } catch (error: any) {
      // Don't show error if request was cancelled
      if (error.name === 'AbortError' || signal.aborted) {
        console.log("Request cancelled by user");
        return;
      }

      console.error("❌ API Error:", error);
      toast.error("Failed to analyze RFP. Please try again later.", {
        duration: 3000,
        position: "top-right",
        style: {
          border: "1px solid #ef4444",
          padding: "12px",
          color: "#b91c1c",
          background: "#fee2e2",
          fontWeight: "500",
        },
      });
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="universal-page-wrapper">
      {/* Background */}
      <div className="universal-background">
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      <div className="min-h-screen py-12" style={{ position: "relative", zIndex: 1 }}>
        <Toaster />

        <div className="upload-container">
          <h1 className="upload-title">Upload RFP Document</h1>

          {/* 
            Making the whole box clickable by wrapping it in a label 
            that points to the hidden file input 
          */}
          <label htmlFor="file-upload" className="upload-box">
            <p style={{ fontSize: "18px", marginBottom: "16px", color: "#555" }}>
              {uploadedFile ? `✅ ${uploadedFile.name}` : "📤 Drop your RFP here"}
            </p>

            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />

            {/* 
              Using a span instead of button to avoid nested interactive controls 
              inside the label, but styling it as the primary button 
            */}
            <span className="btn-primary" style={{ display: "inline-block", padding: "14px 24px", borderRadius: "12px" }}>
              {uploadedFile ? "Change File" : "Select Document"}
            </span>
          </label>

          {uploadedFile && (
            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
              {!isAnalyzing ? (
                <button
                  className="btn-primary"
                  onClick={handleAnalyze}
                  style={{ flex: 1, background: "#10b981" }}
                >
                  Start Analysis 🚀
                </button>
              ) : (
                <>
                  <button
                    className="btn-primary"
                    disabled
                    style={{ 
                      flex: 1, 
                      background: "#6b7280",
                      cursor: "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <span style={{ 
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid #fff",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite"
                    }}></span>
                    Analyzing...
                  </button>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: "14px 24px",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "16px",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "#dc2626";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "#ef4444";
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          <div className="description-list">
            <p>🔹 Supports PDF, Word, Excel, and Image files</p>
            <p>🔹 AI categorizes content by department</p>
            <p>🔹 BOQ items mapped to OEMs + MII identification</p>
            <p>🔹 Cost estimates auto-generated</p>
          </div>

          <button className="btn-secondary" onClick={() => navigate("/")}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
