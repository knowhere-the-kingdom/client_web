import { screenStudioElementCatalog, screenStudioPanelCatalog, type ElementDefinition, type PanelDefinition } from "./screen-studio-model.ts";
import { validateElementBehaviorBindings, type ScreenStudioElementBehaviorBinding } from "./screen-studio-behavior-model.ts";
import { DEFAULT_SITE_UNIT_CONTRACT } from "./screen-studio-element-model.ts";

export const SCREEN_STUDIO_ELEMENT_COMPOSITION_CONTRACT = "ScreenStudioElementCompositionV1" as const;
export const SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER = ["Controls", "Text", "Inputs", "Navigation", "Feedback", "Inventory", "Layout/Media"] as const;
export type ScreenStudioElementCompositionCategory = typeof SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER[number];
export const SCREEN_STUDIO_ELEMENT_TAB_ORDER = ["Position", "Size", "Palette", "Effects", "Behaviors"] as const;
export type ScreenStudioElementEditorTab = typeof SCREEN_STUDIO_ELEMENT_TAB_ORDER[number];
export const SCREEN_STUDIO_ELEMENT_EDITOR_MODE = "Editor" as const;
export const SCREEN_STUDIO_ELEMENT_EDITOR_MODES = Object.freeze([SCREEN_STUDIO_ELEMENT_EDITOR_MODE]);
export const SCREEN_STUDIO_ELEMENT_EDITOR_LABEL = "Editor" as const;
export type ScreenStudioElementEditorMode = typeof SCREEN_STUDIO_ELEMENT_EDITOR_MODE;
export const SCREEN_STUDIO_ELEMENT_EDITOR_VIEW_MODES = Object.freeze(["compact", "expanded"] as const);
export type ScreenStudioElementEditorViewMode = typeof SCREEN_STUDIO_ELEMENT_EDITOR_VIEW_MODES[number];
export const DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_VIEW_MODE: ScreenStudioElementEditorViewMode = "compact";
export const SCREEN_STUDIO_ELEMENT_CONTEXT_ACTIONS = Object.freeze(["select", "add-element", "duplicate", "copy", "paste", "remove", "move", "resize", "close", "cancel"] as const);
export type ScreenStudioElementContextAction = typeof SCREEN_STUDIO_ELEMENT_CONTEXT_ACTIONS[number];
export type ScreenStudioElementEditorGridV1 = Readonly<{ unit: number; columns: number; rows: number; gap: number }>;
export const DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID: ScreenStudioElementEditorGridV1 = Object.freeze({ unit: 1, columns: 64, rows: 64, gap: 0.25 });
export const SCREEN_STUDIO_ELEMENT_MAX_DEPTH = 4;
export const SCREEN_STUDIO_ELEMENT_MAX_LAYERS = 64;
export const SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS = Object.freeze({ min: 0, max: 64, step: 0.25 });
export const SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS = Object.freeze(["left", "center", "right"] as const);
export const SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS = Object.freeze(["top", "middle", "bottom"] as const);
export type ScreenStudioElementHorizontalAnchor = typeof SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS[number];
export type ScreenStudioElementVerticalAnchor = typeof SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS[number];
export type ScreenStudioElementAlignmentAnchorsV1 = Readonly<{
  horizontal: ScreenStudioElementHorizontalAnchor;
  vertical: ScreenStudioElementVerticalAnchor;
}>;
export const DEFAULT_SCREEN_STUDIO_ELEMENT_ALIGNMENT: ScreenStudioElementAlignmentAnchorsV1 = Object.freeze({ horizontal: "left", vertical: "top" });
export const SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS = Object.freeze({ min: 1, max: 16384 });
export const SCREEN_STUDIO_ELEMENT_SITE_PIXELS_PER_UNIT = DEFAULT_SITE_UNIT_CONTRACT.pxPerSiteUnit;
export const SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS = Object.freeze({ min: 0.25, max: 4, step: 0.25 });
export const SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS = Object.freeze({ min: -65536, max: 65536 });
export const SCREEN_STUDIO_ELEMENT_ZOOM_PIXEL_SCALE_BOUNDS = Object.freeze({ min: 0.000001, max: 65536 });
export type ScreenStudioElementPointerZoomInputV1 = Readonly<{
  viewportWidthPixels: number;
  viewportHeightPixels: number;
  pointerX: number;
  pointerY: number;
  panX: number;
  panY: number;
  pixelsPerSiteUnit: number;
  zoom: number;
  nextZoom: number;
}>;
export type ScreenStudioElementPointerZoomProjectionV1 = Readonly<{
  zoom: number;
  panX: number;
  panY: number;
  worldXSiteUnits: number;
  worldYSiteUnits: number;
}>;
export type ScreenStudioElementViewportGridProjectionV1 = Readonly<{
  viewportWidthPixels: number;
  viewportHeightPixels: number;
  pixelsPerSiteUnit: typeof SCREEN_STUDIO_ELEMENT_SITE_PIXELS_PER_UNIT;
  scale: number;
  cellPixels: number;
  gapPixels: number;
  contentWidthPixels: number;
  contentHeightPixels: number;
}>;

export type SiteUnitGeometryV1 = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
  margin: number;
  borderWidth: number;
  borderRadius: number;
}>;

export type ScreenStudioElementFamily = "element" | "panel";
export type ScreenStudioElementEffect = Readonly<{
  kind: "none" | "drop-shadow" | "glow";
  color?: ScreenStudioElementColor;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  spread?: number;
  alpha?: number;
}>;

export type ScreenStudioElementColor = Readonly<
  | { kind: "theme-token"; token: string }
  | { kind: "hsla"; hue: number; saturation: number; lightness: number; alpha: number }
>;

export type FusedElementCatalogEntry = Readonly<{
  id: string;
  name: string;
  description: string;
  family: ScreenStudioElementFamily;
  category: ScreenStudioElementCompositionCategory;
  allowedChildren: readonly string[];
  movable: boolean;
  closable: boolean;
  source: "element-catalog" | "panel-catalog" | "creator-inventory-extension";
  referenceElementType?: string;
}>;

const INVENTORY_TYPES = ["slot", "action-slot", "designer-slot", "item-slot", "item-slot-1x1", "item-slot-2x2", "item-slot-2x3", "item-slot-3x3", "grid", "inventory-grid", "equipment-panel"] as const;
export const SCREEN_STUDIO_INVENTORY_ELEMENT_TYPES: readonly string[] = INVENTORY_TYPES;
const INVENTORY_TYPE_SET = new Set<string>(INVENTORY_TYPES);
const CONTAINER_ELEMENT_TYPES = ["container", "stack", "grid", "scroll-region", "modal", "card", "inventory-grid", "equipment-panel"] as const;
const CONTAINER_ELEMENT_TYPE_SET = new Set<string>(CONTAINER_ELEMENT_TYPES);
const STATIC_CONTAINER_TYPES = new Set<string>(CONTAINER_ELEMENT_TYPES);
const ALLOWED_SCRIPT_EVENTS = ["activate", "change", "focus", "dismiss"] as const;
const ALLOWED_SCRIPT_ACTIONS = ["show", "hide", "toggle", "set-state"] as const;

