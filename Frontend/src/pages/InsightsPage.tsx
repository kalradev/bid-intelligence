import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DepartmentCard from "../components/DepartmentCard";
import FeatureCard from "../components/FeatureCard";
import InteractiveBackground from "../components/InteractiveBackground";
import { departments, features } from "../data/uiData";

export default function InsightsPage() {
  const navigate = useNavigate();

  // Handle scroll to section on page load if hash is present
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#departments-section") {
      setTimeout(() => {
        const element = document.getElementById("departments-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="universal-page-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 🌟 NAVBAR START */}
      <nav className="insights-navbar" style={{ zIndex: 20, position: 'relative' }}>
        <div className="navbar-title">Bid Intelligence.AI</div>
        <button className="navbar-btn" onClick={() => {
          window.scrollTo({ top: 0, behavior: "instant" });
          navigate("/");
        }}>
          Analysis
        </button>
      </nav>
      {/* 🌟 NAVBAR END */}

      {/* 🌈 Animated Background */}
      <div className="universal-background" style={{ zIndex: 0 }}>
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      {/* 🕸️ Interactive Particle Background */}
      <InteractiveBackground />

      {/* 🌟 MAIN CONTENT */}
      <div
        className="min-h-screen hero-background"
        style={{ position: "relative", zIndex: 10 }}
      >
        <div className="w-full max-w-screen-xl mx-auto px-4 lg:px-8 py-16">
          {/* ===== HEADER ===== */}
          <div className="text-center mb-16">
            <div className="inline-block mb-4 px-4 py-2 bg-blue-100 rounded-full">
              <span className="text-blue-600 font-semibold text-sm">
                AI-Powered Bid Intelligence
              </span>
            </div>

            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Your AI Insights Are Ready
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Explore detailed intelligence across departments, identify Make in
              India opportunities, and dive deeper into product mapping, global
              research, and cost estimation.
            </p>
          </div>

          {/* ===== FEATURE CARDS ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {features.map((feature, idx) => (
              <FeatureCard
                key={idx}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "instant" });
                  navigate(feature.route);
                }}
              />
            ))}
          </div>

          {/* ===== DEPARTMENTS ===== */}
          <div id="departments-section" className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">
              Complete Department Coverage
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {departments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  icon={dept.icon}
                  name={dept.name}
                  textClass={dept.textClass}
                // onClick={() => {
                //   if (dept.name === "Bid Management") {
                //     navigate("/bid-management");
                //   } else {
                //     alert("This department is not configured yet.");
                //   }
                // }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
