import "./App.css";

import BidManagement from "./pages/BidManagement.jsx"; // ⬅️ IMPORT ADDED
import Commercial from "./pages/Commercial.jsx";
import CostEstimationPage from "./pages/CostEstimationPage.jsx";
import Finance from "./pages/Finance.jsx";
import GlobalIntelligencePage from "./pages/GlobalIntelligencePage";
import InsightsPage from "./pages/InsightsPage";
import LandingPage from "./pages/LandingPage";
import Legal from "./pages/Legal.jsx";
import LoginPage from "./pages/LoginPage";
import ProductMappingPage from "./pages/ProductMappingPage";
import SCM from "./pages/SCM.jsx";
import SignupPage from "./pages/SignupPage";
import SmartRfpPage from "./pages/SmartRfpPage";
import Technical from "./pages/Technical.jsx";
import UploadPage from "./pages/UploadPage";

import DocumentViewer from "./pages/DocumentViewer";


import { Route, Routes, useLocation } from "react-router-dom";


export default function App() {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/$/, "");

  // Pages that should NOT have centered container (full width)
  const fullWidthPages = [
    "/smart-rfp",
    "/global-intelligence",
    "/product-mapping",
    "/bid-management",
    "/technical",
    "/commercial",
    "/finance",
    "/legal",
    "/scm",

    "/document-viewer",
    // ⬅️ Make navbar full width like Smart RFP
  ];

  const isFullWidth = fullWidthPages.includes(currentPath);

  return (
    <>

      <div className={isFullWidth ? "full-width-page" : "app-wrapper"}>
        <Routes>
          {/* Login is now the default page */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Landing page moved to /home (after login) */}
          <Route path="/home" element={<LandingPage />} />

          <Route path="/commercial" element={<Commercial />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/scm" element={<SCM />} />

          <Route path="/upload" element={<UploadPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/smart-rfp" element={<SmartRfpPage />} />
          <Route path="/cost-estimation" element={<CostEstimationPage />} />
          <Route path="/product-mapping" element={<ProductMappingPage />} />
          <Route path="/global-intelligence" element={<GlobalIntelligencePage />} />
          <Route path="/technical" element={<Technical />} />
          <Route path="/bid-management" element={<BidManagement />} />

          <Route path="/document-viewer" element={<DocumentViewer />} />
        </Routes>
      </div>
    </>
  );
}
