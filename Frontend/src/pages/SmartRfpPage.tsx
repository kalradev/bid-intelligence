import { Copy, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectAnalysis, updateAnalysisData } from "../utils/documentAnalysis";
import { parseBidDeadlines } from "../utils/deadlineUtils";

function formatDisplayValue(value: unknown): string {
  if (value == null) return "N/A";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "N/A";
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((v) => formatDisplayValue(v)).filter((v) => v !== "N/A").join("; ");
    return joined || "N/A";
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const pick = o.text ?? o.criterion ?? o.description ?? o.value ?? o.date ?? o.deadline;
    if (pick != null) return formatDisplayValue(pick);
    try {
      return JSON.stringify(value);
    } catch {
      return "N/A";
    }
  }
  return String(value);
}

export default function SmartRfpPage() {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [animate, setAnimate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const currentDoc = localStorage.getItem("currentDocument");
        const analysisDataLocal = localStorage.getItem("analysisData");

        let projName = "";
        let docId: number | null = null;

        if (currentDoc) {
          try {
            const doc = JSON.parse(currentDoc);
            projName = doc.projectName || "";
            docId = doc.documentId ?? null;
          } catch {
            /* ignore */
          }
        }

        if (analysisDataLocal && !projName) {
          try {
            const data = JSON.parse(analysisDataLocal);
            projName = data.data?.projectName || "";
            docId = data.data?.metadata?.documentId ?? null;
          } catch {
            /* ignore */
          }
        }

        if (projName) {
          try {
            const result = await fetchProjectAnalysis(projName, docId, null);
            updateAnalysisData(result, projName);
            setAnalysisData(result);
          } catch {
            if (analysisDataLocal) {
              setAnalysisData(JSON.parse(analysisDataLocal));
            }
          }
        } else if (analysisDataLocal) {
          setAnalysisData(JSON.parse(analysisDataLocal));
        }
      } catch {
        setAnalysisData(null);
      } finally {
        setIsLoading(false);
        setTimeout(() => setAnimate(true), 60);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="universal-page-wrapper">
        <div className="universal-background">
          <div className="universal-bg-gradient-1" />
          <div className="universal-bg-gradient-2" />
          <div className="universal-bg-gradient-3" />
        </div>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 18, color: "#34908B", fontWeight: 600 }}>Loading Smart RFP analysis...</div>
          <div style={{ width: 40, height: 40, border: "4px solid #e5e7eb", borderTop: "4px solid #6FBEB2", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (!analysisData?.data) {
    return (
      <div className="universal-page-wrapper">
        <div className="universal-background">
          <div className="universal-bg-gradient-1" />
          <div className="universal-bg-gradient-2" />
          <div className="universal-bg-gradient-3" />
        </div>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 24, position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 18, color: "#64748b", textAlign: "center" }}>No analysis data found. Upload and analyze an RFP first.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="department-navbar-btn" onClick={() => navigate("/upload")}>
              Go to Upload
            </button>
            <button type="button" className="department-navbar-btn department-navbar-btn--secondary" onClick={() => navigate("/insights")}>
              Back to Insights
            </button>
          </div>
        </div>
      </div>
    );
  }

  const projectOverview = analysisData.data.departmentalSummaries?.projectOverview || {};
  const bidManagement = analysisData.data.departmentalSummaries?.bidManagement || {};
  const { submissionDeadline, bidOpeningDate } = parseBidDeadlines(
    bidManagement.keyDeadlines,
    projectOverview.lastSubmissionDate,
    projectOverview.bidOpeningDate
  );

  const calculateDaysRemaining = (dateString: string) => {
    if (!dateString || dateString === "N/A") return null;

    try {
      const deadline = new Date(dateString);

      if (isNaN(deadline.getTime())) {
        const cleanedDate = dateString.replace(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, "$1T$2");
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
    } catch {
      return null;
    }
  };

  const lastSubmissionDisplay = formatDisplayValue(submissionDeadline || projectOverview.lastSubmissionDate);
  const daysRemaining = calculateDaysRemaining(lastSubmissionDisplay === "N/A" ? "" : lastSubmissionDisplay);

  const emdValue = formatDisplayValue(projectOverview.emd);
  const projectDetails = [
    { label: "Project Name", value: formatDisplayValue(projectOverview.projectName) },
    { label: "Client", value: formatDisplayValue(projectOverview.client) },
    { label: "Tender ID", value: formatDisplayValue(projectOverview.tenderId), copy: true },
    { label: "Bid Value", value: formatDisplayValue(projectOverview.bidValue), tone: "accent" as const },
    ...(emdValue !== "N/A"
      ? [{ label: "EMD", value: emdValue, tone: "warn" as const }]
      : []),
    { label: "Completion Period", value: formatDisplayValue(projectOverview.completionPeriod) },
    {
      label: "Bid Submission Deadline",
      value: lastSubmissionDisplay,
      tone: "urgent" as const,
      showCountdown: true,
    },
    { label: "Bid Opening Date", value: formatDisplayValue(bidOpeningDate || projectOverview.bidOpeningDate) },
  ];

  const downloadExcel = () => {
    let csv = "Detail,Value\n";
    projectDetails.forEach((row) => {
      csv += `${row.label},${row.value}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Smart_RFP_Details.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied ✅");
  };

  return (
    <>
      <header className="department-navbar">
        <h1 className="department-navbar-title department-navbar-title-center">Smart RFP Analysis</h1>
        <button type="button" className="department-navbar-btn" onClick={() => navigate("/insights")}>
          Home
        </button>
      </header>

      <div className="universal-page-wrapper">
        <div className="universal-background">
          <div className="universal-bg-gradient-1" />
          <div className="universal-bg-gradient-2" />
          <div className="universal-bg-gradient-3" />
        </div>

        <main
          style={{
            minHeight: "100vh",
            width: "100%",
            padding: "90px 16px 32px",
            display: "flex",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
            opacity: animate ? 1 : 0,
            transform: animate ? "translateY(0)" : "translateY(12px)",
            transition: "0.45s ease",
          }}
        >
          <div className="smart-rfp-content-card">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 26, gap: 16 }}>
              <h2 className="smart-rfp-page-title">Project Overview</h2>

              <button type="button" className="department-navbar-btn" onClick={downloadExcel}>
                Download
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 22,
              }}
            >
              {projectDetails.map((item) => {
                const valueClass =
                  item.tone === "accent"
                    ? "smart-rfp-detail-value smart-rfp-detail-value--accent"
                    : item.tone === "warn"
                      ? "smart-rfp-detail-value smart-rfp-detail-value--warn"
                      : item.tone === "urgent"
                        ? "smart-rfp-detail-value smart-rfp-detail-value--urgent"
                        : "smart-rfp-detail-value";

                return (
                  <div key={item.label} className="smart-rfp-detail-card">
                    <p className="smart-rfp-detail-label">{item.label}</p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p className={valueClass}>{item.value}</p>

                        {item.copy && item.value !== "N/A" && (
                          <Copy
                            size={18}
                            style={{ cursor: "pointer", color: "#34908B", flexShrink: 0 }}
                            onClick={() => copyToClipboard(item.value)}
                          />
                        )}
                      </div>

                      {item.showCountdown && daysRemaining && (
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
                                : "linear-gradient(135deg, #6FBEB2, #34908B)",
                            color: "white",
                            fontSize: 13,
                            fontWeight: 700,
                            width: "fit-content",
                            boxShadow: "0 2px 8px rgba(52, 144, 139, 0.25)",
                            animation: daysRemaining.isPassed || daysRemaining.days <= 3 ? "pulse 2s infinite" : "none",
                          }}
                        >
                          <Clock size={14} />
                          <span>
                            {daysRemaining.isPassed
                              ? "Deadline Passed"
                              : `${Math.abs(daysRemaining.days)} day${Math.abs(daysRemaining.days) !== 1 ? "s" : ""} left`}
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
    </>
  );
}
