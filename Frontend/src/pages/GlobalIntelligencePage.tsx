import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectAnalysis } from "../utils/documentAnalysis";

interface ProductData {
  product: string;
  oem: string;
  model: string;
  country: string;
  mii: boolean;
  /** true when OEM was typed manually in Product Mapping (not selected from list) */
  oemWasTyped?: boolean;
}

export default function GlobalIntelligencePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Build Your Stack | Bid Intelligence";
    return () => { document.title = "Bid Intelligence"; };
  }, []);

  const [search, setSearch] = useState("");
  const [data, setData] = useState<ProductData[]>([]);
  const STACK_MODEL_OVERRIDES_KEY = "buildYourStack_modelOverrides";
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>(() => {
    try {
      const s = localStorage.getItem(STACK_MODEL_OVERRIDES_KEY);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const setModelOverride = (product: string, oem: string, value: string) => {
    const key = `${product}|${oem}`;
    setModelOverrides((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STACK_MODEL_OVERRIDES_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };
  const [focusedModelKey, setFocusedModelKey] = useState<string | null>(null);

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

      const recommendations = item.oemRecommendations || [];
      const match = recommendations.find((r: any) => (r.oem || "").trim() === selectedOem);
      const oemWasTyped = !match;
      const modelDisplay = match
        ? (match.model || item.model || "—")
        : (item.model || "");

      let country = "Unknown";
      let isMII = false;
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
        oemWasTyped,
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
            padding: "20px 24px",
            paddingTop: "88px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Search within stack */}
          <div style={{ width: "100%", maxWidth: 900, marginBottom: 12 }}>
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

          {/* Stack in tabular form */}
          <div
            style={{
              width: "100%",
              maxWidth: 1200,
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            {stackFiltered.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                  <tr>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Product Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13, width: 120 }}>OEM</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 13 }}>Model</th>
                  </tr>
                </thead>
                <tbody>
                  {stackFiltered.map((item, i) => {
                    const overrideKey = `${item.product}|${item.oem}`;
                    const displayModel = item.oemWasTyped
                      ? (modelOverrides[overrideKey] ?? "")
                      : (item.model ?? "—");
                    const isFocused = focusedModelKey === overrideKey;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 500, color: "#0f172a", fontSize: 14 }}>{item.product}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              background: "rgba(255,143,143,0.2)",
                              color: "#b91c1c",
                              border: "1px solid rgba(255,143,143,0.4)",
                            }}
                          >
                            {item.oem}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151", width: "1%", minWidth: 200 }}>
                          {item.oemWasTyped ? (
                            <input
                              type="text"
                              value={displayModel}
                              onChange={(e) => setModelOverride(item.product, item.oem, e.target.value)}
                              onFocus={() => setFocusedModelKey(overrideKey)}
                              onBlur={() => setFocusedModelKey(null)}
                              placeholder="Enter model name"
                              style={{
                                width: "100%",
                                maxWidth: "100%",
                                minWidth: 0,
                                boxSizing: "border-box",
                                padding: "8px 12px",
                                border: `1px solid ${isFocused ? "#06b6d4" : "#cbd5e1"}`,
                                borderRadius: 8,
                                fontSize: 14,
                                color: "#0f172a",
                                background: "#fff",
                                outline: "none",
                                boxShadow: isFocused ? "0 0 0 3px rgba(6, 182, 212, 0.2)" : "0 1px 2px rgba(0,0,0,0.04)",
                                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                              }}
                            />
                          ) : (
                            displayModel
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: 15,
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
