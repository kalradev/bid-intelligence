import { CheckCircle, Globe, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectAnalysis, updateAnalysisData } from "../utils/documentAnalysis";

export default function ProductMappingPage() {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [animate, setAnimate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("");

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
          console.log(`📡 Fetching fresh product mapping data for project: ${projName}`);
          try {
            const token = localStorage.getItem('token');
            if (token) {
              const result = await fetchProjectAnalysis(projName, docId, null);
              updateAnalysisData(result, projName);
              setAnalysisData(result);
              
              // Debug: Log product mapping data
              const productMapping = result?.data?.departmentalSummaries?.productMapping;
              if (productMapping) {
                const productCount = productMapping.miiProductStatus?.length || 0;
                console.log("📦 Product Mapping Data Found (from API):", {
                  totalItems: productMapping.totalItems,
                  productCount: productCount,
                  products: productMapping.miiProductStatus?.slice(0, 5) // First 5 products
                });
              } else {
                console.warn("⚠️ No productMapping data in API response!");
                console.log("Available sections:", Object.keys(result?.data?.departmentalSummaries || {}));
              }
            } else {
              console.warn("No token found, using localStorage data only");
              if (analysisDataLocal) {
                const parsed = JSON.parse(analysisDataLocal);
                setAnalysisData(parsed);
              }
            }
          } catch (error: any) {
            console.error("Error fetching project analysis:", error);
            // Fallback to localStorage if API fails
            if (analysisDataLocal) {
              const parsed = JSON.parse(analysisDataLocal);
              setAnalysisData(parsed);
              console.warn("Using localStorage data as fallback");
            }
          }
        } else {
          // No project name, use localStorage only
          if (analysisDataLocal) {
            const parsed = JSON.parse(analysisDataLocal);
            setAnalysisData(parsed);
            
            // Debug: Log product mapping data
            const productMapping = parsed?.data?.departmentalSummaries?.productMapping;
            if (productMapping) {
              const productCount = productMapping.miiProductStatus?.length || 0;
              console.log("📦 Product Mapping Data Found (localStorage):", {
                totalItems: productMapping.totalItems,
                productCount: productCount,
                products: productMapping.miiProductStatus?.slice(0, 3)
              });
            } else {
              console.warn("⚠️ No productMapping data in analysisData!");
              console.log("Available sections:", Object.keys(parsed?.data?.departmentalSummaries || {}));
            }
          } else {
            console.warn("⚠️ No analysisData in localStorage and no project name!");
          }
        }
      } catch (error) {
        console.error("Error loading product mapping data:", error);
      } finally {
        setIsLoading(false);
        setTimeout(() => setAnimate(true), 60);
      }
    };
    
    loadData();
  }, []);

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

  const productMapping = analysisData?.data?.departmentalSummaries?.productMapping || {};

  const totalItems = parseInt(productMapping.totalItems) || 0;
  const totalOEMsCount = productMapping.totalOEMs?.count || 0;
  const indianOEMs = productMapping.totalOEMs?.indian || 0;
  const globalOEMs = productMapping.totalOEMs?.global || 0;
  const productsMapped = parseInt(productMapping.productsMapped) || 0;
  const miiMapped = parseInt(productMapping.makeInIndiaMapping?.mapped) || 0;
  const miiUnmapped = parseInt(productMapping.makeInIndiaMapping?.unmapped) || 0;
  const miiProductStatus = productMapping.miiProductStatus || [];

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

  return (
    <>
      {/* NAVBAR */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          background: "linear-gradient(135deg, #001f3f, #003d7a)",
          zIndex: 100,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#fff",
            margin: 0,
          }}
        >
          Product Mapping
        </h1>

        <button
          onClick={() => navigate("/insights")}
          style={{
            background: "#06b6d4",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            marginLeft: "16px",
          }}
        >
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
                  </tr>
                </thead>

                <tbody>
                  {miiProductStatus.length > 0 ? (
                    miiProductStatus.map((item: any, index: number) => {
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
                          <td style={{ padding: 10, color: oemDisplay !== "N/A" ? "#111827" : "#9ca3af" }}>
                            {oemDisplay}
                          </td>
                          <td style={{ 
                            padding: 10,
                            fontSize: 13,
                            color: modelDisplay !== "N/A" ? "#374151" : "#9ca3af"
                          }}>
                            {modelDisplay}
                          </td>
                          <td style={{
                            padding: 10,
                            color: isMapped ? "#059669" : "#dc2626",
                            fontWeight: 700
                          }}>
                            {miiStatusDisplay}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
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
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
