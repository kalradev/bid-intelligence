import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import NavbarBidManagement from "../components/NavbarBidManagement";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";
import { filterEMD, processDepartmentData } from "../utils/deduplication";
import { exportToPDF } from "../utils/pdfExport";
import { parseBidDeadlines } from "../utils/deadlineUtils";

// Normalize project name: "GEM 2025\B" or "GEM 2025" -> "GEM/2025" so API can resolve
function normalizeProjectName(name) {
    if (name == null || typeof name !== "string") return name;
    let s = name.trim().replace(/\\[Bb]?\s*$/, "");
    s = s.replace(/\s+(\d{4})\s*$/, "/$1");
    return s.trim() || name;
}

/** Corrigendum / merged analysis payloads may use strings or objects in list fields; React cannot render raw objects. */
function formatBidLine(value) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map((v) => formatBidLine(v)).filter(Boolean).join("; ");
    }
    if (typeof value === "object") {
        const o = value;
        const pick =
            o.text ??
            o.criterion ??
            o.description ??
            o.requirement ??
            o.point ??
            o.title ??
            o.name;
        if (typeof pick === "string") return pick;
        try {
            return JSON.stringify(o);
        } catch {
            return String(o);
        }
    }
    return String(value);
}

const BidManagement = () => {
    const [data, setData] = useState(null);
    const contentRef = useRef(null);
    const [eligibilityChecks, setEligibilityChecks] = useState({});
    const [eligibilityDocuments, setEligibilityDocuments] = useState({}); // { criteriaText: { name, file } }
    const [projectName, setProjectName] = useState(null);
    const [documentId, setDocumentId] = useState(null);
    const [projectOverview, setProjectOverview] = useState(null);
    const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
    const fileInputRefs = useRef({});

    // Load eligibility checklist from API
    const loadEligibilityChecklist = useCallback(async (projName, docId) => {
        if (!projName) {
            console.warn("No project name provided for checklist load");
            return;
        }

        setIsLoadingChecklist(true);
        try {
            const token = getAuthToken();
            if (!token) {
                console.warn("No token found, skipping checklist load");
                setIsLoadingChecklist(false);
                return;
            }

            const trimmedProj = normalizeProjectName(projName) || (projName || "").trim();
            let url = `${API_BASE_URL}/api/rfp/eligibility-checklist/${encodeURIComponent(trimmedProj)}`;
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
                const overviewData = parsed?.data?.departmentalSummaries?.projectOverview || null;

                // Extract project name and document ID (normalize project name e.g. "GEM 2025\\B" -> "GEM/2025")
                const projName = normalizeProjectName(parsed?.data?.projectName) ?? parsed?.data?.projectName;
                const docId = parsed?.data?.metadata?.documentId;
                setProjectName(projName);
                setDocumentId(docId);
                setProjectOverview(overviewData);

                // Process and deduplicate all list-based fields, filter N/A.
                // Use empty object fallback so page never goes fully blank.
                try {
                    const processedData = processDepartmentData(bidManagementData || {});
                    setData(processedData);
                } catch (processError) {
                    console.error("Error processing bid management data:", processError);
                    // Fallback: keep raw shape or empty object so UI remains stable
                    setData(bidManagementData || {});
                }

                // Checklist is loaded by the effect below when projectName/documentId/data are set (no delayed load here to avoid overwriting user Yes/No)
            } else {
                setData({});
            }
        } catch (error) {
            console.error("Error loading bid management data:", error);
            setData({});
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
        console.log(`🔵 Button clicked! Item: "${item}", Checked: ${checked}`);

        if (!projectName) {
            console.warn("❌ No project name available");
            return;
        }

        console.log(`📋 Current state before update:`, eligibilityChecks);

        // Store current state for potential revert
        const previousChecks = { ...eligibilityChecks };

        // Optimistically update UI immediately
        const newChecks = {
            ...eligibilityChecks,
            [item]: checked
        };
        console.log(`✨ New state (optimistic):`, newChecks);
        setEligibilityChecks(newChecks);

        // Save to API
        try {
            const token = getAuthToken();
            if (!token) {
                console.warn("❌ No token found, cannot save checklist");
                // Revert state if no token
                setEligibilityChecks(previousChecks);
                return;
            }

            console.log(`📤 Saving to API: ${API_BASE_URL}/api/rfp/eligibility-checklist/${encodeURIComponent(projectName)}`);
            console.log(`📦 Payload:`, { checklist: newChecks, document_id: documentId });

            const trimmedProjectName = normalizeProjectName(projectName) || (projectName || "").trim();
            const response = await fetch(
                `${API_BASE_URL}/api/rfp/eligibility-checklist/${encodeURIComponent(trimmedProjectName)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        checklist: newChecks,
                        document_id: documentId != null && documentId !== "" ? String(documentId) : null
                    })
                }
            );

            console.log(`📥 API Response status: ${response.status}`);

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ API Response:`, result);
                if (result.success) {
                    console.log("✅ Eligibility checklist saved to database successfully!");
                    // No need to reload - optimistic update already applied
                }
            } else {
                const errorText = await response.text();
                console.error("❌ Failed to save eligibility checklist:", response.status, errorText);
                // Keep optimistic selection visible; only revert so user can retry with clear feedback
                setEligibilityChecks(previousChecks);
                alert("Could not save eligibility selection. Please check your connection and try again.");
            }
        } catch (error) {
            console.error("❌ Error saving eligibility checklist:", error);
            setEligibilityChecks(previousChecks);
            alert("Could not save eligibility selection. Please check your connection and try again.");
        }
    };

    // Handle document upload for a specific eligibility criterion
    const handleEligibilityDocumentUpload = (item, event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        setEligibilityDocuments(prev => ({
            ...prev,
            [item]: { name: file.name, file }
        }));
        event.target.value = "";
    };

    const handleRemoveEligibilityDocument = (item) => {
        setEligibilityDocuments(prev => {
            const next = { ...prev };
            delete next[item];
            return next;
        });
    };

    // Download all eligibility criteria as a text file (with Yes/No status if available)
    const handleDownloadEligibilityCriteria = () => {
        if (!data?.successFactors?.preQualificationCriteria?.length) return;
        const lines = [
            "Eligibility Criteria",
            "===================",
            "",
            ...data.successFactors.preQualificationCriteria.map((item, idx) => {
                const status = eligibilityChecks[item];
                const statusText = status === true || status === "true" ? "Yes" : status === false || status === "false" ? "No" : "—";
                return `${idx + 1}. [${statusText}] ${formatBidLine(item)}`;
            }),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Eligibility_Criteria.txt";
        a.click();
        URL.revokeObjectURL(url);
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
                {(() => {
                    const { submissionDeadline, bidOpeningDate } = parseBidDeadlines(
                        data.keyDeadlines,
                        projectOverview?.lastSubmissionDate,
                        projectOverview?.bidOpeningDate
                    );
                    const deadlineRows = [
                        { label: "Bid Submission Deadline", value: submissionDeadline },
                        { label: "Bid Opening Date", value: bidOpeningDate },
                    ];
                    const hasAny = deadlineRows.some((row) => row.value);
                    if (!hasAny && !data.keyDeadlines) {
                        return <p>N/A</p>;
                    }
                    if (!hasAny) {
                        return <p>{data.keyDeadlines}</p>;
                    }
                    return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                            {deadlineRows.map((row) => (
                                <div key={row.label} className="insight-pill-badge">
                                    <span className="insight-pill-badge-label">{row.label}:</span>
                                    <span className="insight-pill-badge-value">{row.value || "N/A"}</span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

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
                                            {formatBidLine(item)}
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
                                            {formatBidLine(item)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Eligibility Criteria with Yes/No Buttons */}
                        {data.successFactors.preQualificationCriteria && Array.isArray(data.successFactors.preQualificationCriteria) && data.successFactors.preQualificationCriteria.length > 0 && (
                            <div style={{ marginBottom: "24px", background: "#fef3c7", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "4px" }}>
                                    <h4 style={{ fontWeight: "700", fontSize: "18px", color: "#92400e", margin: "0" }}>
                                        Eligibility Criteria
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleDownloadEligibilityCriteria}
                                        title="Download all eligibility criteria"
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "8px",
                                            color: "#92400e",
                                            background: "#fffbeb",
                                            border: "2px solid #fde68a",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "#fef3c7";
                                            e.currentTarget.style.borderColor = "#f59e0b";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "#fffbeb";
                                            e.currentTarget.style.borderColor = "#fde68a";
                                        }}
                                    >
                                        <Download size={20} />
                                    </button>
                                </div>
                                <p style={{ fontSize: "13px", color: "#78350f", marginBottom: "12px", marginTop: "0" }}>
                                    Mark each criterion Yes/No. Auto-checked values from your eligibility documents appear after analysis; fill any remaining points manually.
                                </p>
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
                                        const isUnselected = checkStatus === undefined || checkStatus === null;

                                        return (
                                            <li
                                                key={idx}
                                                style={{
                                                    marginBottom: "16px",
                                                    padding: "12px",
                                                    background: isYes ? "#dcfce7" : isNo ? "#fee2e2" : "#f9fafb",
                                                    borderRadius: "8px",
                                                    border: `2px solid ${isYes ? "#15803d" : isNo ? "#b91c1c" : "#d1d5db"}`,
                                                    transition: "all 0.3s ease"
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
                                                        fontWeight: "500",
                                                        minWidth: "300px"
                                                    }}>
                                                        {formatBidLine(item)}
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
                                                                padding: "10px 24px",
                                                                fontSize: "15px",
                                                                fontWeight: "700",
                                                                borderRadius: "8px",
                                                                border: isYes ? "3px solid #15803d" : "2px solid #d1d5db",
                                                                cursor: isLoadingChecklist ? "not-allowed" : "pointer",
                                                                background: isYes ? "#15803d" : isNo ? "#f3f4f6" : "#ffffff",
                                                                color: isYes ? "white" : isNo ? "#9ca3af" : "#4b5563",
                                                                transition: "all 0.3s ease",
                                                                boxShadow: isYes ? "0 4px 8px rgba(21, 128, 61, 0.5)" : "0 2px 4px rgba(0, 0, 0, 0.1)",
                                                                transform: isYes ? "scale(1.08)" : "scale(1)",
                                                                opacity: isLoadingChecklist ? 0.6 : 1
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isLoadingChecklist && !isYes) {
                                                                    e.currentTarget.style.background = isNo ? "#e5e7eb" : "#f0fdf4";
                                                                    e.currentTarget.style.borderColor = isNo ? "#9ca3af" : "#86efac";
                                                                    e.currentTarget.style.transform = "scale(1.05)";
                                                                    e.currentTarget.style.boxShadow = "0 3px 6px rgba(0, 0, 0, 0.15)";
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isYes) {
                                                                    e.currentTarget.style.background = isNo ? "#f3f4f6" : "#ffffff";
                                                                    e.currentTarget.style.borderColor = isNo ? "#d1d5db" : "#d1d5db";
                                                                    e.currentTarget.style.transform = "scale(1)";
                                                                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                                                                }
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
                                                                transition: "all 0.3s ease",
                                                                boxShadow: isNo ? "0 4px 8px rgba(185, 28, 28, 0.5)" : "0 2px 4px rgba(0, 0, 0, 0.1)",
                                                                transform: isNo ? "scale(1.08)" : "scale(1)",
                                                                opacity: isLoadingChecklist ? 0.6 : 1
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isLoadingChecklist && !isNo) {
                                                                    e.currentTarget.style.background = isYes ? "#e5e7eb" : "#fef2f2";
                                                                    e.currentTarget.style.borderColor = isYes ? "#9ca3af" : "#fca5a5";
                                                                    e.currentTarget.style.transform = "scale(1.05)";
                                                                    e.currentTarget.style.boxShadow = "0 3px 6px rgba(0, 0, 0, 0.15)";
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isNo) {
                                                                    e.currentTarget.style.background = isYes ? "#f3f4f6" : "#ffffff";
                                                                    e.currentTarget.style.borderColor = isYes ? "#d1d5db" : "#d1d5db";
                                                                    e.currentTarget.style.transform = "scale(1)";
                                                                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                                                                }
                                                            }}
                                                        >
                                                            ✗ No
                                                        </button>
                                                        {/* Upload document for this criterion */}
                                                        <span style={{ marginLeft: "8px" }}>
                                                            {eligibilityDocuments[item] ? (
                                                                <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#0369a1" }}>
                                                                    <span title={eligibilityDocuments[item].name}>📎 {eligibilityDocuments[item].name.length > 20 ? eligibilityDocuments[item].name.slice(0, 18) + "…" : eligibilityDocuments[item].name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveEligibilityDocument(item)}
                                                                        style={{
                                                                            padding: "4px 8px",
                                                                            fontSize: "12px",
                                                                            background: "#fef2f2",
                                                                            color: "#b91c1c",
                                                                            border: "1px solid #fecaca",
                                                                            borderRadius: "6px",
                                                                            cursor: "pointer"
                                                                        }}
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <input
                                                                        type="file"
                                                                        ref={el => { fileInputRefs.current[`file-${idx}`] = el; }}
                                                                        style={{ display: "none" }}
                                                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                                                        onChange={(e) => handleEligibilityDocumentUpload(item, e)}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => fileInputRefs.current[`file-${idx}`]?.click()}
                                                                        disabled={isLoadingChecklist}
                                                                        style={{
                                                                            padding: "8px 16px",
                                                                            fontSize: "14px",
                                                                            fontWeight: "600",
                                                                            borderRadius: "8px",
                                                                            border: "2px solid #0369a1",
                                                                            background: "#f0f9ff",
                                                                            color: "#0369a1",
                                                                            cursor: isLoadingChecklist ? "not-allowed" : "pointer",
                                                                            opacity: isLoadingChecklist ? 0.6 : 1
                                                                        }}
                                                                        title="Upload document"
                                                                    >
                                                                        📤
                                                                    </button>
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
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
                                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                                return listItems.length > 0 && (
                                    <div key={category} style={{ marginBottom: "16px" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                                            {category}
                                        </h4>
                                        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                                            {listItems.map((factor, idx) => (
                                                <li key={idx} style={{ marginBottom: "6px" }}>
                                                    ✔ {formatBidLine(factor)}
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
                                        ✔ {formatBidLine(factor)}
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
                                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                                return listItems.length > 0 && (
                                    <div key={category} style={{ marginBottom: "16px" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                                            {category}
                                        </h4>
                                        <ul style={{ paddingLeft: "20px" }}>
                                            {listItems.map((point, idx) => (
                                                <li key={idx} style={{ marginBottom: "6px" }}>{formatBidLine(point)}</li>
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
                                            <li key={idx} style={{ marginBottom: "6px" }}>{formatBidLine(point)}</li>
                                        ))}
                                    </ul>
                                ) : null;
                            })()
                        ) : null}
                    </>
                )}

                {/* Critical Dates */}
                {Array.isArray(data.criticalDates) && data.criticalDates.length > 0 && (
                    <>
                        <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
                            Critical Dates
                        </h3>
                        <div style={{ background: "#fef3c7", padding: "15px", borderRadius: "8px" }}>
                            {data.criticalDates.map((item, idx) => (
                                <p key={idx} style={{ marginBottom: "8px" }}>
                                    <strong>{formatBidLine(item?.date)}:</strong> {formatBidLine(item?.description)}
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
                                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                                return listItems.length > 0 && (
                                    <div key={category} style={{ marginBottom: "16px" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#4b5563", marginBottom: "8px", marginTop: "12px" }}>
                                            {category}
                                        </h4>
                                        <ul style={{ paddingLeft: "20px" }}>
                                            {listItems.map((req, idx) => (
                                                <li key={idx} style={{ marginBottom: "6px" }}>{formatBidLine(req)}</li>
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
                                            <li key={idx} style={{ marginBottom: "6px" }}>{formatBidLine(req)}</li>
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
                                const listItems = Array.isArray(filteredItems) ? filteredItems : [];
                                return listItems.length > 0 && (
                                    <div key={category} style={{ marginBottom: "16px" }}>
                                        <h4 style={{ fontWeight: "600", fontSize: "16px", color: "#991b1b", marginBottom: "8px", marginTop: "12px" }}>
                                            {category}
                                        </h4>
                                        <ul style={{ paddingLeft: "20px", color: "#dc2626" }}>
                                            {listItems.map((risk, idx) => (
                                                <li key={idx} style={{ marginBottom: "6px" }}>
                                                    {formatBidLine(risk)}
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
                                                {formatBidLine(risk)}
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
                                            {formatBidLine(item)}
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
                                            {formatBidLine(item)}
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
                                            {formatBidLine(item)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                {/* Action Items */}
                {Array.isArray(data.actionItems) && data.actionItems.length > 0 && (
                    <>
                        <h3 style={{ fontWeight: "700", marginTop: "26px", marginBottom: "12px" }}>
                            Action Items
                        </h3>
                        <ul style={{ paddingLeft: "20px" }}>
                            {data.actionItems.map((action, idx) => (
                                <li key={idx} style={{ marginBottom: "6px" }}>{formatBidLine(action)}</li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </>
    );
};

export default BidManagement;
