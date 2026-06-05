import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { processDepartmentData, filterEMD } from "../utils/deduplication";
import { exportToPDF } from "../utils/pdfExport";

const SCM = () => {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem("analysisData");
      if (storedData) {
        const parsed = JSON.parse(storedData);
        const scmData = parsed?.data?.departmentalSummaries?.scm;
        const bm = parsed?.data?.departmentalSummaries?.bidManagement;

        const fallbackScm = {
          keyPoints: bm?.keyPoints || {},
          complianceRequirements: bm?.complianceRequirements || {},
          riskAreas: bm?.riskAreas || {},
          actionItems: Array.isArray(bm?.actionItems) ? bm.actionItems : [],
        };

        const hasScmPayload = scmData && Object.keys(scmData || {}).length > 0;
        const mergedScm = hasScmPayload
          ? { ...fallbackScm, ...scmData }
          : fallbackScm;

        // Process and deduplicate all list-based fields, filter N/A
        const processedData = processDepartmentData(mergedScm || {});
        setData(processedData);
      } else {
        setData({});
      }
    } catch (error) {
      console.error("Error loading SCM data:", error);
      setData({});
    }
  }, []);

  const handleDownloadPDF = () => {
    if (contentRef.current) {
      exportToPDF(contentRef.current, "SCM_Summary");
    }
  };

  if (!data) {
    return (
      <>
        <NavbarBidManagement pageTitle="SCM" />
        <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
          <p>Loading data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavbarBidManagement pageTitle="SCM" onDownloadPDF={handleDownloadPDF} />

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
        {/* Lead Time */}
        <h3 style={{ fontWeight: "700", marginBottom: "8px" }}>Lead Time</h3>
        <p style={{ fontWeight: "600" }}>{data.leadTime || "N/A"}</p>

        {/* Critical Items */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Critical Items
        </h3>
        <p style={{ fontWeight: "600" }}>{data.criticalItems || data.criticalItemsCount || "N/A"}</p>

        {/* Risk Level */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Risk Level
        </h3>
        <div style={{
          marginBottom: "12px"
        }}>
          <p style={{
            fontWeight: "700",
            fontSize: "18px",
            color: data.riskLevel === "High" ? "#dc2626" : data.riskLevel === "Medium" ? "#d97706" : "#059669",
            marginBottom: "8px"
          }}>
            {data.riskLevel || "N/A"}
          </p>

          {/* Risk Level Explanation */}
          <div style={{
            background: data.riskLevel === "High" ? "#fee2e2" : data.riskLevel === "Medium" ? "#fef3c7" : "#d1fae5",
            border: `1px solid ${data.riskLevel === "High" ? "#fecaca" : data.riskLevel === "Medium" ? "#fde68a" : "#a7f3d0"}`,
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "14px",
            color: data.riskLevel === "High" ? "#991b1b" : data.riskLevel === "Medium" ? "#92400e" : "#065f46"
          }}>
            <p style={{ margin: "0 0 6px 0", fontWeight: "600" }}>
              What does this mean?
            </p>
            {data.riskLevel === "High" && (
              <ul style={{ margin: "0", paddingLeft: "20px" }}>
                <li>Significant delivery constraints and timeline risks</li>
                <li>Limited supplier availability or import dependencies</li>
                <li>Complex logistics and procurement challenges</li>
                <li>Requires early sourcing and contingency planning</li>
              </ul>
            )}
            {data.riskLevel === "Medium" && (
              <ul style={{ margin: "0", paddingLeft: "20px" }}>
                <li>Moderate delivery constraints and timeline considerations</li>
                <li>Some supplier availability concerns or import dependencies</li>
                <li>Standard logistics with some planning required</li>
                <li>Monitor critical items and lead times closely</li>
              </ul>
            )}
            {data.riskLevel === "Low" && (
              <ul style={{ margin: "0", paddingLeft: "20px" }}>
                <li>Minimal delivery constraints and timeline risks</li>
                <li>Good supplier availability and local sourcing options</li>
                <li>Straightforward logistics and procurement</li>
                <li>Standard procurement processes should suffice</li>
              </ul>
            )}
            {(!data.riskLevel || data.riskLevel === "N/A") && (
              <p style={{ margin: "0" }}>
                Risk level is determined based on delivery constraints, supplier availability, import dependencies,
                and complexity of procurement. It helps prioritize supply chain planning efforts.
              </p>
            )}
          </div>

          {/* Risk Factors */}
          <div style={{
            marginTop: "12px",
            fontSize: "13px",
            color: "#6b7280",
            fontStyle: "italic"
          }}>
            <p style={{ margin: "0" }}>
              <strong>Risk Factors Considered:</strong> Delivery timelines, supplier availability,
              import dependencies, critical items count, and logistics complexity.
            </p>
          </div>
        </div>

        {/* Sourcing Strategy */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "12px",
          }}
        >
          Sourcing Strategy
        </h3>

        <div
          style={{
            background: "#e5efff",
            padding: "14px 18px",
            borderRadius: "8px",
            marginBottom: "12px",
            fontWeight: "600",
            color: "#1956a3",
          }}
        >
          {data.sourcingStrategy || "N/A"}
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
                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                return listItems.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px" }}>
                      {listItems.map((point, idx) => (
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

        {/* Compliance Requirements */}
        {data.complianceRequirements && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Compliance Requirements
            </h3>
            {typeof data.complianceRequirements === 'object' && !Array.isArray(data.complianceRequirements) ? (
              // New organized structure with subheadings
              Object.entries(data.complianceRequirements).map(([category, items]) => {
                const filteredItems = Array.isArray(items) ? filterEMD(items) : items;
                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                return listItems.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px" }}>
                      {listItems.map((req, idx) => (
                        <li key={idx} style={{ marginBottom: "6px" }}>{req}</li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : Array.isArray(data.complianceRequirements) && data.complianceRequirements.length > 0 ? (
              // Fallback for old array structure - filter EMD values
              (() => {
                const filteredReqs = filterEMD(data.complianceRequirements);
                return filteredReqs.length > 0 ? (
                  <ul style={{ paddingLeft: "20px" }}>
                    {filteredReqs.map((req, idx) => (
                      <li key={idx} style={{ marginBottom: "6px" }}>{req}</li>
                    ))}
                  </ul>
                ) : null;
              })()
            ) : null}
          </>
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
                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                return listItems.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#991b1b", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                      {listItems.map((risk, idx) => (
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

export default SCM;
