import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { GatewaySessionProjection } from "../api/gateway-contract.ts";
import { AWARENESS_ITEM } from "../inventory/inventory-model.ts";
import { WorkspacePage } from "./WorkspacePage.tsx";
import { boundedRailPointerLayout, type RailLayout } from "./rail-layout.ts";
import { WorkspaceSidebar } from "./WorkspaceSidebar.tsx";
import { WorkspaceSlotHeader } from "./WorkspaceSlotHeader.tsx";
import { canonicalWorkspacePageId, findWorkspacePage, selectedWorkspaceAncestorIds, workspacePageRegistry } from "./workspace-registry.ts";
import { type AuthorizationProjection, type WorkspaceId, type WorkspacePageDefinition } from "./workspace-model.ts";
import { canRouteWorkspacePage, initialWorkspaceSelection, readRailMode, resolveWorkspaceSelection, workspaceSessionPreferenceKey, writeRailMode, writeSessionSelection, type RailMode, type WorkspaceSelection } from "./workspace-routing.ts";
import "./designer-workspace.css";

export function DesignerWorkspace({ projection, authorization, onBack, onLogout }: Readonly<{
  projection: GatewaySessionProjection; authorization: AuthorizationProjection | null; onBack: () => void; onLogout: () => void;
}>) {
  const defaultFullRailWidth = useMemo(() => Math.max(224, Math.min(288, window.innerWidth * .122)), []);
  const sessionKey = useMemo(() => workspaceSessionPreferenceKey(projection.accountSoul.instanceId, projection.session.expiresAt, projection.session.authorizationRevision), [projection]);
  const [railLayout, setRailLayout] = useState<RailLayout>(() => {
    const mode = readRailMode(window.localStorage);
    return { mode, width: mode === "hidden" ? 0 : mode === "compact" ? 96 : defaultFullRailWidth };
  });
  const railMode = railLayout.mode;
  const lastFullRailWidth = useRef(defaultFullRailWidth);
  const railHandleDragged = useRef(false);
  const [selection, setSelection] = useState<WorkspaceSelection>(() => initialWorkspaceSelection(window.location.search, window.sessionStorage, sessionKey, authorization));
  const explicitlyExpandedPageIds = useRef<ReadonlySet<string>>(new Set());
  const [expandedPageIds, setExpandedPageIds] = useState<ReadonlySet<string>>(() => new Set(selectedWorkspaceAncestorIds(selection.pageId)));
  const requestedPage = findWorkspacePage(selection.pageId) ?? workspacePageRegistry[0];
  const page = canRouteWorkspacePage(requestedPage, authorization)
    ? requestedPage
    : findWorkspacePage("account-settings") ?? workspacePageRegistry[0];
  const screenStudioActive = page.id === "screen-studio" || page.parentId === "screen-studio";

  const navigate = (next: WorkspaceSelection, replace = false) => {
    const resolved = resolveWorkspaceSelection(next.workspace, next.pageId, authorization);
    const url = new URL(window.location.href);
    url.pathname = "/dashboard";
    url.searchParams.set("workspace", resolved.workspace);
    url.searchParams.set("page", resolved.pageId);
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    writeSessionSelection(window.sessionStorage, sessionKey, resolved);
    setSelection(resolved);
  };
  const selectWorkspace = (workspace: WorkspaceId, preferredPage?: string) => navigate(resolveWorkspaceSelection(workspace, preferredPage ?? null, authorization));
  const selectPage = (nextPage: WorkspacePageDefinition) => { if (canRouteWorkspacePage(nextPage, authorization)) navigate({ workspace: nextPage.workspace, pageId: nextPage.id }); };
  const setRail = (mode: RailMode, width: number) => { writeRailMode(window.localStorage, mode); setRailLayout({ mode, width }); };
  const showRail = () => setRail("full", lastFullRailWidth.current);
  const cycleRail = () => railMode === "full" ? setRail("compact", 96) : railMode === "compact" ? setRail("hidden", 0) : showRail();
  const updateRailFromPointer = (clientX: number, persist: boolean) => {
    const next = boundedRailPointerLayout(clientX, window.innerWidth);
    if (next.mode === "full") lastFullRailWidth.current = next.width;
    if (persist) writeRailMode(window.localStorage, next.mode);
    setRailLayout(next);
  };
  const beginRailResize = (clientX: number) => {
    const startX = clientX;
    railHandleDragged.current = false;
    const move = (event: PointerEvent) => {
      if (Math.abs(event.clientX - startX) > 3) railHandleDragged.current = true;
      if (railHandleDragged.current) updateRailFromPointer(event.clientX, false);
    };
    const end = (event: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      if (railHandleDragged.current) updateRailFromPointer(event.clientX, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };
  const handleRailKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); railMode === "full" ? setRail("compact", 96) : setRail("hidden", 0); }
    else if (event.key === "ArrowRight") { event.preventDefault(); showRail(); }
    else if (event.key === "Home") { event.preventDefault(); setRail("hidden", 0); }
    else if (event.key === "End") { event.preventDefault(); showRail(); }
  };
  const toggleNavigationBranch = (pageId: string) => setExpandedPageIds((current) => {
    const next = new Set(current);
    const explicit = new Set(explicitlyExpandedPageIds.current);
    if (next.has(pageId)) { next.delete(pageId); explicit.delete(pageId); }
    else { next.add(pageId); explicit.add(pageId); }
    explicitlyExpandedPageIds.current = explicit;
    return next;
  });
  useEffect(() => {
    setExpandedPageIds(new Set([...explicitlyExpandedPageIds.current, ...selectedWorkspaceAncestorIds(selection.pageId)]));
  }, [selection.pageId]);

  useEffect(() => {
    const syncLocation = () => { const query = new URLSearchParams(window.location.search); const next = resolveWorkspaceSelection(query.get("workspace"), query.get("page"), authorization); writeSessionSelection(window.sessionStorage, sessionKey, next); setSelection(next); };
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [authorization, sessionKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedPageId = url.searchParams.get("page");
    const canonicalPageId = canonicalWorkspacePageId(requestedPageId);
    if (!requestedPageId || requestedPageId === canonicalPageId || selection.pageId !== canonicalPageId) return;
    url.searchParams.set("page", canonicalPageId);
    window.history.replaceState({}, "", url);
  }, [selection.pageId]);

  useEffect(() => {
    const returnToGame = (event: KeyboardEvent) => { if (event.key !== "Escape" && event.key !== "Tab") return; const target = event.target as HTMLElement | null; if (target?.matches("input, textarea, select") || target?.isContentEditable) return; event.preventDefault(); onBack(); };
    window.addEventListener("keydown", returnToGame);
    return () => window.removeEventListener("keydown", returnToGame);
  }, [onBack]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${page.label} · Designer Workspace`;
    return () => { document.title = previousTitle; };
  }, [page.label]);

  const resizeHandle = <button type="button" className="designer-workspace-rail__slide-handle" onPointerDown={(event) => beginRailResize(event.clientX)} onClick={() => { if (railHandleDragged.current) { railHandleDragged.current = false; return; } cycleRail(); }} onKeyDown={handleRailKey} aria-label={railMode === "hidden" ? "Show Designer Workspace navigation" : "Resize Designer Workspace navigation"} title={railMode === "hidden" ? "Show navigation" : "Drag to resize navigation; click to cycle full, mini, and hidden"}><span aria-hidden="true" /></button>;
  return <main className={`designer-workspace is-rail-${railMode}`} style={{ "--designer-rail-preferred-boundary": `${railLayout.width}px` } as CSSProperties} aria-label="Designer Workspace">
    {railMode === "hidden" ? <>{resizeHandle}<button type="button" className="designer-rail-reveal" onClick={showRail} aria-label="Show Designer Workspace navigation"><img src={AWARENESS_ITEM.iconPath} alt="" /></button></> : <WorkspaceSidebar railMode={railMode} authorization={authorization} selection={selection} expanded={expandedPageIds} onToggleExpansion={toggleNavigationBranch} onWorkspace={selectWorkspace} onPage={selectPage} resizeHandle={resizeHandle}>
      <WorkspaceSlotHeader projection={projection} selectedWorkspace={selection.workspace} onBack={onBack} onLogout={onLogout} onWorkspace={selectWorkspace} />
    </WorkspaceSidebar>}
    <section className={`designer-workspace__content${screenStudioActive ? " is-screen-studio" : ""}`} aria-live="polite"><WorkspacePage page={page} projection={projection} onNavigate={selectPage} /></section>
  </main>;
}
