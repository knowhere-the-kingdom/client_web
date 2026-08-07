import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { childPages, findWorkspacePage, PORTAL_PRESENTATION_BLOCKER } from "./workspace-registry.ts";
import type { WorkspacePageDefinition } from "./workspace-model.ts";

function pageAncestors(page: WorkspacePageDefinition): readonly WorkspacePageDefinition[] {
  const ancestors: WorkspacePageDefinition[] = [];
  let parent = findWorkspacePage(page.parentId);
  while (parent?.workspace === "portal") { ancestors.unshift(parent); parent = findWorkspacePage(parent.parentId); }
  return ancestors;
}

function templateLabel(page: WorkspacePageDefinition): string {
  return page.template === "manager-list" ? "Manager List placeholder" : page.template === "settings" ? "Settings placeholder" : "Portal placeholder";
}

export function PortalWorkspacePage({ page, onNavigate }: Readonly<{
  page: WorkspacePageDefinition;
  onNavigate: (page: WorkspacePageDefinition) => void;
}>) {
  const ancestors = pageAncestors(page);
  const children = childPages("portal", page.id);
  return <article className="designer-workspace-placeholder portal-workspace-page" data-page-status={page.status}>
    <nav className="portal-workspace-page__path" aria-label="Portal page path"><ol>
      <li><span>Portal Workspace</span></li>
      {ancestors.map((ancestor) => <li key={ancestor.id}><button type="button" onClick={() => onNavigate(ancestor)}>{ancestor.label}</button></li>)}
      <li><span aria-current="page">{page.label}</span></li>
    </ol></nav>
    <header><div><span>{templateLabel(page)}</span><h1>{page.label}</h1></div><ProjectStatusDot status={page.status} /></header>
    <p>{page.description}</p>
    {children.length ? <section className="portal-workspace-page__children" aria-labelledby="portal-child-pages"><h2 id="portal-child-pages">Contained pages</h2><ul>{children.map((child) => <li key={child.id}><button type="button" onClick={() => onNavigate(child)}><span><strong>{child.label}</strong><small>{child.description}</small></span><ProjectStatusDot status={child.status} /></button></li>)}</ul></section> : null}
    <p className="designer-workspace-placeholder__boundary"><strong>Presentation-only route.</strong> {page.blocker ?? PORTAL_PRESENTATION_BLOCKER}</p>
  </article>;
}
