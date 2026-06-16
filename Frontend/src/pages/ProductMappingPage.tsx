import { CheckCircle, Globe, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { getAuthToken } from "../utils/authStorage";
import { fetchProjectAnalysis, updateAnalysisData } from "../utils/documentAnalysis";

export default function ProductMappingPage() {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [animate, setAnimate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("");
  /** Selected OEM per product index (string key). Empty string = none/custom. */
  const [oemSelections, setOemSelections] = useState<Record<string, string>>({});
  const [savingSelections, setSavingSelections] = useState(false);
  const typingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleRows, setVisibleRows] = useState(25);

  // Get project name and fetch fresh data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Get project name from localStorage
        const currentDoc = localStorage.getItem("currentDocument");
        const analysisDataLocal = localStorage.getItem("analysisData");
        
        let projName = "";
        let docId: number | null = null;
        
        if (currentDoc) {
          try {
            const doc = JSON.parse(currentDoc);
            projName = doc.projectName || "";
            docId = doc.documentId || null;
          } catch (e) {
            console.error("Error parsing currentDocument:", e);
          }
        }
        
        if (analysisDataLocal && !projName) {
          try {
            const data = JSON.parse(analysisDataLocal);
            projName = data.data?.projectName || "";
            docId = data.data?.metadata?.documentId || null;
          } catch (e) {
            console.error("Error parsing analysisData:", e);
          }
        }
        
        setProjectName(projName);
        
        // If we have a project name, fetch fresh data from API
        if (projName) {
          try {
            const token = getAuthToken();
            if (token) {
              const result = await fetchProjectAnalysis(projName, docId, null);
              updateAnalysisData(result, projName);
              setAnalysisData(result);
            } else if (analysisDataLocal) {
              const parsed = JSON.parse(analysisDataLocal);
              setAnalysisData(parsed);
            }
          } catch (_) {
            // Backend unreachable: show saved data so the page still works
            if (analysisDataLocal) {
              const parsed = JSON.parse(analysisDataLocal);
              setAnalysisData(parsed);
            }
          }
        } else if (analysisDataLocal) {
          const parsed = JSON.parse(analysisDataLocal);
          setAnalysisData(parsed);
        }
      } catch (_) {
      } finally {
        setIsLoading(false);
        setTimeout(() => setAnimate(true), 60);
      }
    };
    
    loadData();
  }, []);

  // Hydrate OEM selections from API when analysis data is loaded
  useEffect(() => {
    const pm = analysisData?.data?.departmentalSummaries?.productMapping;
    if (pm?.oemSelections && typeof pm.oemSelections === "object") {
      setOemSelections(pm.oemSelections);
    }
  }, [analysisData]);

  const saveOemSelections = useCallback(async (nextSelections: Record<string, string>) => {
    const proj = projectName || analysisData?.data?.projectName;
    let docId = analysisData?.data?.metadata?.documentId;
    if (docId == null) {
      try {
        const currentDoc = localStorage.getItem("currentDocument");
        if (currentDoc) {
          const doc = JSON.parse(currentDoc);
          docId = doc.documentId;
        }
      } catch (_) {}
    }
    const token = getAuthToken();
    if (!token) return;

    const updateLocal = () => {
      if (analysisData?.data?.departmentalSummaries?.productMapping) {
        const copy = { ...analysisData };
        if (!copy.data.departmentalSummaries.productMapping) copy.data.departmentalSummaries.productMapping = {};
        copy.data.departmentalSummaries.productMapping.oemSelections = nextSelections;
        setAnalysisData(copy);
        localStorage.setItem("analysisData", JSON.stringify(copy));
      }
    };

    if (!proj || docId == null) {
      setOemSelections(nextSelections);
      updateLocal();
      return;
    }

    setSavingSelections(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/rfp/save-product-oem-selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          project_name: proj,
          document_id: docId,
          oem_selections: nextSelections,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOemSelections(nextSelections);
        updateLocal();
      } else {
        setOemSelections(nextSelections);
        updateLocal();
        const { toast } = await import("react-hot-toast");
        toast.error(data.detail || "Could not save to database. Selections stored locally.");
      }
    } catch (_) {
      setOemSelections(nextSelections);
      updateLocal();
      const { toast } = await import("react-hot-toast");
      toast.error("Backend not reachable. Start your backend server to save to the database. Selections are kept locally until then.");
    } finally {
      setSavingSelections(false);
    }
  }, [projectName, analysisData]);

  const handleSelectOem = useCallback((productIndex: number, oemName: string) => {
    const key = String(productIndex);
    setOemSelections((prev) => {
      const next = { ...prev };
      next[key] = (prev[key] === oemName ? "" : oemName);
      saveOemSelections(next);
      return next;
    });
  }, [saveOemSelections]);

  const handleSelectedOemInput = useCallback((productIndex: number, value: string) => {
    const key = String(productIndex);
    setOemSelections((prev) => ({ ...prev, [key]: value }));
    if (typingSaveTimerRef.current) clearTimeout(typingSaveTimerRef.current);
    typingSaveTimerRef.current = setTimeout(() => {
      setOemSelections((latest) => {
        saveOemSelections(latest);
        return latest;
      });
    }, 450);
  }, [saveOemSelections]);

  useEffect(() => {
    setVisibleRows(25);
  }, [analysisData?.data?.departmentalSummaries?.productMapping?.miiProductStatus?.length]);

  useEffect(() => {
    return () => {
      if (typingSaveTimerRef.current) clearTimeout(typingSaveTimerRef.current);
    };
  }, []);

  const productMapping = analysisData?.data?.departmentalSummaries?.productMapping || {};
  const technicalSummary = analysisData?.data?.departmentalSummaries?.technical || {};
  const mappedProducts = Array.isArray(productMapping.miiProductStatus) ? productMapping.miiProductStatus : [];
  const fallbackProductsFromTechnical = useMemo(() => {
    const specs = Array.isArray(technicalSummary?.keySpecifications)
      ? technicalSummary.keySpecifications
      : [];
    return specs
      .map((spec: any) => {
        const productName = (spec?.productName || "").toString().trim();
        if (!productName) return null;
        const specification = (spec?.specification || "N/A").toString().trim();
        return {
          productName,
          category: "Extracted",
          oem: "N/A",
          model: specification || "N/A",
          miiStatus: "Unmapped",
          oemRecommendations: [],
        };
      })
      .filter(Boolean);
  }, [technicalSummary]);
  const miiProductStatus = mappedProducts.length > 0 ? mappedProducts : fallbackProductsFromTechnical;
  const totalItems = parseInt(productMapping.totalItems) || miiProductStatus.length || 0;
  const totalOEMsCount = productMapping.totalOEMs?.count || 0;
  const indianOEMs = productMapping.totalOEMs?.indian || 0;
  const globalOEMs = productMapping.totalOEMs?.global || 0;
  const productsMapped = parseInt(productMapping.productsMapped) || miiProductStatus.length || 0;
  const miiMapped = parseInt(productMapping.makeInIndiaMapping?.mapped) || 0;
  const miiUnmapped = parseInt(productMapping.makeInIndiaMapping?.unmapped) || 0;
  const visibleProductRows = useMemo(
    () => miiProductStatus.slice(0, visibleRows),
    [miiProductStatus, visibleRows]
  );

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "20px" }}>
        <div style={{ fontSize: "18px", color: "#6b7280" }}>Loading product mapping data...</div>
        <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTop: "4px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "20px" }}>
        <p style={{ fontSize: "18px", color: "#6b7280" }}>No analysis data found.</p>
        <button
          onClick={() => navigate("/upload")}
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
    );
  }

  // ✅ Calculate MII compliance percentage - CORRECT calculation
  // Percentage = (Indian OEM products / Total products) * 100
  let miiCompliance = "0%";
  if (totalItems > 0 && typeof miiMapped === 'number' && miiMapped >= 0) {
    // Ensure percentage is between 0-100%
    const percentage = Math.min(100, Math.max(0, Math.round((miiMapped / totalItems) * 100)));
    miiCompliance = `${percentage}%`;
    
    // Validate calculation
    if (miiMapped + miiUnmapped !== totalItems) {
      console.warn(`⚠️ Frontend validation: MII mapping mismatch! ${miiMapped} + ${miiUnmapped} !== ${totalItems}`);
    }
  }

  const fadeInStyle = {
    opacity: animate ? 1 : 0,
    transform: animate ? "translateY(0)" : "translateY(14px)",
    transition: "0.6s ease",
  };

  const card = {
    background: "#fff",
    borderRadius: "14px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    border: "1px solid #e5e7eb",
  };

  const miiFlagWaveCSS =
    "@keyframes mii-flag-wave{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}.mii-flag-wave{display:inline-block;margin-right:6px;animation:mii-flag-wave 1.2s ease-in-out infinite;vertical-align:middle;line-height:0}";

  const IndianFlagIcon = () => (
    <span className="mii-flag-wave" aria-hidden title="Indian OEM">
      <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", borderRadius: 1 }}>
        <rect width="20" height="14" fill="#FF9933" />
        <rect y="4.67" width="20" height="4.67" fill="#fff" />
        <rect y="9.33" width="20" height="4.67" fill="#138808" />
        <circle cx="10" cy="7" r="1.6" fill="#000080" />
        <circle cx="10" cy="7" r="1.2" fill="#fff" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <line key={i} x1={10 + 1.2 * Math.cos(a)} y1={7 + 1.2 * Math.sin(a)} x2={10 + 1.6 * Math.cos(a)} y2={7 + 1.6 * Math.sin(a)} stroke="#000080" strokeWidth="0.25" />
          );
        })}
      </svg>
    </span>
  );

  const isUnspecifiedOem = (oem: any) => {
    const text = String(oem || "").trim().toLowerCase();
    return !text || text === "unspecified" || text === "unspecified oem" || text === "n/a" || text === "na";
  };

  const buildLocalFallbackRecommendations = (item: any) => {
    const category = String(item?.category || "").toLowerCase();
    const name = String(item?.productName || "").toLowerCase();
    const modelBase = String(item?.model || item?.productName || "Standard").trim();
    const specText = String(item?.specifications || "").trim();

    let pool = [
      "Dell", "HPE", "Lenovo", "Cisco", "IBM", "Oracle", "Wipro", "HCL Technologies",
    ];
    if (category.includes("server") || name.includes("server")) {
      pool = ["Dell", "HPE", "Lenovo", "IBM", "Wipro", "HCL Technologies", "Supermicro", "Fujitsu"];
    } else if (category.includes("network") || name.includes("switch") || name.includes("firewall")) {
      pool = ["Cisco", "Juniper", "HPE Aruba", "Fortinet", "Palo Alto", "Wipro", "HCL Technologies", "Arista"];
    } else if (category.includes("storage") || name.includes("storage")) {
      pool = ["NetApp", "Dell EMC", "HPE", "IBM", "Pure Storage", "Hitachi Vantara", "Wipro", "HCL Technologies"];
    } else if (category.includes("security")) {
      pool = ["Fortinet", "Palo Alto", "Cisco", "Check Point", "Sophos", "Wipro", "HCL Technologies", "IBM"];
    }

    const seed = `${name}|${category}|${modelBase}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const start = pool.length > 0 ? hash % pool.length : 0;
    const selected = [pool[start], pool[(start + 3) % pool.length], pool[(start + 5) % pool.length]]
      .filter((v, i, arr) => !!v && arr.indexOf(v) === i);

    return selected.map((oem, i) => ({
      oem,
      model: i === 0
        ? modelBase
        : (specText ? `${oem} ${String(item?.productName || "Standard").trim()}` : `${oem} ${String(item?.productName || "Standard").trim()}`),
      miiStatus: oem.toLowerCase().includes("wipro") || oem.toLowerCase().includes("hcl") ? "Indian OEM" : "Global OEM",
      matchScore: i === 0 ? 95 : 90 - i,
      priceRange: i === 0 ? "Mid-Range" : "Budget",
      availability: "Readily Available",
      reasoning: "Fallback recommendation generated from extracted tender data",
    }));
  };

  return (
    <>
      <style>{miiFlagWaveCSS}</style>
      {/* NAVBAR */}
      <header className="department-navbar">
        <h1 className="department-navbar-title department-navbar-title-center">Product Mapping</h1>
        <button className="department-navbar-btn" onClick={() => navigate("/insights")}>
          Home
        </button>
      </header>

      {/* BACKGROUND */}
      <div className="universal-page-wrapper">
        <div className="universal-background">
          <div className="universal-bg-gradient-1"></div>
          <div className="universal-bg-gradient-2"></div>
          <div className="universal-bg-gradient-3"></div>
        </div>

        <div
          style={{
            minHeight: "100vh",
            padding: "90px 32px 32px",
            display: "flex",
            justifyContent: "center",
            ...fadeInStyle,
          }}
        >
          <div style={{ width: "100%", maxWidth: 1300 }}>

            {/* METRIC CARDS */}
            <div
              style={{
                display: "grid",
                gap: "20px",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                marginBottom: 28,
              }}
            >
              {[
                {
                  title: "Total Items",
                  value: totalItems,
                  icon: <Package size={24} color="#2563eb" />,
                  hoverColor: "rgba(59, 130, 246, 0.08)"
                },
                {
                  title: "Unique OEM Manufacturers",
                  value: totalOEMsCount || (indianOEMs + globalOEMs),
                  subtitle: `${indianOEMs} Indian / ${globalOEMs} Global`,
                  icon: <Globe size={24} color="#059669" />,
                  hoverColor: "rgba(16, 185, 129, 0.08)"
                },
                {
                  title: "Products Mapped",
                  value: productsMapped,
                  hoverColor: "rgba(139, 92, 246, 0.08)"
                },
                {
                  title: "Make in India Mapping",
                  value: miiCompliance,
                  valueColor: "#059669",
                  subtitle: `${miiMapped} Mapped / ${miiUnmapped} Unmapped`,
                  icon: <CheckCircle size={24} color="#059669" />,
                  hoverColor: "rgba(6, 182, 212, 0.08)"
                },
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    ...card,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                    e.currentTarget.style.background = item.hoverColor;
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
                    e.currentTarget.style.borderColor = item.hoverColor.replace("0.08", "0.3");
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0) scale(1)";
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                >
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{item.title}</p>
                  <p style={{ fontSize: 32, fontWeight: 700, color: item.valueColor || "#111" }}>
                    {item.value}
                  </p>
                  {item.subtitle && (
                    <p style={{ color: "#555" }}>{item.subtitle}</p>
                  )}
                  {item.icon}
                </div>
              ))}
            </div>

            {/* PRODUCT TABLE */}
            <div style={{ ...card }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                MII Product Status
              </h2>
              
              {totalItems > miiProductStatus.length && (
                <p style={{ 
                  fontSize: 14, 
                  color: "#666", 
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "#f0f9ff",
                  borderLeft: "3px solid #0284c7",
                  borderRadius: 4
                }}>
                  <strong>Note:</strong> Showing {miiProductStatus.length} of {totalItems} items. 
                  All items with specified OEMs are included. Commodity items are represented by samples.
                </p>
              )}

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: 10, textAlign: "left" }}>Product Name</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Category</th>
                    <th style={{ padding: 10, textAlign: "left" }}>OEM</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Model</th>
                    <th style={{ padding: 10, textAlign: "left" }}>MII Status</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Selected OEM</th>
                  </tr>
                </thead>

                <tbody>
                  {miiProductStatus.length > 0 ? (
                    visibleProductRows.map((item: any, index: number) => {
                      // Check if we have AI-generated recommendations
                      const recommendationsRaw = Array.isArray(item.oemRecommendations) ? item.oemRecommendations : [];
                      const recommendationsFiltered = recommendationsRaw.filter(
                        (rec: any) => !isUnspecifiedOem(rec?.oem)
                      );
                      const recommendations = recommendationsFiltered.length > 0
                        ? recommendationsFiltered
                        : buildLocalFallbackRecommendations(item);
                      const hasRecommendations = recommendations.length > 0;
                      
                      // Format OEM - show "Unspecified" as "N/A" for better UX
                      const oemDisplay = item.oem && item.oem !== "Unspecified" && item.oem !== "N/A" && item.oem.trim() !== ""
                        ? item.oem 
                        : "N/A";
                      
                      // Format Model - use productName if model is missing
                      const modelDisplay = item.model && item.model !== "N/A" && item.model.trim() !== ""
                        ? item.model
                        : "N/A";
                      
                      // Format MII Status
                      const miiStatusDisplay = item.miiStatus || "Unmapped";
                      const isMapped = miiStatusDisplay === "Mapped" || 
                                     miiStatusDisplay === "MII-Compliant" || 
                                     miiStatusDisplay === "Indian OEM" ||
                                     miiStatusDisplay === "MII Compliant";
                      
                      return (
                        <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: 10, fontWeight: 500 }}>{item.productName || "N/A"}</td>
                          <td style={{ padding: 10 }}>{item.category || "Other"}</td>
                          
                          {/* OEM Column - Checkbox per OEM, one selection per product */}
                          <td style={{ padding: 10 }}>
                            {hasRecommendations ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {recommendations.slice(0, 4).map((rec: any, i: number) => {
                                  const selected = (oemSelections[String(index)] || "").trim() === (rec.oem || "").trim();
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        padding: "6px 8px",
                                        background: i === 0 ? "rgba(59, 130, 246, 0.08)" : "rgba(107, 114, 128, 0.05)",
                                        borderRadius: "6px",
                                        borderLeft: `3px solid ${rec.miiStatus === "Indian OEM" ? "#10b981" : "#3b82f6"}`,
                                        fontSize: "13px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginTop: 1 }}>
                                        <input
                                          type="checkbox"
                                          checked={selected}
                                          onChange={() => handleSelectOem(index, rec.oem || "")}
                                          style={{ width: 18, height: 18, cursor: "pointer" }}
                                        />
                                        <span style={{ fontWeight: 600, color: "#111827" }}>
                                          {i + 1}. {rec.oem}
                                          {i === 0 && (
                                            <span style={{
                                              marginLeft: "6px",
                                              fontSize: "10px",
                                              background: "#3b82f6",
                                              color: "white",
                                              padding: "2px 6px",
                                              borderRadius: "4px",
                                              fontWeight: 700
                                            }}>
                                              BEST
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ color: oemDisplay !== "N/A" ? "#111827" : "#9ca3af" }}>
                                {oemDisplay}
                              </span>
                            )}
                          </td>
                          
                          {/* Model Column - Show multiple models if available */}
                          <td style={{ padding: 10 }}>
                            {hasRecommendations ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {recommendations.slice(0, 4).map((rec: any, i: number) => (
                                  <div
                                    key={i}
                                    style={{
                                      padding: "6px 8px",
                                      background: i === 0 ? "rgba(59, 130, 246, 0.05)" : "rgba(243, 244, 246, 0.8)",
                                      borderRadius: "6px",
                                      fontSize: "13px"
                                    }}
                                  >
                                    <div style={{ fontWeight: 500, color: "#374151", marginBottom: "2px" }}>
                                      {rec.model}
                                    </div>
                                    {rec.reasoning && (
                                      <div
                                        style={{
                                          fontSize: "10px",
                                          color: "#6b7280",
                                          fontStyle: "italic",
                                          lineHeight: 1.3
                                        }}
                                      >
                                        {rec.reasoning.length > 60
                                          ? rec.reasoning.substring(0, 60) + "..."
                                          : rec.reasoning}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ 
                                fontSize: 13,
                                color: modelDisplay !== "N/A" ? "#374151" : "#9ca3af"
                              }}>
                                {modelDisplay}
                              </span>
                            )}
                          </td>
                          
                          {/* MII Status Column - One status per OEM */}
                          <td style={{ padding: 10 }}>
                            {hasRecommendations ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {recommendations.slice(0, 4).map((rec: any, i: number) => {
                                  const recMii = rec.miiStatus || "Unmapped";
                                  const isIndian = recMii === "Indian OEM" || recMii === "MII-Compliant" || recMii === "MII Compliant" || recMii === "Mapped";
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        padding: "6px 8px",
                                        background: i === 0 ? "rgba(59, 130, 246, 0.05)" : "rgba(243, 244, 246, 0.8)",
                                        borderRadius: "6px",
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: isIndian ? "#059669" : "#dc2626",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px"
                                      }}
                                    >
                                      {isIndian && <IndianFlagIcon />}
                                      {recMii}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{
                                color: isMapped ? "#059669" : "#dc2626",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                              }}>
                                {isMapped && <IndianFlagIcon />}
                                {miiStatusDisplay}
                              </span>
                            )}
                          </td>
                          {/* Selected OEM - editable; shows selection or allows typing custom */}
                          <td style={{ padding: 10 }}>
                            <input
                              type="text"
                              value={oemSelections[String(index)] ?? ""}
                              onChange={(e) => handleSelectedOemInput(index, e.target.value)}
                              placeholder="Type OEM or select above"
                              style={{
                                width: "100%",
                                minWidth: 140,
                                padding: "8px 10px",
                                border: "1px solid #e5e7eb",
                                borderRadius: 6,
                                fontSize: 13,
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                          <p style={{ fontSize: "16px", fontWeight: 600 }}>No product mapping data available.</p>
                          <p style={{ fontSize: "14px" }}>
                            {projectName 
                              ? "Products will appear here after analysis. Make sure your RFP document contains a BOQ/BOM section."
                              : "Please upload and analyze an RFP document first."}
                          </p>
                          {!projectName && (
                            <button
                              onClick={() => navigate("/upload")}
                              style={{
                                padding: "10px 20px",
                                background: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 600,
                                cursor: "pointer",
                                marginTop: "8px"
                              }}
                            >
                              Go to Upload Page
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {miiProductStatus.length > visibleRows && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setVisibleRows((prev) => prev + 25)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Show more ({miiProductStatus.length - visibleRows} remaining)
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
