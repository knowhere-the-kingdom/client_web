import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { screenStudioDefaultPageRecords, screenStudioScreenRecords } from "../dashboard/screen-studio-fixtures.ts";
import { SCREEN_STUDIO_BEHAVIOR_CATEGORIES, SCREEN_STUDIO_BEHAVIOR_CATALOG, type ScreenStudioBehaviorCategory } from "../dashboard/screen-studio-behavior-model.ts";
import {
  SCREEN_STUDIO_ADD_MENU_STATE_INITIAL,
  DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID,
  SCREEN_STUDIO_ELEMENT_EDITOR_LABEL,
  SCREEN_STUDIO_FUSED_ELEMENT_CATALOG,
  SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS,
  SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS,
  addElementLayerUnderContainer,
  buildElementAddMenuGroupsForParent,
  canLayerHostChildren,
  findElementLayerById,
  isElementEditorActionAllowed,
  isClosableElementLayer,
  isMovableElementLayer,
  isReparentableElementLayer,
  openAddMenuGroup,
  projectAlignedSiteUnitGeometry,
  projectElementViewportGrid,
  resetAddMenuState,
  selectAddMenuType,
  updateElementLayerById,
  validateElementLayers,
  type ElementLayerV1,
  type ScreenStudioAddMenuState,
  type ScreenStudioElementHorizontalAnchor,
  type ScreenStudioElementLayerContainerTarget,
  type ScreenStudioElementVerticalAnchor,
} from "../dashboard/screen-studio-element-composition-model.ts";
import {
  applyScreenStudioCommand,
  constrainPlacement,
  createEmptyScreenStudioEditorSession,
  createScreenStudioDocument,
  deleteSelectedScreenStudioTarget,
  loadScreenStudioTarget,
  projectScreenStudioParentDrop,
  reparentScreenStudioHierarchy,
  SCREEN_STUDIO_SCREEN_GROUPS,
  screenStudioContextMenuGroups,
  screenStudioElementCatalog,
  screenStudioPageRecords,
  selectScreenStudioLoadedTarget,
  snapToGrid,
  type ScreenNode,
  type ScreenGroupId,
  type ScreenRecord,
  type ScreenStudioDocument,
} from "../dashboard/screen-studio-model.ts";
import {
  evaluateScreenStudioPermissionGate,
  type ScreenStudioPermissionContext,
} from "../dashboard/screen-studio-permission.ts";
import type { AuthorizationProjection } from "./workspace-model.ts";
import { screenRecordToPageRecord } from "./screen-studio-screen-layout.ts";
import { findResolvedCompositionElement, projectElementLayersComposition, reconcileScreenNodesToElementLayers } from "./screen-studio-composition-ui.ts";
import { WorkspaceEditorOverlay } from "./WorkspaceEditorOverlay.tsx";
import "./screen-studio-editor-interactions.css";

type ContextMenuState = Readonly<{
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  nodeId: string | null;
}>;
type Candidate = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;
type DragState = Readonly<{
  nodeId: string;
  pointerId: number;
  candidate: Candidate;
  valid: boolean;
}>;
type HeldPlacement = Readonly<{
  node: ScreenNode;
  candidate: Candidate;
  valid: boolean;
}>;
type ResizeCorner = "nw" | "ne" | "sw" | "se";
type ResizeState = Readonly<{
  nodeId: string;
  pointerId: number;
  corner: ResizeCorner;
  startClientX: number;
  startClientY: number;
  start: Candidate;
  candidate: Candidate;
  valid: boolean;
}>;
type LayerResizeState = Readonly<{
  layerId: string;
  pointerId: number;
  corner: ResizeCorner;
  startClientX: number;
  startClientY: number;
  startGeometry: ElementLayerV1["geometry"];
  candidate: ElementLayerV1["geometry"];
  valid: boolean;
}>;
type PendingPointer = Readonly<{ nodeId: string; pointerId: number; x: number; y: number }>;
type LayerDragState = Readonly<{
  layerId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startGeometry: ElementLayerV1["geometry"];
  candidate: ElementLayerV1["geometry"];
  projectedParentId: string | null | undefined;
  projectionValid: boolean;
}>;
type EditorFeedback = Readonly<{ tone: "status" | "alert"; message: string }>;
type LoadMenuKind = "element" | "screen";
type ScreenStudioContainerType = "workspace" | "hud" | "element" | "behavior";
type ScreenStudioContainerEditorTab = "Position" | "Size" | "Palette" | "Effects" | "Behaviors";
type ScreenStudioContainerSettings = Readonly<{ name: string; slug: string; type: ScreenStudioContainerType }>;
type LogicCanvasNode = Readonly<{ id: string; recordId: string; x: number; y: number }>;
type StudioCamera = Readonly<{ x: number; y: number; zoom: number }>;
type StudioPan = Readonly<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number }>;
const SCREEN_STUDIO_CONTAINER_TYPES = Object.freeze([
  Object.freeze({ id: "workspace", label: "Workspace" }),
  Object.freeze({ id: "hud", label: "HUD" }),
  Object.freeze({ id: "element", label: "Element" }),
  Object.freeze({ id: "behavior", label: "Behavior" }),
] as const);
const DEFAULT_CONTAINER_SETTINGS: ScreenStudioContainerSettings = Object.freeze({ name: "Untitled Screen", slug: "creator/untitled-screen", type: "workspace" });
const LOCAL_SCREEN_DRAFT_ID = "local-screen-draft";
const SCREEN_STUDIO_STAGE_WIDTH = 960;
const SCREEN_STUDIO_STAGE_HEIGHT = 640;
const SCREEN_STUDIO_ZOOM_MIN = 0.25;
const SCREEN_STUDIO_ZOOM_MAX = 4;
const nestedUrlSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const SCREEN_STUDIO_CONTAINER_EDITOR_TABS = Object.freeze(["Position", "Size", "Palette", "Effects", "Behaviors"] as const);

function loadKindsForContainer(type: ScreenStudioContainerType): ReadonlySet<"behavior" | LoadMenuKind> {
  if (type === "workspace") return new Set(["element", "screen"]);
  if (type === "hud" || type === "element") return new Set(["element"]);
  return new Set(["behavior"]);
}
function screenLoadGroupDepth(groupId: ScreenGroupId): number {
  let depth = 0;
  let current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === groupId);
  const visited = new Set<ScreenGroupId>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === current?.parentId);
  }
  return depth;
}

function screenLoadGroupAncestorIds(groupId: ScreenGroupId): readonly ScreenGroupId[] {
  const ancestors: ScreenGroupId[] = [];
  let current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === groupId);
  const visited = new Set<ScreenGroupId>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    ancestors.push(current.parentId);
    current = SCREEN_STUDIO_SCREEN_GROUPS.find((group) => group.id === current?.parentId);
  }
  return ancestors;
}
const SCREEN_STUDIO_VIEWPORT_PRESET_LABELS = {
  left: "Left",
  center: "Center",
  right: "Right",
  top: "Top",
  middle: "Middle",
  bottom: "Bottom",
} as const;

const editorPage = screenStudioDefaultPageRecords.find(
  (page) => page.template === "screen-studio-editor",
)!;

const SITE_UNIT_STEP = 0.25;
const SITE_UNIT_MAX = 64;

function boundedSiteUnit(value: number): number {
  const finite = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(SITE_UNIT_MAX, Math.round(finite / SITE_UNIT_STEP) * SITE_UNIT_STEP));
}

function snappedSiteDelta(value: number): number {
  return Number.isFinite(value) ? Math.round(value / SITE_UNIT_STEP) * SITE_UNIT_STEP : 0;
}

function nodeInteractionPolicy(node: ScreenNode) {
  const entry = SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find(
    (candidate) => candidate.id === node.definitionId,
  );
  return entry ? { elementType: entry.id, family: entry.family } : null;
}

function reconcileLayersWithDocument(current: readonly ElementLayerV1[], nodes: readonly ScreenNode[], unit: number): readonly ElementLayerV1[] {
  return reconcileScreenNodesToElementLayers(current, nodes, unit);
}

function removeLayerById(layers: readonly ElementLayerV1[], layerId: string): readonly ElementLayerV1[] {
  const visit = (siblings: readonly ElementLayerV1[]): readonly ElementLayerV1[] => Object.freeze(siblings
    .filter((layer) => layer.id !== layerId)
    .map((layer) => Object.freeze({ ...layer, children: visit(layer.children) }))
    .map((layer, order) => layer.order === order ? layer : Object.freeze({ ...layer, order })));
  const candidate = visit(layers);
  return validateElementLayers(candidate).length ? layers : candidate;
}

function layerIds(layers: readonly ElementLayerV1[], output = new Set<string>()): Set<string> {
  for (const layer of layers) {
    output.add(layer.id);
    layerIds(layer.children, output);
  }
  return output;
}

function addedLayerId(before: readonly ElementLayerV1[], after: readonly ElementLayerV1[]): string | null {
  const previous = layerIds(before);
  for (const id of layerIds(after)) if (!previous.has(id)) return id;
  return null;
}

function parentLayerId(layers: readonly ElementLayerV1[], layerId: string, parentId: string | null = null): string | null {
  for (const layer of layers) {
    if (layer.id === layerId) return parentId;
    const nested = parentLayerId(layer.children, layerId, layer.id);
    if (nested !== null) return nested;
  }
  return null;
}

function layerContainsId(layer: ElementLayerV1, candidateId: string): boolean {
  return layer.children.some((child) => child.id === candidateId || layerContainsId(child, candidateId));
}

function reparentElementLayer(
  layers: readonly ElementLayerV1[],
  layerId: string,
  parentId: string | null,
  geometry: ElementLayerV1["geometry"],
): readonly ElementLayerV1[] | null {
  let moved: ElementLayerV1 | null = null;
  const remove = (siblings: readonly ElementLayerV1[]): readonly ElementLayerV1[] => Object.freeze(siblings
    .filter((layer) => {
      if (layer.id !== layerId) return true;
      moved = Object.freeze({ ...layer, geometry });
      return false;
    })
    .map((layer) => Object.freeze({ ...layer, children: remove(layer.children) }))
    .map((layer, order) => Object.freeze({ ...layer, order })));
  const without = remove(layers);
  if (!moved) return null;
  const insert = (siblings: readonly ElementLayerV1[]): readonly ElementLayerV1[] => Object.freeze(siblings.map((layer) => {
    if (layer.id === parentId) return Object.freeze({ ...layer, children: Object.freeze([...layer.children, moved!].map((child, order) => Object.freeze({ ...child, order }))) });
    return Object.freeze({ ...layer, children: insert(layer.children) });
  }));
  const next = parentId === null
    ? Object.freeze([...without, moved].map((layer, order) => Object.freeze({ ...layer, order })))
    : insert(without);
  return validateElementLayers(next).length ? null : next;
}

