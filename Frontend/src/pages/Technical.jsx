import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";

const Technical = () => {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      setData(parsed?.data?.departmentalSummaries?.technical);
    }
  }, []);

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
              Object.entries(data.keyPoints).map(([category, items]) => (
                items && items.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px" }}>
                      {items.map((point, idx) => (
                        <li key={idx} style={{ marginBottom: "6px" }}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )
              ))
            ) : Array.isArray(data.keyPoints) && data.keyPoints.length > 0 ? (
              // Fallback for old array structure
              <ul style={{ paddingLeft: "20px" }}>
                {data.keyPoints.map((point, idx) => (
                  <li key={idx} style={{ marginBottom: "6px" }}>{point}</li>
                ))}
              </ul>
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
              // New organized structure with subheadings
              Object.entries(data.criticalRequirements).map(([category, items]) => (
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

        {/* Risk Areas */}
        {data.riskAreas && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px", color: "#dc2626" }}>
              Risk Areas
            </h3>
            {typeof data.riskAreas === 'object' && !Array.isArray(data.riskAreas) ? (
              // New organized structure with subheadings
              Object.entries(data.riskAreas).map(([category, items]) => (
                items && items.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#991b1b", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                      {items.map((risk, idx) => (
                        <li key={idx} style={{ marginBottom: "6px" }}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )
              ))
            ) : Array.isArray(data.riskAreas) && data.riskAreas.length > 0 ? (
              // Fallback for old array structure
              <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                {data.riskAreas.map((risk, idx) => (
                  <li key={idx} style={{ marginBottom: "6px" }}>{risk}</li>
                ))}
              </ul>
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