function categoryFor(id: string): ScreenStudioElementCompositionCategory {
  if (INVENTORY_TYPE_SET.has(id)) return "Inventory";
  if (["button", "icon-button", "menu-item"].includes(id)) return "Controls";
  if (["heading", "text", "rich-text", "label"].includes(id)) return "Text";
  if (["checkbox", "select", "toggle", "text-field", "search-field"].includes(id)) return "Inputs";
  if (["link", "tabs"].includes(id)) return "Navigation";
  if (["badge", "status-dot", "progress-bar", "toast", "tooltip"].includes(id)) return "Feedback";
  return "Layout/Media";
}

function asElementEntry(entry: ElementDefinition): FusedElementCatalogEntry {
  const type = entry.id;
  return Object.freeze({ id: type, name: entry.name, description: entry.description, family: "element", category: categoryFor(type), allowedChildren: entry.allowedChildren, movable: true, closable: STATIC_CONTAINER_TYPES.has(type), source: "element-catalog", ...(entry.referenceElementId ? { referenceElementType: entry.referenceElementId } : {}) });
}

function asPanelEntry(entry: PanelDefinition): FusedElementCatalogEntry {
  return Object.freeze({ id: entry.id, name: entry.name, description: entry.description, family: "panel", category: entry.id === "panel-navigation" ? "Navigation" : "Layout/Media", allowedChildren: entry.allowedChildren, movable: true, closable: true, source: "panel-catalog" });
}

export const SCREEN_STUDIO_FUSED_ELEMENT_CATALOG: readonly FusedElementCatalogEntry[] = Object.freeze(([
  ...screenStudioElementCatalog.map(asElementEntry),
  ...screenStudioPanelCatalog.map(asPanelEntry),
  Object.freeze({ id: "equipment-panel", name: "Equipment Panel", description: "A projection-only equipment container; it does not define runtime authority.", family: "element", category: "Inventory", allowedChildren: ["slot", "item-slot"], movable: true, closable: true, source: "creator-inventory-extension" }),
] as FusedElementCatalogEntry[]).sort((a: FusedElementCatalogEntry, b: FusedElementCatalogEntry) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));

const FUSED_BY_ID = new Map(SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.map((entry) => [entry.id, entry]));
export function fusedElementCategory(id: string): ScreenStudioElementCompositionCategory | undefined { return FUSED_BY_ID.get(id)?.category; }
export function isFusedElementType(id: string): boolean { return FUSED_BY_ID.has(id); }
export function fusedElementReferenceOptions(elementType: string): readonly FusedElementCatalogEntry[] {
  if (!FUSED_BY_ID.has(elementType)) return Object.freeze([]);
  return Object.freeze(SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.filter((candidate) => candidate.id !== elementType && !resolveFusedElementReferenceChain(candidate.id).includes(elementType)));
}
export function resolveFusedElementReferenceChain(elementType: string): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = elementType;
  while (current) {
    if (seen.has(current) || !FUSED_BY_ID.has(current)) return Object.freeze([]);
    seen.add(current);
    chain.push(current);
    current = FUSED_BY_ID.get(current)?.referenceElementType;
  }
  return Object.freeze(chain);
}
export function groupFusedElements(): readonly Readonly<{ category: ScreenStudioElementCompositionCategory; elements: readonly FusedElementCatalogEntry[] }>[] {
  return Object.freeze(SCREEN_STUDIO_ELEMENT_CATEGORY_ORDER.map((category) => Object.freeze({ category, elements: Object.freeze(SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.filter((entry) => entry.category === category)) })).filter((group) => group.elements.length > 0));
}

export function isValidSiteUnitValue(value: number): boolean {
  return Number.isFinite(value) && value >= SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.min && value <= SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.max && Math.abs(value / SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step - Math.round(value / SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step)) < 1e-9;
}
const SITE_UNIT_GEOMETRY_KEYS = Object.freeze(["x", "y", "width", "height", "padding", "margin", "borderWidth", "borderRadius"] as const);
export function isValidSiteUnitGeometry(geometry: SiteUnitGeometryV1): boolean {
  try {
    if (!geometry || typeof geometry !== "object" || Array.isArray(geometry) || Object.getPrototypeOf(geometry) !== Object.prototype) return false;
    const keys = Object.keys(geometry);
    if (keys.length !== SITE_UNIT_GEOMETRY_KEYS.length || keys.some((key) => !SITE_UNIT_GEOMETRY_KEYS.includes(key as typeof SITE_UNIT_GEOMETRY_KEYS[number]))) return false;
    return SITE_UNIT_GEOMETRY_KEYS.every((key) => Object.prototype.hasOwnProperty.call(geometry, key) && isValidSiteUnitValue(geometry[key]));
  } catch {
    return false;
  }
}

function roundedProjectionValue(value: number): number {
  return Number(value.toFixed(6));
}

export function clampElementEditorZoom(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const bounded = Math.min(SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.max, Math.max(SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.min, value));
  return roundedProjectionValue(Math.round(bounded / SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.step) * SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.step);
}

