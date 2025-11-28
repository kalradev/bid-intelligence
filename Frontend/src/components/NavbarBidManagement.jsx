import { useNavigate } from "react-router-dom";

const NavbarBidManagement = ({ pageTitle = "Bid Management" }) => {
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

      {/* RIGHT SIDE HOME BUTTON */}
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
          marginLeft: "auto",
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
    </header>
  );
};

export default NavbarBidManagement;
