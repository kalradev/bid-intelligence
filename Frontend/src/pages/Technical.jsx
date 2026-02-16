import { useCallback, useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { API_BASE_URL } from "../config";
import { exportToPDF } from "../utils/pdfExport";
import { processDepartmentData, filterEMD } from "../utils/deduplication";

const Technical = () => {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);
  const [eligibilityChecks, setEligibilityChecks] = useState({});
  const [projectName, setProjectName] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [technicalEligibilityCriteria, setTechnicalEligibilityCriteria] = useState([]);

  // Load eligibility checklist from API (same as Bid Management)
  const loadEligibilityChecklist = useCallback(async (projName, docId) => {
    if (!projName) return;
    setIsLoadingChecklist(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoadingChecklist(false);
        return;
      }
      let url = `${API_BASE_URL}/api/rfp/eligibility-checklist/${encodeURIComponent(projName)}`;
      if (docId) url += `?document_id=${docId}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.checklist) setEligibilityChecks(result.checklist);
        else setEligibilityChecks({});
      }
    } catch (error) {
      console.error("Error loading eligibility checklist:", error);
    } finally {
      setIsLoadingChecklist(false);
    }
  }, []);

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      const technicalData = parsed?.data?.departmentalSummaries?.technical;
      const projName = parsed?.data?.projectName;
      const docId = parsed?.data?.metadata?.documentId;
      const criteria = parsed?.data?.departmentalSummaries?.bidManagement?.successFactors?.technicalEvaluationCriteria;

      setProjectName(projName || null);
      setDocumentId(docId || null);
      setTechnicalEligibilityCriteria(Array.isArray(criteria) ? criteria : []);

      if (technicalData) {
        setData(processDepartmentData(technicalData));
      } else {
        setData(null);
      }
    }
  }, []);

  useEffect(() => {
    if (projectName && data) loadEligibilityChecklist(projectName, documentId);
  }, [projectName, documentId, data, loadEligibilityChecklist]);

  const handleEligibilityCheck = async (item, checked) => {
    if (!projectName) return;
    const previousChecks = { ...eligibilityChecks };
    const newChecks = { ...eligibilityChecks, [item]: checked };
    setEligibilityChecks(newChecks);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setEligibilityChecks(previousChecks);
        return;
      }
      const response = await fetch(
        `${API_BASE_URL}/api/rfp/eligibility-checklist/${encodeURIComponent(projectName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ checklist: newChecks, document_id: documentId ? String(documentId) : null }),
        }
      );
      if (!response.ok) setEligibilityChecks(previousChecks);
    } catch (error) {
      console.error("Error saving eligibility checklist:", error);
      setEligibilityChecks(previousChecks);
    }
  };

  const handleDownloadPDF = () => {
    if (contentRef.current) {
      exportToPDF(contentRef.current, "Technical_Summary");
    }
  };

  if (!data) {
    return (
      <>
        <NavbarBidManagement pageTitle="Technical" />
        <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
          <p>Loading data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavbarBidManagement pageTitle="Technical" onDownloadPDF={handleDownloadPDF} />

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
        {/* Total Items */}
        <h3 style={{ fontWeight: "700", marginBottom: "8px" }}>Total Items</h3>
        <p style={{ fontWeight: "700", fontSize: "24px" }}>{data.totalItems || "N/A"}</p>

        {/* Key Specifications */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "12px",
          }}
        >
          Key Specifications
        </h3>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {data.keySpecifications && data.keySpecifications.length > 0 ? (
            data.keySpecifications.map((spec, idx) => (
              <span
                key={idx}
                style={{
                  background: "#d5ffe4",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#137f41",
                  fontWeight: "600",
                  display: "block",
                  width: "100%",
                  marginBottom: "4px",
                }}
              >
                <strong>{spec.productName || "N/A"}:</strong> {spec.specification || "N/A"}
              </span>
            ))
          ) : (
            <p>No specifications available</p>
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

        {/* Critical Requirements */}
        {data.criticalRequirements && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Critical Requirements
            </h3>
            {typeof data.criticalRequirements === 'object' && !Array.isArray(data.criticalRequirements) ? (
              // New organized structure with subheadings - exclude "Quality" category
              Object.entries(data.criticalRequirements)
                .filter(([category]) => category.toLowerCase() !== 'quality')
                .map(([category, items]) => (
                  items && items.length > 0 && (
                    <div key={category} style={{ marginBottom: "16px" }}>
                      <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                        {category}
                      </h4>
                      <ul style={{ paddingLeft: "20px" }}>
                        {items.map((req, idx) => (
                          <li key={idx} style={{ marginBottom: "6px" }}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )
                ))
            ) : Array.isArray(data.criticalRequirements) && data.criticalRequirements.length > 0 ? (
              // Fallback for old array structure
              <ul style={{ paddingLeft: "20px" }}>
                {data.criticalRequirements.map((req, idx) => (
                  <li key={idx} style={{ marginBottom: "6px" }}>{req}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        {/* Technical Eligibility Criteria only (with Yes/No) */}
        {technicalEligibilityCriteria && technicalEligibilityCriteria.length > 0 && (
          <div style={{ marginBottom: "24px", marginTop: "26px", background: "#fef3c7", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
            <h3 style={{ fontWeight: "700", fontSize: "18px", color: "#92400e", marginBottom: "12px", marginTop: "0" }}>
              Technical Eligibility Criteria
            </h3>
            {isLoadingChecklist && (
              <p style={{ fontSize: "14px", color: "#92400e", marginBottom: "12px" }}>Loading checklist...</p>
            )}
            <ul style={{ paddingLeft: "0", margin: "0", listStyle: "none" }}>
              {technicalEligibilityCriteria.map((item, idx) => {
                const checkStatus = eligibilityChecks[item];
                const isYes = checkStatus === true || checkStatus === "true";
                const isNo = checkStatus === false || checkStatus === "false";
                return (
                  <li
                    key={idx}
                    style={{
                      marginBottom: "16px",
                      padding: "12px",
                      background: isYes ? "#dcfce7" : isNo ? "#fee2e2" : "#f9fafb",
                      borderRadius: "8px",
                      border: `2px solid ${isYes ? "#15803d" : isNo ? "#b91c1c" : "#d1d5db"}`,
                      transition: "all 0.3s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      <span style={{ flex: 1, fontSize: "16px", color: "#78350f", fontWeight: "500", minWidth: "300px" }}>
                        {item}
                      </span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          onClick={() => handleEligibilityCheck(item, true)}
                          disabled={isLoadingChecklist}
                          style={{
                            padding: "10px 24px",
                            fontSize: "15px",
                            fontWeight: "700",
                            borderRadius: "8px",
                            border: isYes ? "3px solid #15803d" : "2px solid #d1d5db",
                            cursor: isLoadingChecklist ? "not-allowed" : "pointer",
                            background: isYes ? "#15803d" : isNo ? "#f3f4f6" : "#ffffff",
                            color: isYes ? "white" : isNo ? "#9ca3af" : "#4b5563",
                            opacity: isLoadingChecklist ? 0.6 : 1,
                          }}
                        >
                          ✓ Yes
                        </button>
                        <button
                          onClick={() => handleEligibilityCheck(item, false)}
                          disabled={isLoadingChecklist}
                          style={{
                            padding: "10px 24px",
                            fontSize: "15px",
                            fontWeight: "700",
                            borderRadius: "8px",
                            border: isNo ? "3px solid #b91c1c" : "2px solid #d1d5db",
                            cursor: isLoadingChecklist ? "not-allowed" : "pointer",
                            background: isNo ? "#b91c1c" : isYes ? "#f3f4f6" : "#ffffff",
                            color: isNo ? "white" : isYes ? "#9ca3af" : "#4b5563",
                            opacity: isLoadingChecklist ? 0.6 : 1,
                          }}
                        >
                          ✗ No
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Risk Areas */}
        {data.riskAreas && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px", color: "#dc2626" }}>
              Risk Areas
            </h3>
            {typeof data.riskAreas === 'object' && !Array.isArray(data.riskAreas) ? (
              // New organized structure with subheadings
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
            ) : Array.isArray(data.riskAreas) && data.riskAreas.length > 0 ? (
              // Fallback for old array structure - filter EMD values
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
          </>
        )}

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

export default Technical;