const POINTER_ZOOM_INPUT_KEYS = Object.freeze(["viewportWidthPixels", "viewportHeightPixels", "pointerX", "pointerY", "panX", "panY", "pixelsPerSiteUnit", "zoom", "nextZoom"] as const);
export function projectPointerCenteredElementZoom(input: ScreenStudioElementPointerZoomInputV1): ScreenStudioElementPointerZoomProjectionV1 | null {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return null;
    const keys = Object.keys(input);
    if (keys.length !== POINTER_ZOOM_INPUT_KEYS.length || keys.some((key) => !POINTER_ZOOM_INPUT_KEYS.includes(key as typeof POINTER_ZOOM_INPUT_KEYS[number]))) return null;
    if (!POINTER_ZOOM_INPUT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(input, key) && Number.isFinite(input[key]))) return null;
    if (input.viewportWidthPixels < SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.min
      || input.viewportWidthPixels > SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.max
      || input.viewportHeightPixels < SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.min
      || input.viewportHeightPixels > SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.max
      || input.pointerX < 0
      || input.pointerX > input.viewportWidthPixels
      || input.pointerY < 0
      || input.pointerY > input.viewportHeightPixels
      || input.panX < SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.min
      || input.panX > SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.max
      || input.panY < SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.min
      || input.panY > SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.max
      || input.pixelsPerSiteUnit < SCREEN_STUDIO_ELEMENT_ZOOM_PIXEL_SCALE_BOUNDS.min
      || input.pixelsPerSiteUnit > SCREEN_STUDIO_ELEMENT_ZOOM_PIXEL_SCALE_BOUNDS.max
      || input.zoom < SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.min
      || input.zoom > SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.max
      || input.nextZoom < SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.min
      || input.nextZoom > SCREEN_STUDIO_ELEMENT_EDITOR_ZOOM_BOUNDS.max) return null;
    const zoom = clampElementEditorZoom(input.zoom);
    const nextZoom = clampElementEditorZoom(input.nextZoom);
    if (zoom === null || nextZoom === null || zoom !== input.zoom) return null;
    const worldXSiteUnits = (input.pointerX - input.panX) / (input.pixelsPerSiteUnit * zoom);
    const worldYSiteUnits = (input.pointerY - input.panY) / (input.pixelsPerSiteUnit * zoom);
    const panX = input.pointerX - worldXSiteUnits * input.pixelsPerSiteUnit * nextZoom;
    const panY = input.pointerY - worldYSiteUnits * input.pixelsPerSiteUnit * nextZoom;
    if (![worldXSiteUnits, worldYSiteUnits, panX, panY].every(Number.isFinite)
      || panX < SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.min
      || panX > SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.max
      || panY < SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.min
      || panY > SCREEN_STUDIO_ELEMENT_EDITOR_PAN_PIXEL_BOUNDS.max) return null;
    return Object.freeze({
      zoom: nextZoom,
      panX: roundedProjectionValue(panX),
      panY: roundedProjectionValue(panY),
      worldXSiteUnits: roundedProjectionValue(worldXSiteUnits),
      worldYSiteUnits: roundedProjectionValue(worldYSiteUnits),
    });
  } catch {
    return null;
  }
}

function snapToSiteUnitStep(value: number): number {
  return roundedProjectionValue(Math.round(value / SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step) * SCREEN_STUDIO_ELEMENT_SITE_UNIT_BOUNDS.step);
}

export function isValidElementAlignmentAnchors(alignment: ScreenStudioElementAlignmentAnchorsV1): boolean {
  try {
    if (!alignment || typeof alignment !== "object" || Array.isArray(alignment) || Object.getPrototypeOf(alignment) !== Object.prototype) return false;
    const keys = Object.keys(alignment);
    return keys.length === 2
      && keys.includes("horizontal")
      && keys.includes("vertical")
      && SCREEN_STUDIO_ELEMENT_HORIZONTAL_ANCHORS.includes(alignment.horizontal)
      && SCREEN_STUDIO_ELEMENT_VERTICAL_ANCHORS.includes(alignment.vertical);
  } catch {
    return false;
  }
}

export function projectAlignedSiteUnitGeometry(
  geometry: SiteUnitGeometryV1,
  containerWidth: number,
  containerHeight: number,
  alignment: ScreenStudioElementAlignmentAnchorsV1 = DEFAULT_SCREEN_STUDIO_ELEMENT_ALIGNMENT,
): SiteUnitGeometryV1 | null {
  if (!isValidSiteUnitGeometry(geometry)
    || !isValidSiteUnitValue(containerWidth)
    || !isValidSiteUnitValue(containerHeight)
    || containerWidth <= 0
    || containerHeight <= 0
    || geometry.width > containerWidth
    || geometry.height > containerHeight
    || !isValidElementAlignmentAnchors(alignment)) return null;
  const horizontalSpace = containerWidth - geometry.width;
  const verticalSpace = containerHeight - geometry.height;
  const x = alignment.horizontal === "left" ? 0 : alignment.horizontal === "center" ? snapToSiteUnitStep(horizontalSpace / 2) : horizontalSpace;
  const y = alignment.vertical === "top" ? 0 : alignment.vertical === "middle" ? snapToSiteUnitStep(verticalSpace / 2) : verticalSpace;
  const projected = Object.freeze({ ...geometry, x, y });
  return isValidSiteUnitGeometry(projected) && x + geometry.width <= containerWidth && y + geometry.height <= containerHeight ? projected : null;
}

function isValidEditorGrid(grid: ScreenStudioElementEditorGridV1): boolean {
  if (!grid
    || typeof grid !== "object"
    || Array.isArray(grid)
    || Object.getPrototypeOf(grid) !== Object.prototype
    || Object.keys(grid).length !== 4
    || !["unit", "columns", "rows", "gap"].every((key) => Object.prototype.hasOwnProperty.call(grid, key))) return false;
  return Boolean(Number.isInteger(grid.columns)
    && grid.columns > 0
    && grid.columns <= 256
    && Number.isInteger(grid.rows)
    && grid.rows > 0
    && grid.rows <= 256
    && isValidSiteUnitValue(grid.unit)
    && grid.unit > 0
    && isValidSiteUnitValue(grid.gap));
}

export function projectElementViewportGrid(
  viewportWidthPixels: number,
  viewportHeightPixels: number,
  grid: ScreenStudioElementEditorGridV1 = DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID,
): ScreenStudioElementViewportGridProjectionV1 | null {
  try {
    if (!Number.isFinite(viewportWidthPixels)
      || !Number.isFinite(viewportHeightPixels)
      || viewportWidthPixels < SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.min
      || viewportWidthPixels > SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.max
      || viewportHeightPixels < SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.min
      || viewportHeightPixels > SCREEN_STUDIO_ELEMENT_VIEWPORT_PIXEL_BOUNDS.max
      || !isValidEditorGrid(grid)) return null;
    const contentWidthSiteUnits = grid.columns * grid.unit + Math.max(0, grid.columns - 1) * grid.gap;
    const contentHeightSiteUnits = grid.rows * grid.unit + Math.max(0, grid.rows - 1) * grid.gap;
    const scale = Math.min(
      viewportWidthPixels / (contentWidthSiteUnits * SCREEN_STUDIO_ELEMENT_SITE_PIXELS_PER_UNIT),
      viewportHeightPixels / (contentHeightSiteUnits * SCREEN_STUDIO_ELEMENT_SITE_PIXELS_PER_UNIT),
    );
    if (!Number.isFinite(scale) || scale <= 0) return null;
    const pixelsPerScaledSiteUnit = SCREEN_STUDIO_ELEMENT_SITE_PIXELS_PER_UNIT * scale;
    return Object.freeze({
      viewportWidthPixels,
      viewportHeightPixels,
      pixelsPerSiteUnit: SCREEN_STUDIO_ELEMENT_SITE_PIXELS_PER_UNIT,
      scale: roundedProjectionValue(scale),
      cellPixels: roundedProjectionValue(grid.unit * pixelsPerScaledSiteUnit),
      gapPixels: roundedProjectionValue(grid.gap * pixelsPerScaledSiteUnit),
      contentWidthPixels: roundedProjectionValue(contentWidthSiteUnits * pixelsPerScaledSiteUnit),
      contentHeightPixels: roundedProjectionValue(contentHeightSiteUnits * pixelsPerScaledSiteUnit),
    });
  } catch {
    return null;
  }
}

