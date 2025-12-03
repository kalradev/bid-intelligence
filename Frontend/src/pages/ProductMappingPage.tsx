import { CheckCircle, Globe, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ProductMappingPage() {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const storedData = localStorage.getItem("analysisData");
    if (storedData) {
      const parsed = JSON.parse(storedData);
      setAnalysisData(parsed);
    }
    setTimeout(() => setAnimate(true), 60);
  }, []);

  if (!analysisData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading...</p>
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

  // Calculate MII compliance percentage - CORRECT calculation
  let miiCompliance = "0%";
  if (totalItems > 0 && typeof miiMapped === 'number') {
    // Ensure percentage is between 0-100%
    const percentage = Math.min(100, Math.max(0, Math.round((miiMapped / totalItems) * 100)));
    miiCompliance = `${percentage}%`;
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
                    miiProductStatus.map((item: any, index: number) => (
                      <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: 10 }}>{item.productName || "N/A"}</td>
                        <td style={{ padding: 10 }}>{item.category || "N/A"}</td>
                        <td style={{ padding: 10 }}>{item.oem || "N/A"}</td>
                        <td style={{ 
                          padding: 10,
                          fontSize: 13,
                          color: "#374151"
                        }}>
                          {item.model || "N/A"}
                        </td>
                        <td style={{
                          padding: 10,
                          color: item.miiStatus === "Mapped" ? "#059669" : "#dc2626",
                          fontWeight: 700
                        }}>
                          {item.miiStatus || "Unmapped"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 20, textAlign: "center" }}>
                        No product mapping data available.
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
