import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";
import { processDepartmentData, filterEMD } from "../utils/deduplication";

const Finance = () => {
  const [data, setData] = useState(null);
  const [paymentTerms, setPaymentTerms] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      const financeData = parsed?.data?.departmentalSummaries?.finance;
      const commercialData = parsed?.data?.departmentalSummaries?.commercial;
      
      // Process and deduplicate all list-based fields, filter N/A
      if (financeData) {
        setData(processDepartmentData(financeData));
      } else {
        setData(null);
      }
      
      // Get payment terms from commercial data
      if (commercialData && commercialData.paymentTerms) {
        setPaymentTerms(commercialData.paymentTerms);
      }
    }
  }, []);

  const handleDownloadPDF = () => {
    if (contentRef.current) {
      exportToPDF(contentRef.current, "Finance_Summary");
    }
  };

  if (!data) {
    return (
      <>
        <NavbarBidManagement pageTitle="Finance" />
        <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
          <p>Loading data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavbarBidManagement pageTitle="Finance" onDownloadPDF={handleDownloadPDF} />

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
        {/* Turnover Required */}
        <h3 style={{ fontWeight: "700", marginBottom: "8px" }}>
          Turnover Required
        </h3>
        <p style={{ fontWeight: "700" }}>{data.turnoverRequired || "N/A"}</p>

        {/* Bank Guarantee */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Bank Guarantee
        </h3>
        <p style={{ fontWeight: "700" }}>{data.bankGuarantee || "N/A"}</p>

        {/* Payment Terms */}
        {paymentTerms && (
          <>
            <h3
              style={{
                fontWeight: "700",
                marginTop: "26px",
                marginBottom: "8px",
              }}
            >
              Payment Terms
            </h3>
            <p>{paymentTerms}</p>
          </>
        )}






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
                return filteredItems && filteredItems.length > 0 && (
                  <div key={category} style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                      {category}
                    </h4>
                    <ul style={{ paddingLeft: "20px" }}>
                      {filteredItems.map((req, idx) => (
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

export default Finance;
