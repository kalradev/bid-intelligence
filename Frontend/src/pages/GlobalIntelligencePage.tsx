import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      const token = localStorage.getItem("token");
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
          Build Your Stack
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
                border: "1px solid #e5e7eb",
                fontSize: 14,
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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
                    background: "#fff",
                    borderRadius: 12,
                    padding: "16px 20px",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    border: "1px solid #e5e7eb",
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
                        background: "rgba(255,143,143,0.2)",
                        color: "#b91c1c",
                        border: "1px solid rgba(255,143,143,0.4)",
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
                  background: "#fff",
                  borderRadius: 14,
                  padding: 48,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 15,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
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
