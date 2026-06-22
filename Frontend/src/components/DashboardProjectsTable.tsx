import { memo, type CSSProperties } from "react";

export type DashboardProjectItem = {
  id: number;
  project_name: string;
  tender_id?: string | null;
  client_name?: string | null;
  user_id?: number | null;
  assigned_users?: Array<{ id: number; fullName: string; email: string; role: string }>;
};

const TH: CSSProperties = {
  padding: "13px 16px",
  textAlign: "left",
  fontWeight: 600,
  color: "#475569",
  fontSize: 14,
};

const TD_NAME: CSSProperties = {
  padding: "13px 16px",
  fontWeight: 600,
  color: "#0f172a",
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const TD_MUTED: CSSProperties = {
  padding: "13px 16px",
  color: "#64748b",
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function normalizeRole(role?: string): string {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function getAssignedNameList(
  users: DashboardProjectItem["assigned_users"],
  role: "bid_manager" | "technical_manager"
): string[] {
  return (users || [])
    .filter((u) => normalizeRole(u.role) === role)
    .map((u) => u.fullName)
    .filter(Boolean);
}

function AssignedNamesCell({ names, emptyLabel = "None" }: { names: string[]; emptyLabel?: string }) {
  if (names.length === 0) {
    return <span className="dashboard-projects-assigned-empty">{emptyLabel}</span>;
  }

  return (
    <div className="dashboard-projects-assigned-names" title={names.join(", ")}>
      {names.map((name) => (
        <span key={name} className="dashboard-projects-assigned-chip">
          {name}
        </span>
      ))}
    </div>
  );
}

function ProjectTableRow({
  project,
  bidManagerNames,
  technicalManagerNames,
  showBadge,
  showAssign,
  onView,
  onAssign,
  onArchive,
  onUpload,
}: {
  project: DashboardProjectItem;
  bidManagerNames: string[];
  technicalManagerNames: string[];
  showBadge: boolean;
  showAssign: boolean;
  onView: (name: string) => void;
  onAssign?: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
}) {
  return (
    <tr className="dashboard-projects-table-row">
      <td style={TD_NAME} title={project.project_name}>
        <span>{project.project_name}</span>
        {showBadge && <span className="dashboard-projects-admin-tag"> [Admin]</span>}
      </td>
      <td style={TD_MUTED} title={project.tender_id || undefined}>
        {project.tender_id ?? "—"}
      </td>
      <td style={TD_MUTED} title={project.client_name || undefined}>
        {project.client_name ?? "—"}
      </td>
      <td className="dashboard-projects-table-cell--assigned">
        {bidManagerNames.length > 0 ? (
          <AssignedNamesCell names={bidManagerNames} />
        ) : (
          <span className="dashboard-projects-assigned-empty">—</span>
        )}
      </td>
      <td className="dashboard-projects-table-cell--assigned">
        <AssignedNamesCell names={technicalManagerNames} />
      </td>
      <td className="dashboard-projects-table-cell--actions">
        <div className="admin-projects-actions admin-projects-actions--centered">
          <button type="button" className="admin-projects-action admin-projects-action--view" onClick={() => onView(project.project_name)} title="View result">
            View
          </button>
          {showAssign && onAssign && (
            <button type="button" className="admin-projects-action admin-projects-action--assign" onClick={() => onAssign(project.project_name)} title="Assign managers" aria-label="Assign managers">
              +
            </button>
          )}
          <button type="button" className="admin-projects-action admin-projects-action--archive" onClick={() => onArchive(project.id)} title="Archive project">
            Archive
          </button>
          <button type="button" className="admin-projects-action admin-projects-action--upload" onClick={() => onUpload(project.id, project.project_name)} title="Upload final bid">
            Upload
          </button>
        </div>
      </td>
    </tr>
  );
}

const MemoProjectTableRow = memo(ProjectTableRow);

type DashboardProjectsTableProps = {
  projects: DashboardProjectItem[];
  loading: boolean;
  bmById: Record<number, string>;
  currentUserId?: number | null;
  showAdminBadge?: "auto" | "always" | "off";
  showAssign?: boolean;
  emptyMessage?: string;
  onView: (name: string) => void;
  onAssign?: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
};

export const DashboardProjectsTable = memo(function DashboardProjectsTable({
  projects,
  loading,
  bmById,
  currentUserId = null,
  showAdminBadge = "off",
  showAssign = false,
  emptyMessage = "No projects found.",
  onView,
  onAssign,
  onArchive,
  onUpload,
}: DashboardProjectsTableProps) {
  if (loading && projects.length === 0) {
    return (
      <div className="dashboard-teams-tab-pane__empty">
        <div className="admin-projects-panel__spinner" />
        Loading…
      </div>
    );
  }

  if (projects.length === 0) {
    return <div className="dashboard-teams-tab-pane__empty">{emptyMessage}</div>;
  }

  const colgroup = showAssign ? (
    <>
      <col style={{ width: "16%" }} />
      <col style={{ width: "9%" }} />
      <col style={{ width: "11%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "32%" }} />
    </>
  ) : (
    <>
      <col style={{ width: "18%" }} />
      <col style={{ width: "10%" }} />
      <col style={{ width: "12%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "28%" }} />
    </>
  );

  return (
    <div className="admin-dashboard-table dashboard-teams-tab-pane__table dashboard-projects-table-scroll">
      <table>
        <colgroup>{colgroup}</colgroup>
        <thead>
          <tr>
            <th style={TH}>Project</th>
            <th style={TH}>Tender ID</th>
            <th style={TH}>Client</th>
            <th style={TH}>Bid Manager</th>
            <th style={TH}>Technical Manager(s)</th>
            <th className="dashboard-projects-table-actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const assignedBMs = getAssignedNameList(project.assigned_users, "bid_manager");
            const bidManagerNames =
              assignedBMs.length > 0
                ? assignedBMs
                : project.user_id && bmById[project.user_id]
                  ? [bmById[project.user_id]]
                  : [];
            const technicalManagerNames = getAssignedNameList(project.assigned_users, "technical_manager");
            const showBadge =
              showAdminBadge === "always" ||
              (showAdminBadge === "auto" && currentUserId != null && project.user_id === currentUserId);

            return (
              <MemoProjectTableRow
                key={project.id}
                project={project}
                bidManagerNames={bidManagerNames}
                technicalManagerNames={technicalManagerNames}
                showBadge={showBadge}
                showAssign={showAssign}
                onView={onView}
                onAssign={onAssign}
                onArchive={onArchive}
                onUpload={onUpload}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
