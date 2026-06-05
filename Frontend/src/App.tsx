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
import ProjectComparisonPage from "./pages/ProjectComparisonPage";
import ProjectResultsPage from "./pages/ProjectResultsPage";
import SCM from "./pages/SCM.jsx";
import SmartRfpPage from "./pages/SmartRfpPage";
import TeamPage from "./pages/TeamPage";
import TeamProjectsPage from "./pages/TeamProjectsPage";
import TeamQuotaPage from "./pages/TeamQuotaPage";
import Technical from "./pages/Technical.jsx";
import UploadPage from "./pages/UploadPage";

import AccountPage from "./pages/AccountPage";
import ChangePasswordRequiredPage from "./pages/ChangePasswordRequiredPage";
import DocumentViewer from "./pages/DocumentViewer";

import { Navigate, Route, Routes, useLocation } from "react-router-dom";


export default function App() {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/$/, "") || "/";

  // Force BM/TM to change password before accessing any other page
  const token = localStorage.getItem("token");
  let user: { mustChangePassword?: boolean } | null = null;
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) user = JSON.parse(userStr);
  } catch {
    // ignore
  }
  const mustChangePaths = ["/", "/login", "/change-password"];
  if (token && user?.mustChangePassword && !mustChangePaths.includes(currentPath)) {
    return <Navigate to="/change-password" replace />;
  }


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
    "/team",
    "/team-quota",
    "/project-results",
    "/product mapping",
  ];

  const isFullWidth = fullWidthPages.includes(currentPath) || currentPath.startsWith("/project-results") || currentPath.startsWith("/project-comparison") || currentPath.startsWith("/team-projects");

  return (
    <>

      <div className={isFullWidth ? "full-width-page" : "app-wrapper"}>
        <Routes>
          {/* Login is now the default page */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordRequiredPage />} />

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
          <Route path="/product mapping" element={<Navigate to="/product-mapping" replace />} />
          <Route path="/global-intelligence" element={<GlobalIntelligencePage />} />
          <Route path="/technical" element={<Technical />} />
          <Route path="/bid-management" element={<BidManagement />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/project-results/:projectName" element={<ProjectResultsPage />} />
          <Route path="/project-comparison/:projectId" element={<ProjectComparisonPage />} />
          <Route path="/team-projects/:bidManagerId" element={<TeamProjectsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/team-quota" element={<TeamQuotaPage />} />

          <Route path="/document-viewer" element={<DocumentViewer />} />
          <Route path="*" element={<Navigate to="/insights" replace />} />
        </Routes>
      </div>
    </>
  );
}
