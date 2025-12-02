import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";

const BidManagement = () => {
    const [data, setData] = useState(null);
    const contentRef = useRef(null);

    useEffect(() => {
        const storedData = localStorage.getItem("analysisData");
        if (storedData) {
            const parsed = JSON.parse(storedData);
            setData(parsed?.data?.departmentalSummaries?.bidManagement);
        }
    }, []);

    const handleDownloadPDF = () => {
        if (contentRef.current) {
            exportToPDF(contentRef.current, "Bid_Management_Summary");
        }
    };

    if (!data) {
        return (
            <>
                <NavbarBidManagement pageTitle="Bid Management" />
                <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
                    <p>Loading data...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <NavbarBidManagement pageTitle="Bid Management" onDownloadPDF={handleDownloadPDF} />

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
                {/* Project Overview */}
                <h3 style={{ fontWeight: "700", marginBottom: "8px" }}>
                    Project Overview
                </h3>
                <p>{data.projectOverview || "N/A"}</p>

                {/* Key Deadlines */}
                <h3
                    style={{
                        fontWeight: "700",
                        marginTop: "26px",
                        marginBottom: "8px",
                    }}
                >
                    Key Deadlines
                </h3>
                <p>{data.keyDeadlines || "N/A"}</p>

                {/* Strategy */}
                <h3
                    style={{
                        fontWeight: "700",
                        marginTop: "26px",
                        marginBottom: "8px",
                    }}
                >
                    Strategy
                </h3>
                <p>{data.strategy || "N/A"}</p>

                {/* Success Factors */}
                <h3
                    style={{
                        fontWeight: "700",
                        marginTop: "26px",
                        marginBottom: "12px",
                    }}
                >
                    Success Factors
                </h3>

                <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                    {data.successFactors && data.successFactors.length > 0 ? (
                        data.successFactors.map((factor, idx) => (
                            <li key={idx} style={{ marginBottom: "6px" }}>✔ {factor}</li>
                        ))
                    ) : (
                        <li>No success factors available</li>
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

export default BidManagement;
