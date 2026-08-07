import type { AuthorizationCapability } from "../api/gateway-contract.ts";

export type ScreenLifecycle = "draft" | "review" | "published" | "archived";
export type ScreenRuntimeMode = "hud" | "page";
export type ScreenPageTemplate = "screen-studio-editor" | "manager-list" | "editor" | "settings" | "custom";
export type ScreenNodeKind = "element" | "panel" | "page";
export type ScreenStatus = "planned" | "ready" | "started" | "in-progress" | "blocked" | "review" | "complete";

export type ScreenAudit = Readonly<{
  owner: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ScreenRevision = Readonly<{
  revision: number;
  lifecycle: ScreenLifecycle;
  contentHash?: string;
  basedOnRevision?: number;
  savedAt?: string;
  savedBy?: string;
}>;

export type PermissionGate = Readonly<{
  id: string;
  requiredCapability?: AuthorizationCapability;
  requiredRole?: string;
  mode: "all" | "any";
  deniedMessage: string;
}>;

export type LayoutGrid = Readonly<{
  unit: number;
  columns: number;
  rows: number;
  gap: number;
  breakpoints: readonly Readonly<{ id: string; minWidth: number; columns: number }>[];
}>;

export type Placement = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  parentId?: string;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
}>;

export type ElementProperty = Readonly<{
  id: string;
  type: "string" | "number" | "boolean" | "enum" | "color" | "asset";
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: readonly string[];
}>;

export const SCREEN_STUDIO_CONTROL_FUNCTIONS = Object.freeze([
  "none", "activate", "open-context-menu", "navigate-workspace", "set-value", "toggle", "submit", "dismiss", "apply", "restore-defaults",
] as const);
export type ScreenStudioControlFunctionId = typeof SCREEN_STUDIO_CONTROL_FUNCTIONS[number];
export type ScreenStudioElementSemantics = "container" | "trigger" | "content";
export type ScreenStudioBorder = Readonly<{ widthUnits: number; radiusUnits: number }>;
export type ScreenStudioControlFunction = Readonly<{
  functionId: ScreenStudioControlFunctionId;
  targetId?: string;
  value?: string | number | boolean;
}>;
export type ScreenStudioControlFunctions = Readonly<{
  leftClick: ScreenStudioControlFunction;
  rightClick: ScreenStudioControlFunction;
}>;

export type ElementDefinition = Readonly<{
  id: string;
  slug: string;
  version: number;
  lifecycle: ScreenLifecycle;
  status: ScreenStatus;
  name: string;
  description: string;
  kind: "element";
  semantics: ScreenStudioElementSemantics;
  border: ScreenStudioBorder;
  controlFunctions: ScreenStudioControlFunctions | null;
  allowedChildren: readonly string[];
  properties: readonly ElementProperty[];
  events: readonly ("activate" | "change" | "submit" | "dismiss")[];
  requiredAccessibleName: boolean;
  placement: Readonly<{ minWidth: number; minHeight: number; maxWidth?: number; maxHeight?: number }>;
  themeTokens: readonly string[];
  presentationAuthority: "projection-only";
  referenceElementId?: string;
  gate?: PermissionGate;
  audit: ScreenAudit;
}>;

export type PanelDefinition = Readonly<{
  id: string;
  slug: string;
  version: number;
  lifecycle: ScreenLifecycle;
  status: ScreenStatus;
  name: string;
  description: string;
  kind: "panel";
  semantics: "container";
  border: ScreenStudioBorder;
  allowedChildren: readonly string[];
  gate?: PermissionGate;
  audit: ScreenAudit;
}>;

export type ScreenNode = Readonly<{
  id: string;
  kind: ScreenNodeKind;
  definitionId: string;
  placement: Placement;
  properties: Readonly<Record<string, string | number | boolean>>;
  gate?: PermissionGate;
}>;

export type PageRecord = Readonly<{
  id: string;
  slug: string;
  version: number;
  lifecycle: ScreenLifecycle;
  status: ScreenStatus;
  displayName: string;
  description: string;
  runtimeMode: ScreenRuntimeMode;
  template: ScreenPageTemplate;
  grid: LayoutGrid;
  nodes: readonly ScreenNode[];
  gate?: PermissionGate;
  revision: ScreenRevision;
  audit: ScreenAudit;
}>;

export const SCREEN_RECORD_TYPES = Object.freeze(["hud", "workspace", "system"] as const);
export type ScreenRecordType = typeof SCREEN_RECORD_TYPES[number];
export const SCREEN_STUDIO_SCREEN_SCHEMA_VERSION = 1 as const;
export const SCREEN_RECORD_ROLES = Object.freeze(["player", "administrator", "world-designer"] as const);
export type ScreenRecordRole = typeof SCREEN_RECORD_ROLES[number];
export const SCREEN_RECORD_TAGS = Object.freeze([
  "game", "hud", "character", "spirit", "system", "login", "workspace", "account", "knowhere", "portal", "creator",
  "manager-list", "editor", "settings", "custom", "screen-studio-editor",
] as const);
export type ScreenRecordTag = typeof SCREEN_RECORD_TAGS[number];

export const SCREEN_GROUP_IDS = Object.freeze([
  "game-screens", "game-character-hud", "game-spirit-hud",
  "workspace-screens", "workspace-account", "workspace-character", "workspace-knowhere",
  "workspace-knowhere-login", "workspace-knowhere-manager", "workspace-knowhere-editor", "workspace-knowhere-designer",
  "workspace-portal", "workspace-creator", "workspace-creator-screen-studio", "workspace-creator-maker-lab", "workspace-creator-world-creator",
] as const);
export type ScreenGroupId = typeof SCREEN_GROUP_IDS[number];

export type ScreenGroup = Readonly<{
  id: ScreenGroupId;
  label: string;
  parentId: ScreenGroupId | null;
  order: number;
}>;

export type ScreenElementHierarchyNode = Readonly<{
  id: string;
  kind: ScreenNodeKind;
  definitionId: string;
  order: number;
  properties?: Readonly<Record<string, string | number | boolean>>;
  controlFunctions?: ScreenStudioControlFunctions;
  children: readonly ScreenElementHierarchyNode[];
}>;

export type ScreenViewportGrid = Readonly<{
  viewport: "fullscreen";
  scaling: "viewport-fit";
  unit: number;
  columns: number;
  rows: number;
  gap: number;
}>;

export type ScreenRecord = Readonly<{
  schemaVersion: typeof SCREEN_STUDIO_SCREEN_SCHEMA_VERSION;
  id: string;
  sourcePageId: string | null;
  displayName: string;
  type: ScreenRecordType;
  roles: readonly ScreenRecordRole[];
  tags: readonly ScreenRecordTag[];
  groupId: ScreenGroupId;
  grid: ScreenViewportGrid;
  elements: readonly ScreenElementHierarchyNode[];
  lifecycle: ScreenLifecycle;
  status: ScreenStatus;
  revision: ScreenRevision;
  gate?: PermissionGate;
  audit: ScreenAudit;
}>;

export type ScreenRecordValidation = Readonly<{ ok: true }> | Readonly<{ ok: false; errors: readonly string[] }>;
export type ScreenStudioParentTarget = Readonly<{ kind: "screen" | ScreenNodeKind; definitionId?: string }>;
export type ScreenStudioParentDropProjection =
  | Readonly<{ ok: true; parent: ScreenStudioParentTarget; childKind: ScreenNodeKind; childDefinitionId: string }>
  | Readonly<{ ok: false; reason: "unknown-child-definition" | "unknown-parent-definition" | "invalid-parent-kind" | "parent-disallows-child" }>;
