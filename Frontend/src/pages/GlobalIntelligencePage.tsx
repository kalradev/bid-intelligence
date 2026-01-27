import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import SearchBar from "./GlobalIntelligence/components/SearchBar";

interface ProductData {
  product: string;
  oem: string;
  model: string;
  country: string;
  mii: boolean;
}

export default function GlobalIntelligencePage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [miiFilter, setMiiFilter] = useState("All");
  const [data, setData] = useState<ProductData[]>([]);

  // Load product mapping data from localStorage
  useEffect(() => {
    const analysisData = localStorage.getItem("analysisData");
    if (analysisData) {
      try {
        const parsed = JSON.parse(analysisData);
        const productMapping = parsed?.data?.departmentalSummaries?.productMapping;

        if (productMapping?.miiProductStatus && Array.isArray(productMapping.miiProductStatus)) {
          // Transform miiProductStatus to the format needed for the table
          const transformedData: ProductData[] = productMapping.miiProductStatus.map((item: any) => {
            // Country: use item.country if present, else derive from MII status (India / Global / Unknown)
            let country = "Unknown";
            let isMII = false;
            if (item.country && typeof item.country === "string" && item.country.trim()) {
              country = item.country.trim();
              isMII = /india|indian|mii/i.test(country);
            } else if (item.miiStatus) {
              const status = item.miiStatus.toLowerCase();
              if (status.includes("indian") || status.includes("mii-compliant") || status.includes("mii compliant") || (status.includes("mii") && status.includes("compliant")) || status.includes("likely indian")) {
                country = "India";
                isMII = true;
              } else if (status.includes("global") || status.includes("foreign")) {
                country = "Global";
                isMII = false;
              } else if (status.includes("review") || status.includes("unspecified")) {
                country = "Unknown";
                isMII = false;
              }
            }

            // Model = model name only. Never OEM list (e.g. "Blustar/Voltas/Carrier"), specs, or N/A. Fallback: [Category] Series or Standard Model.
            const looksLikeSpecs = (s) => {
              if (!s || typeof s !== "string") return true;
              const t = String(s).trim();
              if (t.length > 65) return true;
              return /(Width|Thickness|Length|Size):\s*\d|\d+\s*mm\s*[x,×]\s*\d|\d+\s*mm\s*,\s*\d|dimension\s*\d/i.test(t);
            };
            const looksLikeOemList = (s) => (s && typeof s === "string" && (s.split("/").length >= 2));
            const m = (item.model || "").trim();
            const cat = (item.category || "").trim();
            const useCat = looksLikeOemList(cat) ? "General" : (cat || "General");
            let modelDisplay = "Standard Model";
            if (m && m !== "N/A" && m !== "Unspecified" && !looksLikeSpecs(m) && !looksLikeOemList(m)) {
              modelDisplay = m;
            } else {
              const pn = (item.productName || "").trim();
              if (pn && !looksLikeOemList(pn)) modelDisplay = pn.length > 42 ? pn.substring(0, 42) + "…" : pn;
              else modelDisplay = useCat + " Series";
            }

            return {
              product: item.productName || "N/A",
              oem: item.oem || "Unspecified",
              model: modelDisplay,
              country: country,
              mii: isMII,
            };
          });

          setData(transformedData);
        } else {
          // No product mapping data available
          setData([]);
        }
      } catch (error) {
        console.error("Error parsing analysis data:", error);
        setData([]);
      }
    } else {
      // No analysis data in localStorage
      setData([]);
    }
  }, []);

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(search.toLowerCase()) ||
      item.oem.toLowerCase().includes(search.toLowerCase());

    const matchesCountry =
      countryFilter === "All" || item.country === countryFilter;

    const matchesMII =
      miiFilter === "All" ||
      (miiFilter === "MII" && item.mii) ||
      (miiFilter === "Not MII" && !item.mii);

    return matchesSearch && matchesCountry && matchesMII;
  });

  return (
    <>
      {/* NAVBAR - FIXED OUTSIDE WRAPPER */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          background: "linear-gradient(135deg, #001f3f 0%, #003d7a 100%)",
          boxShadow: "0 4px 20px rgba(0, 31, 63, 0.3)",
          zIndex: 100,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            flex: 1,
            textAlign: "center",
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          Global Intelligence
        </h1>

        <button
          onClick={() => navigate("/insights")}
          style={{
            background: "#06b6d4",
            color: "#ffffff",
            padding: "10px 20px",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: "auto",
            boxShadow: "0px 4px 15px rgba(6, 182, 212, 0.3)",
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0891b2";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0px 6px 20px rgba(6, 182, 212, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#06b6d4";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0px 4px 15px rgba(6, 182, 212, 0.3)";
          }}
        >
          Home
        </button>
      </header>

      <div className="universal-page-wrapper">
        <div className="universal-background">
          <div className="universal-bg-gradient-1"></div>
          <div className="universal-bg-gradient-2"></div>
          <div className="universal-bg-gradient-3"></div>
        </div>

        <div
          style={{
            minHeight: "100vh",
            background: "#DBE9FA",
            padding: "32px",
            paddingTop: "80px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* ✅ SEARCH + FILTERS */}
          <SearchBar
            search={search}
            setSearch={setSearch}
            countryFilter={countryFilter}
            setCountryFilter={setCountryFilter}
            miiFilter={miiFilter}
            setMiiFilter={setMiiFilter}
          />

          {/* ✅ TABLE */}
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "1200px",
              borderRadius: "14px",
              boxShadow: "0px 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f8fafc", color: "#374151", fontWeight: 600 }}>
                <tr>
                  {["Product Name", "OEM", "Model", "Country", "MII Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px" }}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, i) => (
                    <tr
                      key={i}
                      style={{
                        borderTop: "1px solid #e5e7eb",
                      }}
                    >
                      <td style={{ padding: "14px 16px" }}>{item.product}</td>
                      <td style={{ padding: "14px 16px" }}>{item.oem}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>{item.model}</td>
                      <td style={{ padding: "14px 16px" }}>{item.country}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: item.mii ? "#059669" : "#dc2626" }}>
                        {item.mii ? "✅ MII" : "❌ Not MII"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px 16px", textAlign: "center", color: "#6b7280" }}>
                      {data.length === 0
                        ? "No analysis data available. Please upload and analyze a tender document first."
                        : "No products match your search criteria."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
