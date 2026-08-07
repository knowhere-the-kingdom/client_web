import { creatorWorkspaceEntry } from "../dashboard/creator-workspace-registry.ts";
import { evaluateScreenStudioPermissionGate, type ScreenStudioPermissionContext } from "../dashboard/screen-studio-permission.ts";
import { ScreenStudioElementManager } from "./ScreenStudioElementManager.tsx";
import { ScreenStudioBehaviorManager } from "./ScreenStudioBehaviorManager.tsx";
import { ScreenStudioManager, type ScreenStudioManagerScope } from "./ScreenStudioManager.tsx";
import { ScreenStudioThemesPanel } from "./ScreenStudioThemesPanel.tsx";
import { CreatorGridDesigner } from "./CreatorDesignerSurfaces.tsx";
import type { AuthorizationProjection, WorkspacePageDefinition } from "./workspace-model.ts";
import "./screen-studio.css";

export function ScreenStudioRouteShell({ page, authorization, expectedAuthorizationRevision, parentAuthorized }: Readonly<{ page: WorkspacePageDefinition; authorization: AuthorizationProjection | null; expectedAuthorizationRevision: number; parentAuthorized: boolean }>) {
  const entry = creatorWorkspaceEntry(page.id);
  const managerScope: ScreenStudioManagerScope = "screens";
  const permissionContext: ScreenStudioPermissionContext = { authorization, expectedAuthorizationRevision, parentAuthorized };
  const pageAccess = evaluateScreenStudioPermissionGate(entry ? { id: `gate-${entry.id}`, requiredCapability: entry.requiredCapability, mode: "all", deniedMessage: "World Designer capability is required." } : undefined, permissionContext);
  return <section className="screen-studio-route" data-screen-studio-view={page.id} aria-label="Screen Studio">
    {!pageAccess.allowed ? <p className="screen-studio-boundary" role="alert">Screen Studio content is unavailable: {pageAccess.reason}. The Creator parent authorization remains required.</p> : page.id === "styles" ? <ScreenStudioThemesPanel authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} /> : page.id === "elements" ? <ScreenStudioElementManager authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} /> : page.id === "behaviors" ? <ScreenStudioBehaviorManager authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} /> : page.id === "screen-designer" && entry ? <CreatorGridDesigner entry={entry} authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} parentAuthorized={parentAuthorized} /> : <ScreenStudioManager scope={managerScope} authorization={authorization} expectedAuthorizationRevision={expectedAuthorizationRevision} parentAuthorized={parentAuthorized} />}
  </section>;
}
