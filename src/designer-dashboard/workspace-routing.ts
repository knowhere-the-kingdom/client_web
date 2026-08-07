import { canonicalWorkspacePageId, findWorkspacePage, workspaceDefinitions, workspacePageRegistry } from "./workspace-registry.ts";
import { hasCapability, pageAccess, type AuthorizationProjection, type WorkspaceId, type WorkspacePageDefinition } from "./workspace-model.ts";

export type RailMode = "full" | "compact" | "hidden";
export type WorkspaceSelection = Readonly<{ workspace: WorkspaceId; pageId: string }>;
export type StorageReader = Pick<Storage, "getItem">;
export type StorageWriter = Pick<Storage, "setItem">;

export const WORKSPACE_RAIL_PREFERENCE_KEY = "knowhere.designer-workspace.rail.v1";
const LEGACY_DASHBOARD_RAIL_PREFERENCE_KEY = "knowhere.designer-dashboard.rail.v1";
const WORKSPACE_SESSION_PREFERENCE_NAMESPACE = "knowhere.designer-dashboard.selection.v1";

export function workspaceSessionPreferenceKey(accountSoulInstanceId: string, sessionExpiresAt: string, authorizationRevision: number): string {
  return `${WORKSPACE_SESSION_PREFERENCE_NAMESPACE}:${accountSoulInstanceId}:${sessionExpiresAt}:${authorizationRevision}`;
}

export function readRailMode(storage: StorageReader | null): RailMode {
  try {
    const value = storage?.getItem(WORKSPACE_RAIL_PREFERENCE_KEY) ?? storage?.getItem(LEGACY_DASHBOARD_RAIL_PREFERENCE_KEY);
    return value === "hidden" || value === "compact" ? value : "full";
  } catch {
    return "full";
  }
}

export function writeRailMode(storage: StorageWriter | null, mode: RailMode): void {
  try { storage?.setItem(WORKSPACE_RAIL_PREFERENCE_KEY, mode); } catch { /* local preference failure is non-authoritative */ }
}

export function nextRailMode(mode: RailMode): RailMode {
  return mode === "full" ? "compact" : mode === "compact" ? "hidden" : "full";
}

export function canRouteWorkspacePage(page: WorkspacePageDefinition, authorization: AuthorizationProjection | null): boolean {
  if (!hasCapability(authorization, page.requiredCapability)) return false;
  // Portal routes are deliberately presentation-only. Routability exposes
  // status metadata and hierarchy, never a mutation or persistence surface.
  return page.workspace === "portal" || page.workspace === "creator" || pageAccess(page, authorization).enabled;
}

function firstAccessiblePage(workspace: WorkspaceId, authorization: AuthorizationProjection | null): WorkspacePageDefinition | null {
  return workspacePageRegistry.find((page) => page.workspace === workspace && canRouteWorkspacePage(page, authorization)) ?? null;
}

function fallbackWorkspaceSelection(authorization: AuthorizationProjection | null): WorkspaceSelection {
  const fallback = firstAccessiblePage("account", authorization) ?? null;
  if (!fallback) throw new Error("No account workspace route available");
  return Object.freeze({ workspace: fallback.workspace, pageId: fallback.id });
}

function normalizePageId(workspace: WorkspaceId | string | null, pageId: string | null): string | null {
  if (pageId === null || pageId === "") return pageId;
  if (workspace === "creator") return pageId.toLowerCase();
  return pageId;
}

export function resolveWorkspaceSelection(
  requestedWorkspace: string | null,
  requestedPageId: string | null,
  authorization: AuthorizationProjection | null,
): WorkspaceSelection {
  const workspace = workspaceDefinitions.some((candidate) => candidate.id === requestedWorkspace)
    ? requestedWorkspace as WorkspaceId
    : "account";
  const localFallback = firstAccessiblePage(workspace, authorization);
  const normalizedPageId = normalizePageId(workspace, requestedPageId);
  const hasRequestedPage = requestedPageId !== null && requestedPageId !== "";
  if (!hasRequestedPage) return localFallback ? Object.freeze({
    workspace,
    pageId: localFallback.id,
  }) : fallbackWorkspaceSelection(authorization);

  const requestedPage = findWorkspacePage(canonicalWorkspacePageId(normalizedPageId));
  if (requestedPage?.workspace === workspace && canRouteWorkspacePage(requestedPage, authorization)) {
    return Object.freeze({ workspace, pageId: requestedPage.id });
  }
  return fallbackWorkspaceSelection(authorization);
}

export function readSessionSelection(storage: StorageReader | null, key: string, authorization: AuthorizationProjection | null): WorkspaceSelection | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as { workspace?: unknown; pageId?: unknown };
    if (typeof value.workspace !== "string" || typeof value.pageId !== "string") return null;
    const resolved = resolveWorkspaceSelection(value.workspace, value.pageId, authorization);
    const storedCanonicalPageId = canonicalWorkspacePageId(normalizePageId(value.workspace, value.pageId));
    return resolved.workspace === value.workspace && resolved.pageId === storedCanonicalPageId ? resolved : null;
  } catch {
    return null;
  }
}

export function writeSessionSelection(storage: StorageWriter | null, key: string, selection: WorkspaceSelection): void {
  try { storage?.setItem(key, JSON.stringify(selection)); } catch { /* route remains authoritative for this render only */ }
}

export function initialWorkspaceSelection(
  search: string,
  storage: StorageReader | null,
  sessionPreferenceKey: string,
  authorization: AuthorizationProjection | null,
): WorkspaceSelection {
  const query = new URLSearchParams(search);
  if (query.has("workspace") || query.has("page")) {
    return resolveWorkspaceSelection(query.get("workspace"), query.get("page"), authorization);
  }
  return readSessionSelection(storage, sessionPreferenceKey, authorization)
    ?? resolveWorkspaceSelection("account", "account-settings", authorization);
}