export type ScreenStudioReparentResult =
  | Readonly<{ ok: true; screen: ScreenRecord }>
  | Readonly<{ ok: false; reason: "invalid-screen" | "unknown-node" | "unknown-parent" | "self-or-descendant-parent" | "parent-disallows-child" }>;

export type CompositeElementDefinition = Readonly<{
  id: string;
  version: number;
  lifecycle: ScreenLifecycle;
  status: ScreenStatus;
  name: string;
  description: string;
  kind: "composite-element";
  rootDefinitionId: string;
  children: readonly ScreenElementHierarchyNode[];
  layering: Readonly<{ mode: "modal"; topmost: true }>;
  dismissActions: readonly ("click-away" | "apply" | "defaults")[];
  keyboardDismiss: "escape";
  persistence: "none";
  gate: PermissionGate;
  audit: ScreenAudit;
}>;

export type RevisionConflict = Readonly<{
  type: "revision-conflict";
  pageId: string;
  expectedRevision: number;
  actualRevision: number;
  action: "reload" | "compare";
}>;

export type ScreenStudioDocument = Readonly<{
  page: PageRecord;
  clipboard: readonly ScreenNode[];
  undo: readonly PageRecord[];
  redo: readonly PageRecord[];
}>;

export const SCREEN_STUDIO_AUTHORING_CAPABILITY: AuthorizationCapability = "world.designer.read";
export const SCREEN_STUDIO_EDITOR_PERSISTENCE = "session-only" as const;

export type ScreenStudioLoadTarget =
  | Readonly<{ kind: "element"; stableId: string }>
  | Readonly<{ kind: "screen"; stableId: string }>;

export type ScreenStudioLoadedRoot = Readonly<{
  kind: ScreenStudioLoadTarget["kind"];
  stableId: string;
  label: string;
}>;

export type ScreenStudioEditorSession = Readonly<{
  persistence: typeof SCREEN_STUDIO_EDITOR_PERSISTENCE;
  loadedTarget: ScreenStudioLoadTarget | null;
  selectedTarget: ScreenStudioLoadTarget | null;
  root: ScreenStudioLoadedRoot | null;
  document: ScreenStudioDocument | null;
  selectedNodeIds: readonly string[];
}>;

export type ScreenStudioLoadFailure = "capability-required" | "invalid-target" | "unknown-target";
export type ScreenStudioLoadResult =
  | Readonly<{ ok: true; session: ScreenStudioEditorSession }>
  | Readonly<{ ok: false; reason: ScreenStudioLoadFailure; session: ScreenStudioEditorSession }>;

export type ScreenStudioContextActionId =
  | "add-element" | "add-panel" | "add-page" | "paste"
  | "duplicate" | "copy" | "load-element" | "load-screen" | "delete";

export type ScreenStudioContextAction = Readonly<{
  id: ScreenStudioContextActionId;
  label: string;
  enabled: boolean;
}>;

export type ScreenStudioContextGroup = Readonly<{
  id: "add-new" | "clipboard" | "load-actions";
  label: string;
  actions: readonly ScreenStudioContextAction[];
}>;

export const SCREEN_STUDIO_PARENTING_RULES: Readonly<Record<"screen" | ScreenNodeKind, readonly ScreenNodeKind[]>> = Object.freeze({
  screen: Object.freeze(["element", "panel", "page"] satisfies readonly ScreenNodeKind[]),
  page: Object.freeze(["element", "panel", "page"] satisfies readonly ScreenNodeKind[]),
  panel: Object.freeze(["element", "panel"] satisfies readonly ScreenNodeKind[]),
  element: Object.freeze([] satisfies readonly ScreenNodeKind[]),
});

export type ScreenStudioCommand =
  | Readonly<{ type: "add"; node: ScreenNode }>
  | Readonly<{ type: "paste"; nodes: readonly ScreenNode[]; anchor: Readonly<{ x: number; y: number }> }>
  | Readonly<{ type: "duplicate"; nodeId: string }>
  | Readonly<{ type: "copy"; nodeIds: readonly string[] }>
  | Readonly<{ type: "remove"; nodeIds: readonly string[] }>
  | Readonly<{ type: "set-property"; nodeId: string; key: string; value: string | number | boolean }>
  | Readonly<{ type: "move"; nodeIds: readonly string[]; delta: Readonly<{ x: number; y: number }> }>
  | Readonly<{ type: "resize"; nodeId: string; width: number; height: number; x?: number; y?: number }>;

export type DraftSaveResult =
  | Readonly<{ ok: true; page: PageRecord }>
  | Readonly<{ ok: false; conflict: RevisionConflict }>;

const audit: ScreenAudit = { owner: "Creator", createdAt: "2026-08-04T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" };

export const SCREEN_STUDIO_PAGE_TEMPLATES: readonly ScreenPageTemplate[] = ["manager-list", "editor", "settings", "custom", "screen-studio-editor"];

const property = (id: string, type: ElementProperty["type"], required = false, defaultValue?: ElementProperty["defaultValue"]): ElementProperty => ({ id, type, required, ...(defaultValue === undefined ? {} : { defaultValue }) });
const designerGate: PermissionGate = { id: "gate-screen-studio-designer-read", requiredCapability: "world.designer.read", mode: "all", deniedMessage: "World Designer capability is required for this authoring primitive." };
const controlElementIds = new Set(["button", "icon-button", "link", "menu-item", "text-field", "search-field", "checkbox", "select", "toggle", "slider", "color-field", "slot", "action-slot", "designer-slot", "item-slot", "tabs"]);
const containerElementIds = new Set(["inventory-grid", "container", "stack", "grid", "scroll-region", "modal", "table", "list", "card", "tree-view", "inspector-panel"]);
const leftFunctionFor = (id: string): ScreenStudioControlFunctionId => id === "link" || id === "menu-item" ? "navigate-workspace" : id === "checkbox" || id === "toggle" ? "toggle" : id === "text-field" || id === "search-field" || id === "select" || id === "slider" || id === "color-field" || id === "tabs" ? "set-value" : "activate";
const controlFunctionsFor = (id: string): ScreenStudioControlFunctions | null => controlElementIds.has(id) ? {
  leftClick: { functionId: leftFunctionFor(id) },
  rightClick: { functionId: "open-context-menu" },
} : null;
const element = (id: string, name: string, description: string, properties: readonly ElementProperty[], requiredAccessibleName = false, gate?: PermissionGate, referenceElementId?: string): ElementDefinition => ({
  id, slug: id, version: 1, lifecycle: "draft", status: "started", name, description, kind: "element", semantics: controlElementIds.has(id) ? "trigger" : containerElementIds.has(id) ? "container" : "content",
  border: { widthUnits: 1, radiusUnits: 1 }, controlFunctions: controlFunctionsFor(id), allowedChildren: [], properties, events: ["activate"], requiredAccessibleName,
  placement: { minWidth: 1, minHeight: 1, maxWidth: 64, maxHeight: 64 }, themeTokens: ["surface", "text", "focus"], presentationAuthority: "projection-only", ...(referenceElementId ? { referenceElementId } : {}), ...(gate ? { gate } : {}), audit,
});

