import { ChevronRight, Cpu, FileSearch, Globe2, LineChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="universal-page-wrapper">
      {/* Background Animation */}
      <div className="universal-background">
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>

      {/* Hero Section */}
      <div className="landing-container">
        <div className="text-center hero-section">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-100 rounded-full shadow-sm">
            <span className="text-blue-600 font-semibold text-sm ">
              AI-Powered Bidding Evolution
            </span>
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-snug">
            Transform Complex RFPs into
            <span className="text-blue-600"> Winning Bids</span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Experience the next generation of bid intelligence — automated analysis,
            AI-driven insights, and real-time opportunity mapping — all in one intuitive platform.
          </p>

          <button onClick={() => navigate("/upload")} className="modern-button">
            Get Started <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Feature Highlights */}
        <div className="hover-feature-section">
          <h2>What Makes Us Different?</h2>

          <div className="hover-grid">
            <div className="hover-card">
              <div className="hover-icon bg-gradient-blue">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <h3>AI Bid Engine</h3>
              <p>
                Our AI interprets RFP documents to identify crucial patterns
                and pricing advantages in seconds.
              </p>
            </div>

            <div className="hover-card">
              <div className="hover-icon bg-gradient-green">
                <LineChart className="w-8 h-8 text-white" />
              </div>
              <h3>Predictive Cost Estimation</h3>
              <p>
                Leverage machine learning to forecast costs and bid
                success probabilities with stunning accuracy.
              </p>
            </div>

            <div className="hover-card">
              <div className="hover-icon bg-gradient-purple">
                <FileSearch className="w-8 h-8 text-white" />
              </div>
              <h3>Smart Document Insights</h3>
              <p>
                Automatically extract key details, timelines, and tender specifics from
                lengthy bid documents — no manual effort needed.
              </p>
            </div>

            <div className="hover-card">
              <div className="hover-icon bg-gradient-cyan">
                <Globe2 className="w-8 h-8 text-white" />
              </div>
              <h3>Global Bid Intelligence</h3>
              <p>
                Stay ahead with live updates on global tenders, competitor activity, and
                market bidding trends to optimize every submission.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
