import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";
import { processDepartmentData, filterEMD } from "../utils/deduplication";

const Legal = () => {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);
  const [projectName, setProjectName] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [userRiskAreas, setUserRiskAreas] = useState([]);
  const [newRiskInput, setNewRiskInput] = useState("");

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      const legalData = parsed?.data?.departmentalSummaries?.legal;
      setProjectName(parsed?.data?.projectName ?? null);
      setDocumentId(parsed?.data?.metadata?.documentId ?? null);
      if (legalData) {
        setData(processDepartmentData(legalData));
      } else {
        setData(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!projectName) { setUserRiskAreas([]); return; }
    const key = `riskAreas_user_legal_${projectName}_${documentId ?? ""}`;
    try {
      const stored = localStorage.getItem(key);
      setUserRiskAreas(stored ? (JSON.parse(stored) || []) : []);
    } catch { setUserRiskAreas([]); }
  }, [projectName, documentId]);

  useEffect(() => {
    if (!projectName || userRiskAreas.length === 0) return;
    localStorage.setItem(`riskAreas_user_legal_${projectName}_${documentId ?? ""}`, JSON.stringify(userRiskAreas));
  }, [projectName, documentId, userRiskAreas]);

  const handleAddUserRisk = () => {
    const trimmed = newRiskInput.trim();
    if (!trimmed) return;
    setUserRiskAreas((prev) => [...prev, trimmed]);
    setNewRiskInput("");
  };
  const handleRemoveUserRisk = (index) => {
    setUserRiskAreas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDownloadPDF = () => {
    if (contentRef.current) {
      exportToPDF(contentRef.current, "Legal_Summary");
    }
  };

  if (!data) {
    return (
      <>
        <NavbarBidManagement pageTitle="Legal" />
        <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
          <p>Loading data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavbarBidManagement pageTitle="Legal" onDownloadPDF={handleDownloadPDF} />

      {/* CONTENT SECTION */}
      <div
        ref={contentRef}
        style={{
          maxWidth: "900px",
          margin: "40px auto",
          background: "white",
          padding: "35px",
          borderRadius: "12px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
          fontSize: "18px",
          lineHeight: "32px",
        }}
      >
        {/* Contract Type */}
        <h3 style={{ fontWeight: "700", marginBottom: "8px" }}>
          Contract Type
        </h3>
        <p>{data.contractType || "N/A"}</p>

        {/* Liability Cap */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Liability Cap
        </h3>
        <p>{data.liabilityCap || "N/A"}</p>

        {/* Dispute Resolution */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Dispute Resolution
        </h3>
        <p>{data.disputeResolution || "N/A"}</p>

        {/* Required Compliance Documents */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "12px",
          }}
        >
          Required Compliance Documents
        </h3>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {data.requiredComplianceDocuments && data.requiredComplianceDocuments.length > 0 ? (
            data.requiredComplianceDocuments.map((doc, idx) => (
              <span
                key={idx}
                style={{
                  background: "#ffdddd",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "14px",
                  color: "#b80f0f",
                  fontWeight: "600",
                }}
              >
                {doc}
              </span>
            ))
          ) : data.requiredDocuments && data.requiredDocuments.length > 0 ? (
            // Fallback for requiredDocuments field name
            data.requiredDocuments.map((doc, idx) => (
              <span
                key={idx}
                style={{
                  background: "#ffdddd",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "14px",
                  color: "#b80f0f",
                  fontWeight: "600",
                }}
              >
                {doc}
              </span>
            ))
          ) : (
            <p>No compliance documents specified</p>
          )}
        </div>

        {/* Key Points */}
        {data.keyPoints && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Key Points
            </h3>
            {typeof data.keyPoints === 'object' && !Array.isArray(data.keyPoints) ? (
              // New organized structure with subheadings
              Object.entries(data.keyPoints).map(([category, items]) => {
                const filteredItems = Array.isArray(items) ? filterEMD(items) : items;
                return filteredItems && filteredItems.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px" }}>
                      {filteredItems.map((point, idx) => (
                        <li key={idx} style={{ marginBottom: "6px" }}>{point}</li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : Array.isArray(data.keyPoints) && data.keyPoints.length > 0 ? (
              // Fallback for old array structure - filter EMD values
              (() => {
                const filteredPoints = filterEMD(data.keyPoints);
                return filteredPoints.length > 0 ? (
                  <ul style={{ paddingLeft: "20px" }}>
                    {filteredPoints.map((point, idx) => (
                      <li key={idx} style={{ marginBottom: "6px" }}>{point}</li>
                    ))}
                  </ul>
                ) : null;
              })()
            ) : null}
          </>
        )}

        {/* Critical Dates */}
        {data.criticalDates && data.criticalDates.length > 0 && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Critical Dates
            </h3>
            <div style={{ background: "#fef3c7", padding: "15px", borderRadius: "8px" }}>
              {data.criticalDates.map((item, idx) => (
                <p key={idx} style={{ marginBottom: "8px" }}>
                  <strong>{item.date}:</strong> {item.description}
                </p>
              ))}
            </div>
          </>
        )}

        {/* Risk Areas (document + your risks) */}
        {(data.riskAreas || userRiskAreas.length > 0) && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px", color: "#dc2626" }}>
              Risk Areas
            </h3>
            {data.riskAreas && typeof data.riskAreas === 'object' && !Array.isArray(data.riskAreas) ? (
              Object.entries(data.riskAreas).map(([category, items]) => {
                const filteredItems = Array.isArray(items) ? filterEMD(items) : items;
                return filteredItems && filteredItems.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#991b1b", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                      {filteredItems.map((risk, idx) => (
                        <li key={idx} style={{ marginBottom: "6px" }}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : data.riskAreas && Array.isArray(data.riskAreas) && data.riskAreas.length > 0 ? (
              (() => {
                const filteredRisks = filterEMD(data.riskAreas);
                return filteredRisks.length > 0 ? (
                  <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                    {filteredRisks.map((risk, idx) => (
                      <li key={idx} style={{ marginBottom: "6px" }}>{risk}</li>
                    ))}
                  </ul>
                ) : null;
              })()
            ) : null}
            {userRiskAreas.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#991b1b", marginBottom: "8px", marginTop: "12px" }}>Your risks</h4>
                <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                  {userRiskAreas.map((risk, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Your risk areas */}
        <div style={{ marginTop: "26px", marginBottom: "24px", background: "#fef2f2", padding: "16px", borderRadius: "8px", border: "1px solid #fecaca" }}>
          <h3 style={{ fontWeight: "700", fontSize: "18px", color: "#991b1b", marginBottom: "12px", marginTop: "0" }}>Your risk areas</h3>
          <p style={{ fontSize: "14px", color: "#7f1d1d", marginBottom: "12px" }}>Add risks you want to track (saved for this project/document).</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <input type="text" value={newRiskInput} onChange={(e) => setNewRiskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddUserRisk()} placeholder="Type a risk and press Enter or Add" style={{ flex: "1", minWidth: "200px", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "14px" }} />
            <button type="button" onClick={handleAddUserRisk} style={{ padding: "10px 20px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          {userRiskAreas.length > 0 ? (
            <ul style={{ paddingLeft: "20px", margin: "0", color: "#991b1b" }}>
              {userRiskAreas.map((risk, idx) => (
                <li key={idx} style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ flex: 1 }}>{risk}</span>
                  <button type="button" onClick={() => handleRemoveUserRisk(idx)} style={{ padding: "4px 10px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: "14px", color: "#9ca3af", margin: 0 }}>No risks added yet.</p>
          )}
        </div>

        {/* Action Items */}
        {data.actionItems && data.actionItems.length > 0 && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Action Items
            </h3>
            <ul style={{ paddingLeft: "20px" }}>
              {data.actionItems.map((action, idx) => (
                <li key={idx} style={{ marginBottom: "6px" }}>{action}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
};

export default Legal;
