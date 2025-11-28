import { useEffect, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";

const Technical = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      setData(parsed?.data?.departmentalSummaries?.technical);
    }
  }, []);

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
      <NavbarBidManagement pageTitle="Technical" />

      {/* CONTENT SECTION */}
      <div
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

        {/* Compliance */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Compliance
        </h3>
        <p style={{ fontWeight: "700", color: "#1e9e55", fontSize: "24px" }}>
          {data.compliancePercent || "N/A"}
        </p>

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
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "14px",
                  color: "#137f41",
                  fontWeight: "600",
                }}
              >
                {spec}
              </span>
            ))
          ) : (
            <p>No specifications available</p>
          )}
        </div>

        {/* Gaps Identified */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "12px",
          }}
        >
          Gaps Identified
        </h3>

        <ul style={{ paddingLeft: "18px" }}>
          {data.gapsIdentified && data.gapsIdentified.length > 0 ? (
            data.gapsIdentified.map((gap, idx) => (
              <li key={idx} style={{ color: "#c33", fontWeight: "600", marginBottom: "6px" }}>
                {gap}
              </li>
            ))
          ) : (
            <li>No gaps identified</li>
          )}
        </ul>

        {/* Key Points */}
        {data.keyPoints && data.keyPoints.length > 0 && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Key Points
            </h3>
            <ul style={{ paddingLeft: "20px" }}>
              {data.keyPoints.map((point, idx) => (
                <li key={idx} style={{ marginBottom: "6px" }}>{point}</li>
              ))}
            </ul>
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
        {data.complianceRequirements && data.complianceRequirements.length > 0 && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
              Compliance Requirements
            </h3>
            <ul style={{ paddingLeft: "20px" }}>
              {data.complianceRequirements.map((req, idx) => (
                <li key={idx} style={{ marginBottom: "6px" }}>{req}</li>
              ))}
            </ul>
          </>
        )}

        {/* Risk Areas */}
        {data.riskAreas && data.riskAreas.length > 0 && (
          <>
            <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px", color: "#dc2626" }}>
              Risk Areas
            </h3>
            <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
              {data.riskAreas.map((risk, idx) => (
                <li key={idx} style={{ marginBottom: "6px" }}>{risk}</li>
              ))}
            </ul>
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