export function ScreenStudioEditor({
  authorization,
  expectedAuthorizationRevision,
  parentAuthorized,
}: Readonly<{
  authorization: AuthorizationProjection | null;
  expectedAuthorizationRevision: number;
  parentAuthorized: boolean;
}>) {
  const [editorSession, setEditorSession] = useState(createEmptyScreenStudioEditorSession);
  const requestedScreenId = useMemo(() => new URLSearchParams(window.location.search).get("screen"), []);
  const emptyDocument = useMemo<ScreenStudioDocument>(() => createScreenStudioDocument({ ...editorPage, nodes: [] }), []);
  const document = editorSession.document ?? emptyDocument;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<readonly ElementLayerV1[]>([]);
  const [canonicalScreen, setCanonicalScreen] = useState<ScreenRecord | null>(null);
  const [containerEditorOpen, setContainerEditorOpen] = useState(false);
  const [containerDraftUnsaved, setContainerDraftUnsaved] = useState(false);
  const [containerEditorTab, setContainerEditorTab] = useState<ScreenStudioContainerEditorTab>("Position");
  const [containerSettings, setContainerSettings] = useState<ScreenStudioContainerSettings>(DEFAULT_CONTAINER_SETTINGS);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewportHorizontalPreset, setViewportHorizontalPreset] = useState<ScreenStudioElementHorizontalAnchor>("left");
  const [viewportVerticalPreset, setViewportVerticalPreset] = useState<ScreenStudioElementVerticalAnchor>("top");
  const [loadMenuKind, setLoadMenuKind] = useState<LoadMenuKind | null>(null);
  const [screenLoadQuery, setScreenLoadQuery] = useState("");
  const [collapsedScreenLoadGroups, setCollapsedScreenLoadGroups] = useState<ReadonlySet<ScreenGroupId>>(() => new Set());
  const [addMenuState, setAddMenuState] = useState<ScreenStudioAddMenuState | null>(null);
  const [addMenuTarget, setAddMenuTarget] = useState<ScreenStudioElementLayerContainerTarget | null>(null);
  const [logicMenuCategory, setLogicMenuCategory] = useState<ScreenStudioBehaviorCategory | null>(null);
  const [logicNodes, setLogicNodes] = useState<readonly LogicCanvasNode[]>([]);
  const [editorFeedback, setEditorFeedback] = useState<EditorFeedback | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [layerDrag, setLayerDrag] = useState<LayerDragState | null>(null);
  const [heldPlacement, setHeldPlacement] = useState<HeldPlacement | null>(
    null,
  );
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [layerResize, setLayerResize] = useState<LayerResizeState | null>(null);
  const pendingPointer = useRef<PendingPointer | null>(null);
  const cameraViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cameraInitialized = useRef(false);
  const zoomStatusTimer = useRef<number | null>(null);
  const [camera, setCamera] = useState<StudioCamera>({ x: 0, y: 0, zoom: 1 });
  const [cameraPan, setCameraPan] = useState<StudioPan | null>(null);
  const [zoomStatusVisible, setZoomStatusVisible] = useState(false);
  const [viewportPixels, setViewportPixels] = useState({ width: 0, height: 0 });
  const viewportGrid = useMemo(() => projectElementViewportGrid(viewportPixels.width, viewportPixels.height), [viewportPixels.height, viewportPixels.width]);
  const contextMenuRef = useRef<HTMLElement>(null);
  const contextTriggerRef = useRef<HTMLElement | null>(null);
  const permissionContext: ScreenStudioPermissionContext = {
    authorization,
    expectedAuthorizationRevision,
    parentAuthorized,
  };
  const pageAccess = evaluateScreenStudioPermissionGate(
    editorPage.gate,
    permissionContext,
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const bounds = canvas.getBoundingClientRect();
      setViewportPixels({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const viewport = cameraViewportRef.current;
    if (!viewport) return;
    const centerStage = () => {
      if (cameraInitialized.current) return;
      const bounds = viewport.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      cameraInitialized.current = true;
      setCamera({
        x: Math.round((bounds.width - SCREEN_STUDIO_STAGE_WIDTH) / 2),
        y: Math.round((bounds.height - SCREEN_STUDIO_STAGE_HEIGHT) / 2),
        zoom: 1,
      });
    };
    centerStage();
    const observer = new ResizeObserver(centerStage);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => {
    if (zoomStatusTimer.current !== null) window.clearTimeout(zoomStatusTimer.current);
  }, []);
  const authoringCapabilities = authorization?.revision === expectedAuthorizationRevision ? authorization.capabilities : [];
  useEffect(() => {
    if (!requestedScreenId || editorSession.document || !authoringCapabilities.includes("world.designer.read")) return;
    const screen = screenStudioScreenRecords.find((candidate) => candidate.id === requestedScreenId);
    if (!screen) return;
    const page = screenRecordToPageRecord(screen);
    setEditorSession({
      persistence: "session-only",
      loadedTarget: { kind: "screen", stableId: screen.id },
      selectedTarget: { kind: "screen", stableId: screen.id },
      root: { kind: "screen", stableId: screen.id, label: screen.displayName },
      document: createScreenStudioDocument(page),
      selectedNodeIds: Object.freeze([]),
    });
    setCanonicalScreen(screen);
    setContainerDraftUnsaved(false);
    setContainerSettings({ name: screen.displayName, slug: screen.id.replace(/^screen-/, ""), type: screen.type === "hud" ? "hud" : "workspace" });
    setContainerEditorTab("Position");
    setContainerEditorOpen(true);
    setLogicNodes([]);
    setLayers(reconcileLayersWithDocument([], page.nodes, page.grid.unit));
    setEditorFeedback({ tone: "status", message: `${screen.displayName} loaded from the Screens manager.` });
  }, [authoringCapabilities, editorSession.document, requestedScreenId]);
  const contextActionGroups = screenStudioContextMenuGroups(editorSession, authoringCapabilities);
  const loadActions = contextActionGroups.find((group) => group.id === "load-actions")?.actions ?? [];
  const canvasContainerState = editorSession.document === null
    ? "empty"
    : containerDraftUnsaved
      ? "draft-screen"
      : canonicalScreen
        ? "loaded-screen"
        : "loaded-content";
  const canvasHasContainer = canvasContainerState !== "empty";
  const contextLoadKinds = loadKindsForContainer(containerSettings.type);
  const contextAction = (id: string) => contextActionGroups.flatMap((group) => group.actions).find((action) => action.id === id);
  const visibleScreenLoadRecords = useMemo(() => {
    const query = screenLoadQuery.trim().toLowerCase();
    if (!query) return screenStudioScreenRecords;
    return screenStudioScreenRecords.filter((record) => `${record.displayName} ${record.id} ${record.type} ${record.roles.join(" ")} ${record.tags.join(" ")}`.toLowerCase().includes(query));
  }, [screenLoadQuery]);
  const visibleScreenLoadGroups = useMemo(() => {
    const recordGroups = new Set(visibleScreenLoadRecords.map((record) => record.groupId));
    const hasVisibleDescendant = (groupId: ScreenGroupId): boolean => recordGroups.has(groupId) || SCREEN_STUDIO_SCREEN_GROUPS.some((candidate) => candidate.parentId === groupId && hasVisibleDescendant(candidate.id));
    return SCREEN_STUDIO_SCREEN_GROUPS.filter((group) => hasVisibleDescendant(group.id));
  }, [visibleScreenLoadRecords]);
  const visibleNodes = editorSession.document ? document.page.nodes.filter(
    (node) =>
      evaluateScreenStudioPermissionGate(node.gate, permissionContext).allowed,
  ) : [];
  const viewportStride = viewportGrid ? viewportGrid.cellPixels + viewportGrid.gapPixels : 0;
  const storedPixelsToViewport = (value: number) => viewportStride > 0 ? value / editorPage.grid.unit * viewportStride : 0;
  const viewportPixelsToStored = (value: number) => viewportStride > 0 ? snapToGrid(value / viewportStride * editorPage.grid.unit) : 0;
  const showZoomStatus = () => {
    setZoomStatusVisible(true);
    if (zoomStatusTimer.current !== null) window.clearTimeout(zoomStatusTimer.current);
    zoomStatusTimer.current = window.setTimeout(() => setZoomStatusVisible(false), 900);
  };
  const setCameraZoomAt = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewportBounds = cameraViewportRef.current?.getBoundingClientRect();
    const zoom = Math.max(SCREEN_STUDIO_ZOOM_MIN, Math.min(SCREEN_STUDIO_ZOOM_MAX, nextZoom));
    setCamera((current) => {
      const anchorX = clientX !== undefined && viewportBounds ? clientX - viewportBounds.left : (viewportBounds?.width ?? 0) / 2;
      const anchorY = clientY !== undefined && viewportBounds ? clientY - viewportBounds.top : (viewportBounds?.height ?? 0) / 2;
      const worldX = (anchorX - current.x) / current.zoom;
      const worldY = (anchorY - current.y) / current.zoom;
      return { x: anchorX - worldX * zoom, y: anchorY - worldY * zoom, zoom };
    });
    showZoomStatus();
  };
  const beginCameraPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCameraPan({ pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: camera.x, startY: camera.y });
  };
  const updateCameraPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!cameraPan || cameraPan.pointerId !== event.pointerId) return;
    event.preventDefault();
    setCamera((current) => ({ ...current, x: cameraPan.startX + event.clientX - cameraPan.startClientX, y: cameraPan.startY + event.clientY - cameraPan.startClientY }));
  };
  const endCameraPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!cameraPan || cameraPan.pointerId !== event.pointerId) return;
    setCameraPan(null);
  };
  const handleCameraWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    setCameraZoomAt(camera.zoom * factor, event.clientX, event.clientY);
  };
  const storedCandidateValid = (candidate: Candidate) => candidate.x >= 0
    && candidate.y >= 0
    && candidate.x / editorPage.grid.unit + candidate.width / editorPage.grid.unit <= DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.columns
    && candidate.y / editorPage.grid.unit + candidate.height / editorPage.grid.unit <= DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.rows;
  const storedCandidateStyle = (candidate: Candidate): CSSProperties => ({
    left: storedPixelsToViewport(candidate.x),
    top: storedPixelsToViewport(candidate.y),
    width: storedPixelsToViewport(candidate.width),
    height: storedPixelsToViewport(candidate.height),
  });
  const selectedLayer = selectedId ? findElementLayerById(layers, selectedId) : null;
  const compositionProjection = useMemo(() => projectElementLayersComposition(layers), [layers]);
  const resolvedSelectedLayer = compositionProjection.ok && selectedId
    ? findResolvedCompositionElement(compositionProjection.resolved, selectedId)
    : null;
  const contextLayer = contextMenu?.nodeId ? findElementLayerById(layers, contextMenu.nodeId) : null;
  const contextDocumentNode = contextMenu?.nodeId ? visibleNodes.find((node) => node.id === contextMenu.nodeId) ?? null : null;
  const rootAddTarget = useMemo<ScreenStudioElementLayerContainerTarget>(() => Object.freeze({ id: null, elementType: "container", family: "element" }), []);
  const addMenuGroups = useMemo(() => addMenuTarget ? buildElementAddMenuGroupsForParent(addMenuTarget) : [], [addMenuTarget]);
  const update = (next: ScreenStudioDocument, selection = selectedId) => {
    if (!editorSession.document) return;
    const nextLayers = reconcileLayersWithDocument(layers, next.page.nodes, editorPage.grid.unit);
    const composition = projectElementLayersComposition(nextLayers);
    if (!composition.ok) {
      setEditorFeedback({ tone: "alert", message: `ScreenStudioCompositionV1 rejected this change: ${composition.errors[0] ?? "invalid composition"}.` });
      return;
    }
    setEditorSession((current) => ({ ...current, document: next, selectedNodeIds: selection ? Object.freeze([selection]) : Object.freeze([]) }));
    setLayers(nextLayers);
    setSelectedId(selection);
  };
  const closeContextMenu = (restoreFocus = true) => {
    setContextMenu(null);
    setLoadMenuKind(null);
    setScreenLoadQuery("");
    setAddMenuState(null);
    setAddMenuTarget(null);
    setLogicMenuCategory(null);
    if (restoreFocus) requestAnimationFrame(() => contextTriggerRef.current?.focus());
  };
  const toggleScreenLoadGroup = (groupId: ScreenGroupId) => setCollapsedScreenLoadGroups((current) => {
    const next = new Set(current);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    return next;
  });
  const openContainerEditor = () => {
    closeContextMenu(false);
    setContainerEditorTab("Position");
    if (!editorSession.document) {
      const draftPage = { ...editorPage, id: LOCAL_SCREEN_DRAFT_ID, displayName: DEFAULT_CONTAINER_SETTINGS.name, description: "Unsaved local Screen Studio page draft.", nodes: Object.freeze([]) };
      setEditorSession({
        persistence: "session-only",
        loadedTarget: null,
        selectedTarget: null,
        root: { kind: "screen", stableId: LOCAL_SCREEN_DRAFT_ID, label: DEFAULT_CONTAINER_SETTINGS.name },
        document: createScreenStudioDocument(draftPage),
        selectedNodeIds: Object.freeze([]),
      });
      setCanonicalScreen(null);
      setContainerSettings(DEFAULT_CONTAINER_SETTINGS);
      setContainerDraftUnsaved(true);
      setSelectedId(null);
      setLogicNodes([]);
      setLayers([]);
    }
    setContainerEditorOpen(true);
  };
  const loadCatalogTarget = (kind: LoadMenuKind, stableId: string) => {
    const canonicalScreenRecord = kind === "screen" ? screenStudioScreenRecords.find((candidate) => candidate.id === stableId) : undefined;
    const canonicalScreenPage = canonicalScreenRecord ? screenRecordToPageRecord(canonicalScreenRecord) : undefined;
    const result = canonicalScreenRecord && canonicalScreenPage
      ? {
          ok: true as const,
          session: {
            persistence: "session-only" as const,
            loadedTarget: { kind: "screen" as const, stableId },
            selectedTarget: { kind: "screen" as const, stableId },
            root: { kind: "screen" as const, stableId, label: canonicalScreenRecord.displayName },
            document: createScreenStudioDocument(canonicalScreenPage),
            selectedNodeIds: Object.freeze([]),
          },
        }
      : loadScreenStudioTarget(editorSession, { kind, stableId }, authoringCapabilities);
    if (!result.ok) {
      setEditorFeedback({ tone: "alert", message: "That catalog item could not be loaded into Screen Studio." });
      return;
    }
    setEditorSession(result.session);
    setCanonicalScreen(canonicalScreenRecord ?? null);
    setContainerDraftUnsaved(false);
    setLogicNodes([]);
    if (kind === "screen") {
      const screen = screenStudioScreenRecords.find((candidate) => candidate.id === stableId);
      const page = screenStudioPageRecords.find((candidate) => candidate.id === stableId);
      if (screen) setContainerSettings({ name: screen.displayName, slug: screen.id.replace(/^screen-/, ""), type: screen.type === "hud" ? "hud" : "workspace" });
      else if (page) setContainerSettings({ name: page.displayName, slug: page.id.replace(/^page-/, ""), type: "workspace" });
      setContainerEditorTab("Position");
      setContainerEditorOpen(true);
    } else {
      const element = screenStudioElementCatalog.find((candidate) => candidate.id === stableId);
      setContainerSettings({ name: element?.name ?? stableId, slug: `elements/${stableId}`, type: "element" });
      setContainerEditorOpen(false);
    }
    setSelectedId(null);
    setLayers(reconcileLayersWithDocument([], result.session.document?.page.nodes ?? [], editorPage.grid.unit));
    setEditorFeedback({ tone: "status", message: `${result.session.root?.label ?? "Catalog item"} loaded into the session-only editor.` });
    closeContextMenu(false);
    requestAnimationFrame(() => canvasRef.current?.focus());
  };
  const deleteLoadedTarget = () => {
    const next = deleteSelectedScreenStudioTarget(editorSession, authoringCapabilities);
    if (next === editorSession) return;
    setEditorSession(next);
    setCanonicalScreen(null);
    setContainerEditorOpen(false);
    setContainerDraftUnsaved(false);
    setContainerSettings(DEFAULT_CONTAINER_SETTINGS);
    setSelectedId(null);
    setLogicNodes([]);
    setLayers([]);
    setEditorFeedback({ tone: "status", message: "Loaded catalog item removed from the session-only editor." });
    closeContextMenu(false);
    requestAnimationFrame(() => canvasRef.current?.focus());
  };
  const addLogicNode = (recordId: string) => {
    if (!contextMenu || !SCREEN_STUDIO_BEHAVIOR_CATALOG.some((entry) => entry.id === recordId)) return;
    setLogicNodes((current) => Object.freeze([...current, Object.freeze({ id: `logic-node-${current.length + 1}`, recordId, x: contextMenu.canvasX, y: contextMenu.canvasY })]));
    setEditorFeedback({ tone: "status", message: `${recordId} added as a local visual logic block.` });
    closeContextMenu(false);
  };
  const cancelInteraction = () => {
    pendingPointer.current = null;
    setDrag(null);
    setLayerDrag(null);
    setHeldPlacement(null);
    setResizeState(null);
    setLayerResize(null);
  };
  const canvasCandidate = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const snapped = { x: viewportPixelsToStored(x), y: viewportPixelsToStored(y), width, height };
    return {
      candidate: snapped,
      valid: Boolean(viewportGrid && storedCandidateValid(snapped)),
    };
  };
  const openContextMenu = (
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>,
    nodeId: string | null = null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const bounds = target.getBoundingClientRect();
    const canvasBounds = canvasRef.current?.getBoundingClientRect() ?? bounds;
    const clientX = "clientX" in event ? event.clientX : bounds.left + 160;
    const clientY = "clientY" in event ? event.clientY : bounds.top + 120;
    const positioningBounds = canvasRef.current?.closest<HTMLElement>(".designer-workspace__content")?.getBoundingClientRect();
    const positioningLeft = positioningBounds?.left ?? 0;
    const positioningTop = positioningBounds?.top ?? 0;
    const positioningWidth = positioningBounds?.width ?? window.innerWidth;
    const positioningHeight = positioningBounds?.height ?? window.innerHeight;
    const menuX = clientX - positioningLeft + 8;
    const menuY = clientY - positioningTop + 8;
    if (nodeId) {
      setSelectedId(nodeId);
      setEditorSession((current) => selectScreenStudioLoadedTarget(current, current.loadedTarget));
    }
    contextTriggerRef.current = target;
    setAddMenuState(null);
    setAddMenuTarget(null);
    setLoadMenuKind(null);
    setEditorFeedback(null);
    setContextMenu({
      x: Math.max(8, Math.min(menuX, positioningWidth - 280)),
      y: Math.max(8, Math.min(menuY, positioningHeight - 360)),
      canvasX: viewportPixelsToStored((clientX - canvasBounds.left) / camera.zoom),
      canvasY: viewportPixelsToStored((clientY - canvasBounds.top) / camera.zoom),
      nodeId,
    });
  };
  const startHeldNodePlacement = (node: ScreenNode, clientX: number, clientY: number) => {
    if (!isElementEditorActionAllowed(nodeInteractionPolicy(node), "move")) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const result = canvasCandidate((clientX - bounds.left) / camera.zoom - storedPixelsToViewport(node.placement.width) / 2, (clientY - bounds.top) / camera.zoom - storedPixelsToViewport(node.placement.height) / 2, node.placement.width, node.placement.height);
    setHeldPlacement({ node, candidate: result.candidate, valid: result.valid });
    setSelectedId(node.id);
  };
  const beginNodePointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: ScreenNode,
  ) => {
    if (event.button === 1) {
      beginCameraPan(event);
      return;
    }
    setSelectedId(node.id);
    if (!isElementEditorActionAllowed(nodeInteractionPolicy(node), "move")) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(node.id);
    pendingPointer.current = { nodeId: node.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const beginThresholdDrag = (event: ReactPointerEvent<HTMLButtonElement>, node: ScreenNode) => {
    const pending = pendingPointer.current;
    if (!pending || pending.pointerId !== event.pointerId || pending.nodeId !== node.id) return;
    const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
    if (distance < 6) return;
    pendingPointer.current = null;
    const result = { candidate: { x: node.placement.x, y: node.placement.y, width: node.placement.width, height: node.placement.height }, valid: storedCandidateValid({ x: node.placement.x, y: node.placement.y, width: node.placement.width, height: node.placement.height }) };
    setDrag({ nodeId: node.id, pointerId: event.pointerId, candidate: result.candidate, valid: result.valid });
  };
  const updateNodeDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const node = visibleNodes.find((entry) => entry.id === drag.nodeId);
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!node || !bounds) return;
    const result = canvasCandidate(
      (event.clientX - bounds.left) / camera.zoom - storedPixelsToViewport(node.placement.width) / 2,
      (event.clientY - bounds.top) / camera.zoom - storedPixelsToViewport(node.placement.height) / 2,
      node.placement.width,
      node.placement.height,
    );
    setDrag({ ...drag, candidate: result.candidate, valid: result.valid });
  };
  const commitNodeDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (pendingPointer.current?.pointerId === event.pointerId) pendingPointer.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const node = visibleNodes.find((entry) => entry.id === drag.nodeId);
    if (node && drag.valid)
      update(
        applyScreenStudioCommand(document, {
          type: "move",
          nodeIds: [node.id],
          delta: {
            x: drag.candidate.x - node.placement.x,
            y: drag.candidate.y - node.placement.y,
          },
        }),
        node.id,
      );
    setDrag(null);
  };
  const updateHeldPlacement = (event: ReactPointerEvent<HTMLElement>) => {
    if (!heldPlacement) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const result = canvasCandidate(
      (event.clientX - bounds.left) / camera.zoom - storedPixelsToViewport(heldPlacement.node.placement.width) / 2,
      (event.clientY - bounds.top) / camera.zoom - storedPixelsToViewport(heldPlacement.node.placement.height) / 2,
      heldPlacement.node.placement.width,
      heldPlacement.node.placement.height,
    );
    setHeldPlacement({
      ...heldPlacement,
      candidate: result.candidate,
      valid: result.valid,
    });
  };
  const commitHeldPlacement = () => {
    if (heldPlacement?.valid)
      update(
        applyScreenStudioCommand(document, {
          type: "add",
          node: {
            ...heldPlacement.node,
            placement: {
              ...heldPlacement.node.placement,
              ...heldPlacement.candidate,
            },
          },
        }),
        heldPlacement.node.id,
      );
    setHeldPlacement(null);
  };
  const beginResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: ScreenNode,
    corner: ResizeCorner,
  ) => {
    if (!isElementEditorActionAllowed(nodeInteractionPolicy(node), "resize")) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = {
      x: node.placement.x,
      y: node.placement.y,
      width: node.placement.width,
      height: node.placement.height,
    };
    setResizeState({
      nodeId: node.id,
      pointerId: event.pointerId,
      corner,
      startClientX: event.clientX,
      startClientY: event.clientY,
      start,
      candidate: start,
      valid: true,
    });
  };
  const updateResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    if (!canvasRef.current) return;
    const dx = viewportPixelsToStored((event.clientX - resizeState.startClientX) / camera.zoom);
    const dy = viewportPixelsToStored((event.clientY - resizeState.startClientY) / camera.zoom);
    const start = resizeState.start;
    const resizingNode = visibleNodes.find((node) => node.id === resizeState.nodeId);
    if (!resizingNode) return;
    const raw =
      resizeState.corner === "nw"
        ? {
            x: start.x + dx,
            y: start.y + dy,
            width: start.width - dx,
            height: start.height - dy,
          }
        : resizeState.corner === "ne"
          ? {
              x: start.x,
              y: start.y + dy,
              width: start.width + dx,
              height: start.height - dy,
            }
          : resizeState.corner === "sw"
            ? {
                x: start.x + dx,
                y: start.y,
                width: start.width - dx,
                height: start.height + dy,
              }
            : {
                x: start.x,
                y: start.y,
                width: start.width + dx,
                height: start.height + dy,
              };
    const candidate = constrainPlacement(
      { ...resizingNode.placement, ...raw },
      editorPage.grid,
    );
    setResizeState({
      ...resizeState,
      candidate: {
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      },
      valid: storedCandidateValid({ x: candidate.x, y: candidate.y, width: candidate.width, height: candidate.height }),
    });
  };
  const commitResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    if (resizeState.valid)
      update(
        applyScreenStudioCommand(document, {
          type: "resize",
          nodeId: resizeState.nodeId,
          ...resizeState.candidate,
        }),
        resizeState.nodeId,
      );
    setResizeState(null);
  };
  const openElementAddMenu = (target: ScreenStudioElementLayerContainerTarget) => {
    if (!editorSession.document || !contextAction("add-element")?.enabled) {
      setEditorFeedback({ tone: "alert", message: "Load an Element or Screen before adding objects." });
      return;
    }
    const groups = buildElementAddMenuGroupsForParent(target);
    if (!groups.length) {
      setEditorFeedback({ tone: "alert", message: "This object cannot accept child elements." });
      return;
    }
    setAddMenuTarget(target);
    setAddMenuState(SCREEN_STUDIO_ADD_MENU_STATE_INITIAL);
    requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLElement>("[data-add-menu-entry]")?.focus());
  };
  const chooseElementType = (type: string) => {
    if (!addMenuState || !addMenuTarget || !contextMenu) return;
    const selectedType = selectAddMenuType(addMenuState, addMenuGroups, type);
    if (!selectedType) {
      setEditorFeedback({ tone: "alert", message: "That element type is unavailable for this container." });
      return;
    }
    const before = layers;
    const siblingCount = addMenuTarget.id === null ? layers.length : findElementLayerById(layers, addMenuTarget.id)?.children.length ?? 0;
    const geometry = addMenuTarget.id === null
      ? { x: boundedSiteUnit(contextMenu.canvasX / editorPage.grid.unit), y: boundedSiteUnit(contextMenu.canvasY / editorPage.grid.unit) }
      : { x: boundedSiteUnit(1 + siblingCount * SITE_UNIT_STEP), y: boundedSiteUnit(1 + siblingCount * SITE_UNIT_STEP) };
    const result = addElementLayerUnderContainer({
      layers,
      parent: addMenuTarget,
      childType: selectedType,
      geometry,
      idPrefix: "screen-designer",
    });
    if (!result.ok) {
      setEditorFeedback({ tone: "alert", message: `Element was not added: ${result.error}.` });
      return;
    }
    const composition = projectElementLayersComposition(result.layers);
    if (!composition.ok) {
      setEditorFeedback({ tone: "alert", message: `Element was not added: ${composition.errors[0] ?? "invalid composition"}.` });
      return;
    }
    const nextSelectedId = addedLayerId(before, result.layers);
    setLayers(result.layers);
    setSelectedId(nextSelectedId);
    setEditorFeedback({ tone: "status", message: `${selectedType} added to the local Screen Designer composition.` });
    closeContextMenu(false);
    requestAnimationFrame(() => {
      if (nextSelectedId) canvasRef.current?.querySelector<HTMLElement>(`[data-layer-id="${nextSelectedId}"]`)?.focus();
    });
  };
  const beginLayerPointer = (event: ReactPointerEvent<HTMLButtonElement>, layer: ElementLayerV1) => {
    setSelectedId(layer.id);
    if (!isMovableElementLayer(layer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setLayerDrag({
      layerId: layer.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startGeometry: layer.geometry,
      candidate: layer.geometry,
      projectedParentId: parentLayerId(layers, layer.id),
      projectionValid: true,
    });
  };
  const updateLayerPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!layerDrag || layerDrag.pointerId !== event.pointerId) return;
    if (!viewportStride) return;
    const dx = snappedSiteDelta((event.clientX - layerDrag.startClientX) / camera.zoom / viewportStride);
    const dy = snappedSiteDelta((event.clientY - layerDrag.startClientY) / camera.zoom / viewportStride);
    const draggedLayer = findElementLayerById(layers, layerDrag.layerId);
    if (!draggedLayer) return;
    const reparentable = isReparentableElementLayer(draggedLayer);
    const hitLayers = reparentable ? window.document.elementsFromPoint(event.clientX, event.clientY)
      .map((element) => element.closest<HTMLElement>("[data-layer-id]"))
      .filter((element, index, entries): element is HTMLElement => Boolean(element) && entries.indexOf(element) === index) : [];
    const targetElement = hitLayers.find((element) => {
      const candidateId = element.dataset.layerId;
      return Boolean(candidateId && candidateId !== draggedLayer.id && !layerContainsId(draggedLayer, candidateId));
    });
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    const insideCanvas = Boolean(canvasBounds && event.clientX >= canvasBounds.left && event.clientX <= canvasBounds.right && event.clientY >= canvasBounds.top && event.clientY <= canvasBounds.bottom);
    const existingParentId = parentLayerId(layers, draggedLayer.id);
    const projectedParentId = reparentable ? targetElement?.dataset.layerId ?? (insideCanvas ? null : undefined) : existingParentId;
    const projectedParent = projectedParentId ? findElementLayerById(layers, projectedParentId) : null;
    const projection = !reparentable ? { ok: true as const } : projectedParentId === undefined
      ? null
      : projectScreenStudioParentDrop(
          projectedParent ? { kind: projectedParent.family, definitionId: projectedParent.elementType } : { kind: "screen" },
          draggedLayer.family,
          draggedLayer.elementType,
        );
    const projectionValid = Boolean(projection?.ok);
    const parent = projectionValid ? projectedParent : null;
    const parentWidth = parent?.geometry.width ?? SITE_UNIT_MAX;
    const parentHeight = parent?.geometry.height ?? SITE_UNIT_MAX;
    const maxX = Math.max(0, parentWidth - layerDrag.startGeometry.width);
    const maxY = Math.max(0, parentHeight - layerDrag.startGeometry.height);
    setLayerDrag({
      ...layerDrag,
      candidate: Object.freeze({
        ...layerDrag.startGeometry,
        x: Math.min(maxX, boundedSiteUnit(layerDrag.startGeometry.x + dx)),
        y: Math.min(maxY, boundedSiteUnit(layerDrag.startGeometry.y + dy)),
      }),
      projectedParentId,
      projectionValid,
    });
  };
  const commitLayerPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!layerDrag || layerDrag.pointerId !== event.pointerId) return;
    const projectedParentId = layerDrag.projectedParentId;
    const draggedLayer = findElementLayerById(layers, layerDrag.layerId);
    const nextLayers = layerDrag.projectionValid && projectedParentId !== undefined && draggedLayer
      ? isReparentableElementLayer(draggedLayer)
        ? reparentElementLayer(layers, layerDrag.layerId, projectedParentId, layerDrag.candidate)
        : (() => { const result = updateElementLayerById(layers, layerDrag.layerId, (layer) => Object.freeze({ ...layer, geometry: layerDrag.candidate })); return result.ok ? result.layers : null; })()
      : null;
    if (nextLayers) {
      const composition = projectElementLayersComposition(nextLayers);
      if (!composition.ok) {
        setEditorFeedback({ tone: "alert", message: `Container placement was rejected: ${composition.errors[0] ?? "invalid composition"}.` });
        setLayerDrag(null);
        return;
      }
      setLayers(nextLayers);
      if (canonicalScreen && projectedParentId !== undefined && draggedLayer && isReparentableElementLayer(draggedLayer)) {
        const canonicalResult = reparentScreenStudioHierarchy(canonicalScreen, layerDrag.layerId, projectedParentId);
        if (canonicalResult.ok) {
          setCanonicalScreen(canonicalResult.screen);
          const page = screenRecordToPageRecord(canonicalResult.screen);
          setEditorSession((current) => ({ ...current, document: createScreenStudioDocument(page), selectedNodeIds: Object.freeze([layerDrag.layerId]) }));
        }
      }
      setEditorFeedback({ tone: "status", message: draggedLayer && isReparentableElementLayer(draggedLayer) ? "Container placement and parent updated in local Screen Studio state." : "Element position updated within its existing parent." });
    } else {
      setEditorFeedback({ tone: "alert", message: "Container placement was rejected; the existing parent and position were preserved." });
    }
    setLayerDrag(null);
  };
  const layerParentBounds = (layerId: string): Readonly<{ width: number; height: number }> => {
    const parentId = parentLayerId(layers, layerId);
    const parent = parentId ? findElementLayerById(layers, parentId) : null;
    return { width: parent?.geometry.width ?? SITE_UNIT_MAX, height: parent?.geometry.height ?? SITE_UNIT_MAX };
  };
  const resizeLayerGeometry = (start: ElementLayerV1["geometry"], corner: ResizeCorner, dx: number, dy: number, bounds: Readonly<{ width: number; height: number }>): ElementLayerV1["geometry"] | null => {
    const west = corner.includes("w");
    const north = corner.includes("n");
    const candidate = Object.freeze({
      ...start,
      x: boundedSiteUnit(west ? start.x + dx : start.x),
      y: boundedSiteUnit(north ? start.y + dy : start.y),
      width: Math.max(SITE_UNIT_STEP, boundedSiteUnit(west ? start.width - dx : start.width + dx)),
      height: Math.max(SITE_UNIT_STEP, boundedSiteUnit(north ? start.height - dy : start.height + dy)),
    });
    return candidate.x + candidate.width <= bounds.width && candidate.y + candidate.height <= bounds.height ? candidate : null;
  };
  const beginLayerResize = (event: ReactPointerEvent<HTMLButtonElement>, layer: ElementLayerV1, corner: ResizeCorner) => {
    if (!isElementEditorActionAllowed(layer, "resize") || !viewportStride) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setLayerResize({ layerId: layer.id, pointerId: event.pointerId, corner, startClientX: event.clientX, startClientY: event.clientY, startGeometry: layer.geometry, candidate: layer.geometry, valid: true });
  };
  const updateLayerResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!layerResize || layerResize.pointerId !== event.pointerId || !viewportStride) return;
    const candidate = resizeLayerGeometry(
      layerResize.startGeometry,
      layerResize.corner,
      snappedSiteDelta((event.clientX - layerResize.startClientX) / camera.zoom / viewportStride),
      snappedSiteDelta((event.clientY - layerResize.startClientY) / camera.zoom / viewportStride),
      layerParentBounds(layerResize.layerId),
    );
    setLayerResize({ ...layerResize, candidate: candidate ?? layerResize.candidate, valid: Boolean(candidate) });
  };
  const commitLayerResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!layerResize || layerResize.pointerId !== event.pointerId) return;
    if (layerResize.valid) {
      const result = updateElementLayerById(layers, layerResize.layerId, (layer) => Object.freeze({ ...layer, geometry: layerResize.candidate }));
      if (result.ok) { setLayers(result.layers); setEditorFeedback({ tone: "status", message: "Element size updated in bounded site units." }); }
    }
    setLayerResize(null);
  };
  const keyboardLayerResize = (event: ReactKeyboardEvent<HTMLButtonElement>, layer: ElementLayerV1, corner: ResizeCorner) => {
    const dx = event.key === "ArrowLeft" ? -SITE_UNIT_STEP : event.key === "ArrowRight" ? SITE_UNIT_STEP : 0;
    const dy = event.key === "ArrowUp" ? -SITE_UNIT_STEP : event.key === "ArrowDown" ? SITE_UNIT_STEP : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    const candidate = resizeLayerGeometry(layer.geometry, corner, dx, dy, layerParentBounds(layer.id));
    if (!candidate) return;
    const result = updateElementLayerById(layers, layer.id, (current) => Object.freeze({ ...current, geometry: candidate }));
    if (result.ok) setLayers(result.layers);
  };
  const closeLayer = (layer: ElementLayerV1) => {
    if (!isClosableElementLayer(layer)) return;
    const documentNode = document.page.nodes.find((node) => node.id === layer.id);
    if (documentNode) {
      update(applyScreenStudioCommand(document, { type: "remove", nodeIds: [layer.id] }), null);
    } else {
      const nextLayers = removeLayerById(layers, layer.id);
      const composition = projectElementLayersComposition(nextLayers);
      if (!composition.ok) {
        setEditorFeedback({ tone: "alert", message: `Removal was rejected: ${composition.errors[0] ?? "invalid composition"}.` });
        return;
      }
      setLayers(nextLayers);
      setSelectedId(null);
    }
    setEditorFeedback({ tone: "status", message: `${layer.elementType} removed from local Screen Designer state.` });
  };
  const applyViewportAlignment = (horizontal: ScreenStudioElementHorizontalAnchor, vertical: ScreenStudioElementVerticalAnchor) => {
    setViewportHorizontalPreset(horizontal);
    setViewportVerticalPreset(vertical);
    if (!selectedId) return;
    const layer = findElementLayerById(layers, selectedId);
    const node = visibleNodes.find((entry) => entry.id === selectedId);
    const geometry = layer?.geometry ?? (node ? { x: boundedSiteUnit(node.placement.x / editorPage.grid.unit), y: boundedSiteUnit(node.placement.y / editorPage.grid.unit), width: boundedSiteUnit(node.placement.width / editorPage.grid.unit), height: boundedSiteUnit(node.placement.height / editorPage.grid.unit), padding: 0, margin: 0, borderWidth: 0, borderRadius: 0 } : null);
    if (!geometry) return;
    const bounds = layer ? layerParentBounds(layer.id) : { width: SITE_UNIT_MAX, height: SITE_UNIT_MAX };
    const projected = projectAlignedSiteUnitGeometry(geometry, bounds.width, bounds.height, { horizontal, vertical });
    if (!projected) { setEditorFeedback({ tone: "alert", message: "Alignment was rejected because the selected object exceeds its parent bounds." }); return; }
    if (node) { update(applyScreenStudioCommand(document, { type: "move", nodeIds: [node.id], delta: { x: projected.x * editorPage.grid.unit - node.placement.x, y: projected.y * editorPage.grid.unit - node.placement.y } }), node.id); return; }
    if (layer) {
      const result = updateElementLayerById(layers, layer.id, (current) => Object.freeze({ ...current, geometry: projected }));
      if (result.ok) { setLayers(result.layers); setEditorFeedback({ tone: "status", message: `${horizontal} / ${vertical} alignment applied in bounded site units.` }); }
    }
  };
  const handleContextMenuKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const buttons = [...(contextMenuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)") ?? [])];
    const activeIndex = buttons.indexOf(window.document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (activeIndex + 1 + buttons.length) % buttons.length : (activeIndex - 1 + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && addMenuState?.kind === "groups") {
      const group = (window.document.activeElement as HTMLElement | null)?.dataset.addMenuGroup;
      if (group) {
        event.preventDefault();
        setAddMenuState(openAddMenuGroup(addMenuState, addMenuGroups, group));
      }
      return;
    }
    if ((event.key === "ArrowLeft" || event.key === "Escape") && addMenuState?.kind === "group-items") {
      event.preventDefault();
      event.stopPropagation();
      setAddMenuState(resetAddMenuState());
      return;
    }
    if (event.key === "Escape" && addMenuState) {
      event.preventDefault();
      event.stopPropagation();
      setAddMenuState(null);
      setAddMenuTarget(null);
      return;
    }
    if (event.key === "Escape" && loadMenuKind) {
      event.preventDefault();
      event.stopPropagation();
      const closingKind = loadMenuKind;
      setLoadMenuKind(null);
      requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLElement>(`[data-load-action="${closingKind}"]`)?.focus());
      return;
    }
    if (event.key === "Escape" && contextMenu) {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
    }
  };
  useEffect(() => {
    if (!addMenuState) return;
    requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLElement>("[data-add-menu-entry]")?.focus());
  }, [addMenuState]);
  useEffect(() => {
    if (!loadMenuKind) return;
    requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLElement>("[data-load-menu-entry]")?.focus());
  }, [loadMenuKind]);
  useEffect(() => {
    if (!contextMenu || addMenuState || loadMenuKind) return;
    requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLElement>("[role='menuitem']:not(:disabled)")?.focus());
  }, [contextMenu, addMenuState, loadMenuKind]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-screen-studio-context-menu]")) {
        closeContextMenu(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelInteraction();
        closeContextMenu();
      }
    };
    const resize = () => cancelInteraction();
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, []);
  const renderLayer = (layer: ElementLayerV1, parentId: string | null, depth: number): ReactNode => {
    const documentNode = parentId === null ? document.page.nodes.find((node) => node.id === layer.id) : null;
    const isDocumentRoot = Boolean(documentNode);
    const geometry = layerResize?.layerId === layer.id ? layerResize.candidate : layerDrag?.layerId === layer.id ? layerDrag.candidate : layer.geometry;
    const position = documentNode ? {
      ...storedCandidateStyle(documentNode.placement),
      zIndex: documentNode.placement.zIndex + 20,
    } : {
      left: geometry.x * viewportStride,
      top: geometry.y * viewportStride,
      width: Math.max(viewportGrid?.cellPixels ?? 0, geometry.width * viewportStride - (viewportGrid?.gapPixels ?? 0)),
      height: Math.max(viewportGrid?.cellPixels ?? 0, geometry.height * viewportStride - (viewportGrid?.gapPixels ?? 0)),
      zIndex: layer.order + depth + 30,
    };
    return <div
      key={layer.id}
      className={`screen-studio-layer${isDocumentRoot ? " is-document-root" : ""}${selectedId === layer.id ? " is-selected" : ""}${layerDrag?.projectionValid && layerDrag.projectedParentId === layer.id ? " is-valid-parent-projection" : ""}`}
      data-layer-id={layer.id}
      data-parent-layer-id={parentId ?? "root"}
      data-layer-order={layer.order}
      data-layer-depth={depth}
      data-layer-movable={isMovableElementLayer(layer) ? "true" : "false"}
      data-parent-projection={layerDrag?.projectedParentId === layer.id ? (layerDrag.projectionValid ? "valid" : "invalid") : "none"}
      style={position}
    >
      {!isDocumentRoot ? <button
        type="button"
        className="screen-studio-layer__object"
        aria-label={`${layer.family} ${layer.elementType}. Movable and resizable design object${isReparentableElementLayer(layer) ? ". Container drop enabled" : ". Existing parent retained"}`}
        onPointerDown={(event) => beginLayerPointer(event, layer)}
        onPointerMove={updateLayerPointer}
        onPointerUp={commitLayerPointer}
        onPointerCancel={() => setLayerDrag(null)}
        onLostPointerCapture={() => setLayerDrag(null)}
        onClick={(event) => { event.stopPropagation(); setSelectedId(layer.id); }}
        onContextMenu={(event) => openContextMenu(event, layer.id)}
        onKeyDown={(event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            openContextMenu(event, layer.id);
          }
        }}
      ><b>{layer.family}</b><span>{layer.elementType}</span></button> : null}
      {!isDocumentRoot && selectedId === layer.id && isElementEditorActionAllowed(layer, "resize") ? (["nw", "ne", "sw", "se"] as const).map((corner) => <button type="button" key={`${layer.id}-${corner}`} className={`screen-studio-resize-handle screen-studio-resize-handle--${corner}`} aria-label={`Resize ${layer.elementType} from ${corner} corner`} style={{ left: corner.includes("e") ? `calc(100% - .5rem)` : "-.5rem", top: corner.includes("s") ? `calc(100% - .5rem)` : "-.5rem" }} onPointerDown={(event) => beginLayerResize(event, layer, corner)} onPointerMove={updateLayerResize} onPointerUp={commitLayerResize} onPointerCancel={() => setLayerResize(null)} onLostPointerCapture={() => setLayerResize(null)} onKeyDown={(event) => keyboardLayerResize(event, layer, corner)} />) : null}
      {!isDocumentRoot && isClosableElementLayer(layer) ? <button type="button" className="screen-studio-layer__close" aria-label={`Remove ${layer.elementType}`} onClick={(event) => { event.stopPropagation(); closeLayer(layer); }}>×</button> : null}
      <div className="screen-studio-layer__children" aria-label={`${layer.elementType} child layers`}>
        {[...layer.children].sort((left, right) => left.order - right.order).map((child) => renderLayer(child, layer.id, depth + 1))}
      </div>
    </div>;
  };
  const selectedAlignmentEditor = selectedId ? <fieldset className="screen-studio-editor__selection-alignment"><legend>Alignment anchors</legend><label>Horizontal anchor<select value={viewportHorizontalPreset} onChange={(event) => applyViewportAlignment(event.target.value as ScreenStudioElementHorizontalAnchor, viewportVerticalPreset)}>{SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS.map((anchor) => <option value={anchor} key={anchor}>{SCREEN_STUDIO_VIEWPORT_PRESET_LABELS[anchor]}</option>)}</select></label><label>Vertical anchor<select value={viewportVerticalPreset} onChange={(event) => applyViewportAlignment(viewportHorizontalPreset, event.target.value as ScreenStudioElementVerticalAnchor)}>{SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS.map((anchor) => <option value={anchor} key={anchor}>{SCREEN_STUDIO_VIEWPORT_PRESET_LABELS[anchor]}</option>)}</select></label></fieldset> : null;
  if (!pageAccess.allowed)
    return (
      <section className="screen-studio-editor" aria-label={`Screen Studio ${SCREEN_STUDIO_ELEMENT_EDITOR_LABEL}`}>
        <p className="screen-studio-boundary" role="alert">
          Editor unavailable: {pageAccess.reason}. The authorized Creator parent
          remains required.
        </p>
      </section>
    );
  return (
    <section
      className="screen-studio-editor"
      aria-label={`Screen Studio ${SCREEN_STUDIO_ELEMENT_EDITOR_LABEL}`}
      data-screen-composition-contract="ScreenStudioCompositionV1"
      data-screen-composition-status={compositionProjection.ok ? "resolved" : "invalid"}
      data-screen-composition-root-count={compositionProjection.ok ? compositionProjection.resolved.length : 0}
    >
        <div className="screen-studio-editor__canvas-wrap">
        <div
          ref={cameraViewportRef}
          className="screen-studio-editor__canvas"
          aria-label="Screen Studio infinite camera workspace"
          role="application"
          data-camera-pan={cameraPan ? "active" : "idle"}
          data-camera-zoom={camera.zoom.toFixed(3)}
          onWheel={handleCameraWheel}
          onPointerDownCapture={(event) => {
            if (event.button === 1) beginCameraPan(event);
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && event.button === 0) beginCameraPan(event);
          }}
          onPointerMove={updateCameraPan}
          onPointerUp={endCameraPan}
          onPointerCancel={endCameraPan}
          onAuxClick={(event) => {
            if (event.button === 1) event.preventDefault();
          }}
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              setCameraZoomAt(camera.zoom * 1.15);
            } else if (event.key === "-") {
              event.preventDefault();
              setCameraZoomAt(camera.zoom / 1.15);
            } else if (event.key === "0") {
              event.preventDefault();
              const bounds = cameraViewportRef.current?.getBoundingClientRect();
              setCamera({ x: Math.round(((bounds?.width ?? SCREEN_STUDIO_STAGE_WIDTH) - SCREEN_STUDIO_STAGE_WIDTH) / 2), y: Math.round(((bounds?.height ?? SCREEN_STUDIO_STAGE_HEIGHT) - SCREEN_STUDIO_STAGE_HEIGHT) / 2), zoom: 1 });
              showZoomStatus();
            }
          }}
          tabIndex={0}
        >
          <div className="screen-studio-editor__camera" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}>
            <div
              ref={canvasRef}
              className="screen-studio-editor__viewport"
              style={
                {
                  width: SCREEN_STUDIO_STAGE_WIDTH,
                  height: SCREEN_STUDIO_STAGE_HEIGHT,
                  "--studio-grid-cell": `${viewportGrid?.cellPixels ?? 0}px`,
                  "--studio-grid-gap": `${viewportGrid?.gapPixels ?? 0}px`,
                  "--studio-grid-stride": `${viewportGrid ? viewportGrid.cellPixels + viewportGrid.gapPixels : 0}px`,
                } as CSSProperties
              }
            role="application"
            aria-label="Screen Studio snapped grid canvas"
            data-viewport-grid={viewportGrid ? "measured" : "pending"}
            data-root-parent-projection={layerDrag?.projectedParentId === null ? (layerDrag.projectionValid ? "valid" : "invalid") : "none"}
            onContextMenu={(event) => {
              if (drag || heldPlacement || resizeState) {
                event.preventDefault();
                return;
              }
              openContextMenu(event);
            }}
            onPointerMove={(event) => {
              if (cameraPan) {
                updateCameraPan(event);
                return;
              }
              updateNodeDrag(event);
              updateHeldPlacement(event);
              updateResize(event);
            }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget && event.button === 0) beginCameraPan(event);
            }}
            onPointerUp={(event) => {
              if (cameraPan) {
                endCameraPan(event);
                return;
              }
              commitNodeDrag(event);
              if (heldPlacement) commitHeldPlacement();
              commitResize(event);
            }}
            onPointerCancel={cancelInteraction}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedId(null);
                setEditorSession((current) => selectScreenStudioLoadedTarget(current, null));
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "ContextMenu" ||
                (event.shiftKey && event.key === "F10")
              ) {
                event.preventDefault();
                openContextMenu(event);
              }
            }}
            tabIndex={-1}
          >
            {visibleNodes.map((node) => (
              <div key={node.id}>
                <button
                  type="button"
                  aria-label={`${node.kind} ${node.definitionId}`}
                  className={`screen-studio-editor__node ${node.id === selectedId ? "is-selected" : ""}`}
                  style={{
                    ...storedCandidateStyle(node.placement),
                    zIndex: node.placement.zIndex,
                  }}
                  onPointerDown={(event) => beginNodePointer(event, node)}
                  onPointerMove={(event) => beginThresholdDrag(event, node)}
                  onPointerUp={commitNodeDrag}
                  onPointerCancel={cancelInteraction}
                  onLostPointerCapture={cancelInteraction}
                  onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); pendingPointer.current = null; startHeldNodePlacement(node, event.clientX, event.clientY); }}
                  onClick={() => setSelectedId(node.id)}
                  onContextMenu={(event) => openContextMenu(event, node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                      event.preventDefault();
                      event.stopPropagation();
                      openContextMenu(event, node.id);
                    }
                  }}
                >
                  <b>{node.kind}</b>
                  <span>{node.definitionId}</span>
                </button>
                {selectedId === node.id && isElementEditorActionAllowed(nodeInteractionPolicy(node), "resize")
                  ? (["nw", "ne", "sw", "se"] as const).map((corner) => (
                      <button
                        type="button"
                        key={`${node.id}-${corner}`}
                        className={`screen-studio-resize-handle screen-studio-resize-handle--${corner}`}
                        aria-label={`Resize ${node.definitionId} from ${corner} corner`}
                        style={{
                          left: corner.includes("e")
                            ? storedPixelsToViewport(node.placement.x + node.placement.width) - 8
                            : storedPixelsToViewport(node.placement.x) - 8,
                          top: corner.includes("s")
                            ? storedPixelsToViewport(node.placement.y + node.placement.height) - 8
                            : storedPixelsToViewport(node.placement.y) - 8,
                        }}
                        onPointerDown={(event) =>
                          beginResize(event, node, corner)
                        }
                        onPointerUp={commitResize}
                        onPointerCancel={cancelInteraction}
                        onLostPointerCapture={cancelInteraction}
                        onContextMenu={(event) => event.stopPropagation()}
                      />
                    ))
                  : null}
                {selectedId === node.id && isElementEditorActionAllowed(nodeInteractionPolicy(node), "close") ? (
                  <button
                    type="button"
                    className="screen-studio-delete-control"
                    aria-label={`Remove ${node.definitionId}`}
                    style={{
                      left: storedPixelsToViewport(node.placement.x + node.placement.width) + 4,
                      top: storedPixelsToViewport(node.placement.y) - 8,
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      update(
                        applyScreenStudioCommand(document, {
                          type: "remove",
                          nodeIds: [node.id],
                        }),
                        null,
                      )
                    }
                    onContextMenu={(event) => event.stopPropagation()}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {logicNodes.map((node) => { const record=SCREEN_STUDIO_BEHAVIOR_CATALOG.find((entry)=>entry.id===node.recordId); return <button type="button" key={node.id} className="screen-studio-editor__logic-node" style={{left:storedPixelsToViewport(node.x),top:storedPixelsToViewport(node.y)}} onContextMenu={(event)=>{event.preventDefault();setLogicNodes((current)=>current.filter((entry)=>entry.id!==node.id));}}><b>{record?.name ?? node.recordId}</b><small>{record?.kind} · {record?.category}</small></button>; })}
            {[...layers].sort((left, right) => left.order - right.order).map((layer) => renderLayer(layer, null, 0))}
            {drag ? (
              <div
                className={`screen-studio-editor__ghost ${drag.valid ? "is-valid" : "is-invalid"}`}
                style={storedCandidateStyle(drag.candidate)}
                aria-hidden="true"
              />
            ) : null}
            {heldPlacement ? (
              <div
                className={`screen-studio-editor__ghost ${heldPlacement.valid ? "is-valid" : "is-invalid"}`}
                style={storedCandidateStyle(heldPlacement.candidate)}
                aria-hidden="true"
              />
            ) : null}
            {resizeState ? (
              <div
                className={`screen-studio-editor__ghost ${resizeState.valid ? "is-valid" : "is-invalid"}`}
                style={storedCandidateStyle(resizeState.candidate)}
                aria-hidden="true"
              />
            ) : null}
            {layerResize ? <div className={`screen-studio-editor__ghost ${layerResize.valid ? "is-valid" : "is-invalid"}`} style={{ left: layerResize.candidate.x * viewportStride, top: layerResize.candidate.y * viewportStride, width: layerResize.candidate.width * viewportStride - (viewportGrid?.gapPixels ?? 0), height: layerResize.candidate.height * viewportStride - (viewportGrid?.gapPixels ?? 0) }} aria-hidden="true" /> : null}
            </div>
          </div>
          <output className={`screen-studio-editor__zoom-status ${zoomStatusVisible ? "is-visible" : ""}`} aria-live="polite">{Math.round(camera.zoom * 100)}%</output>
        </div>
        {selectedId && visibleNodes.find((node) => node.id === selectedId) ? (() => {
          const selectedNode = visibleNodes.find((node) => node.id === selectedId)!;
          const compositionParent = resolvedSelectedLayer?.parentId
            ?? (selectedLayer ? parentLayerId(layers, selectedLayer.id) : null)
            ?? "Screen root";
          return <aside className="screen-studio-editor__selection-popover" aria-label="Selected node editor">
            <button type="button" aria-label="Deselect node" onClick={() => setSelectedId(null)}>×</button>
            <h3>{selectedNode.definitionId}</h3>
            <p>{selectedNode.kind} · local draft</p>
            <dl>
              <div><dt>Canvas x / y</dt><dd>{selectedNode.placement.x} / {selectedNode.placement.y}</dd></div>
              <div><dt>Canvas size</dt><dd>{selectedNode.placement.width} × {selectedNode.placement.height}</dd></div>
              <div><dt>Composition parent</dt><dd>{compositionParent}</dd></div>
              <div><dt>Parent-relative x / y</dt><dd>{selectedLayer ? `${selectedLayer.geometry.x}u / ${selectedLayer.geometry.y}u` : "Unavailable"}</dd></div>
              <div><dt>Composition size</dt><dd>{selectedLayer ? `${selectedLayer.geometry.width}u × ${selectedLayer.geometry.height}u` : "Unavailable"}</dd></div>
              <div><dt>Resolved styles</dt><dd>{resolvedSelectedLayer ? `${resolvedSelectedLayer.styles.color.kind} · ${resolvedSelectedLayer.styles.borderColor.kind} · ${resolvedSelectedLayer.styles.effect.kind}` : "Unavailable"}</dd></div>
              <div><dt>Resolved behaviors</dt><dd>{resolvedSelectedLayer?.behaviors.length ?? 0}</dd></div>
              <div><dt>Overrides</dt><dd>None · inherited from parent</dd></div>
            </dl>
            <label>Label<input value={String(selectedNode.properties.label ?? "")} onChange={(event) => update(applyScreenStudioCommand(document, { type: "set-property", nodeId: selectedNode.id, key: "label", value: event.target.value }), selectedNode.id)} /></label>
            {selectedAlignmentEditor}
            <small>Grid-snapped local state; Save Draft remains disabled.</small>
          </aside>;
        })() : null}
        {selectedLayer && !visibleNodes.some((node) => node.id === selectedLayer.id) ? <aside className="screen-studio-editor__selection-popover" aria-label="Selected layer inspector">
          <button type="button" aria-label="Deselect layer" onClick={() => setSelectedId(null)}>×</button>
          <h3>{selectedLayer.elementType}</h3>
          <p>{selectedLayer.family} · local nested layer</p>
          <dl>
            <div><dt>Parent</dt><dd>{parentLayerId(layers, selectedLayer.id) ?? "Canvas root"}</dd></div>
            <div><dt>Order</dt><dd>{selectedLayer.order + 1}</dd></div>
            <div><dt>x / y</dt><dd>{selectedLayer.geometry.x}u / {selectedLayer.geometry.y}u</dd></div>
            <div><dt>Size</dt><dd>{selectedLayer.geometry.width}u × {selectedLayer.geometry.height}u</dd></div>
            <div><dt>Resolved styles</dt><dd>{resolvedSelectedLayer ? `${resolvedSelectedLayer.styles.color.kind} · ${resolvedSelectedLayer.styles.borderColor.kind} · ${resolvedSelectedLayer.styles.effect.kind}` : "Unavailable"}</dd></div>
            <div><dt>Resolved behaviors</dt><dd>{resolvedSelectedLayer?.behaviors.length ?? 0}</dd></div>
            <div><dt>Overrides</dt><dd>None · inherited from parent</dd></div>
          </dl>
          {selectedAlignmentEditor}
          <small>{isReparentableElementLayer(selectedLayer) ? "Container placement can move, resize, and reparent locally." : "Element placement can move and resize within its existing parent."}</small>
        </aside> : null}
        {drag || heldPlacement || resizeState || layerDrag || layerResize ? (
          <div
            className="screen-studio-editor__interaction-feedback"
            role="alert"
          >
            {(drag?.valid ?? heldPlacement?.valid ?? resizeState?.valid ?? layerDrag?.projectionValid ?? layerResize?.valid)
              ? "Valid snapped placement"
              : "Invalid placement — move inside the canvas or press Escape to cancel"}
          </div>
        ) : null}
        {editorFeedback ? <div className={`screen-studio-editor__interaction-feedback is-${editorFeedback.tone}`} role={editorFeedback.tone}>{editorFeedback.message}</div> : null}
        {contextMenu ? (
          <nav
            ref={contextMenuRef}
            className="screen-studio-context-menu"
            data-screen-studio-context-menu
            data-canvas-container-state={canvasContainerState}
            role="menu"
            aria-label={
              contextMenu.nodeId ? "Object actions" : "Canvas actions"
            }
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onKeyDown={handleContextMenuKeyDown}
          >
            {(contextMenu.nodeId ? canLayerHostChildren(contextLayer) : canvasHasContainer) ? <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={Boolean(addMenuState)}
              disabled={!contextAction("add-element")?.enabled}
              onClick={() => openElementAddMenu(contextMenu.nodeId && contextLayer ? { id: contextLayer.id, elementType: contextLayer.elementType, family: contextLayer.family } : rootAddTarget)}
            >
              {contextMenu.nodeId ? "Add New Child" : "Add New"}
            </button> : null}
            {!contextMenu.nodeId && canvasHasContainer ? <button
              type="button"
              role="menuitem"
              disabled={!contextAction("paste")?.enabled}
              onClick={() => {
                if (document.clipboard.length) update(applyScreenStudioCommand(document, { type: "paste", nodes: document.clipboard, anchor: { x: contextMenu.canvasX, y: contextMenu.canvasY } }));
                closeContextMenu();
              }}
            >Paste</button> : null}
            {!contextMenu.nodeId ? <button type="button" role="menuitem" onClick={openContainerEditor}>{canvasHasContainer ? "Edit Container" : "New Container"}</button> : null}
            {contextDocumentNode ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    update(
                      applyScreenStudioCommand(document, {
                        type: "duplicate",
                        nodeId: contextDocumentNode.id,
                      }),
                    );
                    closeContextMenu();
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    update(
                      applyScreenStudioCommand(document, {
                        type: "copy",
                        nodeIds: [contextDocumentNode.id],
                      }),
                    );
                    closeContextMenu();
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    update(
                      applyScreenStudioCommand(document, {
                        type: "remove",
                        nodeIds: [contextDocumentNode.id],
                      }),
                      null,
                    );
                    closeContextMenu();
                  }}
                >
                  Remove
                </button>
              </>
            ) : null}
            {contextLayer && !contextDocumentNode && isClosableElementLayer(contextLayer) ? <button type="button" role="menuitem" onClick={() => { closeLayer(contextLayer); closeContextMenu(false); }}>Remove</button> : null}
            <div className="screen-studio-context-menu__load-actions" role="group" aria-label="Load actions">
              {canvasHasContainer && contextLoadKinds.has("behavior") ? <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={logicMenuCategory !== null} onClick={() => setLogicMenuCategory(SCREEN_STUDIO_BEHAVIOR_CATEGORIES[0])}>Load Behavior</button> : null}
              {loadActions.map((action) => action.id === "delete" ? (
                canvasHasContainer ?
                <button
                  type="button"
                  role="menuitem"
                  key={action.id}
                  disabled={!action.enabled}
                  onClick={deleteLoadedTarget}
                >{action.label}</button> : null
              ) : (action.id === "load-element" && !canvasHasContainer) || !contextLoadKinds.has(action.id === "load-element" ? "element" : "screen") ? null : (
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={loadMenuKind === (action.id === "load-element" ? "element" : "screen")}
                  data-load-action={action.id === "load-element" ? "element" : "screen"}
                  key={action.id}
                  disabled={!action.enabled}
                  onClick={() => {
                    setAddMenuState(null);
                    setAddMenuTarget(null);
                    const nextKind = action.id === "load-element" ? "element" : "screen";
                    setLoadMenuKind(nextKind);
                    if (nextKind === "screen") setScreenLoadQuery("");
                  }}
                >{action.label}</button>
              ))}
            </div>
            {loadMenuKind ? (
              <div
                className="screen-studio-add-menu screen-studio-load-menu"
                role="menu"
                aria-label={loadMenuKind === "element" ? "Element catalog" : "Screen catalog"}
              >
                {loadMenuKind === "element" ? screenStudioElementCatalog.map((record) => (
                  <button
                    type="button"
                    role="menuitem"
                    data-load-menu-entry
                    key={record.id}
                    onClick={() => loadCatalogTarget(loadMenuKind, record.id)}
                  >{record.name}</button>
                )) : <>
                  <label className="screen-studio-load-menu__search">Search screens<input type="search" value={screenLoadQuery} placeholder="Search name, type, role, or tag…" onChange={(event) => setScreenLoadQuery(event.target.value)} /></label>
                  <span className="screen-studio-load-menu__count" role="status">{visibleScreenLoadRecords.length} screens</span>
                  {visibleScreenLoadGroups.map((group) => {
                    const records = visibleScreenLoadRecords.filter((record) => record.groupId === group.id);
                    const searching = screenLoadQuery.trim().length > 0;
                    const expanded = searching || !collapsedScreenLoadGroups.has(group.id);
                    const hiddenByAncestor = !searching && screenLoadGroupAncestorIds(group.id).some((ancestorId) => collapsedScreenLoadGroups.has(ancestorId));
                    return <section className="screen-studio-load-menu__group" data-depth={screenLoadGroupDepth(group.id)} style={{ "--screen-load-group-depth": screenLoadGroupDepth(group.id) } as CSSProperties} key={group.id} hidden={hiddenByAncestor} aria-labelledby={`screen-load-group-${group.id}`}>
                      <h3><button type="button" id={`screen-load-group-${group.id}`} aria-expanded={expanded} aria-controls={`screen-load-group-${group.id}-records`} onClick={() => toggleScreenLoadGroup(group.id)}><span aria-hidden="true">{expanded ? "▾" : "▸"}</span><span>{group.label}</span></button></h3>
                      <div id={`screen-load-group-${group.id}-records`} className="screen-studio-load-menu__records" hidden={!expanded}>
                        {records.map((record) => <button type="button" role="menuitem" data-load-menu-entry key={record.id} onClick={() => loadCatalogTarget("screen", record.id)}><span>{record.displayName}</span><small>{record.type} · {record.roles.join(", ") || "no roles"}</small></button>)}
                      </div>
                    </section>;
                  })}
                </>}
              </div>
            ) : null}
            {logicMenuCategory !== null ? <div className="screen-studio-add-menu" role="menu" aria-label="Behavior groups">{SCREEN_STUDIO_BEHAVIOR_CATEGORIES.map((category)=><button type="button" role="menuitem" key={category} aria-expanded={logicMenuCategory===category} onClick={()=>setLogicMenuCategory(category)}>{category}</button>)}<div role="group" aria-label={`${logicMenuCategory} behaviors`}>{SCREEN_STUDIO_BEHAVIOR_CATALOG.filter((entry)=>entry.category===logicMenuCategory).map((entry)=><button type="button" role="menuitem" key={entry.id} onClick={()=>addLogicNode(entry.id)}>{entry.name}<small>{entry.kind}</small></button>)}</div></div>:null}
            {addMenuState && addMenuTarget ? (
              <div
                className="screen-studio-add-menu"
                role="menu"
                aria-label={addMenuState.kind === "groups" ? "Element type groups" : `${addMenuState.group} element types`}
              >
                {addMenuState.kind === "groups" ? addMenuGroups.map((group) => <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  data-add-menu-entry
                  data-add-menu-group={group.group}
                  key={group.group}
                  onClick={() => setAddMenuState(openAddMenuGroup(addMenuState, addMenuGroups, group.group))}
                ><span>{group.group}</span><span aria-hidden="true">›</span></button>) : <>
                  <button type="button" role="menuitem" data-add-menu-entry onClick={() => setAddMenuState(resetAddMenuState())}>← Back to groups</button>
                  {addMenuGroups.find((group) => group.group === addMenuState.group)?.items.map((item) => <button
                    type="button"
                    role="menuitem"
                    data-add-menu-entry
                    key={item.id}
                    title={item.description}
                    onClick={() => chooseElementType(item.id)}
                  >{item.name}</button>)}
                </>}
              </div>
            ) : null}
          </nav>
        ) : null}
        <WorkspaceEditorOverlay
          open={containerEditorOpen}
          title={`Edit Container · ${containerSettings.name}`}
          onDismiss={() => setContainerEditorOpen(false)}
          className="screen-studio-element-editor-overlay screen-studio-container-editor-overlay"
        >
          <div className="screen-studio-element-editor screen-studio-container-editor">
            <nav className="screen-studio-element-editor__tabs" aria-label="Container settings">
              {SCREEN_STUDIO_CONTAINER_EDITOR_TABS.map((tab) => <button type="button" key={tab} aria-current={containerEditorTab === tab ? "page" : undefined} onClick={() => setContainerEditorTab(tab)}>{tab}</button>)}
            </nav>
            <p className="screen-studio-element-editor__autosave" role="status">{containerDraftUnsaved ? "Unsaved new page draft · session only" : "Loaded screen · validated changes autosave in this session"}</p>
            {containerEditorTab === "Position" ? <fieldset>
              <legend>Container</legend>
              <label>Name<input value={containerSettings.name} onChange={(event) => setContainerSettings((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Page link URL slug<input value={containerSettings.slug} aria-invalid={!nestedUrlSlug.test(containerSettings.slug)} aria-describedby="screen-studio-container-slug-help" onChange={(event) => setContainerSettings((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/^\/+/, "") }))} /></label>
              <small id="screen-studio-container-slug-help">Nested route, for example creator/screen-studio.</small>
              {!nestedUrlSlug.test(containerSettings.slug) ? <small role="alert">Use lowercase path segments separated by slashes.</small> : null}
              <label>Page type<select value={containerSettings.type} onChange={(event) => setContainerSettings((current) => ({ ...current, type: event.target.value as ScreenStudioContainerType }))}>{SCREEN_STUDIO_CONTAINER_TYPES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            </fieldset> : null}
            {containerEditorTab === "Size" ? <fieldset><legend>Size</legend><label>Viewport sizing<input value="Fullscreen responsive grid" readOnly aria-readonly="true" /></label><label>Root position<input value="Viewport origin (no x/y offset)" readOnly aria-readonly="true" /></label></fieldset> : null}
            {containerEditorTab === "Palette" ? <fieldset><legend>Palette</legend><p>Container styles inherit through the child hierarchy unless a child defines an override.</p></fieldset> : null}
            {containerEditorTab === "Effects" ? <fieldset><legend>Effects</legend><p>Container effects inherit through the child hierarchy unless a child defines an override.</p></fieldset> : null}
            {containerEditorTab === "Behaviors" ? <fieldset data-screen-container-behavior-count={logicNodes.length}><legend>Screen container behaviors</legend><p>{containerSettings.type === "behavior" ? "Right-click the finite grid and choose Load Behavior. Attached blocks use Account Settings action bindings and remain local until the Screen is saved." : "Change Page type to Behavior before attaching behavior blocks."}</p>{logicNodes.length ? <ul className="screen-studio-container-editor__behaviors">{logicNodes.map((node) => { const record = SCREEN_STUDIO_BEHAVIOR_CATALOG.find((entry) => entry.id === node.recordId); return <li key={node.id}><span><b>{record?.name ?? node.recordId}</b><small>{record?.kind} · {record?.category}</small></span><button type="button" onClick={() => setLogicNodes((current) => current.filter((entry) => entry.id !== node.id))}>Detach</button></li>; })}</ul> : <p>No behaviors attached.</p>}</fieldset> : null}
          </div>
        </WorkspaceEditorOverlay>
      </div>
    </section>
  );
}