export const screenStudioElementCatalog: readonly ElementDefinition[] = [
  element("button", "Button", "A capability-gated action trigger.", [property("label", "string", true)], true),
  element("icon-button", "Icon Button", "An icon action with an accessible name.", [property("icon", "asset", true), property("label", "string", true)], true),
  element("link", "Link", "A Gateway-routed navigation link.", [property("label", "string", true), property("route", "string", true)], true),
  element("menu-item", "Menu Item", "A workspace menu entry.", [property("label", "string", true), property("status", "enum", true)], true),
  element("heading", "Heading", "A semantic heading.", [property("text", "string", true)], true),
  element("text", "Text", "Plain descriptive text.", [property("text", "string", true)]),
  element("rich-text", "Rich Text", "Allowlisted rich text projection; no HTML or scripts.", [property("text", "string", true)]),
  element("label", "Label", "A form or data label.", [property("text", "string", true)], true),
  element("badge", "Badge", "A short status or revision marker.", [property("text", "string", true), property("status", "enum")]),
  element("status-dot", "Status Dot", "Status with text fallback; color is never the only signal.", [property("status", "enum", true), property("label", "string", true)], true),
  element("text-field", "Text Field", "A typed text input.", [property("label", "string", true), property("name", "string", true)], true),
  element("search-field", "Search Field", "A typed search input.", [property("label", "string", true), property("name", "string", true)], true),
  element("checkbox", "Checkbox", "A boolean input.", [property("label", "string", true), property("name", "string", true)], true),
  element("select", "Select", "An allowlisted option selector.", [property("label", "string", true), property("name", "string", true), property("options", "enum", true)], true),
  element("toggle", "Toggle", "A boolean switch.", [property("label", "string", true), property("name", "string", true)], true),
  element("slider", "Slider", "A bounded numeric range control.", [property("label", "string", true), property("name", "string", true), property("min", "number", true), property("max", "number", true), property("step", "number", true), property("value", "number", true)], true),
  element("color-field", "Color Field", "A validated color text or numeric channel control.", [property("label", "string", true), property("name", "string", true), property("value", "string", true)], true),
  element("color-swatch", "Color Swatch", "A non-authoritative color preview.", [property("color", "color", true), property("label", "string", true)], true),
  element("progress-bar", "Progress Bar", "A numeric progress projection.", [property("value", "number", true), property("label", "string", true)], true),
  element("image", "Image", "A public content-bundle image.", [property("src", "asset", true), property("alt", "string", true)], true),
  element("slot", "Slot", "Base 1×1 item-grid slot presentation inherited by specialized slots.", [property("label", "string", true), property("gridWidth", "number", true, 1), property("gridHeight", "number", true, 1)], true, designerGate),
  element("action-slot", "Action Slot", "Interactive 2×2 slot presentation that inherits the base Slot contract.", [property("actionLabel", "string")], true, designerGate, "slot"),
  element("designer-slot", "Designer Slot", "Universal 2×2 Awareness action slot with its own left and right behaviors.", [property("label", "string", true, "Designer")], true, designerGate, "action-slot"),
  element("item-slot", "Item Slot (Legacy 1×1)", "Legacy projection alias for the 1×1 item slot.", [property("itemId", "string"), property("label", "string", true)], true, designerGate, "slot"),
  element("item-slot-1x1", "1×1 Item Slot", "Projection-only 1×1 inventory item slot.", [property("itemId", "string"), property("label", "string", true)], true, designerGate, "slot"),
  element("item-slot-2x2", "2×2 Item Slot", "Projection-only 2×2 inventory item slot.", [property("itemId", "string"), property("label", "string", true)], true, designerGate, "slot"),
  element("item-slot-2x3", "2×3 Item Slot", "Projection-only 2×3 inventory item slot.", [property("itemId", "string"), property("label", "string", true)], true, designerGate, "slot"),
  element("item-slot-3x3", "3×3 Item Slot", "Projection-only 3×3 inventory item slot.", [property("itemId", "string"), property("label", "string", true)], true, designerGate, "slot"),
  element("inventory-grid", "Inventory Grid", "A projection-only inventory layout.", [property("layoutId", "string", true), property("label", "string", true)], true),
  element("tooltip", "Tooltip", "A descriptive tooltip projection.", [property("text", "string", true)], true),
  element("divider", "Divider", "A visual section divider." , []),
  element("spacer", "Spacer", "An empty layout spacer.", []),
  element("container", "Container", "A bounded child container.", [property("label", "string")], false),
  element("stack", "Stack", "A one-axis child layout.", [property("direction", "enum", true)]),
  element("grid", "Grid", "A bounded child grid.", [property("columns", "number", true)]),
  element("scroll-region", "Scroll Region", "A bounded scroll container.", []),
  element("tabs", "Tabs", "An accessible tab group.", [property("label", "string", true)], true),
  element("modal", "Modal", "A dialog surface.", [property("label", "string", true)], true),
  element("toast", "Toast/Alert", "A status announcement.", [property("text", "string", true), property("status", "enum", true)], true),
  element("table", "Table", "A typed data table.", [property("label", "string", true)], true),
  element("list", "List", "A typed result list.", [property("label", "string", true)], true),
  element("card", "Card", "A bounded content card.", [property("label", "string", true)], true),
  element("tree-view", "Tree View", "A hierarchical navigation projection.", [property("label", "string", true)], true),
  element("inspector-panel", "Inspector Panel", "A selected-record inspector.", [property("label", "string", true)], true),
];

export const screenStudioPanelCatalog: readonly PanelDefinition[] = [
  { id: "panel-page-root", slug: "page-root", version: 1, lifecycle: "draft", status: "started", name: "Page Root", description: "Ordered fullscreen root container for a Screen record.", kind: "panel", semantics: "container", border: { widthUnits: 0, radiusUnits: 0 }, allowedChildren: ["heading", "container", "status-dot"], audit },
  { id: "panel-navigation", slug: "navigation", version: 1, lifecycle: "draft", status: "started", name: "Navigation", description: "A bounded navigation container for links, menu actions, and tab groups.", kind: "panel", semantics: "container", border: { widthUnits: 1, radiusUnits: 1 }, allowedChildren: ["link", "menu-item", "button", "icon-button", "tabs"], audit },
  { id: "panel-page-header", slug: "page-header", version: 1, lifecycle: "draft", status: "started", name: "Page Header", description: "Title, description, status, and capability notice.", kind: "panel", semantics: "container", border: { widthUnits: 1, radiusUnits: 1 }, allowedChildren: ["heading", "text", "status-dot", "button"], audit },
  { id: "panel-manager-list", slug: "manager-list", version: 1, lifecycle: "draft", status: "started", name: "Manager List", description: "Search, filters, rows, selection, and inspector regions.", kind: "panel", semantics: "container", border: { widthUnits: 1, radiusUnits: 1 }, allowedChildren: ["search-field", "select", "table", "list", "inspector-panel"], audit },
  { id: "panel-editor-form", slug: "editor-form", version: 1, lifecycle: "draft", status: "started", name: "Editor Form", description: "Schema-backed fields and revision actions.", kind: "panel", semantics: "container", border: { widthUnits: 1, radiusUnits: 1 }, allowedChildren: ["text-field", "select", "checkbox", "toggle", "button", "toast"], audit },
  { id: "panel-screen-studio-canvas", slug: "screen-studio-canvas", version: 1, lifecycle: "draft", status: "started", name: "Screen Studio Canvas", description: "Grid, palette, selection, and revision controls.", kind: "panel", semantics: "container", border: { widthUnits: 1, radiusUnits: 0 }, allowedChildren: ["grid", "status-dot", "button", "inspector-panel"], gate: designerGate, audit },
  { id: "panel-color-picker", slug: "color-picker", version: 1, lifecycle: "draft", status: "started", name: "Color Picker", description: "Typed color controls composed as a topmost modal panel.", kind: "panel", semantics: "container", border: { widthUnits: 1, radiusUnits: 2 }, allowedChildren: ["slider", "select", "color-swatch", "color-field", "button"], gate: designerGate, audit },
];

