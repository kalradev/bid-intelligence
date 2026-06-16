import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

export type AdminProjectItem = {
  id: number;
  project_name: string;
  tender_id: string | null;
  client_name: string | null;
};

const ROW_HEIGHT = 50;

type RowData = {
  projects: AdminProjectItem[];
  onView: (name: string) => void;
  onAssign: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
};

function ProjectRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const project = data.projects[index];
  return (
    <div className="admin-projects-virtual-row" style={style}>
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
          <button type="button" className="admin-projects-action admin-projects-action--view" onClick={() => data.onView(project.project_name)} title="View result">
            View
          </button>
          <button type="button" className="admin-projects-action admin-projects-action--assign" onClick={() => data.onAssign(project.project_name)} title="Assign managers" aria-label="Assign managers">
            +
          </button>
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

type AdminProjectsTableProps = {
  projects: AdminProjectItem[];
  loading: boolean;
  maxHeight?: string;
  onView: (name: string) => void;
  onAssign: (name: string) => void;
  onArchive: (id: number) => void;
  onUpload: (id: number, name: string) => void;
};

export const AdminProjectsTable = memo(function AdminProjectsTable({
  projects,
  loading,
  maxHeight = "calc(100vh - 280px)",
  onView,
  onAssign,
  onArchive,
  onUpload,
}: AdminProjectsTableProps) {
  const listHostRef = useRef<HTMLDivElement>(null);
  const [listSize, setListSize] = useState({ width: 0, height: 0 });

  const itemData = useMemo<RowData>(
    () => ({ projects, onView, onAssign, onArchive, onUpload }),
    [projects, onView, onAssign, onArchive, onUpload]
  );

  useEffect(() => {
    const el = listHostRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width > 0 && height > 0) {
        setListSize({ width, height });
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [projects.length, loading, maxHeight]);

  if (loading && projects.length === 0) {
    return (
      <div className="admin-projects-panel" style={{ maxHeight }}>
        <div className="admin-projects-panel__empty">
          <div className="admin-projects-panel__spinner" />
          Loading projects…
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="admin-projects-panel" style={{ maxHeight }}>
        <div className="admin-projects-panel__empty">
          No admin-owned projects yet. Upload & analyze to create projects as Bid Admin.
        </div>
      </div>
    );
  }

  return (
    <div className="admin-projects-panel" style={{ maxHeight, height: maxHeight }}>
      <div className="admin-projects-virtual-header">
        <div className="admin-projects-virtual-cell admin-projects-virtual-cell--name">Project</div>
        <div className="admin-projects-virtual-cell admin-projects-virtual-cell--tender">Tender ID</div>
        <div className="admin-projects-virtual-cell admin-projects-virtual-cell--client">Client</div>
        <div className="admin-projects-virtual-cell admin-projects-virtual-cell--actions">Actions</div>
      </div>
      <div ref={listHostRef} className="admin-projects-virtual-list-host">
        {listSize.width > 0 && listSize.height > 0 && (
          <FixedSizeList
            height={listSize.height}
            width={listSize.width}
            itemCount={projects.length}
            itemSize={ROW_HEIGHT}
            itemData={itemData}
            overscanCount={5}
          >
            {MemoProjectRow}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
});
