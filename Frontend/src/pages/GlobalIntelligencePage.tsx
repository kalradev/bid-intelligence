import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthToken } from "../utils/authStorage";
import { fetchProjectAnalysis } from "../utils/documentAnalysis";

interface ProductData {
  product: string;
  oem: string;
  model: string;
  country: string;
  mii: boolean;
}

export default function GlobalIntelligencePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Build Your Stack | Bid Intelligence";
    return () => { document.title = "Bid Intelligence"; };
  }, []);

  const [search, setSearch] = useState("");
  const [data, setData] = useState<ProductData[]>([]);

  function buildStackFromAnalysis(parsed: any): ProductData[] {
    const productMapping = parsed?.data?.departmentalSummaries?.productMapping;
    const oemSelections: Record<string, string> = (productMapping?.oemSelections && typeof productMapping.oemSelections === "object")
      ? productMapping.oemSelections
      : {};
    if (!productMapping?.miiProductStatus || !Array.isArray(productMapping.miiProductStatus)) return [];

    const stackOnly: ProductData[] = [];
    productMapping.miiProductStatus.forEach((item: any, index: number) => {
      const selectedOem = (oemSelections[String(index)] ?? "").trim();
      if (!selectedOem) return;

      const modelDisplay = item.model || item.oemRecommendations?.[0]?.model || "Standard Model";
      let country = "Unknown";
      let isMII = false;
      if (item.oemRecommendations?.length) {
        const match = item.oemRecommendations.find((r: any) => (r.oem || "").trim() === selectedOem);
        if (match) {
          const status = (match.miiStatus || "").toLowerCase();
          if (status.includes("indian") || status.includes("mii-compliant") || status.includes("mii compliant")) {
            country = "India";
            isMII = true;
          } else {
            country = "Global";
            isMII = false;
          }
        }
      }
      if (country === "Unknown" && item.miiStatus) {
        const status = item.miiStatus.toLowerCase();
        if (status.includes("indian") || status.includes("mii-compliant") || status.includes("likely indian")) {
          country = "India";
          isMII = true;
        } else if (status.includes("global") || status.includes("foreign")) {
          country = "Global";
          isMII = false;
        }
      }
      stackOnly.push({
        product: item.productName || "N/A",
        oem: selectedOem,
        model: modelDisplay,
        country,
        mii: isMII,
      });
    });
    return stackOnly;
  }

  // Show stack immediately from localStorage, then refresh from API in background (avoids late display and reduces failed requests)
  useEffect(() => {
    const analysisDataLocal = localStorage.getItem("analysisData");
    if (analysisDataLocal) {
      try {
        const parsed = JSON.parse(analysisDataLocal);
        setData(buildStackFromAnalysis(parsed));
      } catch (_) {
        setData([]);
      }
    } else {
      setData([]);
    }

    const refreshFromApi = async () => {
      const token = getAuthToken();
      const currentDoc = localStorage.getItem("currentDocument");
      const analysisDataLocal2 = localStorage.getItem("analysisData");
      let projectName = "";
      let documentId: number | null = null;
      if (currentDoc) {
        try {
          const doc = JSON.parse(currentDoc);
          projectName = doc.projectName || "";
          documentId = doc.documentId ?? null;
        } catch (_) {}
      }
      if (!projectName && analysisDataLocal2) {
        try {
          const data = JSON.parse(analysisDataLocal2);
          projectName = data.data?.projectName || "";
          documentId = data.data?.metadata?.documentId ?? null;
        } catch (_) {}
      }
      if (!token || !projectName) return;
      try {
        const result = await fetchProjectAnalysis(projectName, documentId, null);
        if (result?.data) {
          localStorage.setItem("analysisData", JSON.stringify(result));
          setData(buildStackFromAnalysis(result));
        }
      } catch (_) {
        // Backend unreachable; keep showing localStorage data (no console spam)
      }
    };
    refreshFromApi();
  }, []);

  const stackFiltered = data.filter(
    (item) =>
      !search.trim() ||
      item.product.toLowerCase().includes(search.toLowerCase()) ||
      item.oem.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* NAVBAR - FIXED OUTSIDE WRAPPER */}
      <header className="department-navbar">
        <h1 className="department-navbar-title department-navbar-title-center">Build Your Stack</h1>
        <button className="department-navbar-btn" onClick={() => navigate("/insights")}>
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
            padding: "90px 32px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Search within stack */}
          <div style={{ width: "100%", maxWidth: 520, marginBottom: 24 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in your stack..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid rgba(111,190,178,0.25)",
                fontSize: 14,
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 2px 8px rgba(111,190,178,0.1)",
              }}
            />
          </div>

          {/* Stack: only items where user selected or typed OEM */}
          <div
            style={{
              width: "100%",
              maxWidth: "640px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {stackFiltered.length > 0 ? (
              stackFiltered.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    boxShadow: "0 2px 10px rgba(111,190,178,0.12)",
                    border: "1px solid rgba(111,190,178,0.25)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{item.product}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        background: "rgba(111,190,178,0.2)",
                        color: "#b91c1c",
                        border: "1px solid rgba(111,190,178,0.4)",
                      }}
                    >
                      {item.oem}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{item.country}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: item.mii ? "#059669" : "#dc2626" }}>
                      {item.mii ? "MII" : "Not MII"}
                    </span>
                  </div>
                  {item.model && item.model !== "Standard Model" && (
                    <div style={{ fontSize: 12, color: "#64748b" }}>{item.model}</div>
                  )}
                </div>
              ))
            ) : (
              <div
                style={{
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 14,
                  padding: 48,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 15,
                  border: "1px solid rgba(111,190,178,0.25)",
                  boxShadow: "0 2px 10px rgba(111,190,178,0.12)",
                }}
              >
                {data.length === 0
                  ? "Your stack is empty. Go to Product Mapping, select an OEM or type a product name/OEM for each product, then come back here to see your stack."
                  : "No items in your stack match the search."}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
