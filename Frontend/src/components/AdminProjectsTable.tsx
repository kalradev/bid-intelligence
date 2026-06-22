import { memo } from "react";

export type AdminProjectItem = {
  id: number;
  project_name: string;
  tender_id: string | null;
  client_name: string | null;
};

const GRID_COLS = "28% 14% 32% 26%";

type AdminProjectRowProps = {
  project: AdminProjectItem;
  onView: (name: string) => void;
  onAssign: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
};

const AdminProjectRow = memo(function AdminProjectRow({
  project,
  onView,
  onAssign,
  onArchive,
  onUpload,
}: AdminProjectRowProps) {
  return (
    <div className="admin-projects-virtual-row" style={{ gridTemplateColumns: GRID_COLS }}>
      <div className="admin-projects-virtual-cell admin-projects-virtual-cell--name" title={project.project_name}>
        {project.project_name}
      </div>
      <div className="admin-projects-virtual-cell admin-projects-virtual-cell--muted" title={project.tender_id || undefined}>
        {project.tender_id || "—"}
      </div>
      <div className="admin-projects-virtual-cell admin-projects-virtual-cell--muted" title={project.client_name || undefined}>
        {project.client_name || "—"}
      </div>
      <div className="admin-projects-virtual-cell admin-projects-virtual-cell--actions">
        <div className="admin-projects-actions">
          <button type="button" className="admin-projects-action admin-projects-action--view" onClick={() => onView(project.project_name)} title="View result">
            View
          </button>
          <button type="button" className="admin-projects-action admin-projects-action--assign" onClick={() => onAssign(project.project_name)} title="Assign managers" aria-label="Assign managers">
            +
          </button>
          <button type="button" className="admin-projects-action admin-projects-action--archive" onClick={() => onArchive(project.id)} title="Archive project">
            Archive
          </button>
          <button type="button" className="admin-projects-action admin-projects-action--upload" onClick={() => onUpload(project.id, project.project_name)} title="Upload final bid">
            Upload
          </button>
        </div>
      </div>
    </div>
  );
});

type AdminProjectsTableProps = {
  projects: AdminProjectItem[];
  loading: boolean;
  maxHeight?: string;
  fillParent?: boolean;
  onView: (name: string) => void;
  onAssign: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
};

export const AdminProjectsTable = memo(function AdminProjectsTable({
  projects,
  loading,
  maxHeight = "calc(100vh - 280px)",
  fillParent = false,
  onView,
  onAssign,
  onArchive,
  onUpload,
}: AdminProjectsTableProps) {
  const panelClassName = fillParent ? "admin-projects-panel admin-projects-panel--fill" : "admin-projects-panel";
  const panelStyle = fillParent ? undefined : { maxHeight, height: maxHeight };

  if (loading && projects.length === 0) {
    return (
      <div className={panelClassName} style={panelStyle}>
        <div className="admin-projects-panel__empty">
          <div className="admin-projects-panel__spinner" />
          Loading projects…
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={panelClassName} style={panelStyle}>
        <div className="admin-projects-panel__empty">
          No admin-owned projects yet. Upload & analyze to create projects as Bid Admin.
        </div>
      </div>
    );
  }

  return (
    <div className={panelClassName} style={panelStyle}>
      <div className="admin-projects-virtual-header" style={{ gridTemplateColumns: GRID_COLS }}>
        <div className="admin-projects-virtual-cell admin-projects-virtual-cell--name">Project</div>
        <div className="admin-projects-virtual-cell">Tender ID</div>
        <div className="admin-projects-virtual-cell">Client</div>
        <div className="admin-projects-virtual-cell admin-projects-virtual-cell--actions">Actions</div>
      </div>
      <div className="admin-projects-virtual-list-host admin-projects-virtual-list-host--scroll">
        {projects.map((project) => (
          <AdminProjectRow
            key={project.id}
            project={project}
            onView={onView}
            onAssign={onAssign}
            onArchive={onArchive}
            onUpload={onUpload}
          />
        ))}
      </div>
    </div>
  );
});