export const defaultLayoutGrid: LayoutGrid = { unit: 8, columns: 120, rows: 80, gap: 1, breakpoints: [{ id: "narrow", minWidth: 0, columns: 40 }, { id: "wide", minWidth: 1024, columns: 120 }] };

const templatePage = (id: string, slug: ScreenPageTemplate, displayName: string): PageRecord => ({
  id, slug, version: 1, lifecycle: "draft", status: "started", displayName, description: `${displayName} reusable Screen Studio page template.`, runtimeMode: "page", template: slug, grid: defaultLayoutGrid, nodes: [], revision: { revision: 1, lifecycle: "draft" }, audit,
});

export const screenStudioPageRecords: readonly PageRecord[] = [
  templatePage("page-template-manager-list", "manager-list", "Manager List"),
  templatePage("page-template-editor", "editor", "Editor"),
  templatePage("page-template-settings", "settings", "Settings"),
  templatePage("page-template-custom", "custom", "Custom"),
  templatePage("page-screen-studio-editor", "screen-studio-editor", "Screen Studio Editor"),
];

export const screenStudioPages: readonly Pick<PageRecord, "id" | "slug" | "displayName" | "template" | "runtimeMode">[] = screenStudioPageRecords;

const stableScreenStudioId = /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/;
const safeDeclarativeValue = (value: string): boolean => value.length <= 256 && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  && !/(?:javascript:|data:|file:|https?:\/\/|eval\s*\(|function\s*\()/i.test(value);
const hasExactKeys = (candidate: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const keys = Object.keys(candidate);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
};
const safePresentationText = (candidate: unknown, maximum = 256): candidate is string => typeof candidate === "string" && candidate.length > 0 && candidate.length <= maximum
  && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(candidate) && safeDeclarativeValue(candidate);
const validTimestamp = (candidate: unknown): candidate is string => typeof candidate === "string" && candidate.length <= 64 && Number.isFinite(Date.parse(candidate));

function isValidPermissionGate(candidate: unknown): candidate is PermissionGate {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const gate = candidate as Record<string, unknown>;
  if (!hasExactKeys(gate, ["id", "mode", "deniedMessage"], ["requiredCapability", "requiredRole"])) return false;
  if (typeof gate.id !== "string" || !stableScreenStudioId.test(gate.id) || (gate.mode !== "all" && gate.mode !== "any") || !safePresentationText(gate.deniedMessage, 512)) return false;
  if (gate.requiredCapability !== undefined && gate.requiredCapability !== "admin.dashboard.read" && gate.requiredCapability !== "world.designer.read") return false;
  if (gate.requiredRole !== undefined && (typeof gate.requiredRole !== "string" || !SCREEN_RECORD_ROLES.includes(gate.requiredRole as ScreenRecordRole))) return false;
  return gate.requiredCapability !== undefined || gate.requiredRole !== undefined;
}

function isValidScreenRevision(candidate: unknown): candidate is ScreenRevision {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const revision = candidate as Record<string, unknown>;
  if (!hasExactKeys(revision, ["revision", "lifecycle"], ["contentHash", "basedOnRevision", "savedAt", "savedBy"])) return false;
  if (!Number.isSafeInteger(revision.revision) || (revision.revision as number) < 1 || !["draft", "review", "published", "archived"].includes(revision.lifecycle as string)) return false;
  if (revision.contentHash !== undefined && (typeof revision.contentHash !== "string" || !/^[a-f0-9]{64}$/i.test(revision.contentHash))) return false;
  if (revision.basedOnRevision !== undefined && (!Number.isSafeInteger(revision.basedOnRevision) || (revision.basedOnRevision as number) < 1)) return false;
  if (revision.savedAt !== undefined && !validTimestamp(revision.savedAt)) return false;
  if (revision.savedBy !== undefined && !safePresentationText(revision.savedBy)) return false;
  return true;
}

function isValidScreenAudit(candidate: unknown): candidate is ScreenAudit {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const auditRecord = candidate as Record<string, unknown>;
  return hasExactKeys(auditRecord, ["owner", "createdAt", "updatedAt"])
    && safePresentationText(auditRecord.owner) && validTimestamp(auditRecord.createdAt) && validTimestamp(auditRecord.updatedAt);
}

function isValidScreenGrid(candidate: unknown): candidate is ScreenViewportGrid {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const grid = candidate as Record<string, unknown>;
  return hasExactKeys(grid, ["viewport", "scaling", "unit", "columns", "rows", "gap"])
    && grid.viewport === "fullscreen" && grid.scaling === "viewport-fit"
    && Number.isSafeInteger(grid.unit) && (grid.unit as number) >= 1 && (grid.unit as number) <= 64
    && Number.isSafeInteger(grid.columns) && (grid.columns as number) >= 1 && (grid.columns as number) <= 4096
    && Number.isSafeInteger(grid.rows) && (grid.rows as number) >= 1 && (grid.rows as number) <= 4096
    && Number.isSafeInteger(grid.gap) && (grid.gap as number) >= 0 && (grid.gap as number) <= 64;
}

function isValidNodeProperties(candidate: unknown, definition: ElementDefinition | null): boolean {
  if (candidate === undefined) return definition ? definition.properties.every((propertyDefinition) => !propertyDefinition.required) : true;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const properties = candidate as Record<string, unknown>;
  const allowed = new Set(definition?.properties.map((entry) => entry.id) ?? []);
  if (!Object.keys(properties).every((key) => allowed.has(key))) return false;
  if (definition?.properties.some((entry) => entry.required && !(entry.id in properties))) return false;
  return Object.values(properties).every((value) => typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) || typeof value === "string" && safeDeclarativeValue(value));
}

function isValidControlFunctionsWrapper(candidate: unknown): candidate is ScreenStudioControlFunctions {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const wrapper = candidate as Record<string, unknown>;
  return hasExactKeys(wrapper, ["leftClick", "rightClick"]) && parseScreenStudioControlFunction(wrapper.leftClick) !== null && parseScreenStudioControlFunction(wrapper.rightClick) !== null;
}

export const SCREEN_STUDIO_SCREEN_GROUPS: readonly ScreenGroup[] = Object.freeze([
  { id: "game-screens", label: "Game Screens", parentId: null, order: 0 },
  { id: "game-character-hud", label: "Character HUD", parentId: "game-screens", order: 0 },
  { id: "game-spirit-hud", label: "Spirit HUD", parentId: "game-screens", order: 1 },
  { id: "workspace-screens", label: "Workspace Screens", parentId: null, order: 1 },
  { id: "workspace-account", label: "Account Screens", parentId: "workspace-screens", order: 0 },
  { id: "workspace-character", label: "Character Screens", parentId: "workspace-screens", order: 1 },
  { id: "workspace-knowhere", label: "Knowhere Site Specific", parentId: "workspace-screens", order: 2 },
  { id: "workspace-knowhere-login", label: "Login Screens", parentId: "workspace-knowhere", order: 0 },
  { id: "workspace-knowhere-manager", label: "Manager", parentId: "workspace-knowhere", order: 1 },
  { id: "workspace-knowhere-editor", label: "Editor", parentId: "workspace-knowhere", order: 2 },
  { id: "workspace-knowhere-designer", label: "Designer", parentId: "workspace-knowhere", order: 3 },
  { id: "workspace-portal", label: "Portal Screens", parentId: "workspace-screens", order: 3 },
  { id: "workspace-creator", label: "Creator Screens", parentId: "workspace-screens", order: 4 },
  { id: "workspace-creator-screen-studio", label: "Screen Studio", parentId: "workspace-creator", order: 0 },
  { id: "workspace-creator-maker-lab", label: "Maker Lab", parentId: "workspace-creator", order: 1 },
  { id: "workspace-creator-world-creator", label: "World Creator", parentId: "workspace-creator", order: 2 },
]);

const colorControl = (id: string, definitionId: string, order: number, properties: Readonly<Record<string, string | number | boolean>>, leftClick: ScreenStudioControlFunctionId = "set-value"): ScreenElementHierarchyNode => ({
  id,
  kind: "element",
  definitionId,
  order,
  properties,
  controlFunctions: { leftClick: { functionId: leftClick }, rightClick: { functionId: "open-context-menu" } },
  children: [],
});

export const screenStudioColorPickerElement: CompositeElementDefinition = Object.freeze({
  id: "composite-color-picker",
  version: 1,
  lifecycle: "draft",
  status: "ready",
  name: "Color Picker Panel",
  description: "Database-ready typed color controls with local preview and explicit apply/default actions.",
  kind: "composite-element",
  rootDefinitionId: "panel-color-picker",
  children: Object.freeze([
    colorControl("color-hue", "slider", 0, { label: "Hue", name: "hue", min: 0, max: 360, step: 1, value: 0 }),
    colorControl("color-saturation", "slider", 1, { label: "Saturation", name: "saturation", min: 0, max: 100, step: 1, value: 100 }),
    colorControl("color-lightness", "slider", 2, { label: "Lightness", name: "lightness", min: 0, max: 100, step: 1, value: 50 }),
    colorControl("color-alpha", "slider", 3, { label: "Alpha", name: "alpha", min: 0, max: 100, step: 1, value: 100 }),
    colorControl("color-theme", "select", 4, { label: "Theme token", name: "theme", options: "custom|primary|secondary|accent|alert" }),
    { id: "color-swatch", kind: "element", definitionId: "color-swatch", order: 5, properties: { color: "#00ffff", label: "Color preview" }, children: [] } satisfies ScreenElementHierarchyNode,
    colorControl("color-hex", "color-field", 6, { label: "Hex", name: "hex", value: "#00ffff" }),
    colorControl("color-rgba", "color-field", 7, { label: "RGBA", name: "rgba", value: "0,255,255,1" }),
    colorControl("color-apply", "button", 8, { label: "Apply" }, "apply"),
    colorControl("color-defaults", "button", 9, { label: "Defaults" }, "restore-defaults"),
  ]),
  layering: { mode: "modal", topmost: true },
  dismissActions: Object.freeze(["click-away", "apply", "defaults"]),
  keyboardDismiss: "escape",
  persistence: "none",
  gate: designerGate,
  audit,
} satisfies CompositeElementDefinition);

export const screenStudioCompositeElementCatalog: readonly CompositeElementDefinition[] = Object.freeze([screenStudioColorPickerElement]);

export function isValidScreenStudioBorder(candidate: unknown): candidate is ScreenStudioBorder {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const border = candidate as Record<string, unknown>;
  return Object.keys(border).length === 2
    && Number.isSafeInteger(border.widthUnits) && (border.widthUnits as number) >= 0 && (border.widthUnits as number) <= 8
    && Number.isSafeInteger(border.radiusUnits) && (border.radiusUnits as number) >= 0 && (border.radiusUnits as number) <= 32;
}

export function parseScreenStudioControlFunction(candidate: unknown): ScreenStudioControlFunction | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  if (!Object.keys(record).every((key) => key === "functionId" || key === "targetId" || key === "value")) return null;
  if (typeof record.functionId !== "string" || !SCREEN_STUDIO_CONTROL_FUNCTIONS.includes(record.functionId as ScreenStudioControlFunctionId)) return null;
  if (record.targetId !== undefined && (typeof record.targetId !== "string" || !stableScreenStudioId.test(record.targetId))) return null;
  if (record.value !== undefined && typeof record.value !== "string" && typeof record.value !== "number" && typeof record.value !== "boolean") return null;
  if (typeof record.value === "string" && !safeDeclarativeValue(record.value)) return null;
  if (typeof record.value === "number" && !Number.isFinite(record.value)) return null;
  return {
    functionId: record.functionId as ScreenStudioControlFunctionId,
    ...(record.targetId === undefined ? {} : { targetId: record.targetId as string }),
    ...(record.value === undefined ? {} : { value: record.value as string | number | boolean }),
  };
}

