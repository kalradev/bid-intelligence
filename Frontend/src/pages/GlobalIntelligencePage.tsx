import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function GlobalIntelligencePage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [miiFilter, setMiiFilter] = useState("All");

  const data = [
    { product: "IoT Gateway", oem: "HFCL", country: "India", mii: true },
    { product: "Smart Router", oem: "Cisco", country: "USA", mii: false },
    { product: "CCTV Camera", oem: "CP Plus", country: "India", mii: true },
  ];

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
          Product OEM Verification
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
          <div
            style={{
              width: "100%",
              maxWidth: "1200px",
              display: "flex",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Product or OEM..."
              style={{
                flex: 1,
                padding: "14px 18px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "15px",
              }}
            />

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "15px",
                background: "white",
              }}
            >
              <option>All</option>
              <option>India</option>
              <option>USA</option>
            </select>

            <select
              value={miiFilter}
              onChange={(e) => setMiiFilter(e.target.value)}
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                fontSize: "15px",
                background: "white",
              }}
            >
              <option>All</option>
              <option>MII</option>
              <option>Not MII</option>
            </select>
          </div>

          {/* ✅ TABLE */}
          <div
            className="hoverable-card hover-cyan"
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
                  {["Product Name", "OEM", "Country", "MII Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 16px" }}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredData.map((item, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: "1px solid #e5e7eb",
                      transition: "0.25s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "#f4f7fc";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "#fff";
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>{item.product}</td>
                    <td style={{ padding: "14px 16px" }}>{item.oem}</td>
                    <td style={{ padding: "14px 16px" }}>{item.country}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, color: item.mii ? "#059669" : "#dc2626" }}>
                      {item.mii ? "✅ MII" : "❌ Not MII"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
