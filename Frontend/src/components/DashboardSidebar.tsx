import {
  Archive,
  ClipboardCheck,
  FileUp,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { NAVBAR_HEIGHT } from "./DashboardNavbar";

export type SidebarActiveItem =
  | "dashboard"
  | "admin_projects"
  | "all_projects"
  | "members"
  | "archived"
  | "create_user"
  | "upload"
  | "eligibility_docs"
  | "team"
  | "assigned"
  | "by_bid_manager";

type DashboardSidebarProps = {
  activeItem: SidebarActiveItem;
  userRole: string | null;
  userDisplayName?: string;
};

const navButtonBase = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 14px",
  justifyContent: "flex-start",
  border: "none",
  borderRadius: 9,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  background: "transparent",
  color: "#1e4a47",
  transition: "all 0.2s",
  textAlign: "left" as const,
};

function sidebarWidthForRole(role: string | null) {
  return role === "bid_admin" ? 228 : 240;
}

function navStyle(active: boolean) {
  return {
    ...navButtonBase,
    background: active ? "#6FBEB2" : "rgba(165,233,221,0.4)",
    color: active ? "#fff" : "#1e4a47",
    fontWeight: active ? 700 : 600,
    boxShadow: active ? "0 2px 8px rgba(111,190,178,0.3)" : "none",
    border: active ? "none" : "1px solid rgba(111,190,178,0.3)",
  };
}