export const SCREEN_STUDIO_ELEMENT_ALLOWED_CHILDREN: Readonly<Record<string, readonly string[]>> = Object.freeze({
  container: Object.freeze(["*"]),
  stack: Object.freeze(["*"]),
  grid: Object.freeze(["*"]),
  "scroll-region": Object.freeze(["*"]),
  modal: Object.freeze(["*"]),
  card: Object.freeze(["*"]),
  "equipment-panel": Object.freeze(["slot", "action-slot", "item-slot", "item-slot-1x1", "item-slot-2x2", "item-slot-2x3", "item-slot-3x3"]),
  "inventory-grid": Object.freeze(["slot", "action-slot", "item-slot", "item-slot-1x1", "item-slot-2x2", "item-slot-2x3", "item-slot-3x3"]),
  "panel-page-header": Object.freeze(["heading", "text", "status-dot", "button"]),
  "panel-manager-list": Object.freeze(["search-field", "select", "table", "list", "inspector-panel"]),
  "panel-editor-form": Object.freeze(["text-field", "select", "checkbox", "toggle", "button", "toast"]),
  "panel-screen-studio-canvas": Object.freeze(["grid", "status-dot", "button", "inspector-panel"]),
});
export type ScreenStudioAddMenuGroupV1 = Readonly<{ group: ScreenStudioElementCompositionCategory; items: readonly Readonly<{ id: string; name: string; description: string }>[] }>;
export type ScreenStudioElementLayerContainerTarget = Readonly<{ id: string | null; elementType: string; family: ScreenStudioElementFamily }>;
export type ScreenStudioAddMenuState = Readonly<{ kind: "groups" }> | Readonly<{ kind: "group-items"; group: ScreenStudioElementCompositionCategory }>;
export const SCREEN_STUDIO_ADD_MENU_STATE_INITIAL: ScreenStudioAddMenuState = Object.freeze({ kind: "groups" });
export type ScreenStudioAddLayerInput = Readonly<{
  layers: readonly ElementLayerV1[];
  parent: ScreenStudioElementLayerContainerTarget;
  childType: string;
  geometry?: Partial<SiteUnitGeometryV1>;
  order?: number;
  id?: string;
  idPrefix?: string;
}>;

