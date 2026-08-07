import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject, type WheelEvent as ReactWheelEvent } from "react";

import {
  DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID,
  SCREEN_STUDIO_ELEMENT_ALLOWED_CHILDREN,
  SCREEN_STUDIO_ELEMENT_EDITOR_LABEL,
  SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS,
  SCREEN_STUDIO_FUSED_ELEMENT_CATALOG,
  SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS,
  addElementLayerUnderContainer,
  findElementLayerById,
  isClosableElementLayer,
  isElementEditorActionAllowed,
  isValidSiteUnitGeometry,
  projectElementViewportGrid,
  projectPointerCenteredElementZoom,
  snapElementSiteUnit,
  updateElementLayerById,
  validateElementLayers,
  type ElementLayerV1,
  type FusedElementDraftV1,
  type ScreenStudioElementEditorViewMode,
  type ScreenStudioElementViewportGridProjectionV1,
  type SiteUnitGeometryV1,
} from "../dashboard/screen-studio-element-composition-model.ts";

type CanvasTarget = Readonly<{ id: string; elementType: string; family: "element" | "panel"; geometry: SiteUnitGeometryV1; root: boolean }>;
type MenuState = Readonly<{ x: number; y: number; targetId: string | null }>;
type ResizeCorner = "nw" | "ne" | "sw" | "se";
type ParentBounds = Readonly<{ width: number; height: number }>;
type DragState = Readonly<{ target: CanvasTarget; pointerId: number; clientX: number; clientY: number; geometry: SiteUnitGeometryV1; parent: ParentBounds }>;
type ResizeState = Readonly<{ target: CanvasTarget; pointerId: number; corner: ResizeCorner; clientX: number; clientY: number; geometry: SiteUnitGeometryV1; parent: ParentBounds }>;
type PanState = Readonly<{ pointerId: number; clientX: number; clientY: number; panX: number; panY: number }>;

const ROOT_ID = "element-editor-root";
const SITE_STEP_GRID = Object.freeze({ ...DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID, unit: SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step });