type HierarchyParent = Readonly<{ kind: "screen" | ScreenNodeKind; definitionId?: string }>;
type HierarchyValidation = Readonly<{ errors: string[]; count: number }>;
function validateElementHierarchy(
  nodes: readonly ScreenElementHierarchyNode[],
  parent: HierarchyParent = { kind: "screen" },
  depth = 0,
  seenIds = new Set<string>(),
  seenObjects = new WeakSet<object>(),
): HierarchyValidation {
  const errors: string[] = [];
  if (depth > 16) errors.push("hierarchy-depth-exceeded");
  let count = 0;
  nodes.forEach((node, index) => {
    count += 1;
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      errors.push("invalid-hierarchy-node");
      return;
    }
    if (seenObjects.has(node)) {
      errors.push("hierarchy-object-cycle");
      return;
    }
    seenObjects.add(node);
    if (!hasExactKeys(node as unknown as Record<string, unknown>, ["id", "kind", "definitionId", "order", "children"], ["properties", "controlFunctions"])) errors.push("invalid-hierarchy-node-shape");
    if (!stableScreenStudioId.test(node.id)) errors.push("invalid-element-id");
    if (seenIds.has(node.id)) {
      errors.push("hierarchy-cycle-or-duplicate");
      return;
    }
    if (!Number.isSafeInteger(node.order) || node.order !== index) errors.push("non-deterministic-element-order");
    if (node.kind !== "element" && node.kind !== "panel" && node.kind !== "page") {
      errors.push("invalid-node-kind");
      return;
    }
    if (typeof node.definitionId !== "string" || !stableScreenStudioId.test(node.definitionId)) errors.push("invalid-definition-id");
    if (!canParentScreenStudioNode(parent.kind, node.kind)) errors.push("invalid-parenting");
    const projection = projectScreenStudioParentDrop(parent, node.kind, node.definitionId);
    if (!projection.ok && projection.reason === "unknown-child-definition") errors.push("unknown-or-mismatched-definition");
    else if (!projection.ok) errors.push("parent-disallows-child-definition");
    const elementDefinition = node.kind === "element" ? screenStudioElementCatalog.find((entry) => entry.id === node.definitionId) : null;
    if (!isValidNodeProperties(node.properties, elementDefinition ?? null)) errors.push("invalid-node-properties");
    if (elementDefinition?.semantics === "trigger") {
      if (!isValidControlFunctionsWrapper(node.controlFunctions)) errors.push("missing-or-invalid-control-functions");
    } else if (node.controlFunctions !== undefined) errors.push("unexpected-control-functions");
    seenIds.add(node.id);
    if (!Array.isArray(node.children)) {
      errors.push("invalid-hierarchy-children");
      return;
    }
    const child = validateElementHierarchy(node.children, { kind: node.kind, definitionId: node.definitionId }, depth + 1, seenIds, seenObjects);
    count += child.count;
    errors.push(...child.errors);
  });
  return { errors, count };
}