function actionStyle(active: boolean) {
  return navStyle(active);
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#34908B",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        paddingLeft: 12,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function NavButton({
  active,
  title,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button type="button" className={`sidebar-nav-toggle${active ? " active" : ""}`} onClick={onClick} style={navStyle(active)} title={title}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ActionButton({
  active,
  title,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button type="button" className={`sidebar-nav-toggle${active ? " active" : ""}`} onClick={onClick} style={actionStyle(active)} title={title}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function getDashboardSidebarWidth(userRole: string | null) {
  return sidebarWidthForRole(userRole);
}

export default function DashboardSidebar({ activeItem, userRole, userDisplayName = "" }: DashboardSidebarProps) {
  const navigate = useNavigate();
  const role = (userRole || "").toLowerCase();
  const sidebarWidth = sidebarWidthForRole(role);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("analysisData");
    localStorage.removeItem("currentDocument");
    localStorage.removeItem("recentRfpAnalysis");
    toast.success("Logged out");
    navigate("/login");
  };

  const goHome = (view?: string) => {
    if (view) navigate("/home", { state: { view } });
    else navigate("/home");
  };

  const iconSize = role === "bid_admin" ? 18 : 20;

  return (
    <aside
      style={{
        position: "fixed",
        top: NAVBAR_HEIGHT,
        left: 0,
        bottom: 0,
        width: sidebarWidth,
        zIndex: 110,
        background: role === "bid_admin" ? "rgba(232,247,244,0.78)" : "rgba(234,239,239,0.95)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(111,190,178,0.2)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s ease",
      }}
    >
      <nav style={{ flex: 1, padding: role === "bid_admin" ? "16px 10px 12px" : "20px 10px 12px", display: "flex", flexDirection: "column", gap: role === "bid_admin" ? 6 : 4, overflowY: "auto" }}>
        <SectionLabel>Views</SectionLabel>

        {role === "bid_admin" && (
          <>
            <NavButton active={activeItem === "dashboard"} title="Dashboard" onClick={() => goHome("teams")} icon={<LayoutDashboard size={iconSize} style={{ flexShrink: 0 }} />} label="Dashboard" />
            <NavButton active={activeItem === "admin_projects"} title="Admin projects" onClick={() => goHome("personal")} icon={<FolderOpen size={iconSize} style={{ flexShrink: 0 }} />} label="Admin projects" />
            <NavButton active={activeItem === "members"} title="All members and their projects" onClick={() => goHome("members")} icon={<UserCircle size={iconSize} style={{ flexShrink: 0 }} />} label="All members" />
            <NavButton active={activeItem === "archived"} title="Archived projects" onClick={() => goHome("archived")} icon={<Archive size={iconSize} style={{ flexShrink: 0 }} />} label="Archived" />
          </>
        )}

        {role === "bid_manager" && (
          <>
            <NavButton active={activeItem === "dashboard"} title="Dashboard" onClick={() => goHome()} icon={<LayoutDashboard size={iconSize} style={{ flexShrink: 0 }} />} label="Dashboard" />
            <NavButton active={activeItem === "all_projects"} title="All projects" onClick={() => goHome("personal")} icon={<FolderOpen size={iconSize} style={{ flexShrink: 0 }} />} label="All projects" />
          </>
        )}

        {role === "technical_manager" && (
          <>
            <NavButton active={activeItem === "assigned"} title="Assigned projects" onClick={() => goHome()} icon={<LayoutDashboard size={iconSize} style={{ flexShrink: 0 }} />} label="Assigned projects" />
            <NavButton active={activeItem === "by_bid_manager"} title="By Bid Manager" onClick={() => goHome("by_bid_manager")} icon={<Users size={iconSize} style={{ flexShrink: 0 }} />} label="By Bid Manager" />
          </>
        )}

        {(role === "bid_admin" || role === "bid_manager" || role === "technical_manager") && (
          <>
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(111,190,178,0.4) 50%, transparent 100%)", margin: "10px 0" }} />
            <SectionLabel>Actions</SectionLabel>
          </>
        )}

        {role === "bid_admin" && (
          <ActionButton active={activeItem === "create_user"} title="Create Bid Manager or Technical Manager" onClick={() => goHome("create_user")} icon={<UserPlus size={iconSize} style={{ flexShrink: 0 }} />} label="Create User" />
        )}

        {(role === "bid_admin" || role === "bid_manager" || role === "technical_manager") && (
          <ActionButton
            active={activeItem === "upload"}
            title={role === "technical_manager" ? "Upload corrigendum or reference" : "Upload & Analyze RFP"}
            onClick={() => navigate("/upload?mode=rfp")}
            icon={<FileUp size={iconSize} style={{ flexShrink: 0 }} />}
            label={role === "technical_manager" ? "Upload Corrigendum / Reference" : "Upload & Analyze"}
          />
        )}

        {(role === "bid_admin" || role === "bid_manager") && (
          <ActionButton
            active={activeItem === "eligibility_docs"}
            title="Company documents for eligibility auto-check"
            onClick={() => navigate("/upload?mode=eligibility")}
            icon={<ClipboardCheck size={iconSize} style={{ flexShrink: 0 }} />}
            label="Eligibility documents"
          />
        )}

        {(role === "bid_admin" || role === "bid_manager") && (
          <ActionButton active={activeItem === "team"} title="Manage Teams" onClick={() => navigate("/team")} icon={<Users size={iconSize} style={{ flexShrink: 0 }} />} label="Manage Teams" />
        )}
      </nav>

      {(role === "bid_admin" || role === "bid_manager" || role === "technical_manager") && (
        <div style={{ padding: "10px 10px", borderTop: "1px solid rgba(111,190,178,0.2)", display: "flex", flexDirection: "column", gap: 6 }}>
          {role === "bid_admin" && (
            <button
              type="button"
              className="sidebar-nav-toggle"
              onClick={() => navigate("/account")}
              style={{
                ...navButtonBase,
                background: "rgba(165,233,221,0.4)",
                color: "#1e4a47",
                border: "1px solid rgba(111,190,178,0.3)",
              }}
              title="Account & security"
            >
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#6FBEB2", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {(userDisplayName || "Bid Admin").charAt(0).toUpperCase()}
              </div>
              <span>{userDisplayName || "Bid Admin"}</span>
            </button>
          )}
          <button type="button" onClick={handleLogout} style={{ ...navButtonBase, color: role === "bid_admin" ? "#2c6b66" : "#6b5344" }} title="Logout">
            <LogOut size={iconSize} style={{ flexShrink: 0 }} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
}
