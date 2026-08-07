import type { CSSProperties, ReactNode } from "react";

import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { navigationChildPages, workspaceDefinitions } from "./workspace-registry.ts";
import { hasCapability, pageAccess, type AuthorizationProjection, type WorkspaceId, type WorkspacePageDefinition } from "./workspace-model.ts";
import { canRouteWorkspacePage, type RailMode, type WorkspaceSelection } from "./workspace-routing.ts";

const bottomWorkspaceIds: readonly WorkspaceId[] = Object.freeze(["knowhere", "portal", "creator"]);

function NavigationBranch({ page, depth, compact, authorization, selection, expanded, onToggle, onSelect }: Readonly<{
  page: WorkspacePageDefinition; depth: number; compact: boolean; authorization: AuthorizationProjection | null;
  selection: WorkspaceSelection; expanded: ReadonlySet<string>; onToggle: (pageId: string) => void;
  onSelect: (page: WorkspacePageDefinition) => void;
}>) {
  const children = navigationChildPages(page.workspace, page.id);
  const access = pageAccess(page, authorization);
  const routable = canRouteWorkspacePage(page, authorization);
  const open = expanded.has(page.id);
  const title = [...new Set([page.description, access.reason, page.blocker].filter((value): value is string => Boolean(value)))].join(" ");
  return <li className="designer-nav-node" style={{ "--designer-tree-depth": depth, "--designer-tree-indent": `${Math.min(depth * .8, 3.2)}rem` } as CSSProperties} data-depth={depth} data-workspace={page.workspace} data-branch={children.length ? "group" : "page"}>
    <div className={`designer-nav-node__row${children.length ? " has-children" : ""}`}>
      {children.length ? <button type="button" className="designer-nav-node__toggle" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${page.label}`} onClick={() => onToggle(page.id)}><span aria-hidden="true">{open ? "▾" : "▸"}</span></button> : null}
      <button type="button" className="designer-nav-node__page" disabled={!routable} aria-current={selection.pageId === page.id ? "page" : undefined} aria-label={compact ? `${page.label}. ${title}` : undefined} title={title} onClick={() => onSelect(page)}>
        <span className="designer-nav-node__icon" aria-hidden="true">{page.label.slice(0, 1)}</span>
        <span className={compact ? "sr-only" : "designer-nav-node__label"}>{page.label}</span>
        <ProjectStatusDot status={page.status} compact />
      </button>
    </div>
    {children.length && open ? <ul>{children.map((child) => <NavigationBranch key={child.id} page={child} depth={depth + 1} compact={compact} authorization={authorization} selection={selection} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />)}</ul> : null}
  </li>;
}

export function WorkspaceSidebar({ railMode, authorization, selection, expanded, onToggleExpansion, onWorkspace, onPage, children, resizeHandle }: Readonly<{
  railMode: Exclude<RailMode, "hidden">; authorization: AuthorizationProjection | null; selection: WorkspaceSelection;
  expanded: ReadonlySet<string>; onToggleExpansion: (pageId: string) => void;
  onWorkspace: (workspace: WorkspaceId) => void; onPage: (page: WorkspacePageDefinition) => void; children: ReactNode;
  resizeHandle: ReactNode;
}>) {
  const compact = railMode === "compact";
  const roots = navigationChildPages(selection.workspace, null);
  const workspaceLabel = workspaceDefinitions.find((workspace) => workspace.id === selection.workspace)?.label ?? selection.workspace;
  const bottomWorkspaces = workspaceDefinitions.filter((workspace) => bottomWorkspaceIds.includes(workspace.id));

  return <aside className={`designer-workspace-rail is-${railMode}`} aria-label="Designer Workspace navigation">
    {resizeHandle}
    <div className="designer-workspace-rail__top">{children}</div>
    <nav className="designer-workspace-tree" aria-label={`${workspaceLabel} pages`}>
      <ul>{roots.map((page) => <NavigationBranch key={page.id} page={page} depth={0} compact={compact} authorization={authorization} selection={selection} expanded={expanded} onToggle={onToggleExpansion} onSelect={onPage} />)}</ul>
    </nav>
    <nav className="designer-workspace-bottom-nav" aria-label="Administrative Workspaces">
      {bottomWorkspaces.map((workspace) => { const available = hasCapability(authorization, workspace.requiredCapability); return <button key={workspace.id} type="button" disabled={!available} aria-current={selection.workspace === workspace.id ? "page" : undefined} title={available ? workspace.description : `Requires ${workspace.requiredCapability}`} onClick={() => onWorkspace(workspace.id)}><span aria-hidden="true">{workspace.label.slice(0, 1)}</span><b className={compact ? "sr-only" : undefined}>{workspace.label}</b></button>; })}
    </nav>
  </aside>;
}