export function validateScreenRecord(record: ScreenRecord): ScreenRecordValidation {
  const errors: string[] = [];
  const allowedKeys = new Set(["schemaVersion", "id", "sourcePageId", "displayName", "type", "roles", "tags", "groupId", "grid", "elements", "lifecycle", "status", "revision", "gate", "audit"]);
  if (!record || typeof record !== "object" || Array.isArray(record)) return { ok: false, errors: Object.freeze(["invalid-screen-record-shape"]) };
  if (!Object.keys(record).every((key) => allowedKeys.has(key))) errors.push("invalid-screen-record-shape");
  if (record.schemaVersion !== SCREEN_STUDIO_SCREEN_SCHEMA_VERSION) errors.push("invalid-screen-schema-version");
  if (!stableScreenStudioId.test(record.id)) errors.push("invalid-screen-id");
  if (record.sourcePageId !== null && (typeof record.sourcePageId !== "string" || !stableScreenStudioId.test(record.sourcePageId))) errors.push("invalid-source-page-id");
  if (!safePresentationText(record.displayName)) errors.push("invalid-display-name");
  if (!SCREEN_RECORD_TYPES.includes(record.type)) errors.push("invalid-screen-type");
  if (!SCREEN_GROUP_IDS.includes(record.groupId)) errors.push("invalid-screen-group");
  if (SCREEN_STUDIO_SCREEN_GROUPS.some((group) => group.parentId === record.groupId)) errors.push("invalid-screen-group-nonleaf");
  if (!Array.isArray(record.roles) || record.roles.length === 0 || new Set(record.roles).size !== record.roles.length || record.roles.some((role) => !SCREEN_RECORD_ROLES.includes(role))) errors.push("invalid-screen-roles");
  if (!Array.isArray(record.tags) || record.tags.length === 0 || new Set(record.tags).size !== record.tags.length || record.tags.some((tag) => !SCREEN_RECORD_TAGS.includes(tag))) errors.push("invalid-screen-tags");
  if (!isValidScreenGrid(record.grid)) errors.push("invalid-screen-grid");
  if (!["draft", "review", "published", "archived"].includes(record.lifecycle)) errors.push("invalid-screen-lifecycle");
  if (!["planned", "ready", "started", "in-progress", "blocked", "review", "complete"].includes(record.status)) errors.push("invalid-screen-status");
  if (!isValidScreenRevision(record.revision) || record.revision.lifecycle !== record.lifecycle) errors.push("invalid-screen-revision");
  if (!isValidScreenAudit(record.audit)) errors.push("invalid-screen-audit");
  if (record.gate !== undefined && !isValidPermissionGate(record.gate)) errors.push("invalid-screen-gate");
  const hierarchy = Array.isArray(record.elements) ? validateElementHierarchy(record.elements) : { errors: ["invalid-screen-elements"], count: 0 };
  errors.push(...hierarchy.errors);
  if (hierarchy.count > 2048) errors.push("hierarchy-count-exceeded");
  return errors.length ? { ok: false, errors: Object.freeze([...new Set(errors)]) } : { ok: true };
}

export function validateCompositeElementDefinition(definition: CompositeElementDefinition): Readonly<{ ok: boolean; errors: readonly string[] }> {
  const errors: string[] = [];
  if (!stableScreenStudioId.test(definition.id)) errors.push("invalid-composite-id");
  if (definition.layering.mode !== "modal" || definition.layering.topmost !== true) errors.push("invalid-modal-layering");
  if (definition.persistence !== "none") errors.push("unexpected-persistence");
  if (definition.gate.requiredCapability !== SCREEN_STUDIO_AUTHORING_CAPABILITY) errors.push("invalid-capability-gate");
  if (definition.dismissActions.join("|") !== "click-away|apply|defaults") errors.push("invalid-dismiss-actions");
  if (definition.keyboardDismiss !== "escape") errors.push("invalid-keyboard-dismiss");
  const root = screenStudioPanelCatalog.find((panel) => panel.id === definition.rootDefinitionId);
  if (!root) errors.push("unknown-composite-root");
  const hierarchy = validateElementHierarchy(definition.children, { kind: "panel", definitionId: definition.rootDefinitionId });
  errors.push(...hierarchy.errors);
  if (hierarchy.count > 2048) errors.push("hierarchy-count-exceeded");
  return { ok: errors.length === 0, errors: Object.freeze([...new Set(errors)]) };
}

export function createEmptyScreenStudioEditorSession(): ScreenStudioEditorSession {
  return {
    persistence: SCREEN_STUDIO_EDITOR_PERSISTENCE,
    loadedTarget: null,
    selectedTarget: null,
    root: null,
    document: null,
    selectedNodeIds: Object.freeze([]),
  };
}

export function parseScreenStudioLoadTarget(candidate: unknown): ScreenStudioLoadTarget | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || (record.kind !== "element" && record.kind !== "screen") || typeof record.stableId !== "string") return null;
  if (!stableScreenStudioId.test(record.stableId)) return null;
  return { kind: record.kind, stableId: record.stableId };
}

export function hasScreenStudioAuthoringCapability(capabilities: readonly AuthorizationCapability[]): boolean {
  return capabilities.includes(SCREEN_STUDIO_AUTHORING_CAPABILITY);
}

function elementSessionPage(definition: ElementDefinition): PageRecord {
  const unit = defaultLayoutGrid.unit;
  const node: ScreenNode = {
    id: `root-${definition.id}`,
    kind: "element",
    definitionId: definition.id,
    placement: {
      x: 0,
      y: 0,
      width: Math.max(unit, definition.placement.minWidth * unit),
      height: Math.max(unit, definition.placement.minHeight * unit),
      zIndex: 1,
      minWidth: definition.placement.minWidth * unit,
      minHeight: definition.placement.minHeight * unit,
      ...(definition.placement.maxWidth === undefined ? {} : { maxWidth: definition.placement.maxWidth * unit }),
      ...(definition.placement.maxHeight === undefined ? {} : { maxHeight: definition.placement.maxHeight * unit }),
    },
    properties: {},
    ...(definition.gate ? { gate: definition.gate } : {}),
  };
  return {
    ...templatePage(`session-element-${definition.id}`, "custom", definition.name),
    description: `Session-only Element editor for ${definition.name}.`,
    nodes: [node],
    gate: designerGate,
  };
}