function layerIdSet(layers: readonly ElementLayerV1[], output = new Set<string>()): Set<string> {
  for (const layer of layers) {
    if (layer?.id) output.add(layer.id);
    if (layer?.children) layerIdSet(layer.children, output);
  }
  return output;
}
function nextLayerId(baseId: string, layers: readonly ElementLayerV1[]): string {
  const ids = layerIdSet(layers);
  const normalizedBase = baseId.trim() || "local-layer";
  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${normalizedBase}-${index}`;
    if (!ids.has(candidate)) return candidate;
  }
  return `local-layer-${String(layers.length + 1).padStart(6, "0")}`;
}
function insertLayerInOrder(children: readonly ElementLayerV1[], layer: ElementLayerV1, order: number): readonly ElementLayerV1[] {
  const head = children.slice(0, order);
  const tail = children.slice(order);
  return Object.freeze([...head, layer, ...tail]);
}
function normalizeLayerOrder(children: readonly ElementLayerV1[]): readonly ElementLayerV1[] {
  const normalized = children.map((layer, index) => {
    const nextChildren = normalizeLayerOrder(layer.children);
    if (layer.order === index && layer.children === nextChildren) return layer;
    return Object.freeze({ ...layer, order: index, children: nextChildren });
  });
  return Object.freeze(normalized);
}
function isContainerType(elementType: string): boolean { return CONTAINER_ELEMENT_TYPE_SET.has(elementType); }
export function canLayerHostChildren(layer: Pick<ElementLayerV1, "elementType" | "family"> | null): boolean {
  if (!layer) return false;
  const entry = FUSED_BY_ID.get(layer.elementType);
  return Boolean(entry && entry.family === layer.family && (entry.family === "panel" || isContainerType(entry.id)));
}
function childTypesForParentType(elementType: string): readonly string[] {
  const allowed = SCREEN_STUDIO_ELEMENT_ALLOWED_CHILDREN[elementType] ?? FUSED_BY_ID.get(elementType)?.allowedChildren;
  if (!allowed) return Object.freeze([]);
  if (allowed.includes("*")) return SCREEN_STUDIO_FUSED_ELEMENT_CATALOG.map((entry) => entry.id);
  return Object.freeze([...allowed]);
}
export function getAllowedChildTypesForLayer(layer: Pick<ElementLayerV1, "elementType" | "family"> | null): readonly string[] {
  if (!layer || !canLayerHostChildren(layer)) return Object.freeze([]);
  return childTypesForParentType(layer.elementType);
}
export function buildElementAddMenuGroupsForParent(parent: Pick<ElementLayerV1, "elementType" | "family"> | null): readonly ScreenStudioAddMenuGroupV1[] {
  const allowed = new Set(getAllowedChildTypesForLayer(parent));
  const groups = groupFusedElements().map((group) => Object.freeze({
    group: group.category,
    items: Object.freeze(group.elements.filter((entry) => allowed.has(entry.id)).map((entry) => Object.freeze({
      id: entry.id,
      name: entry.name,
      description: entry.description,
    }))),
  }));
  return Object.freeze(groups.filter((group) => group.items.length > 0));
}
export function openAddMenuGroup(state: ScreenStudioAddMenuState, groups: readonly ScreenStudioAddMenuGroupV1[], group: string): ScreenStudioAddMenuState {
  if (state.kind !== "groups") return state;
  return groups.some((entry) => entry.group === group)
    ? Object.freeze({ kind: "group-items", group: group as ScreenStudioElementCompositionCategory })
    : SCREEN_STUDIO_ADD_MENU_STATE_INITIAL;
}
export function selectAddMenuType(state: ScreenStudioAddMenuState, groups: readonly ScreenStudioAddMenuGroupV1[], type: string): string | null {
  if (state.kind !== "group-items") return null;
  const group = groups.find((entry) => entry.group === state.group);
  return group?.items.some((item) => item.id === type) ? type : null;
}
export function resetAddMenuState(): ScreenStudioAddMenuState { return SCREEN_STUDIO_ADD_MENU_STATE_INITIAL; }
export function addElementLayerUnderContainer(input: ScreenStudioAddLayerInput): ElementLayerUpdateResult {
  let fallbackLayers: readonly ElementLayerV1[] = Object.freeze([]);
  try {
    if (!input || typeof input !== "object" || !Array.isArray(input.layers)) {
      return Object.freeze({ ok: false, layers: fallbackLayers, error: "layers must be an array" });
    }
    const { layers, parent, childType, geometry, order, id, idPrefix } = input;
    fallbackLayers = layers;
    const initial = validateElementLayers(layers);
    if (initial.length) return Object.freeze({ ok: false, layers, error: initial[0] });
    if (!parent || typeof parent !== "object") return Object.freeze({ ok: false, layers, error: "parent target is required" });
    if (!safeIdentifier(childType)) return Object.freeze({ ok: false, layers, error: "child type must be a safe identifier" });
    const catalogEntry = FUSED_BY_ID.get(childType);
    if (!catalogEntry) return Object.freeze({ ok: false, layers, error: `unknown child type: ${childType}` });
    const parentLayer = parent.id === null
      ? Object.freeze({ elementType: parent.elementType, family: parent.family, children: Object.freeze([]) } as Pick<ElementLayerV1, "elementType" | "family" | "children">)
      : findElementLayerById(layers, parent.id);
    if (!parentLayer) return Object.freeze({ ok: false, layers, error: `parent not found: ${parent.id}` });
    if (!canLayerHostChildren(parentLayer)) return Object.freeze({ ok: false, layers, error: `parent ${parent.id} cannot host children` });
    if (parent.elementType !== parentLayer.elementType || parent.family !== parentLayer.family) return Object.freeze({ ok: false, layers, error: "parent route and stored tree are not aligned" });
    const allowed = getAllowedChildTypesForLayer(parentLayer);
    if (!allowed.includes(childType)) return Object.freeze({ ok: false, layers, error: `child type ${childType} is not allowed under ${parentLayer.elementType}` });
    const explicitId = id ? (safeIdentifier(id) ? id : "") : "";
    if (id && !explicitId) return Object.freeze({ ok: false, layers, error: "child id must be a safe identifier" });
    const targetId = explicitId || nextLayerId(idPrefix ? `${idPrefix}-${childType}` : `local-${childType}`, layers);
    const parentChildren = parent.id === null ? layers : findElementLayerById(layers, parent.id)?.children ?? [];
    const targetOrder = order === undefined ? parentChildren.length : order;
    if (!Number.isInteger(targetOrder)) return Object.freeze({ ok: false, layers, error: "layer order must be an integer" });
    if (targetOrder < 0 || targetOrder > parentChildren.length) return Object.freeze({ ok: false, layers, error: "layer order is outside the sibling range" });
    const child: ElementLayerV1 = {
      id: targetId,
      elementType: childType,
      family: catalogEntry.family,
      geometry: Object.freeze({ ...defaultGeometry, ...geometry }),
      order: targetOrder,
      children: Object.freeze([]),
    };
    if (parent.id === null) {
      const updatedRoot = normalizeLayerOrder(insertLayerInOrder(layers, child, targetOrder));
      const depthCheck = validateElementLayers(updatedRoot);
      if (depthCheck.length) return Object.freeze({ ok: false, layers, error: depthCheck[0] });
      return Object.freeze({ ok: true, layers: updatedRoot });
    }
    const updated = updateElementLayerById(layers, parent.id, (layer) => Object.freeze({ ...layer, children: normalizeLayerOrder(insertLayerInOrder(layer.children, child, targetOrder)) }));
    if (!updated.ok) return updated;
    return Object.freeze({
      ok: true,
      layers: normalizeLayerOrder(updated.layers),
    });
  } catch {
    return Object.freeze({ ok: false, layers: fallbackLayers, error: "layer add rejected" });
  }
}

export type ElementLayerV1 = Readonly<{
  id: string;
  elementType: string;
  family: ScreenStudioElementFamily;
  geometry: SiteUnitGeometryV1;
  order: number;
  children: readonly ElementLayerV1[];
}>;

function childAllowed(parentType: string, childType: string): boolean {
  const allowed = childTypesForParentType(parentType);
  return Boolean(allowed?.includes("*") || allowed?.includes(childType));
}

export function isMovableElementLayer(layer: Pick<ElementLayerV1, "elementType" | "family">): boolean {
  const entry = FUSED_BY_ID.get(layer.elementType);
  return Boolean(entry && entry.family === layer.family);
}
export function isClosableElementLayer(layer: Pick<ElementLayerV1, "elementType" | "family">): boolean {
  const entry = FUSED_BY_ID.get(layer.elementType);
  return Boolean(entry && entry.family === layer.family && (entry.family === "panel" || STATIC_CONTAINER_TYPES.has(entry.id)));
}
export function isReparentableElementLayer(layer: Pick<ElementLayerV1, "elementType" | "family">): boolean {
  return isClosableElementLayer(layer);
}
export function isElementLayerDropTarget(layer: Pick<ElementLayerV1, "elementType" | "family"> | null): boolean {
  return canLayerHostChildren(layer);
}
export function snapElementSiteUnit(value: number, grid: ScreenStudioElementEditorGridV1 = DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID): number {
  if (!Number.isFinite(value) || !Number.isFinite(grid.unit) || grid.unit <= 0 || !isValidSiteUnitValue(grid.unit)) throw new RangeError("Invalid Editor grid contract.");
  return Math.max(0, Math.round(value / grid.unit) * grid.unit);
}
export function isElementEditorActionAllowed(layer: Pick<ElementLayerV1, "elementType" | "family"> | null, action: ScreenStudioElementContextAction): boolean {
  if (action === "select" || action === "copy" || action === "cancel") return Boolean(layer);
  if (action === "add-element" || action === "paste") return Boolean(layer && (layer.family === "panel" || STATIC_CONTAINER_TYPES.has(layer.elementType)));
  if (action === "move" || action === "resize") return Boolean(layer && isMovableElementLayer(layer));
  if (action === "duplicate") return Boolean(layer && isClosableElementLayer(layer));
  if (action === "remove") return Boolean(layer);
  if (action === "close") return Boolean(layer && isClosableElementLayer(layer));
  return false;
}
export type ScreenStudioElementEditorStateV1 = Readonly<{
  mode: ScreenStudioElementEditorMode;
  grid: ScreenStudioElementEditorGridV1;
  selectedLayerId: string | null;
  heldLayerId: string | null;
  contextMenu: Readonly<{ open: boolean; x: number; y: number; layerId: string | null }>;
}>;
export const DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_STATE: ScreenStudioElementEditorStateV1 = Object.freeze({ mode: SCREEN_STUDIO_ELEMENT_EDITOR_MODE, grid: DEFAULT_SCREEN_STUDIO_ELEMENT_EDITOR_GRID, selectedLayerId: null, heldLayerId: null, contextMenu: Object.freeze({ open: false, x: 0, y: 0, layerId: null }) });

const ELEMENT_LAYER_KEYS = Object.freeze(["id", "elementType", "family", "geometry", "order", "children"] as const);
const ELEMENT_LAYER_KEY_SET = new Set<string>(ELEMENT_LAYER_KEYS);

export function validateElementLayers(root: readonly ElementLayerV1[]): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const objects = new WeakSet<object>();
  let count = 0;
  const visit = (layers: readonly ElementLayerV1[], parentType: string | null, depth: number): void => {
    if (!Array.isArray(layers)) { errors.push("layers must be an array"); return; }
    if (depth > SCREEN_STUDIO_ELEMENT_MAX_DEPTH) errors.push("nesting depth exceeds the bounded maximum");
    for (const [siblingIndex, layer] of layers.entries()) {
      count += 1;
      if (count > SCREEN_STUDIO_ELEMENT_MAX_LAYERS) errors.push("layer count exceeds the bounded maximum");
      if (!layer || typeof layer !== "object") { errors.push("layer must be an object"); continue; }
      if (objects.has(layer)) { errors.push("layer cycle detected"); continue; }
      objects.add(layer);
      const prototype = Object.getPrototypeOf(layer);
      if (prototype !== Object.prototype && prototype !== null) errors.push("layer must be a plain object");
      const unknownKeys = Object.keys(layer).filter((key) => !ELEMENT_LAYER_KEY_SET.has(key));
      if (unknownKeys.length > 0) errors.push(`unknown layer keys: ${unknownKeys.sort().join(",")}`);
      if (!safeIdentifier(layer.id)) errors.push("layer id must be a safe stable identifier");
      else if (ids.has(layer.id)) errors.push(`duplicate layer id: ${layer.id}`);
      else ids.add(layer.id);
      if (!isFusedElementType(layer.elementType)) errors.push(`unknown layer type: ${layer.elementType}`);
      if (layer.family !== FUSED_BY_ID.get(layer.elementType)?.family) errors.push(`layer family mismatch: ${layer.id}`);
      if (!isValidSiteUnitGeometry(layer.geometry)) errors.push(`invalid site-unit geometry: ${layer.id}`);
      if (!Number.isInteger(layer.order) || layer.order !== siblingIndex) errors.push(`invalid sibling order: ${layer.id}`);
      if (parentType && !childAllowed(parentType, layer.elementType)) errors.push(`child type ${layer.elementType} is not allowed inside ${parentType}`);
      if (!Array.isArray(layer.children)) {
        errors.push(`layer children must be an array: ${layer.id}`);
        continue;
      }
      if (layer.children.length > 0 && !canLayerHostChildren(layer)) errors.push(`parent layer cannot contain children: ${layer.id}`);
      visit(layer.children, layer.elementType, depth + 1);
    }
  };
  try { visit(root, null, 1); } catch { errors.push("layer projection is malformed"); }
  return Object.freeze(errors);
}

export function findElementLayerById(layers: readonly ElementLayerV1[], id: string): ElementLayerV1 | null {
  if (!safeIdentifier(id) || validateElementLayers(layers).length > 0) return null;
  const visit = (current: readonly ElementLayerV1[]): ElementLayerV1 | null => {
    for (const layer of current) {
      if (layer.id === id) return layer;
      const child = visit(layer.children);
      if (child) return child;
    }
    return null;
  };
  return visit(layers);
}

export type ElementLayerUpdateResult = Readonly<
  | { ok: true; layers: readonly ElementLayerV1[] }
  | { ok: false; layers: readonly ElementLayerV1[]; error: string }
>;

export function updateElementLayerById(
  layers: readonly ElementLayerV1[],
  id: string,
  update: (layer: ElementLayerV1) => ElementLayerV1,
): ElementLayerUpdateResult {
  const initialErrors = validateElementLayers(layers);
  if (!safeIdentifier(id)) return Object.freeze({ ok: false, layers, error: "layer ID must be a safe stable identifier" });
  if (initialErrors.length) return Object.freeze({ ok: false, layers, error: initialErrors[0] });
  if (!findElementLayerById(layers, id)) return Object.freeze({ ok: false, layers, error: `layer not found: ${id}` });
  let updated = false;
  const visit = (current: readonly ElementLayerV1[]): readonly ElementLayerV1[] => current.map((layer) => {
    if (layer.id === id) { updated = true; return update(layer); }
    return Object.freeze({ ...layer, children: visit(layer.children) });
  });
  let next: readonly ElementLayerV1[];
  try { next = Object.freeze(visit(layers)); } catch { return Object.freeze({ ok: false, layers, error: "layer update rejected" }); }
  const errors = validateElementLayers(next);
  if (!updated || errors.length) return Object.freeze({ ok: false, layers, error: errors[0] ?? "layer update rejected" });
  return Object.freeze({ ok: true, layers: next });
}

export type ElementTabDraftV1 = Readonly<
  | { tab: "Position"; x: number; y: number; parentId?: string }
  | { tab: "Size"; width: number; height: number; padding: number; margin: number; borderWidth: number; borderRadius: number }
  | { tab: "Palette"; color: ScreenStudioElementColor; borderColor: ScreenStudioElementColor }
  | { tab: "Effects"; effect: ScreenStudioElementEffect }
  | { tab: "Behaviors"; bindings: readonly ScreenStudioElementBehaviorBinding[] }
>;
export const SCREEN_STUDIO_ELEMENT_SCRIPT_EVENTS: readonly string[] = ALLOWED_SCRIPT_EVENTS;
export const SCREEN_STUDIO_ELEMENT_SCRIPT_ACTIONS: readonly string[] = ALLOWED_SCRIPT_ACTIONS;

function safeIdentifier(value: unknown): value is string { return typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value); }
function validColor(color: ScreenStudioElementColor): boolean {
  if (!color || typeof color !== "object") return false;
  if (color.kind === "theme-token") return typeof color.token === "string" && /^theme\.[a-z][a-z0-9-]{0,31}$/.test(color.token);
  return color.kind === "hsla" && Number.isFinite(color.hue) && color.hue >= 0 && color.hue <= 360 && Number.isFinite(color.saturation) && color.saturation >= 0 && color.saturation <= 100 && Number.isFinite(color.lightness) && color.lightness >= 0 && color.lightness <= 100 && Number.isFinite(color.alpha) && color.alpha >= 0 && color.alpha <= 1;
}
export function validateElementTabDraft(tab: ElementTabDraftV1): readonly string[] {
  const errors: string[] = [];
  if (!tab || !SCREEN_STUDIO_ELEMENT_TAB_ORDER.includes(tab.tab)) return Object.freeze(["unknown editor tab"]);
  if (tab.tab === "Position" && (![tab.x, tab.y].every(isValidSiteUnitValue) || (tab.parentId !== undefined && !safeIdentifier(tab.parentId)))) errors.push("position must use bounded site units and a safe parent ID");
  if (tab.tab === "Size" && ![tab.width, tab.height, tab.padding, tab.margin, tab.borderWidth, tab.borderRadius].every(isValidSiteUnitValue)) errors.push("size must use bounded site units");
  if (tab.tab === "Palette" && (!validColor(tab.color) || !validColor(tab.borderColor))) errors.push("palette contains an invalid color");
  if (tab.tab === "Effects" && (!tab.effect || ![tab.effect.offsetX ?? 0, tab.effect.offsetY ?? 0, tab.effect.blur ?? 0, tab.effect.spread ?? 0, tab.effect.alpha ?? 0].every((value) => Number.isFinite(value) && value >= -64 && value <= 64) || !["none", "drop-shadow", "glow"].includes(tab.effect.kind) || (tab.effect.color !== undefined && !validColor(tab.effect.color)))) errors.push("effects are outside the bounded presentation contract");
  if (tab.tab === "Behaviors") errors.push(...validateElementBehaviorBindings(tab.bindings));
  return Object.freeze(errors);
}

export type LegacyPanelDraftInput = Readonly<{
  id: string;
  name: string;
  description: string;
  allowedChildren: readonly string[];
  revision?: number;
  audit?: Readonly<{ owner: string; createdAt: string; updatedAt: string }>;
  localDraft?: boolean;
  geometry?: Partial<SiteUnitGeometryV1>;
}>;
export type FusedElementDraftV1 = Readonly<{
  contract: typeof SCREEN_STUDIO_ELEMENT_COMPOSITION_CONTRACT;
  id: string;
  name: string;
  description: string;
  elementType: string;
  family: ScreenStudioElementFamily;
  category: ScreenStudioElementCompositionCategory;
  referenceElementType?: string;
  overrideKeys: readonly ElementDraftOverrideKey[];
  geometry: SiteUnitGeometryV1;
  itemGrid?: Readonly<{ width: number; height: number }>;
  layers: readonly ElementLayerV1[];
  tabs: Readonly<Record<ScreenStudioElementEditorTab, ElementTabDraftV1>>;
  revision: number;
  audit: Readonly<{ owner: string; createdAt: string; updatedAt: string }>;
  localDraft: boolean;
  migratedFromPanelId?: string;
}>;
export const SCREEN_STUDIO_ELEMENT_OVERRIDE_KEYS = Object.freeze(["name", "description", "geometry", "itemGrid", "layers", "Position", "Size", "Palette", "Effects", "Behaviors"] as const);
export type ElementDraftOverrideKey = typeof SCREEN_STUDIO_ELEMENT_OVERRIDE_KEYS[number];

const defaultGeometry = Object.freeze({ x: 0, y: 0, width: 8, height: 4, padding: 0, margin: 0, borderWidth: 0, borderRadius: 0 });
const defaultAudit = Object.freeze({ owner: "Creator", createdAt: "local", updatedAt: "local" });
function defaultTabs(geometry: SiteUnitGeometryV1): Readonly<Record<ScreenStudioElementEditorTab, ElementTabDraftV1>> {
  return Object.freeze({ Position: Object.freeze({ tab: "Position" as const, x: geometry.x, y: geometry.y }), Size: Object.freeze({ tab: "Size" as const, width: geometry.width, height: geometry.height, padding: geometry.padding, margin: geometry.margin, borderWidth: geometry.borderWidth, borderRadius: geometry.borderRadius }), Palette: Object.freeze({ tab: "Palette" as const, color: Object.freeze({ kind: "theme-token" as const, token: "theme.surface" }), borderColor: Object.freeze({ kind: "theme-token" as const, token: "theme.border" }) }), Effects: Object.freeze({ tab: "Effects" as const, effect: Object.freeze({ kind: "none" as const }) }), Behaviors: Object.freeze({ tab: "Behaviors" as const, bindings: Object.freeze([]) }) });
}
export type CreateFusedElementDraftOptions = Readonly<{ id?: string; name?: string; description?: string; geometry?: Partial<SiteUnitGeometryV1>; itemGrid?: Readonly<{ width: number; height: number }>; referenceElementType?: string; overrideKeys?: readonly ElementDraftOverrideKey[]; localDraft?: boolean; updatedAt?: string }>;
export function createFusedElementDraft(elementType: string, options: CreateFusedElementDraftOptions = {}): FusedElementDraftV1 {
  const entry = FUSED_BY_ID.get(elementType);
  if (!entry) throw new RangeError(`Unknown fused Element type: ${elementType}`);
  const slotSize = elementType === "slot" || elementType === "item-slot" || elementType === "item-slot-1x1" ? { width: 1, height: 1 } : elementType === "action-slot" || elementType === "designer-slot" || elementType === "item-slot-2x2" ? { width: 2, height: 2 } : elementType === "item-slot-2x3" ? { width: 2, height: 3 } : elementType === "item-slot-3x3" ? { width: 3, height: 3 } : {};
  const geometry = Object.freeze({ ...defaultGeometry, ...slotSize, ...options.geometry });
  const referenceElementType = options.referenceElementType ?? entry.referenceElementType;
  const itemGridValue = options.itemGrid ?? (Object.keys(slotSize).length ? slotSize as { width: number; height: number } : undefined);
  const itemGrid = itemGridValue ? Object.freeze(itemGridValue) : undefined;
  const inheritedOverrideDefaults = referenceElementType
    ? (["name", "description", ...(options.geometry !== undefined ? ["geometry"] as const : []), ...(options.itemGrid !== undefined ? ["itemGrid"] as const : []), ...(elementType === "action-slot" || elementType === "designer-slot" ? ["Behaviors"] as const : [])] satisfies ElementDraftOverrideKey[])
    : SCREEN_STUDIO_ELEMENT_OVERRIDE_KEYS;
  const overrideKeys: readonly ElementDraftOverrideKey[] = Object.freeze(options.overrideKeys ?? inheritedOverrideDefaults);
  const tabs = defaultTabs(geometry);
  const behaviorBindings = elementType === "action-slot" ? Object.freeze([{ id: "left-action-activate", triggerId: "input-left-hand", behaviorId: "activate" }, { id: "right-action-menu", triggerId: "input-right-hand", behaviorId: "open-context-menu" }]) : elementType === "designer-slot" ? Object.freeze([{ id: "left-action-return", triggerId: "input-left-hand", behaviorId: "return-to-game" }, { id: "right-action-menu", triggerId: "input-right-hand", behaviorId: "open-context-menu" }]) : Object.freeze([]);
  const draft = Object.freeze({ contract: SCREEN_STUDIO_ELEMENT_COMPOSITION_CONTRACT, id: options.id ?? `draft-${elementType}`, name: options.name ?? `Unnamed ${entry.name}`, description: options.description ?? entry.description, elementType, family: entry.family, category: entry.category, ...(referenceElementType ? { referenceElementType } : {}), overrideKeys, geometry, ...(itemGrid === undefined ? {} : { itemGrid }), layers: Object.freeze([]), tabs: Object.freeze({ ...tabs, Behaviors: Object.freeze({ tab: "Behaviors" as const, bindings: behaviorBindings }) }), revision: 1, audit: Object.freeze({ ...defaultAudit, ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}) }), localDraft: options.localDraft ?? true });
  const errors = validateElementDraft(draft);
  if (errors.length) throw new RangeError(`Invalid fused Element draft: ${errors[0]}`);
  return draft;
}
export function migratePanelRecordToElement(record: LegacyPanelDraftInput): FusedElementDraftV1 {
  const source = screenStudioPanelCatalog.find((entry) => entry.id === record.id);
  if (!source) throw new RangeError(`Unknown legacy Panel record: ${record.id}`);
  const geometry = Object.freeze({ ...defaultGeometry, ...record.geometry });
  return Object.freeze({ ...createFusedElementDraft(record.id, { id: record.id, name: record.name, description: record.description, geometry, localDraft: record.localDraft ?? false }), revision: record.revision ?? 1, audit: record.audit ?? defaultAudit, migratedFromPanelId: record.id });
}

export type AutosaveResult = Readonly<{ ok: true; draft: FusedElementDraftV1 }> | Readonly<{ ok: false; draft: FusedElementDraftV1; error: string }>;
export function autosaveElementDraft(draft: FusedElementDraftV1, change: Readonly<Partial<Pick<FusedElementDraftV1, "name" | "description" | "elementType" | "family" | "category" | "referenceElementType" | "overrideKeys" | "geometry" | "itemGrid" | "layers" | "tabs">>>, updatedAt: string): AutosaveResult {
  const changedKeys: ElementDraftOverrideKey[] = [];
  if (change.name !== undefined) changedKeys.push("name");
  if (change.description !== undefined) changedKeys.push("description");
  if (change.geometry !== undefined) changedKeys.push("geometry");
  if (change.itemGrid !== undefined) changedKeys.push("itemGrid");
  if (change.layers !== undefined) changedKeys.push("layers");
  if (change.tabs !== undefined) for (const key of SCREEN_STUDIO_ELEMENT_TAB_ORDER) if (change.tabs[key] !== draft.tabs[key]) changedKeys.push(key);
  const candidate = Object.freeze({ ...draft, ...change, overrideKeys: Object.freeze([...new Set([...(change.overrideKeys ?? draft.overrideKeys), ...changedKeys])]), revision: draft.revision + 1, audit: Object.freeze({ ...draft.audit, updatedAt }), localDraft: true });
  const errors = [...validateElementDraft(candidate)];
  return errors.length ? Object.freeze({ ok: false, draft, error: errors[0] }) : Object.freeze({ ok: true, draft: candidate });
}
export function validateElementDraft(draft: FusedElementDraftV1): readonly string[] {
  const errors: string[] = [];
  if (!draft || draft.contract !== SCREEN_STUDIO_ELEMENT_COMPOSITION_CONTRACT) errors.push("unsupported element composition contract");
  if (!isFusedElementType(draft.elementType)) errors.push("unknown element type");
  if (draft.family !== FUSED_BY_ID.get(draft.elementType)?.family) errors.push("element family does not match the catalog");
  if (draft.category !== fusedElementCategory(draft.elementType)) errors.push("element category does not match the catalog");
  if (!Array.isArray(draft.overrideKeys) || new Set(draft.overrideKeys).size !== draft.overrideKeys.length || draft.overrideKeys.some((key) => !SCREEN_STUDIO_ELEMENT_OVERRIDE_KEYS.includes(key))) errors.push("element overrides must use the closed inheritance allowlist");
  if (draft.referenceElementType !== undefined && (!isFusedElementType(draft.referenceElementType) || draft.referenceElementType === draft.elementType || resolveFusedElementReferenceChain(draft.referenceElementType).includes(draft.elementType))) errors.push("element reference must be known and acyclic");
  if (!isValidSiteUnitGeometry(draft.geometry)) errors.push("geometry must use bounded site units");
  const slotDerived = resolveFusedElementReferenceChain(draft.elementType).includes("slot") || draft.referenceElementType !== undefined && resolveFusedElementReferenceChain(draft.referenceElementType).includes("slot");
  if (slotDerived && draft.referenceElementType === undefined && (!draft.itemGrid || !isValidSiteUnitValue(draft.itemGrid.width) || !isValidSiteUnitValue(draft.itemGrid.height) || draft.itemGrid.width < 1 || draft.itemGrid.height < 1)) errors.push("slot item-grid dimensions must use bounded positive site units");
  if (!slotDerived && draft.itemGrid !== undefined) errors.push("item-grid dimensions are only valid for slot elements");
  errors.push(...validateElementLayers(draft.layers));
  for (const tab of Object.values(draft.tabs)) errors.push(...validateElementTabDraft(tab));
  return Object.freeze(errors);
}

export function resolveElementDraftInheritance(draft: FusedElementDraftV1, availableDrafts: readonly FusedElementDraftV1[] = []): FusedElementDraftV1 {
  const resolve = (current: FusedElementDraftV1, seen: Set<string>): FusedElementDraftV1 => {
    const reference = current.referenceElementType;
    if (!reference || seen.has(reference)) return current;
    const base = availableDrafts.find((candidate) => candidate.elementType === reference) ?? createFusedElementDraft(reference, { id: `template-${reference}`, localDraft: false });
    const inherited = resolve(base, new Set([...seen, reference]));
    const overrides = new Set(current.overrideKeys);
    const tabs = Object.freeze(Object.fromEntries(SCREEN_STUDIO_ELEMENT_TAB_ORDER.map((key) => [key, overrides.has(key) ? current.tabs[key] : inherited.tabs[key]])) as unknown as FusedElementDraftV1["tabs"]);
    return Object.freeze({ ...inherited, ...current, name: overrides.has("name") ? current.name : inherited.name, description: overrides.has("description") ? current.description : inherited.description, geometry: overrides.has("geometry") ? current.geometry : inherited.geometry, itemGrid: overrides.has("itemGrid") ? current.itemGrid : inherited.itemGrid, layers: overrides.has("layers") ? current.layers : inherited.layers, tabs });
  };
  return resolve(draft, new Set([draft.elementType]));
}
