import type { GatewaySessionProjection } from "../api/gateway-contract.ts";
import { creatorWorkspaceEntry } from "../dashboard/creator-workspace-registry.ts";
import { AdminManagerPage } from "./AdminManagerPage.tsx";
import { DashboardSettingsPage, type SettingsDashboardPage } from "../dashboard/DashboardSettingsPages.tsx";
import { PortalWorkspacePage } from "./PortalWorkspacePage.tsx";
import { ProjectStatusDot } from "./ProjectStatusDot.tsx";
import { ScreenStudioRouteShell } from "./ScreenStudioRouteShell.tsx";
import { CreatorWorkspacePage } from "./CreatorWorkspacePage.tsx";
import { findWorkspacePage, workspaceDefinitions } from "./workspace-registry.ts";
import { canRouteWorkspacePage } from "./workspace-routing.ts";
import type { WorkspacePageDefinition } from "./workspace-model.ts";

const settingsPages: Readonly<Partial<Record<string, SettingsDashboardPage>>> = Object.freeze({
  "account-settings": "profile", "game-settings": "gameplay", "interface-settings": "controls-ui",
  "display-settings": "display", "audio-settings": "audio",
});
const settingsRoutes: Readonly<Record<string, string>> = Object.freeze({
  profile: "account-settings", gameplay: "game-settings", "controls-ui": "interface-settings", display: "display-settings", audio: "audio-settings",
});
const managerPages: Readonly<Partial<Record<string, "users" | "groups" | "roles" | "permissions">>> = Object.freeze({
  "knowhere-accounts": "users", "knowhere-permissions": "permissions", "knowhere-roles": "roles", "knowhere-groups": "groups",
});

export function WorkspacePage({ page, projection, onNavigate }: Readonly<{
  page: WorkspacePageDefinition; projection: GatewaySessionProjection; onNavigate: (page: WorkspacePageDefinition) => void;
}>) {
  const settingsPage = settingsPages[page.id];
  const managerKind = managerPages[page.id];
  const workspaceLabel = workspaceDefinitions.find((workspace) => workspace.id === page.workspace)?.label ?? page.workspace;
  const selected = projection.selection.characters.find((character) => character.id === projection.selection.selectedCharacterId) ?? projection.selection.characters[0];
  const user = { id: selected?.id ?? projection.accountSoul.instanceId, username: projection.accountSoul.displayName, displayName: projection.accountSoul.displayName };
  const authorization = projection.session.authorization.revision === projection.session.authorizationRevision ? projection.session.authorization : null;
  const creatorEntry = page.workspace === "creator" ? creatorWorkspaceEntry(page.id) : null;
  if (settingsPage) return <DashboardSettingsPage page={settingsPage} user={user} onNavigate={(next) => { const route = settingsRoutes[next]; const target = route ? findWorkspacePage(route) : null; if (target) onNavigate(target); }} />;
  if (managerKind) return <AdminManagerPage kind={managerKind} authorization={authorization} expectedAuthorizationRevision={projection.session.authorizationRevision} />;
  if (page.workspace === "portal") return <PortalWorkspacePage page={page} onNavigate={onNavigate} />;
  if (page.id === "screen-studio" || creatorEntry?.area === "screen-studio") {
    const studioPage = page.id === "screen-studio" ? findWorkspacePage("screen-designer") ?? page : page;
    return <ScreenStudioRouteShell page={studioPage} authorization={authorization} expectedAuthorizationRevision={projection.session.authorizationRevision} parentAuthorized={canRouteWorkspacePage(page, authorization)} />;
  }
  if (page.id === "maker-lab") {
    const modelDesigner = creatorWorkspaceEntry("model-designer");
    if (modelDesigner) return <CreatorWorkspacePage entry={modelDesigner} authorization={authorization} expectedAuthorizationRevision={projection.session.authorizationRevision} parentAuthorized={canRouteWorkspacePage(page, authorization)} />;
  }
  if (creatorEntry) return <CreatorWorkspacePage entry={creatorEntry} authorization={authorization} expectedAuthorizationRevision={projection.session.authorizationRevision} parentAuthorized={canRouteWorkspacePage(page, authorization)} />;
  return <article className="designer-workspace-placeholder">
    <header><div><span>{workspaceLabel} Workspace</span><h1>{page.label}</h1></div><ProjectStatusDot status={page.status} /></header>
    <p>{page.description}</p>
    <p className="designer-workspace-placeholder__boundary">This route is represented honestly but has no reviewed persistence contract in this client slice.</p>
  </article>;
}
