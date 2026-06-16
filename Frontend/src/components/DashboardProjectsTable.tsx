import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

export type DashboardProjectItem = {
  id: number;
  project_name: string;
  tender_id?: string | null;
  client_name?: string | null;
  user_id?: number | null;
  assigned_users?: Array<{ id: number; fullName: string; email: string; role: string }>;
};

const ROW_HEIGHT = 54;
const DASHBOARD_PROJECT_GRID = "22% 10% 14% 12% 12% 30%";

type RowData = {
  projects: DashboardProjectItem[];
  bmById: Record<number, string>;
  currentUserId: number | null;
  showAdminBadge: "auto" | "always" | "off";
  showAssign: boolean;
  onView: (name: string) => void;
  onAssign?: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
};

function ProjectRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const project = data.projects[index];
  const bidManager = project.user_id ? (data.bmById[project.user_id] ?? "—") : "—";
  const technicalManagers = (project.assigned_users || []).map((u) => u.fullName).join(", ") || "None";
  const showBadge =
    data.showAdminBadge === "always" ||
    (data.showAdminBadge === "auto" && data.currentUserId != null && project.user_id === data.currentUserId);

  return (
    <div className="dashboard-projects-virtual-row" style={{ ...style, gridTemplateColumns: DASHBOARD_PROJECT_GRID }}>
      <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--name" title={project.project_name}>
        <span className="dashboard-projects-name">{project.project_name}</span>
        {showBadge && <span className="dashboard-projects-admin-tag">[Admin]</span>}
      </div>
      <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--muted" title={project.tender_id || undefined}>
        {project.tender_id ?? "—"}
      </div>
      <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--muted" title={project.client_name || undefined}>
        {project.client_name ?? "—"}
      </div>
      <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--muted" title={bidManager}>
        {bidManager}
      </div>
      <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--muted" title={technicalManagers}>
        {technicalManagers}
      </div>
      <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--actions">
        <div className="admin-projects-actions">
          <button type="button" className="admin-projects-action admin-projects-action--view" onClick={() => data.onView(project.project_name)} title="View result">
            View
          </button>
          {data.showAssign && data.onAssign && (
            <button type="button" className="admin-projects-action admin-projects-action--assign" onClick={() => data.onAssign!(project.project_name)} title="Assign managers" aria-label="Assign managers">
              +
            </button>
          )}
          <button type="button" className="admin-projects-action admin-projects-action--archive" onClick={() => data.onArchive(project.id)} title="Archive project">
            Archive
          </button>
          <button type="button" className="admin-projects-action admin-projects-action--upload" onClick={() => data.onUpload(project.id, project.project_name)} title="Upload final bid">
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}

const MemoProjectRow = memo(ProjectRow);

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
  const panelRef = useRef<HTMLDivElement>(null);
  const listHostRef = useRef<HTMLDivElement>(null);
  const [listSize, setListSize] = useState({ width: 0, height: 0 });

  const itemData = useMemo<RowData>(
    () => ({
      projects,
      bmById,
      currentUserId,
      showAdminBadge,
      showAssign,
      onView,
      onAssign,
      onArchive,
      onUpload,
    }),
    [projects, bmById, currentUserId, showAdminBadge, showAssign, onView, onAssign, onArchive, onUpload]
  );

  useEffect(() => {
    const panel = panelRef.current;
    const listHost = listHostRef.current;
    if (!panel || !listHost) return;

    const update = () => {
      const width = panel.clientWidth;
      const height = listHost.clientHeight;
      if (width > 0 && height > 0) {
        setListSize({ width, height });
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(panel);
    ro.observe(listHost);
    return () => ro.disconnect();
  }, [projects.length, loading]);

  const panelStyle = { flex: 1, minHeight: 0, width: "100%" as const };

  if (loading && projects.length === 0) {
    return (
      <div ref={panelRef} className="dashboard-projects-panel" style={panelStyle}>
        <div className="dashboard-projects-panel__empty">
          <div className="admin-projects-panel__spinner" />
          Loading…
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div ref={panelRef} className="dashboard-projects-panel" style={panelStyle}>
        <div className="dashboard-projects-panel__empty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="dashboard-projects-panel" style={panelStyle}>
      <div className="dashboard-projects-virtual-header" style={{ gridTemplateColumns: DASHBOARD_PROJECT_GRID }}>
        <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--name">Project</div>
        <div className="dashboard-projects-virtual-cell">Tender ID</div>
        <div className="dashboard-projects-virtual-cell">Client</div>
        <div className="dashboard-projects-virtual-cell">Bid Manager</div>
        <div className="dashboard-projects-virtual-cell">Technical Manager(s)</div>
        <div className="dashboard-projects-virtual-cell dashboard-projects-virtual-cell--actions">Actions</div>
      </div>
      <div ref={listHostRef} className="dashboard-projects-virtual-list-host">
        {listSize.width > 0 && listSize.height > 0 && (
          <FixedSizeList
            height={listSize.height}
            width={listSize.width}
            itemCount={projects.length}
            itemSize={ROW_HEIGHT}
            itemData={itemData}
            overscanCount={4}
          >
            {MemoProjectRow}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
});
