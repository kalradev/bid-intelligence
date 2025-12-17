import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";
import { processDepartmentData, filterEMD } from "../utils/deduplication";

const Commercial = () => {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      const commercialData = parsed?.data?.departmentalSummaries?.commercial;
      
      // Process and deduplicate all list-based fields, filter N/A
      if (commercialData) {
        setData(processDepartmentData(commercialData));
      } else {
        setData(null);
      }
    }
  }, []);

  const handleDownloadPDF = () => {
    if (contentRef.current) {
      exportToPDF(contentRef.current, "Commercial_Summary");
    }
  };

  if (!data) {
    return (
      <>
        <NavbarBidManagement pageTitle="Commercial" />
        <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
          <p>Loading data...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavbarBidManagement pageTitle="Commercial" onDownloadPDF={handleDownloadPDF} />

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
        {/* Estimated Value */}
        <h3 style={{ fontWeight: "700", marginBottom: "10px" }}>
          Estimated Value
        </h3>
        <p style={{ color: "#5b2dd8", fontWeight: "700", fontSize: "24px" }}>
          {data.estimatedValue || "N/A"}
        </p>

        {/* Warranties */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Warranties
        </h3>
        <p>{data.warranties || "N/A"}</p>

        {/* Penalties */}
        <h3
          style={{
            fontWeight: "700",
            marginTop: "26px",
            marginBottom: "8px",
          }}
        >
          Penalties
        </h3>
        <p>{data.penalties || "N/A"}</p>

        {/* Pricing Bid */}
        {data.pricingBid && (
          <>
            <h3
              style={{
                fontWeight: "700",
                marginTop: "26px",
                marginBottom: "12px",
              }}
            >
              Pricing Bid / Financial Bid
            </h3>
            
            {data.pricingBid.requirements && Array.isArray(data.pricingBid.requirements) && data.pricingBid.requirements.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px" }}>
                  Key Requirements
                </h4>
                <ul style={{ paddingLeft: "20px" }}>
                  {data.pricingBid.requirements.map((req, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.pricingBid.submissionInstructions && Array.isArray(data.pricingBid.submissionInstructions) && data.pricingBid.submissionInstructions.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px" }}>
                  Submission Instructions
                </h4>
                <ul style={{ paddingLeft: "20px" }}>
                  {data.pricingBid.submissionInstructions.map((instruction, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{instruction}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.pricingBid.evaluationCriteria && Array.isArray(data.pricingBid.evaluationCriteria) && data.pricingBid.evaluationCriteria.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px" }}>
                  Evaluation Criteria
                </h4>
                <ul style={{ paddingLeft: "20px" }}>
                  {data.pricingBid.evaluationCriteria.map((criteria, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{criteria}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.pricingBid.documentsNeeded && Array.isArray(data.pricingBid.documentsNeeded) && data.pricingBid.documentsNeeded.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px" }}>
                  Mandatory Documents
                </h4>
                <ul style={{ paddingLeft: "20px" }}>
                  {data.pricingBid.documentsNeeded.map((doc, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.pricingBid.paymentTerms && Array.isArray(data.pricingBid.paymentTerms) && data.pricingBid.paymentTerms.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px" }}>
                  Payment Terms
                </h4>
                <ul style={{ paddingLeft: "20px" }}>
                  {data.pricingBid.paymentTerms.map((term, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{term}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.pricingBid.taxesAndCharges && Array.isArray(data.pricingBid.taxesAndCharges) && data.pricingBid.taxesAndCharges.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px" }}>
                  Taxes & Charges
                </h4>
                <ul style={{ paddingLeft: "20px" }}>
                  {data.pricingBid.taxesAndCharges.map((tax, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{tax}</li>
                  ))}
                </ul>
              </div>
            )}
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

export default Commercial;
