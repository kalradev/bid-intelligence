import { Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NavbarBidManagement = ({ pageTitle = "Bid Management", onDownloadPDF }) => {
  const navigate = useNavigate();

  return (
    <header
      style={{
        background: "linear-gradient(90deg, #002f5e, #0056a6)",
        padding: "20px 40px",
        display: "flex",
        alignItems: "center",
        color: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        position: "relative",
      }}
    >
      {/* CENTER TITLE */}
      <h2
        style={{
          margin: "0 auto",
          fontSize: "26px",
          fontWeight: "600",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {pageTitle}
      </h2>

      {/* RIGHT SIDE BUTTONS */}
      <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
        {/* DOWNLOAD PDF BUTTON */}
        {onDownloadPDF && (
          <button
            onClick={onDownloadPDF}
            style={{
              background: "#0891b2",
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "10px 16px",
              fontSize: "18px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "0.3s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#0e7490")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#0891b2")}
            title="Download as PDF"
          >
            <Download size={20} />
          </button>
        )}

        {/* HOME BUTTON */}
        <button
          onClick={() => {
            navigate("/insights#departments-section");
            // Small delay to ensure page loads before scrolling
            setTimeout(() => {
              const element = document.getElementById("departments-section");
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }, 100);
          }}
          style={{
            background: "#00a878",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "10px 22px",
            fontSize: "18px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.target.style.background = "#008f64")}
          onMouseOut={(e) => (e.target.style.background = "#00a878")}
        >
          Home
        </button>

        {/* LOGOUT BUTTON */}
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "10px 22px",
            fontSize: "18px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.target.style.background = "#b91c1c")}
          onMouseOut={(e) => (e.target.style.background = "#dc2626")}
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default NavbarBidManagement;
