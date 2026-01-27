import { useEffect, useRef, useState, useCallback } from "react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { exportToPDF } from "../utils/pdfExport";
import { processDepartmentData, filterEMD } from "../utils/deduplication";

const BidManagement = () => {
    const [data, setData] = useState(null);
    const contentRef = useRef(null);
    const [eligibilityChecks, setEligibilityChecks] = useState({});
    const [projectName, setProjectName] = useState(null);
    const [documentId, setDocumentId] = useState(null);
    const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);

    // Load eligibility checklist from API
    const loadEligibilityChecklist = useCallback(async (projName, docId) => {
        if (!projName) {
            console.warn("No project name provided for checklist load");
            return;
        }
        
        setIsLoadingChecklist(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn("No token found, skipping checklist load");
                setIsLoadingChecklist(false);
                return;
            }

            let url = `http://localhost:3000/api/rfp/eligibility-checklist/${encodeURIComponent(projName)}`;
            if (docId) {
                url += `?document_id=${docId}`;
            }

            console.log(`📡 Loading eligibility checklist from: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log("📦 Checklist API response:", result);
                
                if (result.success && result.checklist) {
                    console.log("✅ Loaded eligibility checklist from API:", result.checklist);
                    setEligibilityChecks(result.checklist);
                } else {
                    console.warn("⚠️ No checklist data in response or success=false");
                    // Initialize empty checklist if none exists
                    setEligibilityChecks({});
                }
            } else {
                const errorText = await response.text();
                console.error(`❌ Failed to load eligibility checklist: ${response.status}`, errorText);
            }
        } catch (error) {
            console.error("❌ Error loading eligibility checklist:", error);
        } finally {
            setIsLoadingChecklist(false);
        }
    }, []);

    useEffect(() => {
        try {
            const storedData = localStorage.getItem("analysisData");
            if (storedData) {
                const parsed = JSON.parse(storedData);
                const bidManagementData = parsed?.data?.departmentalSummaries?.bidManagement;
                
                // Extract project name and document ID
                const projName = parsed?.data?.projectName;
                const docId = parsed?.data?.metadata?.documentId;
                setProjectName(projName);
                setDocumentId(docId);
                
                // Process and deduplicate all list-based fields, filter N/A
                if (bidManagementData) {
                    try {
                        // Debug: Log eligibility criteria before processing
                        console.log("🔍 Raw eligibility criteria:", bidManagementData?.successFactors?.preQualificationCriteria);
                        console.log("🔍 Full successFactors:", bidManagementData?.successFactors);
                        
                        const processedData = processDepartmentData(bidManagementData);
                        
                        // Fallback: If preQualificationCriteria is empty but we have categorized successFactors,
                        // extract eligibility-like items from Financial, Technical, Compliance sections
                        if ((!processedData.successFactors?.preQualificationCriteria || 
                             processedData.successFactors.preQualificationCriteria.length === 0) &&
                            processedData.successFactors && 
                            typeof processedData.successFactors === 'object') {
                            
                            const eligibilityPatterns = [
                                /minimum.*turnover|turnover.*minimum|average.*turnover|turnover.*required|turnover.*last.*years/i,
                                /must be.*company|company.*registered|indian company|llp|partnership|registered under/i,
                                /years.*experience|experience.*years|minimum.*experience|experience.*required|experience of/i,
                                /profitable|profitability|financial.*standing|must be profitable/i,
                                /no.*litigation|no.*blacklist|debarment|legal.*status|blacklisting/i,
                                /bidder must|must have|required to have|eligibility|must possess/i,
                                /registration|registered under|gst|pan|epf|certificate of incorporation/i
                            ];
                            
                            const extractedCriteria = [];
                            
                            // Extract from Financial section - look for eligibility-like items
                            if (Array.isArray(processedData.successFactors.Financial)) {
                                processedData.successFactors.Financial.forEach(item => {
                                    if (typeof item === 'string') {
                                        const lowerItem = item.toLowerCase();
                                        if (eligibilityPatterns.some(pattern => pattern.test(item)) ||
                                            (lowerItem.includes('minimum') && (lowerItem.includes('turnover') || lowerItem.includes('crore') || lowerItem.includes('years'))) ||
                                            (lowerItem.includes('must be') && lowerItem.includes('profitable')) ||
                                            (lowerItem.includes('bidder must') && lowerItem.includes('turnover'))) {
                                            extractedCriteria.push(item);
                                        }
                                    }
                                });
                            }
                            
                            // Extract from Technical section - look for experience/eligibility requirements
                            if (Array.isArray(processedData.successFactors.Technical)) {
                                processedData.successFactors.Technical.forEach(item => {
                                    if (typeof item === 'string') {
                                        const lowerItem = item.toLowerCase();
                                        if ((lowerItem.includes('experience') && (lowerItem.includes('years') || lowerItem.includes('minimum'))) ||
                                            (lowerItem.includes('minimum') && lowerItem.includes('years')) ||
                                            lowerItem.includes('experience of minimum')) {
                                            extractedCriteria.push(item);
                                        }
                                    }
                                });
                            }
                            
                            // Extract from Compliance section - look for company registration/legal requirements
                            if (Array.isArray(processedData.successFactors.Compliance)) {
                                processedData.successFactors.Compliance.forEach(item => {
                                    if (typeof item === 'string') {
                                        const lowerItem = item.toLowerCase();
                                        if ((lowerItem.includes('must be') && (lowerItem.includes('indian') || lowerItem.includes('company'))) ||
                                            (lowerItem.includes('indian company') || lowerItem.includes('llp') || lowerItem.includes('partnership')) ||
                                            (lowerItem.includes('registered') && (lowerItem.includes('under') || lowerItem.includes('applicable'))) ||
                                            (lowerItem.includes('no') && (lowerItem.includes('litigation') || lowerItem.includes('blacklist'))) ||
                                            lowerItem.includes('debarment')) {
                                            extractedCriteria.push(item);
                                        }
                                    }
                                });
                            }
                            
                            // If we found eligibility criteria, add them to preQualificationCriteria
                            if (extractedCriteria.length > 0) {
                                if (!processedData.successFactors.preQualificationCriteria) {
                                    processedData.successFactors.preQualificationCriteria = [];
                                }
                                // Merge and deduplicate
                                const existing = processedData.successFactors.preQualificationCriteria || [];
                                const combined = [...existing, ...extractedCriteria];
                                processedData.successFactors.preQualificationCriteria = [...new Set(combined)];
                                console.log("✅ Extracted eligibility criteria from categorized sections:", processedData.successFactors.preQualificationCriteria);
                            }
                        }
                        
                        // Debug: Log eligibility criteria after processing
                        console.log("🔍 Processed eligibility criteria:", processedData?.successFactors?.preQualificationCriteria);
                        console.log("🔍 Processed successFactors:", processedData?.successFactors);
                        
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

                // Load eligibility checklist after data is loaded
                if (projName) {
                    // Small delay to ensure state is set
                    setTimeout(() => {
                        loadEligibilityChecklist(projName, docId);
                    }, 100);
                }
            } else {
                setData(null);
            }
        } catch (error) {
            console.error("Error loading bid management data:", error);
            setData(null);
        }
    }, []);

    // Reload checklist when projectName or documentId changes
    useEffect(() => {
        if (projectName && data) {
            console.log(`🔄 Reloading checklist for project: ${projectName}, document: ${documentId}`);
            loadEligibilityChecklist(projectName, documentId);
        }
    }, [projectName, documentId, data, loadEligibilityChecklist]);

    // Handle checkbox toggle and save to API
    const handleEligibilityCheck = async (item, checked) => {
        if (!projectName) {
            console.warn("No project name available");
            return;
        }

        // Store current state for potential revert
        const previousChecks = { ...eligibilityChecks };

        // Optimistically update UI immediately
        const newChecks = {
            ...eligibilityChecks,
            [item]: checked
        };
        setEligibilityChecks(newChecks);

        // Save to API
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn("No token found, cannot save checklist");
                // Revert state if no token
                setEligibilityChecks(previousChecks);
                return;
            }

            const response = await fetch(
                `http://localhost:3000/api/rfp/eligibility-checklist/${encodeURIComponent(projectName)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        checklist: newChecks,
                        document_id: documentId
                    })
                }
            );

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log("✅ Eligibility checklist saved to database");
                    // Reload from server to ensure sync
                    setTimeout(() => {
                        loadEligibilityChecklist(projectName, documentId);
                    }, 200);
                }
            } else {
                console.error("Failed to save eligibility checklist:", response.status);
                const errorText = await response.text();
                console.error("Error details:", errorText);
                // Revert on error
                setEligibilityChecks(previousChecks);
            }
        } catch (error) {
            console.error("Error saving eligibility checklist:", error);
            // Revert on error
            setEligibilityChecks(previousChecks);
        }
    };

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
                                        <li key={idx} style={{ marginBottom: "8px", color: "#0c4a6e" }}>
                                            {item}
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
                                        <li key={idx} style={{ marginBottom: "8px", color: "#14532d" }}>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Eligibility Criteria with Yes/No Buttons */}
                        {data.successFactors?.preQualificationCriteria && Array.isArray(data.successFactors.preQualificationCriteria) && data.successFactors.preQualificationCriteria.length > 0 ? (
                            <div style={{ marginBottom: "24px", background: "#fef3c7", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#92400e", marginBottom: "12px", marginTop: "0" }}>
                                    Eligibility Criteria
                                </h4>
                                {isLoadingChecklist && (
                                    <p style={{ fontSize: "14px", color: "#92400e", marginBottom: "12px" }}>
                                        Loading checklist...
                                    </p>
                                )}
                                <ul style={{ paddingLeft: "0", margin: "0", listStyle: "none" }}>
                                    {data.successFactors.preQualificationCriteria.map((item, idx) => {
                                        // Get check status - handle both boolean true/false and string "true"/"false"
                                        const checkStatus = eligibilityChecks[item];
                                        const isYes = checkStatus === true || checkStatus === "true";
                                        const isNo = checkStatus === false || checkStatus === "false";
                                        
                                        return (
                                            <li 
                                                key={idx} 
                                                style={{ 
                                                    marginBottom: "16px", 
                                                    padding: "12px",
                                                    background: "#f3f4f6",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                                                }}
                                            >
                                                <div style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "16px",
                                                    flexWrap: "wrap"
                                                }}>
                                                    <span style={{ 
                                                        flex: 1,
                                                        fontSize: "16px",
                                                        color: "#78350f",
                                                        fontWeight: "400",
                                                        minWidth: "300px"
                                                    }}>
                                                        {item}
                                                    </span>
                                                    <div style={{
                                                        display: "flex",
                                                        gap: "8px",
                                                        alignItems: "center"
                                                    }}>
                                                        <button
                                                            onClick={() => handleEligibilityCheck(item, true)}
                                                            disabled={isLoadingChecklist}
                                                            style={{
                                                                padding: "8px 20px",
                                                                fontSize: "14px",
                                                                fontWeight: "600",
                                                                borderRadius: "6px",
                                                                border: isYes ? "2px solid #15803d" : "1px solid #d1d5db",
                                                                cursor: isLoadingChecklist ? "not-allowed" : "pointer",
                                                                background: isYes ? "#15803d" : "#ffffff",
                                                                color: isYes ? "white" : "#4b5563",
                                                                transition: "all 0.2s ease",
                                                                opacity: isLoadingChecklist ? 0.6 : 1
                                                            }}
                                                        >
                                                            ✓ Yes
                                                        </button>
                                                        <button
                                                            onClick={() => handleEligibilityCheck(item, false)}
                                                            disabled={isLoadingChecklist}
                                                            style={{
                                                                padding: "8px 20px",
                                                                fontSize: "14px",
                                                                fontWeight: "600",
                                                                borderRadius: "6px",
                                                                border: isNo ? "2px solid #b91c1c" : "1px solid #d1d5db",
                                                                cursor: isLoadingChecklist ? "not-allowed" : "pointer",
                                                                background: isNo ? "#b91c1c" : "#ffffff",
                                                                color: isNo ? "white" : "#4b5563",
                                                                transition: "all 0.2s ease",
                                                                opacity: isLoadingChecklist ? 0.6 : 1
                                                            }}
                                                        >
                                                            X No
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : (
                            <div style={{ marginBottom: "24px", background: "#fee2e2", padding: "16px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                                <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#991b1b", marginBottom: "8px", marginTop: "0" }}>
                                    Eligibility Criteria
                                </h4>
                                <p style={{ color: "#991b1b", fontSize: "14px", margin: "0" }}>
                                    No eligibility criteria found. Please check:
                                    <br />1. If the PDF contains eligibility criteria sections
                                    <br />2. If the analysis completed successfully
                                    <br />3. Check browser console for debugging information
                                </p>
                                <details style={{ marginTop: "12px" }}>
                                    <summary style={{ cursor: "pointer", color: "#991b1b", fontSize: "14px" }}>Debug Information</summary>
                                    <pre style={{ 
                                        background: "#f9fafb", 
                                        padding: "12px", 
                                        borderRadius: "4px", 
                                        fontSize: "12px", 
                                        overflow: "auto",
                                        marginTop: "8px",
                                        maxHeight: "200px"
                                    }}>
                                        {JSON.stringify({
                                            hasSuccessFactors: !!data.successFactors,
                                            successFactorsType: typeof data.successFactors,
                                            hasPreQualificationCriteria: !!data.successFactors?.preQualificationCriteria,
                                            preQualificationCriteriaType: typeof data.successFactors?.preQualificationCriteria,
                                            isArray: Array.isArray(data.successFactors?.preQualificationCriteria),
                                            length: data.successFactors?.preQualificationCriteria?.length,
                                            sample: data.successFactors?.preQualificationCriteria?.slice(0, 2)
                                        }, null, 2)}
                                    </pre>
                                </details>
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
                                                <li key={idx} style={{ marginBottom: "6px" }}>
                                                    ✔ {factor}
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
                                    <li key={idx} style={{ marginBottom: "6px" }}>
                                        ✔ {factor}
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
                                                <li key={idx} style={{ marginBottom: "6px" }}>
                                                    {risk}
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
                                            <li key={idx} style={{ marginBottom: "6px" }}>
                                                {risk}
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
                                        <li key={idx} style={{ marginBottom: "8px" }}>
                                            {item}
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
                                        <li key={idx} style={{ marginBottom: "8px" }}>
                                            {item}
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
                                        <li key={idx} style={{ marginBottom: "8px" }}>
                                            {item}
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
        </>
    );
};

export default BidManagement;