export function useScreenStudioViewportGrid(ref: RefObject<HTMLElement | null>): ScreenStudioElementViewportGridProjectionV1 | null {
  const [projection, setProjection] = useState<ScreenStudioElementViewportGridProjectionV1 | null>(null);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const measure = () => {
      const bounds = target.getBoundingClientRect();
      setProjection(projectElementViewportGrid(bounds.width, bounds.height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref]);
  return projection;
}

function viewportStride(projection: ScreenStudioElementViewportGridProjectionV1): number {
  return projection.cellPixels + projection.gapPixels;
}

export function boundedElementEditorPan({ panX, panY, deltaX, deltaY, viewportWidthPixels, viewportHeightPixels, zoom }: Readonly<{ panX: number; panY: number; deltaX: number; deltaY: number; viewportWidthPixels: number; viewportHeightPixels: number; zoom: number }>): Readonly<{ x: number; y: number }> {
  const limitX = Math.max(0, viewportWidthPixels * Math.max(1, zoom) * 2);
  const limitY = Math.max(0, viewportHeightPixels * Math.max(1, zoom) * 2);
  return Object.freeze({
    x: Math.max(-limitX, Math.min(limitX, panX + deltaX)),
    y: Math.max(-limitY, Math.min(limitY, panY + deltaY)),
  });
}

export function screenStudioGeometryViewportStyle(geometry: SiteUnitGeometryV1, projection: ScreenStudioElementViewportGridProjectionV1 | null): CSSProperties {
  if (!projection) return { visibility: "hidden" };
  const stride = viewportStride(projection);
  return {
    left: geometry.x * stride,
    top: geometry.y * stride,
    width: Math.max(projection.cellPixels, geometry.width * stride - projection.gapPixels),
    height: Math.max(projection.cellPixels, geometry.height * stride - projection.gapPixels),
  };
}

function removeLayerAndNormalize(layers: readonly ElementLayerV1[], id: string): readonly ElementLayerV1[] {
  const visit = (siblings: readonly ElementLayerV1[]): Readonly<{ layers: readonly ElementLayerV1[]; changed: boolean }> => {
    let changed = false;
    const retained: ElementLayerV1[] = [];
    for (const layer of siblings) {
      if (layer.id === id) { changed = true; continue; }
      const nested = visit(layer.children);
      if (nested.changed) changed = true;
      retained.push(nested.changed ? Object.freeze({ ...layer, children: nested.layers }) : layer);
    }
    if (!changed) return Object.freeze({ layers: siblings, changed: false });
    return Object.freeze({
      changed: true,
      layers: Object.freeze(retained.map((layer, order) => layer.order === order ? layer : Object.freeze({ ...layer, order }))),
    });
  };
  return visit(layers).layers;
}

function collectLayerIds(layers: readonly ElementLayerV1[], output = new Set<string>()): Set<string> {
  for (const layer of layers) { output.add(layer.id); collectLayerIds(layer.children, output); }
  return output;
}

function allowedChildren(elementType: string): readonly string[] {
  const allowed = SCREEN_STUDIO_ELEMENT_ALLOWED_CHILDREN[elementType] ?? [];
  return SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.filter((entry) => allowed.includes("*") || allowed.includes(entry.id)).map((entry) => entry.id);
}

function snapped(value: number): number {
  return Math.min(SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.max, snapElementSiteUnit(Math.max(0, value), SITE_STEP_GRID));
}

function boundedGeometry(geometry: SiteUnitGeometryV1, parent: ParentBounds): SiteUnitGeometryV1 | null {
  const candidate = Object.freeze({
    ...geometry,
    x: snapped(geometry.x),
    y: snapped(geometry.y),
    width: Math.max(SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step, snapped(geometry.width)),
    height: Math.max(SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step, snapped(geometry.height)),
  });
  return isValidSiteUnitGeometry(candidate)
    && candidate.x + candidate.width <= parent.width
    && candidate.y + candidate.height <= parent.height
    ? candidate
    : null;
}

function resizedGeometry(start: SiteUnitGeometryV1, corner: ResizeCorner, dx: number, dy: number, parent: ParentBounds): SiteUnitGeometryV1 | null {
  const west = corner.includes("w");
  const north = corner.includes("n");
  return boundedGeometry({
    ...start,
    x: west ? start.x + dx : start.x,
    y: north ? start.y + dy : start.y,
    width: west ? start.width - dx : start.width + dx,
    height: north ? start.height - dy : start.height + dy,
  }, parent);
}

export function ScreenStudioElementEditorCanvas({ draft, viewMode, selectedLayerId, onSelectedLayerChange, onGeometryChange, onLayersChange, onCloseDraft, onInteractionActiveChange }: Readonly<{
  draft: FusedElementDraftV1;
  viewMode: ScreenStudioElementEditorViewMode;
  selectedLayerId: string | null;
  onSelectedLayerChange: (layerId: string | null) => void;
  onGeometryChange: (geometry: SiteUnitGeometryV1) => void;
  onLayersChange: (layers: readonly ElementLayerV1[]) => void;
  onCloseDraft: () => void;
  onInteractionActiveChange?: (active: boolean) => void;
}>) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [candidate, setCandidate] = useState<Readonly<{ targetId: string; geometry: SiteUnitGeometryV1; kind: "move" | "resize" }> | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Readonly<{ x: number; y: number }>>(() => Object.freeze({ x: 0, y: 0 }));
  const [zoomStatusVisible, setZoomStatusVisible] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const zoomStatusTimerRef = useRef<number | null>(null);
  const projection = useScreenStudioViewportGrid(canvasRef);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);
  const interactionChangeRef = useRef(onInteractionActiveChange);
  interactionChangeRef.current = onInteractionActiveChange;
  const rootTarget: CanvasTarget = { id: ROOT_ID, elementType: draft.elementType, family: draft.family, geometry: draft.geometry, root: true };
  const selectedLayer = selectedLayerId ? findElementLayerById(draft.layers, selectedLayerId) : null;
  const selectedTarget: CanvasTarget = selectedLayer ? { ...selectedLayer, root: false } : rootTarget;
  const parentType = !menu?.targetId ? draft.elementType : findElementLayerById(draft.layers, menu.targetId)?.elementType;
  const addOptions = useMemo(() => parentType ? allowedChildren(parentType) : [], [parentType]);
  const renderedZoom = viewMode === "compact" ? zoom : 1;
  const renderedPan = viewMode === "compact" ? pan : Object.freeze({ x: 0, y: 0 });
  const gridStyle = projection ? {
    "--element-editor-grid-cell": `${projection.cellPixels}px`,
    "--element-editor-grid-gap": `${projection.gapPixels}px`,
    "--element-editor-grid-stride": `${viewportStride(projection)}px`,
    "--element-editor-rendered-grid-stride": `${viewportStride(projection) * renderedZoom}px`,
    "--element-editor-grid-zoom": renderedZoom,
    "--element-editor-handle-scale": 1 / renderedZoom,
    "--element-editor-grid-pan-x": `${renderedPan.x}px`,
    "--element-editor-grid-pan-y": `${renderedPan.y}px`,
  } as CSSProperties : undefined;
  const stageStyle = { transform: `translate(${renderedPan.x}px, ${renderedPan.y}px) scale(${renderedZoom})` } as CSSProperties;

  const announceZoom = () => {
    if (zoomStatusTimerRef.current !== null) window.clearTimeout(zoomStatusTimerRef.current);
    setZoomStatusVisible(true);
    zoomStatusTimerRef.current = window.setTimeout(() => {
      setZoomStatusVisible(false);
      zoomStatusTimerRef.current = null;
    }, 1200);
  };
  const applyZoom = (nextZoom: number, pointerX: number, pointerY: number) => {
    if (!projection) return;
    const viewport = canvasRef.current?.getBoundingClientRect();
    if (!viewport) return;
    const next = projectPointerCenteredElementZoom({
      viewportWidthPixels: viewport.width,
      viewportHeightPixels: viewport.height,
      pointerX,
      pointerY,
      panX: pan.x,
      panY: pan.y,
      zoom,
      nextZoom,
      pixelsPerSiteUnit: viewportStride(projection),
    });
    if (!next) return;
    setZoom(next.zoom);
    setPan(Object.freeze({ x: next.panX, y: next.panY }));
    announceZoom();
  };
  const zoomAtCanvasCenter = (nextZoom: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    applyZoom(nextZoom, bounds.width / 2, bounds.height / 2);
  };
  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (viewMode !== "compact" || !projection) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const direction = event.deltaY < 0 ? 1 : -1;
    applyZoom(zoom + direction * SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.step, event.clientX - bounds.left, event.clientY - bounds.top);
  };
  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (viewMode !== "compact" || event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setMenu(null);
    setShowAdd(false);
    setPanning({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y });
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panning || panning.pointerId !== event.pointerId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    setPan(boundedElementEditorPan({
      panX: panning.panX,
      panY: panning.panY,
      deltaX: event.clientX - panning.clientX,
      deltaY: event.clientY - panning.clientY,
      viewportWidthPixels: bounds.width,
      viewportHeightPixels: bounds.height,
      zoom: renderedZoom,
    }));
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panning || panning.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPanning(null);
  };

  const commitLayers = (layers: readonly ElementLayerV1[]): boolean => {
    if (validateElementLayers(layers).length !== 0) return false;
    onLayersChange(layers);
    return true;
  };
  const closeMenu = () => { setMenu(null); setShowAdd(false); queueMicrotask(() => canvasRef.current?.focus()); };
  const openMenu = (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>, targetId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const clientX = "clientX" in event ? event.clientX : bounds.left + bounds.width / 2;
    const clientY = "clientY" in event ? event.clientY : bounds.top + bounds.height / 2;
    onSelectedLayerChange(targetId);
    setMenu({ x: Math.max(8, Math.min(bounds.width - 180, clientX - bounds.left)), y: Math.max(8, Math.min(bounds.height - 120, clientY - bounds.top)), targetId });
    setShowAdd(false);
  };
  const addLayer = (elementType: string) => {
    const parentLayer = menu?.targetId ? findElementLayerById(draft.layers, menu.targetId) : null;
    const parent = parentLayer
      ? { id: parentLayer.id, elementType: parentLayer.elementType, family: parentLayer.family }
      : { id: null, elementType: draft.elementType, family: draft.family };
    const previousIds = collectLayerIds(draft.layers);
    const result = addElementLayerUnderContainer({ layers: draft.layers, parent, childType: elementType, geometry: { x: 0, y: 0 }, idPrefix: "element-editor" });
    if (result.ok && commitLayers(result.layers)) {
      const addedId = [...collectLayerIds(result.layers)].find((id) => !previousIds.has(id)) ?? null;
      onSelectedLayerChange(addedId);
    }
    closeMenu();
  };
  const commitTargetGeometry = (target: CanvasTarget, geometry: SiteUnitGeometryV1) => {
    if (target.root) onGeometryChange(geometry);
    else {
      const result = updateElementLayerById(draft.layers, target.id, (layer) => ({ ...layer, geometry }));
      if (result.ok) commitLayers(result.layers);
    }
  };
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, target: CanvasTarget, parent: ParentBounds) => {
    if (event.button !== 0) return;
    onSelectedLayerChange(target.root ? null : target.id);
    if (!isElementEditorActionAllowed(target, "move") || !projection) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ target, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, geometry: target.geometry, parent });
    setCandidate({ targetId: target.id, geometry: target.geometry, kind: "move" });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId || !projection) return;
    const stride = viewportStride(projection) * renderedZoom;
    const geometry = boundedGeometry({ ...drag.geometry, x: drag.geometry.x + (event.clientX - drag.clientX) / stride, y: drag.geometry.y + (event.clientY - drag.clientY) / stride }, drag.parent);
    if (geometry) setCandidate({ targetId: drag.target.id, geometry, kind: "move" });
  };
  const commitDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (candidate?.targetId === drag.target.id) commitTargetGeometry(drag.target, candidate.geometry);
    setDrag(null);
    setCandidate(null);
  };
  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>, target: CanvasTarget, parent: ParentBounds, corner: ResizeCorner) => {
    if (event.button !== 0) return;
    if (!isElementEditorActionAllowed(target, "resize") || !projection) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResize({ target, pointerId: event.pointerId, corner, clientX: event.clientX, clientY: event.clientY, geometry: target.geometry, parent });
    setCandidate({ targetId: target.id, geometry: target.geometry, kind: "resize" });
  };
  const moveResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resize || resize.pointerId !== event.pointerId || !projection) return;
    const stride = viewportStride(projection) * renderedZoom;
    const geometry = resizedGeometry(resize.geometry, resize.corner, (event.clientX - resize.clientX) / stride, (event.clientY - resize.clientY) / stride, resize.parent);
    if (geometry) setCandidate({ targetId: resize.target.id, geometry, kind: "resize" });
  };
  const commitResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resize || resize.pointerId !== event.pointerId) return;
    if (candidate?.targetId === resize.target.id) commitTargetGeometry(resize.target, candidate.geometry);
    setResize(null);
    setCandidate(null);
  };
  const keyboardResize = (event: React.KeyboardEvent<HTMLButtonElement>, target: CanvasTarget, parent: ParentBounds, corner: ResizeCorner) => {
    const delta = SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step;
    const dx = event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0;
    const dy = event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    const geometry = resizedGeometry(target.geometry, corner, dx, dy, parent);
    if (geometry) commitTargetGeometry(target, geometry);
  };
  const closeTarget = (target: CanvasTarget) => {
    if (!isClosableElementLayer(target)) return;
    if (target.root) onCloseDraft();
    else if (commitLayers(removeLayerAndNormalize(draft.layers, target.id))) onSelectedLayerChange(null);
  };

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!menu && !drag && !resize && !panning)) return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      setDrag(null);
      setResize(null);
      setPanning(null);
      setCandidate(null);
      canvasRef.current?.focus();
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [drag, menu, panning, resize]);

  useEffect(() => { interactionChangeRef.current?.(Boolean(menu || drag || resize || panning)); }, [drag, menu, panning, resize]);
  useEffect(() => () => interactionChangeRef.current?.(false), []);
  useEffect(() => () => { if (zoomStatusTimerRef.current !== null) window.clearTimeout(zoomStatusTimerRef.current); }, []);
  useEffect(() => { if (menu) firstMenuItemRef.current?.focus(); }, [menu]);

  const geometryFor = (target: CanvasTarget) => candidate?.targetId === target.id ? candidate.geometry : target.geometry;
  const resizeHandles = (target: CanvasTarget, parent: ParentBounds) => isElementEditorActionAllowed(target, "resize")
    ? (["nw", "ne", "sw", "se"] as const).map((corner) => <button type="button" key={`${target.id}-${corner}`} className={`screen-studio-element-canvas__resize screen-studio-element-canvas__resize--${corner}`} aria-label={`Resize ${target.elementType} from ${corner} corner`} onPointerDown={(event) => beginResize(event, target, parent, corner)} onPointerMove={moveResize} onPointerUp={commitResize} onPointerCancel={() => { setResize(null); setCandidate(null); }} onKeyDown={(event) => keyboardResize(event, target, parent, corner)} />)
    : null;
  const renderLayer = (layer: ElementLayerV1, parent: ParentBounds): React.ReactNode => {
    const target: CanvasTarget = { ...layer, root: false };
    const geometry = geometryFor(target);
    const childParent = { width: geometry.width, height: geometry.height };
    return <div className="screen-studio-element-canvas__layer-wrap" key={layer.id} style={screenStudioGeometryViewportStyle(geometry, projection)}>
      <button type="button" className={`screen-studio-element-canvas__layer${selectedLayerId === layer.id ? " is-selected" : ""} is-movable`} aria-label={`${layer.elementType} layer, movable and resizable`} onClick={(event) => { event.stopPropagation(); onSelectedLayerChange(layer.id); }} onContextMenu={(event) => openMenu(event, layer.id)} onPointerDown={(event) => beginDrag(event, target, parent)} onPointerMove={moveDrag} onPointerUp={commitDrag} onPointerCancel={() => { setDrag(null); setCandidate(null); }}>
        <b>{layer.elementType}</b><small>design object</small>
      </button>
      {selectedLayerId === layer.id ? resizeHandles(target, parent) : null}
      {selectedLayerId === layer.id && isClosableElementLayer(layer) ? <button type="button" className="screen-studio-element-canvas__close" aria-label={`Close ${layer.elementType} layer`} onClick={() => closeTarget(target)}>×</button> : null}
      {layer.children.map((child) => renderLayer(child, childParent))}
    </div>;
  };

  const rootGeometry = geometryFor(rootTarget);
  const presentedRootGeometry = viewMode === "expanded" ? { ...rootGeometry, x: 0, y: 0 } : rootGeometry;
  const rootParent = { width: DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.columns, height: DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID.rows };
  return <section className="screen-studio-element-editor-canvas" aria-label={SCREEN_STUDIO_ELEMENT_EDITOR_LABEL} data-editor-mode={viewMode} data-viewport-grid={projection ? "measured" : "pending"}>
    <div ref={canvasRef} className="screen-studio-element-editor-canvas__grid" style={gridStyle} role="application" tabIndex={0} aria-label="Element Editor responsive site-unit grid" onWheel={handleWheel} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={() => setPanning(null)} onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); event.stopPropagation(); } }} onClick={(event) => { if (event.target === event.currentTarget) onSelectedLayerChange(null); }} onContextMenu={(event) => { if (event.button === 1 || panning) { event.preventDefault(); event.stopPropagation(); return; } openMenu(event, selectedLayerId); }} onKeyDown={(event) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { openMenu(event, selectedLayerId); return; }
      if (viewMode !== "compact") return;
      if (event.key !== "+" && event.key !== "=" && event.key !== "-" && event.key !== "0") return;
      event.preventDefault();
      if (event.key === "0") zoomAtCanvasCenter(1);
      else zoomAtCanvasCenter(zoom + (event.key === "-" ? -1 : 1) * SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.step);
    }}>
      <div className="screen-studio-element-editor-canvas__stage" style={stageStyle} onClick={(event) => { if (event.target === event.currentTarget) onSelectedLayerChange(null); }}>
      <div className="screen-studio-element-canvas__root-wrap" style={screenStudioGeometryViewportStyle(presentedRootGeometry, projection)} data-expanded-root-origin={viewMode === "expanded" ? "0u 0u" : undefined}>
        <button type="button" className={`screen-studio-element-canvas__layer is-root${selectedLayerId === null ? " is-selected" : ""} is-movable`} aria-label={`${draft.name}, movable and resizable`} onClick={(event) => { event.stopPropagation(); onSelectedLayerChange(null); }} onContextMenu={(event) => openMenu(event, null)} onPointerDown={(event) => beginDrag(event, rootTarget, rootParent)} onPointerMove={moveDrag} onPointerUp={commitDrag} onPointerCancel={() => { setDrag(null); setCandidate(null); }}><b>{draft.name}</b><small>{draft.elementType}</small></button>
        {selectedLayerId === null ? resizeHandles(rootTarget, rootParent) : null}
        {selectedLayerId === null && isClosableElementLayer(rootTarget) ? <button type="button" className="screen-studio-element-canvas__close" aria-label={`Close ${draft.name}`} onClick={() => closeTarget(rootTarget)}>×</button> : null}
        {draft.layers.map((layer) => renderLayer(layer, { width: rootGeometry.width, height: rootGeometry.height }))}
      </div>
      </div>
      {zoomStatusVisible ? <output className="screen-studio-element-editor-canvas__zoom-status" aria-live="polite">{Math.round(zoom * 100)}%</output> : null}
      {candidate ? <output className="screen-studio-element-canvas__footprint" aria-live="polite">{candidate.kind === "move" ? "Position" : "Size"} {candidate.geometry.x}u, {candidate.geometry.y}u · {candidate.geometry.width}u × {candidate.geometry.height}u</output> : null}
      {menu ? <nav className="screen-studio-element-canvas__menu" role="menu" aria-label="Editor context menu" style={{ left: menu.x, top: menu.y }} data-screen-studio-context-menu>
        <button ref={firstMenuItemRef} type="button" role="menuitem" aria-expanded={showAdd} disabled={!addOptions.length || !isElementEditorActionAllowed(selectedTarget, "add-element")} onClick={() => setShowAdd((open) => !open)}>Add New Element</button>
        {showAdd ? <div className="screen-studio-element-canvas__add-menu" aria-label="Add New Element choices">{addOptions.map((type) => <button type="button" role="menuitem" key={type} onClick={() => addLayer(type)}>{SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.find((entry) => entry.id === type)?.name ?? type}</button>)}</div> : null}
        {selectedTarget && isClosableElementLayer(selectedTarget) ? <button type="button" role="menuitem" onClick={() => { closeTarget(selectedTarget); closeMenu(); }}>Close</button> : null}
        <button type="button" role="menuitem" onClick={closeMenu}>Cancel</button>
      </nav> : null}
    </div>
  </section>;
}
