import type { AuthorizationCapability, AuthorizationProjection as GatewayAuthorizationProjection } from "../api/gateway-contract.ts";
import type { ScreenPageTemplate as CreatorScreenPageTemplate, ScreenStatus } from "../dashboard/screen-studio-model.ts";

export type WorkspaceId = "account" | "character" | "knowhere" | "portal" | "creator";

export type ProjectStatus = ScreenStatus;
export type ScreenPageTemplate = CreatorScreenPageTemplate;
export type AuthorizationProjection = GatewayAuthorizationProjection;

export type WorkspaceDefinition = Readonly<{
  id: WorkspaceId;
  label: string;
  description: string;
  requiredCapability?: AuthorizationCapability;
}>;

export type WorkspacePageDefinition = Readonly<{
  id: string;
  label: string;
  workspace: WorkspaceId;
  parentId: string | null;
  route: string;
  status: ProjectStatus;
  description: string;
  requiredCapability?: AuthorizationCapability;
  template: ScreenPageTemplate;
  blocker?: string;
}>;

export type PageAccess = Readonly<{
  enabled: boolean;
  denied: boolean;
  reason: string | null;
}>;

export const projectStatusPresentation: Readonly<Record<ProjectStatus, Readonly<{ label: string; tone: string }>>> = Object.freeze({
  planned: Object.freeze({ label: "Planned", tone: "neutral" }),
  ready: Object.freeze({ label: "Ready", tone: "blue" }),
  started: Object.freeze({ label: "Started", tone: "cyan" }),
  "in-progress": Object.freeze({ label: "In progress", tone: "amber" }),
  blocked: Object.freeze({ label: "Blocked", tone: "red" }),
  review: Object.freeze({ label: "Review", tone: "violet" }),
  complete: Object.freeze({ label: "Complete", tone: "green" }),
});

export function hasCapability(authorization: AuthorizationProjection | null, capability?: AuthorizationCapability): boolean {
  return !capability || Boolean(authorization?.capabilities.includes(capability));
}

export function pageAccess(page: WorkspacePageDefinition, authorization: AuthorizationProjection | null): PageAccess {
  if (!hasCapability(authorization, page.requiredCapability)) {
    return Object.freeze({ enabled: false, denied: true, reason: `Requires ${page.requiredCapability}` });
  }
  if (page.status === "blocked") return Object.freeze({ enabled: false, denied: false, reason: page.blocker ?? "Blocked" });
  if (page.status === "planned") return Object.freeze({ enabled: false, denied: false, reason: page.blocker ?? "Planned" });
  return Object.freeze({ enabled: true, denied: false, reason: null });
}
