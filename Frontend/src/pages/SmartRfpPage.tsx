import { Copy, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SmartRfpPage() {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [animate, setAnimate] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      setAnalysisData(parsed);
    }
    setTimeout(() => setAnimate(true), 80);
  }, []);

  // Real-time countdown - updates every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (!analysisData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const projectOverview = analysisData?.data?.departmentalSummaries?.projectOverview || {};

  // Helper function to calculate days remaining until deadline
  const calculateDaysRemaining = (dateString: string) => {
    if (!dateString || dateString === "N/A") return null;
    
    try {
      // Try to parse the date string
      const deadline = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(deadline.getTime())) {
        // Try alternative parsing for formats like "2024-07-10 15:00:00"
        const cleanedDate = dateString.replace(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');
        const alternativeDeadline = new Date(cleanedDate);
        
        if (isNaN(alternativeDeadline.getTime())) {
          return null;
        }
        
        const diffTime = alternativeDeadline.getTime() - currentTime.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return { days: diffDays, isPassed: diffDays < 0 };
      }
      
      const diffTime = deadline.getTime() - currentTime.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return { days: diffDays, isPassed: diffDays < 0 };
    } catch (error) {
      return null;
    }
  };

  const daysRemaining = calculateDaysRemaining(projectOverview.lastSubmissionDate);

  // Filter out EMD if it's "N/A" or not present
  const projectDetails = [
    {
      label: "Project Name",
      value: projectOverview.projectName || "N/A",
    },
    {
      label: "Client",
      value: projectOverview.client || "N/A",
    },
    {
      label: "Tender ID",
      value: projectOverview.tenderId || "N/A",
      copy: true,
    },
    {
      label: "Bid Value",
      value: projectOverview.bidValue || "N/A",
      color: "#059669",
    },
    // Only include EMD if it's present and not "N/A"
    ...(projectOverview.emd && projectOverview.emd !== "N/A" ? [{
      label: "EMD",
      value: projectOverview.emd,
      color: "#D97706",
    }] : []),
    {
      label: "Completion Period",
      value: projectOverview.completionPeriod || "N/A",
    },
    {
      label: "Last Date of Submission",
      value: projectOverview.lastSubmissionDate || "N/A",
      color: "#DC2626",
    },
  ];

  const downloadExcel = () => {
    let csv = "Detail,Value\n";
    projectDetails.forEach((row) => (csv += `${row.label},${row.value}\n`));

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Smart_RFP_Details.csv";
    a.click();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied ✅");
  };

  return (
    <div className="smart-rfp-page-wrapper">
      {/* Background */}
      <div className="smart-rfp-background">
        <div className="smart-bg-gradient-1"></div>
        <div className="smart-bg-gradient-2"></div>
        <div className="smart-bg-gradient-3"></div>
      </div>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          opacity: animate ? 1 : 0,
          transform: animate ? "translateY(0)" : "translateY(12px)",
          transition: "0.45s ease",
        }}
      >
        {/* NAVBAR */}
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            width: "100%",
            background: "linear-gradient(135deg, #001f3f 0%, #003d7a 100%)",
            boxShadow: "0 4px 20px rgba(0, 31, 63, 0.3)",
            zIndex: 100,
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              flex: 1,
              textAlign: "center",
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            Smart RFP Analysis
          </h1>

          <button
            onClick={() => navigate("/insights")}
            style={{
              background: "#06b6d4",
              color: "#ffffff",
              padding: "10px 20px",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Home
          </button>
        </header>

        {/* CONTENT */}
        <main
          style={{
            width: "100%",
            padding: "80px 5px 5px 5px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1050px",
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #e5e7eb",
            }}
          >
            {/* TITLE + DOWNLOAD */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 26 }}>
              <h2
                style={{
                  flex: 1,
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#111",
                }}
              >
                Project Overview
              </h2>

              <button
                onClick={downloadExcel}
                style={{
                  background: "#059669",
                  color: "white",
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: 0,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Download
              </button>
            </div>

            {/* DETAILS GRID */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "22px",
              }}
            >
              {projectDetails.map((item, i) => {
                const hoverColors = [
                  "rgba(59, 130, 246, 0.08)",
                  "rgba(139, 92, 246, 0.08)",
                  "rgba(16, 185, 129, 0.08)",
                  "rgba(6, 182, 212, 0.08)",
                  "rgba(249, 115, 22, 0.08)",
                  "rgba(236, 72, 153, 0.08)",
                  "rgba(20, 184, 166, 0.08)",
                ];

                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 14,
                      padding: "18px 22px",
                      background: "linear-gradient(135deg, #ffffff, #f8faff)",
                      border: "1px solid #e5e7eb",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                      e.currentTarget.style.background = hoverColors[i];
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
                      e.currentTarget.style.borderColor = hoverColors[i].replace("0.08", "0.3");
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.background = "linear-gradient(135deg, #ffffff, #f8faff)";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                      {item.label}
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ fontSize: 16, fontWeight: 600, color: item.color || "#111" }}>
                          {item.value}
                        </p>

                        {item.copy && (
                          <Copy
                            size={18}
                            style={{ cursor: "pointer", color: "#2563eb" }}
                            onClick={() => copyToClipboard(item.value)}
                          />
                        )}
                      </div>

                      {/* Countdown Badge for Last Date of Submission */}
                      {item.label === "Last Date of Submission" && daysRemaining && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 20,
                            background: daysRemaining.isPassed 
                              ? "linear-gradient(135deg, #ef4444, #dc2626)" 
                              : daysRemaining.days <= 7
                              ? "linear-gradient(135deg, #f59e0b, #d97706)"
                              : "linear-gradient(135deg, #10b981, #059669)",
                            color: "white",
                            fontSize: 13,
                            fontWeight: 700,
                            width: "fit-content",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            animation: daysRemaining.isPassed || daysRemaining.days <= 3 ? "pulse 2s infinite" : "none",
                          }}
                        >
                          <Clock size={14} />
                          <span>
                            {daysRemaining.isPassed 
                              ? "Deadline Passed" 
                              : `${Math.abs(daysRemaining.days)} day${Math.abs(daysRemaining.days) !== 1 ? 's' : ''} left`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
