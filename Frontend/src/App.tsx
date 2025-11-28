import "./App.css";

import CostEstimationPage from "./pages/CostEstimationPage.jsx";
import LandingPage from "./pages/LandingPage";
import UploadPage from "./pages/UploadPage";
import SmartRfpPage from "./pages/SmartRfpPage";
import ProductMappingPage from "./pages/ProductMappingPage";
import GlobalIntelligencePage from "./pages/GlobalIntelligencePage";
import InsightsPage from "./pages/InsightsPage";
import BidManagement from "./pages/BidManagement.jsx"   // ⬅️ IMPORT ADDED
import Technical from "./pages/Technical.jsx"  
import Commercial from "./pages/Commercial.jsx";
import Finance from "./pages/Finance.jsx";
import Legal from "./pages/Legal.jsx";
import SCM from "./pages/SCM.jsx";


import { Routes, Route, useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/$/, "");

  // Pages that should NOT have centered container (full width)
  const fullWidthPages = [
    "/smart-rfp",
    "/global-intelligence",
    "/product-mapping",
    "/bid-management"  ,
    "/technical",
    "/commercial",
"/finance",
"/legal",
"/scm",
   // ⬅️ Make navbar full width like Smart RFP
  ];

  const isFullWidth = fullWidthPages.includes(currentPath);

  return (
    <div className={isFullWidth ? "full-width-page" : "app-wrapper"}>
      <Routes>
        <Route path="/commercial" element={<Commercial />} />
<Route path="/finance" element={<Finance />} />
<Route path="/legal" element={<Legal />} />
<Route path="/scm" element={<SCM />} />

        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/smart-rfp" element={<SmartRfpPage />} />
        <Route path="/cost-estimation" element={<CostEstimationPage />} />
        <Route path="/product-mapping" element={<ProductMappingPage />} />
        <Route path="/global-intelligence" element={<GlobalIntelligencePage />} />
        <Route path="/technical" element={<Technical />} />
        <Route path="/bid-management" element={<BidManagement />} />   {/* ⬅️ NEW NAVBAR PAGE */}
      </Routes>
    </div>
  );
}
