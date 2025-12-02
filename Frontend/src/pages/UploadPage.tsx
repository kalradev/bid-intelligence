import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function UploadPage() {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ✅ File upload validation
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Allow only PDF files
    if (file.type !== "application/pdf") {
      toast.error("Invalid file type. Please upload a PDF document only.", {
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

    // Valid PDF
    setUploadedFile(file);
    console.log("✅ PDF Uploaded:", file.name);
  };

  // ✅ Backend API Integration → Send PDF to localhost:3000
  const handleAnalyze = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a PDF file first!");
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      // ✅ Call backend API
      const apiUrl = "http://localhost:3000/api/rfp/analyze";

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "API request failed");
      }

      const result = await response.json();
      console.log("✅ API Response:", result);

      // 🚀 Store data in localStorage for global access
      localStorage.setItem("analysisData", JSON.stringify(result));

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

    } catch (error) {
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
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />

            {/* 
              Using a span instead of button to avoid nested interactive controls 
              inside the label, but styling it as the primary button 
            */}
            <span className="btn-primary" style={{ display: "inline-block", padding: "14px 24px", borderRadius: "12px" }}>
              {uploadedFile ? "Change File" : "Select PDF File"}
            </span>
          </label>

          {uploadedFile && (
            <button
              className="btn-primary"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              style={{ width: "100%", background: isAnalyzing ? "#9ca3af" : "#10b981" }}
            >
              {isAnalyzing ? "Analyzing..." : "Start Analysis 🚀"}
            </button>
          )}

          <div className="description-list">
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