export function loadScreenStudioTarget(
  session: ScreenStudioEditorSession,
  candidate: unknown,
  capabilities: readonly AuthorizationCapability[],
): ScreenStudioLoadResult {
  if (!hasScreenStudioAuthoringCapability(capabilities)) return { ok: false, reason: "capability-required", session };
  const target = parseScreenStudioLoadTarget(candidate);
  if (!target) return { ok: false, reason: "invalid-target", session };
  const page = target.kind === "screen"
    ? screenStudioPageRecords.find((entry) => entry.id === target.stableId)
    : (() => {
        const definition = screenStudioElementCatalog.find((entry) => entry.id === target.stableId);
        return definition ? elementSessionPage(definition) : undefined;
      })();
  if (!page) return { ok: false, reason: "unknown-target", session };
  const label = target.kind === "screen" ? page.displayName : screenStudioElementCatalog.find((entry) => entry.id === target.stableId)?.name;
  if (!label) return { ok: false, reason: "unknown-target", session };
  return {
    ok: true,
    session: {
      persistence: SCREEN_STUDIO_EDITOR_PERSISTENCE,
      loadedTarget: target,
      selectedTarget: target,
      root: { kind: target.kind, stableId: target.stableId, label },
      document: createScreenStudioDocument(page),
      selectedNodeIds: Object.freeze([]),
    },
  };
}

export function selectScreenStudioLoadedTarget(session: ScreenStudioEditorSession, candidate: unknown): ScreenStudioEditorSession {
  const target = parseScreenStudioLoadTarget(candidate);
  if (!target || !session.loadedTarget || target.kind !== session.loadedTarget.kind || target.stableId !== session.loadedTarget.stableId) {
    return { ...session, selectedTarget: null };
  }
  return { ...session, selectedTarget: target };
}

export function canParentScreenStudioNode(parentKind: "screen" | ScreenNodeKind, childKind: ScreenNodeKind): boolean {
  return SCREEN_STUDIO_PARENTING_RULES[parentKind].includes(childKind);
}

function screenStudioDefinitionExists(kind: ScreenNodeKind, definitionId: string): boolean {
  if (kind === "element") return screenStudioElementCatalog.some((entry) => entry.id === definitionId);
  if (kind === "panel") return screenStudioPanelCatalog.some((entry) => entry.id === definitionId);
  return screenStudioPageRecords.some((entry) => entry.id === definitionId);
}

export function projectScreenStudioParentDrop(parent: ScreenStudioParentTarget, childKind: ScreenNodeKind, childDefinitionId: string): ScreenStudioParentDropProjection {
  if (!screenStudioDefinitionExists(childKind, childDefinitionId)) return { ok: false, reason: "unknown-child-definition" };
  if (!canParentScreenStudioNode(parent.kind, childKind)) return { ok: false, reason: "invalid-parent-kind" };
  if (parent.kind === "screen") return { ok: true, parent, childKind, childDefinitionId };
  if (!parent.definitionId || !screenStudioDefinitionExists(parent.kind, parent.definitionId)) return { ok: false, reason: "unknown-parent-definition" };
  if (parent.kind === "page") return { ok: true, parent, childKind, childDefinitionId };
  const allowedChildren = parent.kind === "panel"
    ? screenStudioPanelCatalog.find((entry) => entry.id === parent.definitionId)?.allowedChildren
    : screenStudioElementCatalog.find((entry) => entry.id === parent.definitionId)?.allowedChildren;
  if (!allowedChildren?.includes(childDefinitionId)) return { ok: false, reason: "parent-disallows-child" };
  return { ok: true, parent, childKind, childDefinitionId };
}

function normalizeScreenStudioHierarchy(nodes: readonly ScreenElementHierarchyNode[]): readonly ScreenElementHierarchyNode[] {
  return Object.freeze(nodes.map((node, order) => Object.freeze({ ...node, order, children: normalizeScreenStudioHierarchy(node.children) })));
}

function findScreenStudioHierarchyNode(nodes: readonly ScreenElementHierarchyNode[], nodeId: string): ScreenElementHierarchyNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const nested = findScreenStudioHierarchyNode(node.children, nodeId);
    if (nested) return nested;
  }
  return null;
}

function removeScreenStudioHierarchyNode(nodes: readonly ScreenElementHierarchyNode[], nodeId: string): readonly ScreenElementHierarchyNode[] {
  return nodes.filter((node) => node.id !== nodeId).map((node) => ({ ...node, children: removeScreenStudioHierarchyNode(node.children, nodeId) }));
}

function appendScreenStudioHierarchyNode(nodes: readonly ScreenElementHierarchyNode[], parentId: string, child: ScreenElementHierarchyNode): readonly ScreenElementHierarchyNode[] {
  return nodes.map((node) => node.id === parentId
    ? { ...node, children: [...node.children, child] }
    : { ...node, children: appendScreenStudioHierarchyNode(node.children, parentId, child) });
}

function screenStudioHierarchyIds(node: ScreenElementHierarchyNode): ReadonlySet<string> {
  const ids = new Set<string>([node.id]);
  const visit = (children: readonly ScreenElementHierarchyNode[]): void => children.forEach((child) => {
    ids.add(child.id);
    visit(child.children);
  });
  visit(node.children);
  return ids;
}

export function reparentScreenStudioHierarchy(screen: ScreenRecord, nodeId: string, parentId: string | null): ScreenStudioReparentResult {
  if (!validateScreenRecord(screen).ok) return { ok: false, reason: "invalid-screen" };
  const node = findScreenStudioHierarchyNode(screen.elements, nodeId);
  if (!node) return { ok: false, reason: "unknown-node" };
  const parentNode = parentId === null ? null : findScreenStudioHierarchyNode(screen.elements, parentId);
  if (parentId !== null && !parentNode) return { ok: false, reason: "unknown-parent" };
  if (parentId !== null && screenStudioHierarchyIds(node).has(parentId)) return { ok: false, reason: "self-or-descendant-parent" };
  const target: ScreenStudioParentTarget = parentNode ? { kind: parentNode.kind, definitionId: parentNode.definitionId } : { kind: "screen" };
  if (!projectScreenStudioParentDrop(target, node.kind, node.definitionId).ok) return { ok: false, reason: "parent-disallows-child" };
  const withoutNode = removeScreenStudioHierarchyNode(screen.elements, nodeId);
  const moved = parentId === null ? [...withoutNode, node] : appendScreenStudioHierarchyNode(withoutNode, parentId, node);
  const next = Object.freeze({ ...screen, elements: normalizeScreenStudioHierarchy(moved), revision: Object.freeze({ ...screen.revision, revision: screen.revision.revision + 1, basedOnRevision: screen.revision.revision }) });
  if (!validateScreenRecord(next).ok) return { ok: false, reason: "invalid-screen" };
  return { ok: true, screen: next };
}

export function screenStudioContextMenuGroups(
  session: ScreenStudioEditorSession,
  capabilities: readonly AuthorizationCapability[],
): readonly ScreenStudioContextGroup[] {
  const authorized = hasScreenStudioAuthoringCapability(capabilities);
  const loaded = authorized && session.document !== null && session.root !== null;
  const hasNodeSelection = loaded && session.selectedNodeIds.length > 0;
  const selectedLoadedTarget = loaded && session.selectedTarget !== null && session.loadedTarget !== null
    && session.selectedTarget.kind === session.loadedTarget.kind && session.selectedTarget.stableId === session.loadedTarget.stableId;
  return Object.freeze([
    Object.freeze({ id: "add-new", label: "Add New", actions: Object.freeze([
      Object.freeze({ id: "add-element", label: "Element", enabled: loaded }),
      Object.freeze({ id: "add-panel", label: "Panel", enabled: loaded }),
      Object.freeze({ id: "add-page", label: "Page", enabled: loaded }),
    ]) }),
    Object.freeze({ id: "clipboard", label: "Clipboard", actions: Object.freeze([
      Object.freeze({ id: "paste", label: "Paste", enabled: loaded && session.document!.clipboard.length > 0 }),
      Object.freeze({ id: "duplicate", label: "Duplicate", enabled: hasNodeSelection }),
      Object.freeze({ id: "copy", label: "Copy", enabled: hasNodeSelection }),
    ]) }),
    Object.freeze({ id: "load-actions", label: "Load / Actions", actions: Object.freeze([
      Object.freeze({ id: "load-element", label: "Load Element", enabled: authorized }),
      Object.freeze({ id: "load-screen", label: "Load Screen", enabled: authorized }),
      Object.freeze({ id: "delete", label: "Delete", enabled: selectedLoadedTarget }),
    ]) }),
  ]);
}

