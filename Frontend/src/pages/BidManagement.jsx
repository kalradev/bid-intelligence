import { useEffect, useRef, useState } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";
import { processDepartmentData, filterEMD } from "../utils/deduplication";
import SourceReferenceModal from "../components/SourceReferenceModal";
import { ExternalLink } from "lucide-react";

const BidManagement = () => {
    const [data, setData] = useState(null);
    const contentRef = useRef(null);
    const [referenceModal, setReferenceModal] = useState({
        isOpen: false,
        sources: [],
        query: "",
        isLoading: false,
    });

    useEffect(() => {
        try {
            const storedData = localStorage.getItem("analysisData");
            if (storedData) {
                const parsed = JSON.parse(storedData);
                const bidManagementData = parsed?.data?.departmentalSummaries?.bidManagement;
                
                // Process and deduplicate all list-based fields, filter N/A
                if (bidManagementData) {
                    try {
                        const processedData = processDepartmentData(bidManagementData);
                        setData(processedData);
                    } catch (processError) {
                        console.error("Error processing bid management data:", processError);
                        // Fallback: use raw data if processing fails
                        setData(bidManagementData);
                    }
                } else {
                    console.warn("No bidManagement data found in analysisData");
                    setData(null);
                }
            } else {
                setData(null);
            }
        } catch (error) {
            console.error("Error loading bid management data:", error);
            setData(null);
        }
    }, []);

    const handleDownloadPDF = () => {
        if (contentRef.current) {
            exportToPDF(contentRef.current, "Bid_Management_Summary");
        }
    };

    const handleGetSources = async (query) => {
        try {
            console.log(`🔍 Fetching sources for query: "${query}"`);
            
            setReferenceModal({
                isOpen: true,
                sources: [],
                query: query,
                isLoading: true,
            });

            // Get current document ID from multiple possible locations
            let documentId = null;
            
            // Try 1: currentDocument
            const currentDoc = localStorage.getItem("currentDocument");
            if (currentDoc) {
                try {
                    const doc = JSON.parse(currentDoc);
                    documentId = doc.fileHash;
                    console.log(`✅ Found documentId from currentDocument: ${documentId?.substring(0, 16)}...`);
                } catch (e) {
                    console.warn("Error parsing currentDocument:", e);
                }
            }
            
            // Try 2: recentRfpAnalysis
            if (!documentId) {
                const recentRfp = localStorage.getItem("recentRfpAnalysis");
                if (recentRfp) {
                    try {
                        const rfp = JSON.parse(recentRfp);
                        documentId = rfp.fileHash;
                        console.log(`✅ Found documentId from recentRfpAnalysis: ${documentId?.substring(0, 16)}...`);
                    } catch (e) {
                        console.warn("Error parsing recentRfpAnalysis:", e);
                    }
                }
            }
            
            // Try 3: analysisData
            if (!documentId) {
                const analysisData = localStorage.getItem("analysisData");
                if (analysisData) {
                    try {
                        const data = JSON.parse(analysisData);
                        documentId = data?.data?.fileHash;
                        console.log(`✅ Found documentId from analysisData: ${documentId?.substring(0, 16)}...`);
                    } catch (e) {
                        console.warn("Error parsing analysisData:", e);
                    }
                }
            }

            if (!documentId) {
                console.error("❌ No documentId found in localStorage!");
                console.error("   Checked: currentDocument, recentRfpAnalysis, analysisData");
                setReferenceModal({
                    isOpen: true,
                    sources: [],
                    query: query,
                    isLoading: false,
                });
                alert("No document found. Please upload and analyze an RFP document first.");
                return;
            }

            console.log(`📄 Using documentId: ${documentId.substring(0, 16)}...`);
            console.log(`🔍 Query: "${query.substring(0, 50)}..."`);

            // Try Node.js backend first, fallback to Flask backend
            // Use hardcoded URLs (process.env is not available in browser)
            const backendUrl = "http://localhost:3000";
            const chatbotUrl = "http://localhost:8080";
            
            // Use EXACT matching API (deterministic, word-for-word)
            let response;
            let errorMessage = null;
            
            try {
                // Use exact matching endpoint
                console.log(`📡 Calling exact matching API: ${backendUrl}/api/reference/exact-matches`);
                response = await fetch(`${backendUrl}/api/reference/exact-matches`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: query,
                        fileHash: documentId,
                        maxResults: 3
                    }),
                });
                
                if (!response.ok) {
                    throw new Error(`Exact matching API returned ${response.status}`);
                }
                
                const exactData = await response.json();
                
                if (exactData.success && exactData.references && exactData.references.length > 0) {
                    // Convert exact matches to source format
                    const sources = exactData.references.map((ref, idx) => ({
                        pageNumber: ref.page.toString(),
                        fileName: 'document.pdf', // Will be set from localStorage
                        snippet: ref.matchedText.substring(0, 300) + (ref.matchedText.length > 300 ? '...' : ''),
                        relevance: Math.round(ref.confidence * 100), // Convert to percentage
                        chunkIndex: idx,
                        matchedText: ref.matchedText, // Store exact matched text for highlighting
<<<<<<< HEAD
                        matchType: ref.matchType,
                        query: query // Pass query for highlighting
=======
                        matchType: ref.matchType
>>>>>>> convert
                    }));
                    
                    console.log(`✅ Found ${sources.length} exact matches`);
                    
                    setReferenceModal({
                        isOpen: true,
                        sources: sources,
                        query: query,
                        isLoading: false,
                    });
                    return;
                } else {
                    console.warn(`⚠️ No exact matches found for: "${query}"`);
                    // Fall through to semantic search as fallback
                }
            } catch (exactError) {
                console.warn('Exact matching failed, trying semantic search:', exactError.message);
                // Fall through to semantic search
            }
            
            // Fallback: Try semantic search (old method)
            try {
                console.log(`📡 Calling Node.js backend: ${backendUrl}/api/rfp/get-sources`);
                response = await fetch(`${backendUrl}/api/rfp/get-sources`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        query: query,
                        documentId: documentId,
                    }),
                    signal: AbortSignal.timeout(15000), // 15 second timeout
                });
                
                console.log(`📥 Node.js response status: ${response.status}`);
            } catch (nodeError) {
                console.warn("❌ Node.js backend error:", nodeError);
                errorMessage = `Node.js backend error: ${nodeError.message}`;
                
                // Fallback to Flask backend
                try {
                    console.log(`📡 Trying Flask backend: ${chatbotUrl}/get-sources`);
                    response = await fetch(`${chatbotUrl}/get-sources`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            query: query,
                            documentId: documentId,
                        }),
                        signal: AbortSignal.timeout(15000),
                    });
                    console.log(`📥 Flask response status: ${response.status}`);
                } catch (flaskError) {
                    console.error("❌ Flask backend also failed:", flaskError);
                    errorMessage = `Both backends failed. Node.js: ${nodeError.message}, Flask: ${flaskError.message}`;
                    throw flaskError;
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ HTTP error! status: ${response.status}, body: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(`📦 Response received:`, {
                sourcesCount: result.sources?.length || 0,
                hasSources: !!(result.sources && result.sources.length > 0),
                message: result.message,
                error: result.error
            });
            
            if (result.sources && result.sources.length > 0) {
                console.log(`✅ Found ${result.sources.length} sources!`);
            } else {
                console.warn(`⚠️ No sources found. Message: ${result.message || 'No message'}`);
                if (result.message) {
                    console.warn(`   ${result.message}`);
                }
            }
            
            setReferenceModal({
                isOpen: true,
                sources: result.sources || [],
                query: query,
                isLoading: false,
            });
        } catch (error) {
            console.error("❌ Error fetching sources:", error);
            console.error("   Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            setReferenceModal({
                isOpen: true,
                sources: [],
                query: query,
                isLoading: false,
            });
            
            // Show user-friendly error
            alert(`Failed to fetch sources: ${error.message}\n\nPlease check:\n1. Flask backend is running on port 8080\n2. Document was uploaded and analyzed\n3. Check browser console for details`);
        }
    };

    const closeReferenceModal = () => {
        setReferenceModal({
            isOpen: false,
            sources: [],
            query: "",
            isLoading: false,
        });
    };

    if (!data) {
        return (
            <>
                <NavbarBidManagement pageTitle="Bid Management" />
                <div style={{ maxWidth: "900px", margin: "40px auto", padding: "35px", textAlign: "center" }}>
                    <p style={{ fontSize: "18px", color: "#6b7280", marginBottom: "12px" }}>
                        {localStorage.getItem("analysisData") 
                            ? "No bid management data available. Please upload and analyze an RFP document first."
                            : "No analysis data found. Please upload and analyze an RFP document first."}
                    </p>
                    <button
                        onClick={() => window.location.href = "/upload"}
                        style={{
                            padding: "12px 24px",
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "16px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#2563eb";
                            e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#3b82f6";
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        Go to Upload Page
                    </button>
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

                {data.successFactors && typeof data.successFactors === 'object' && !Array.isArray(data.successFactors) ? (
                    <>
                        {/* EMD Exemption */}
                        {data.successFactors.emdExemption && Array.isArray(data.successFactors.emdExemption) && data.successFactors.emdExemption.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#e0f2fe", padding: "16px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#0369a1", marginBottom: "12px", marginTop: "0" }}>
                                    EMD Exemption Details
                                </h4>
                                <ul style={{ paddingLeft: "20px", margin: "0" }}>
                                    {data.successFactors.emdExemption.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "8px", color: "#0c4a6e", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{item}</span>
                                            <button
                                                onClick={() => handleGetSources(item)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    padding: "2px 6px",
                                                    background: "transparent",
                                                    border: "1px solid #0c4a6e",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    color: "#0c4a6e",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#e0f2fe";
                                                    e.currentTarget.style.borderColor = "#0369a1";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "#0c4a6e";
                                                }}
                                                title="View source references"
                                            >
                                                <ExternalLink size={12} />
                                                Reference
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Technical Evaluation Criteria */}
                        {data.successFactors.technicalEvaluationCriteria && Array.isArray(data.successFactors.technicalEvaluationCriteria) && data.successFactors.technicalEvaluationCriteria.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#f0fdf4", padding: "16px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#166534", marginBottom: "12px", marginTop: "0" }}>
                                    Technical Evaluation Criteria
                                </h4>
                                <ul style={{ paddingLeft: "20px", margin: "0" }}>
                                    {data.successFactors.technicalEvaluationCriteria.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "8px", color: "#14532d", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{item}</span>
                                            <button
                                                onClick={() => handleGetSources(item)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    padding: "2px 6px",
                                                    background: "transparent",
                                                    border: "1px solid #14532d",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    color: "#14532d",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#f0fdf4";
                                                    e.currentTarget.style.borderColor = "#166534";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "#14532d";
                                                }}
                                                title="View source references"
                                            >
                                                <ExternalLink size={12} />
                                                Reference
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Eligibility Criteria */}
                        {data.successFactors.preQualificationCriteria && Array.isArray(data.successFactors.preQualificationCriteria) && data.successFactors.preQualificationCriteria.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#fef3c7", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#92400e", marginBottom: "12px", marginTop: "0" }}>
                                    Eligibility Criteria
                                </h4>
                                <ul style={{ paddingLeft: "20px", margin: "0" }}>
                                    {data.successFactors.preQualificationCriteria.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "8px", color: "#78350f", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{item}</span>
                                            <button
                                                onClick={() => handleGetSources(item)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    padding: "2px 6px",
                                                    background: "transparent",
                                                    border: "1px solid #78350f",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    color: "#78350f",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#fef3c7";
                                                    e.currentTarget.style.borderColor = "#92400e";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "#78350f";
                                                }}
                                                title="View source references"
                                            >
                                                <ExternalLink size={12} />
                                                Reference
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Other Success Factors (excluding the three special ones) */}
                        {Object.entries(data.successFactors)
                            .filter(([category]) => 
                                category !== 'emdExemption' && 
                                category !== 'technicalEvaluationCriteria' && 
                                category !== 'preQualificationCriteria'
                            )
                            .map(([category, items]) => {
                                // Filter out EMD values from items
                                const filteredItems = Array.isArray(items) ? filterEMD(items) : items;
                                return filteredItems && filteredItems.length > 0 && (
                                    <div key={category} style={{ marginBottom: "16px" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                                            {category}
                                        </h4>
                                        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                                            {filteredItems.map((factor, idx) => (
                                                <li key={idx} style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span>✔ {factor}</span>
                                                    <button
                                                        onClick={() => handleGetSources(factor)}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "2px 6px",
                                                            background: "transparent",
                                                            border: "1px solid #d1d5db",
                                                            borderRadius: "4px",
                                                            cursor: "pointer",
                                                            fontSize: "11px",
                                                            color: "#3b82f6",
                                                            transition: "all 0.2s ease",
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#eff6ff";
                                                            e.currentTarget.style.borderColor = "#3b82f6";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "transparent";
                                                            e.currentTarget.style.borderColor = "#d1d5db";
                                                        }}
                                                        title="View source references"
                                                    >
                                                        <ExternalLink size={12} />
                                                        Reference
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                    </>
                ) : data.successFactors && Array.isArray(data.successFactors) ? (
                    // Fallback for old array structure - filter EMD values
                    (() => {
                        const filteredFactors = filterEMD(data.successFactors);
                        return filteredFactors.length > 0 ? (
                            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                                {filteredFactors.map((factor, idx) => (
                                    <li key={idx} style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span>✔ {factor}</span>
                                        <button
                                            onClick={() => handleGetSources(factor)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 6px",
                                                background: "transparent",
                                                border: "1px solid #d1d5db",
                                                borderRadius: "4px",
                                                cursor: "pointer",
                                                fontSize: "11px",
                                                color: "#3b82f6",
                                                transition: "all 0.2s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "#eff6ff";
                                                e.currentTarget.style.borderColor = "#3b82f6";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = "transparent";
                                                e.currentTarget.style.borderColor = "#d1d5db";
                                            }}
                                            title="View source references"
                                        >
                                            <ExternalLink size={12} />
                                            Reference
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null;
                    })()
                ) : (
                    <p>No success factors available</p>
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
                                // Filter out EMD values from items
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
                                // Filter out EMD values from items
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
                                // Filter out EMD values from items
                                const filteredItems = Array.isArray(items) ? filterEMD(items) : items;
                                return filteredItems && filteredItems.length > 0 && (
                                    <div key={category} style={{ marginBottom: "16px" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#991b1b", marginBottom: "8px", marginTop: "12px" }}>
                                            {category}
                                        </h4>
                                        <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                                            {filteredItems.map((risk, idx) => (
                                                <li key={idx} style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span>{risk}</span>
                                                    <button
                                                        onClick={() => handleGetSources(risk)}
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "2px 6px",
                                                            background: "transparent",
                                                            border: "1px solid #dc2626",
                                                            borderRadius: "4px",
                                                            cursor: "pointer",
                                                            fontSize: "11px",
                                                            color: "#dc2626",
                                                            transition: "all 0.2s ease",
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "#fee2e2";
                                                            e.currentTarget.style.borderColor = "#991b1b";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "transparent";
                                                            e.currentTarget.style.borderColor = "#dc2626";
                                                        }}
                                                        title="View source references"
                                                    >
                                                        <ExternalLink size={12} />
                                                        Reference
                                                    </button>
                                                </li>
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
                                            <li key={idx} style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span>{risk}</span>
                                                <button
                                                    onClick={() => handleGetSources(risk)}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "4px",
                                                        padding: "2px 6px",
                                                        background: "transparent",
                                                        border: "1px solid #dc2626",
                                                        borderRadius: "4px",
                                                        cursor: "pointer",
                                                        fontSize: "11px",
                                                        color: "#dc2626",
                                                        transition: "all 0.2s ease",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = "#fee2e2";
                                                        e.currentTarget.style.borderColor = "#991b1b";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = "transparent";
                                                        e.currentTarget.style.borderColor = "#dc2626";
                                                    }}
                                                    title="View source references"
                                                >
                                                    <ExternalLink size={12} />
                                                    Reference
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null;
                            })()
                        ) : null}
                    </>
                )}

                {/* Risk Factors */}
                {data.riskFactors && (
                    <>
                        <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px", color: "#dc2626" }}>
                            Risk Factors
                        </h3>

                        {/* Liquidated Damages */}
                        {data.riskFactors.liquidatedDamages && Array.isArray(data.riskFactors.liquidatedDamages) && data.riskFactors.liquidatedDamages.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#fee2e2", padding: "16px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#991b1b", marginBottom: "12px", marginTop: "0" }}>
                                    Liquidated Damages (LD)
                                </h4>
                                <ul style={{ paddingLeft: "20px", margin: "0", color: "#7f1d1d" }}>
                                    {data.riskFactors.liquidatedDamages.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{item}</span>
                                            <button
                                                onClick={() => handleGetSources(item)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    padding: "2px 6px",
                                                    background: "transparent",
                                                    border: "1px solid #dc2626",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    color: "#dc2626",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#fee2e2";
                                                    e.currentTarget.style.borderColor = "#991b1b";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "#dc2626";
                                                }}
                                                title="View source references"
                                            >
                                                <ExternalLink size={12} />
                                                Reference
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Site Survey Requirements */}
                        {data.riskFactors.siteSurvey && Array.isArray(data.riskFactors.siteSurvey) && data.riskFactors.siteSurvey.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#dbeafe", padding: "16px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#1e40af", marginBottom: "12px", marginTop: "0" }}>
                                    Site Survey Requirements
                                </h4>
                                <ul style={{ paddingLeft: "20px", margin: "0", color: "#1e3a8a" }}>
                                    {data.riskFactors.siteSurvey.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{item}</span>
                                            <button
                                                onClick={() => handleGetSources(item)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    padding: "2px 6px",
                                                    background: "transparent",
                                                    border: "1px solid #1e40af",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    color: "#1e40af",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#dbeafe";
                                                    e.currentTarget.style.borderColor = "#1e3a8a";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "#1e40af";
                                                }}
                                                title="View source references"
                                            >
                                                <ExternalLink size={12} />
                                                Reference
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Certification Requirements */}
                        {data.riskFactors.certifications && Array.isArray(data.riskFactors.certifications) && data.riskFactors.certifications.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#fef3c7", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#92400e", marginBottom: "12px", marginTop: "0" }}>
                                    Certification Requirements
                                </h4>
                                <ul style={{ paddingLeft: "20px", margin: "0", color: "#78350f" }}>
                                    {data.riskFactors.certifications.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span>{item}</span>
                                            <button
                                                onClick={() => handleGetSources(item)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                    padding: "2px 6px",
                                                    background: "transparent",
                                                    border: "1px solid #92400e",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "11px",
                                                    color: "#92400e",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = "#fef3c7";
                                                    e.currentTarget.style.borderColor = "#78350f";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "#92400e";
                                                }}
                                                title="View source references"
                                            >
                                                <ExternalLink size={12} />
                                                Reference
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
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

            {/* Source Reference Modal */}
            <SourceReferenceModal
                isOpen={referenceModal.isOpen}
                onClose={closeReferenceModal}
                sources={referenceModal.sources}
                query={referenceModal.query}
                isLoading={referenceModal.isLoading}
            />
        </>
    );
};

export default BidManagement;
