import { useNavigate } from "react-router-dom";

export default function CostEstimationPage() {
  const navigate = useNavigate();

  const bidValue = 5.0;
  const purchaseCost = 3.8;
  const profit = bidValue - purchaseCost;
  const marginPercent = ((profit / bidValue) * 100).toFixed(1);

  const penaltyRate = 5;
  const penaltyAmount = (profit * penaltyRate) / 100;
  const finalProfit = profit - penaltyAmount;

  return (
    <>
      {/* NAVBAR - FIXED OUTSIDE WRAPPER */}
      <header className="department-navbar">
        <h1 className="department-navbar-title department-navbar-title-center">Cost Estimation & Bid Insights</h1>
        <button className="department-navbar-btn" onClick={() => navigate("/insights")}>
          Home
        </button>
      </header>

      <div className="universal-page-wrapper">
        {/* Animated Background */}
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
            fontFamily: "Inter, sans-serif",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* VALUE CARDS */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: "40px",
            }}
          >
            {[
              { label: "Bid Value", value: `₹${bidValue.toFixed(2)} Cr`, color: "#2563eb" },
              { label: "Estimated Purchase Cost", value: `₹${purchaseCost.toFixed(2)} Cr`, color: "#7c3aed" },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: "#fff",
                  padding: "28px 32px",
                  borderRadius: "16px",
                  width: "280px",
                  border: "2px solid transparent",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-8px)";
                  e.currentTarget.style.boxShadow = "0 16px 32px rgba(0,0,0,0.15)";
                  e.currentTarget.style.borderColor = card.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "4px",
                    background: card.color,
                  }}
                />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#666", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {card.label}
                </p>
                <p
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    marginTop: 8,
                    color: card.color,
                  }}
                >
                  {card.value}
                </p>
                {card.sub && (
                  <p style={{ fontSize: 13, color: card.color, marginTop: 8, fontWeight: 600 }}>
                    {card.sub}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* PENALTY SECTION */}
          <div
            style={{
              background: "#fff",
              width: "100%",
              maxWidth: "900px",
              padding: "32px",
              borderRadius: "16px",
              border: "2px solid #fecaca",
              boxShadow: "0 8px 24px rgba(220, 38, 38, 0.12)",
              borderLeft: "6px solid #dc2626",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(220, 38, 38, 0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(220, 38, 38, 0.12)";
            }}
          >
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: "#b91c1c", display: "flex", alignItems: "center", gap: "10px" }}>
              ⚠️ Penalty Scenario (Delay / Performance Risk)
            </p>

            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #fee2e2" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#555" }}>Penalty Rate Applied:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>{penaltyRate}%</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #fee2e2" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#555" }}>Penalty Deduction:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>₹{penaltyAmount.toFixed(2)} Cr</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>Final Expected Profit:</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#059669", padding: "8px 16px", background: "#ecfdf5", borderRadius: "8px" }}>
                  ₹{finalProfit.toFixed(2)} Cr
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