export function deleteSelectedScreenStudioTarget(
  session: ScreenStudioEditorSession,
  capabilities: readonly AuthorizationCapability[],
): ScreenStudioEditorSession {
  if (!hasScreenStudioAuthoringCapability(capabilities) || !session.loadedTarget || !session.selectedTarget) return session;
  if (session.loadedTarget.kind !== session.selectedTarget.kind || session.loadedTarget.stableId !== session.selectedTarget.stableId) return session;
  return createEmptyScreenStudioEditorSession();
}

export function snapToGrid(value: number, unit = defaultLayoutGrid.unit): number {
  const safeUnit = Number.isSafeInteger(unit) && unit > 0 && unit <= 64 ? unit : defaultLayoutGrid.unit;
  return Number.isFinite(value) ? Math.max(0, Math.round(value / safeUnit) * safeUnit) : 0;
}

export function constrainPlacement(placement: Placement, grid: LayoutGrid = defaultLayoutGrid): Placement {
  const unit = Number.isSafeInteger(grid.unit) && grid.unit > 0 && grid.unit <= 64 ? grid.unit : defaultLayoutGrid.unit;
  const columns = Number.isSafeInteger(grid.columns) && grid.columns > 0 && grid.columns <= 4096 ? grid.columns : defaultLayoutGrid.columns;
  const rows = Number.isSafeInteger(grid.rows) && grid.rows > 0 && grid.rows <= 4096 ? grid.rows : defaultLayoutGrid.rows;
  const canvasWidth = columns * unit;
  const canvasHeight = rows * unit;
  const normalizeDimension = (candidate: number, fallback: number, canvasExtent: number): number => {
    const finite = Number.isFinite(candidate) ? candidate : fallback;
    return Math.min(canvasExtent, Math.max(unit, snapToGrid(finite, unit)));
  };
  const minWidth = normalizeDimension(placement.minWidth, unit, canvasWidth);
  const minHeight = normalizeDimension(placement.minHeight, unit, canvasHeight);
  const maxWidth = Math.max(minWidth, normalizeDimension(placement.maxWidth ?? canvasWidth, canvasWidth, canvasWidth));
  const maxHeight = Math.max(minHeight, normalizeDimension(placement.maxHeight ?? canvasHeight, canvasHeight, canvasHeight));
  const width = Math.min(Math.max(minWidth, normalizeDimension(placement.width, minWidth, canvasWidth)), maxWidth);
  const height = Math.min(Math.max(minHeight, normalizeDimension(placement.height, minHeight, canvasHeight)), maxHeight);
  const x = Math.min(snapToGrid(placement.x, unit), canvasWidth - width);
  const y = Math.min(snapToGrid(placement.y, unit), canvasHeight - height);
  const zIndex = Number.isSafeInteger(placement.zIndex) ? Math.min(2048, Math.max(0, placement.zIndex)) : 0;
  return {
    x, y, width, height, zIndex, minWidth, minHeight,
    ...(placement.parentId && stableScreenStudioId.test(placement.parentId) ? { parentId: placement.parentId } : {}),
    ...(placement.maxWidth === undefined ? {} : { maxWidth }),
    ...(placement.maxHeight === undefined ? {} : { maxHeight }),
  };
}

function cloneNode(node: ScreenNode, id: string, offset: number, grid: LayoutGrid): ScreenNode {
  return { ...node, id, placement: constrainPlacement({ ...node.placement, x: node.placement.x + offset, y: node.placement.y + offset }, grid) };
}

function nextRevision(page: PageRecord): PageRecord { return { ...page, revision: { ...page.revision, revision: page.revision.revision + 1, lifecycle: "draft" }, audit: { ...page.audit, updatedAt: new Date().toISOString() } }; }

export function createScreenStudioDocument(page: PageRecord): ScreenStudioDocument { return { page, clipboard: [], undo: [], redo: [] }; }

export function applyScreenStudioCommand(document: ScreenStudioDocument, command: ScreenStudioCommand): ScreenStudioDocument {
  const page = document.page;
  let nodes = [...page.nodes];
  let clipboard = document.clipboard;
  if (command.type === "add") nodes.push({ ...command.node, placement: constrainPlacement(command.node.placement, page.grid) });
  if (command.type === "paste") nodes.push(...command.nodes.map((node, index) => cloneNode(node, `${node.id}-paste-${index + 1}`, command.anchor.x + index * page.grid.unit, page.grid)));
  if (command.type === "duplicate") { const source = nodes.find((node) => node.id === command.nodeId); if (source) nodes.push(cloneNode(source, `${source.id}-copy-${page.revision.revision + 1}`, page.grid.unit, page.grid)); }
  if (command.type === "copy") clipboard = nodes.filter((node) => command.nodeIds.includes(node.id));
  if (command.type === "remove") nodes = nodes.filter((node) => !command.nodeIds.includes(node.id));
  if (command.type === "set-property") nodes = nodes.map((node) => node.id === command.nodeId ? { ...node, properties: { ...node.properties, [command.key]: command.value } } : node);
  if (command.type === "move") nodes = nodes.map((node) => command.nodeIds.includes(node.id) ? { ...node, placement: constrainPlacement({ ...node.placement, x: node.placement.x + command.delta.x, y: node.placement.y + command.delta.y }, page.grid) } : node);
  if (command.type === "resize") nodes = nodes.map((node) => node.id === command.nodeId ? { ...node, placement: constrainPlacement({ ...node.placement, x: command.x ?? node.placement.x, y: command.y ?? node.placement.y, width: command.width, height: command.height }, page.grid) } : node);
  if (command.type === "copy") return { ...document, clipboard };
  if (nodes.length === page.nodes.length && nodes.every((node, index) => node === page.nodes[index])) return document;
  return { page: { ...nextRevision(page), nodes }, clipboard, undo: [...document.undo, page], redo: [] };
}

export function undoScreenStudio(document: ScreenStudioDocument): ScreenStudioDocument {
  const previous = document.undo.at(-1); if (!previous) return document;
  return { ...document, page: previous, undo: document.undo.slice(0, -1), redo: [document.page, ...document.redo] };
}

export function redoScreenStudio(document: ScreenStudioDocument): ScreenStudioDocument {
  const next = document.redo[0]; if (!next) return document;
  return { ...document, page: next, undo: [...document.undo, document.page], redo: document.redo.slice(1) };
}

export function saveScreenStudioDraft(page: PageRecord, expectedRevision: number, actualRevision: number, savedBy: string): DraftSaveResult {
  if (expectedRevision !== actualRevision) return { ok: false, conflict: { type: "revision-conflict", pageId: page.id, expectedRevision, actualRevision, action: "compare" } };
  return { ok: true, page: { ...page, revision: { ...page.revision, revision: actualRevision + 1, lifecycle: "draft", savedAt: new Date().toISOString(), savedBy } } };
}
