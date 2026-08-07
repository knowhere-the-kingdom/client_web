import {
  defaultLayoutGrid,
  screenStudioElementCatalog,
  screenStudioPageRecords,
  screenStudioPanelCatalog,
  SCREEN_STUDIO_SCREEN_SCHEMA_VERSION,
  validateScreenRecord,
  type PageRecord,
  type PermissionGate,
  type ScreenNode,
  type ScreenStatus,
  type ScreenGroupId,
  type ScreenElementHierarchyNode,
  type ScreenRecord,
  type ScreenRecordRole,
  type ScreenRecordTag,
} from "./screen-studio-model.ts";
import { workspacePageRegistry } from "../designer-dashboard/workspace-registry.ts";
import type { WorkspacePageDefinition } from "../designer-dashboard/workspace-model.ts";
import { creatorWorkspaceEntry } from "./creator-workspace-registry.ts";

const audit = { owner: "Creator", createdAt: "2026-08-04T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" } as const;

export const screenStudioPermissionFixtures: Readonly<Record<string, PermissionGate>> = {
  adminRead: { id: "gate-admin-read", requiredCapability: "admin.dashboard.read", mode: "all", deniedMessage: "Administrator capability is required to view this page." },
  designerRead: { id: "gate-designer-read", requiredCapability: "world.designer.read", mode: "all", deniedMessage: "World Designer capability is required to view this page." },
};

export const screenStudioStatusFixtures: readonly Readonly<{ id: string; status: ScreenStatus; label: string; description: string }>[] = [
  { id: "planned", status: "planned", label: "Planned", description: "Defined, not started." },
  { id: "ready", status: "ready", label: "Ready", description: "Dependencies are ready." },
  { id: "started", status: "started", label: "Started", description: "Initial implementation exists." },
  { id: "in-progress", status: "in-progress", label: "In progress", description: "Active implementation." },
  { id: "blocked", status: "blocked", label: "Blocked", description: "A named dependency prevents progress." },
  { id: "review", status: "review", label: "Review", description: "Awaiting review or validation." },
  { id: "complete", status: "complete", label: "Complete", description: "Acceptance criteria met." },
];

function placement(x: number, y: number, width: number, height: number, zIndex: number): ScreenNode["placement"] {
  return { x, y, width, height, zIndex, minWidth: 8, minHeight: 8, maxWidth: 960, maxHeight: 640 };
}

function node(id: string, definitionId: string, x: number, y: number, width: number, height: number, properties: ScreenNode["properties"], gate?: PermissionGate): ScreenNode {
  const catalog = [...screenStudioElementCatalog, ...screenStudioPanelCatalog];
  if (!catalog.some((entry) => entry.id === definitionId || entry.id === `panel-${definitionId}`)) throw new Error(`Unknown Screen Studio fixture definition: ${definitionId}`);
  return { id, kind: definitionId.startsWith("panel-") ? "panel" : "element", definitionId, placement: placement(x, y, width, height, 1), properties, ...(gate ? { gate } : {}) };
}

function fixturePage(templateId: string, status: ScreenStatus, description: string, nodes: readonly ScreenNode[], gate?: PermissionGate): PageRecord {
  const template = screenStudioPageRecords.find((page) => page.id === templateId);
  if (!template) throw new Error(`Unknown Screen Studio fixture template: ${templateId}`);
  return {
    ...template,
    description,
    nodes,
    status,
    ...(gate ? { gate } : {}),
    audit,
    revision: { ...template.revision, lifecycle: "draft", basedOnRevision: template.revision.revision },
    grid: defaultLayoutGrid,
  };
}

export const screenStudioDefaultPageRecords: readonly PageRecord[] = [
  fixturePage("page-template-manager-list", "ready", "Reusable browsing, filtering, selection, and inspector page.", [
    node("manager-header", "panel-page-header", 0, 0, 640, 64, { title: "Records", description: "Browse authored records", status: "ready" }, screenStudioPermissionFixtures.adminRead),
    node("manager-search", "search-field", 0, 80, 320, 40, { label: "Search records", name: "query" }),
    node("manager-table", "table", 0, 136, 720, 320, { label: "Record list" }),
    node("manager-inspector", "inspector-panel", 744, 136, 320, 320, { label: "Selected record" }),
  ], screenStudioPermissionFixtures.designerRead),
  fixturePage("page-template-editor", "review", "Reusable schema-backed record editor with revision controls.", [
    node("editor-header", "panel-page-header", 0, 0, 640, 64, { title: "Edit record", description: "Draft changes are revisioned", status: "review" }, screenStudioPermissionFixtures.designerRead),
    node("editor-name", "text-field", 0, 88, 320, 40, { label: "Name", name: "name" }),
    node("editor-status", "select", 0, 144, 320, 40, { label: "Lifecycle", name: "lifecycle", options: "draft|review|published|archived" }),
    node("editor-form", "panel-editor-form", 0, 208, 720, 320, { label: "Schema-backed fields" }, screenStudioPermissionFixtures.designerRead),
  ], screenStudioPermissionFixtures.designerRead),
  fixturePage("page-template-settings", "started", "Settings page fixture for safe preference projections.", [
    node("settings-header", "panel-page-header", 0, 0, 640, 64, { title: "Settings", description: "Preferences are Gateway-owned when persisted", status: "started" }),
    node("settings-toggle", "toggle", 0, 88, 320, 40, { label: "Reduced motion", name: "reducedMotion" }),
    node("settings-save", "button", 0, 144, 160, 40, { label: "Save draft" }),
  ]),
  fixturePage("page-template-custom", "blocked", "Custom page fixture held until a reviewed resource contract exists.", [
    node("custom-header", "panel-page-header", 0, 0, 640, 64, { title: "Custom page", description: "Awaiting a reviewed resource contract", status: "blocked" }),
    node("custom-alert", "toast", 0, 88, 640, 48, { text: "Blocked: no persistence contract attached.", status: "blocked" }),
  ]),
  fixturePage("page-screen-studio-editor", "in-progress", "Special Screen Studio canvas/editor fixture for composing Page revisions.", [
    node("studio-canvas", "panel-screen-studio-canvas", 0, 0, 960, 640, { label: "Screen Studio canvas", gridUnit: defaultLayoutGrid.unit }),
    node("studio-status", "status-dot", 0, 656, 240, 32, { status: "in-progress", label: "Draft changes" }),
    node("studio-inspector", "inspector-panel", 976, 0, 320, 640, { label: "Node inspector" }, screenStudioPermissionFixtures.designerRead),
  ]),
];

export const screenStudioFixtureSummary = screenStudioDefaultPageRecords.map((page) => ({
  id: page.id,
  template: page.template,
  runtimeMode: page.runtimeMode,
  status: page.status,
  nodeCount: page.nodes.length,
  gate: page.gate?.requiredCapability ?? null,
}));

const screenGrid = Object.freeze({ viewport: "fullscreen", scaling: "viewport-fit", unit: 8, columns: 120, rows: 80, gap: 1 } as const);

export function creatorScreenGroupForWorkspacePage(page: WorkspacePageDefinition): ScreenGroupId {
  if (page.workspace !== "creator") throw new RangeError(`Not a Creator Workspace page: ${page.id}`);
  if (page.id === "screen-studio") return "workspace-creator-screen-studio";
  if (page.id === "maker-lab") return "workspace-creator-maker-lab";
  const entry = creatorWorkspaceEntry(page.id);
  if (!entry) throw new RangeError(`Unmapped Creator screen: ${page.id}`);
  if (entry.area === "screen-studio") return "workspace-creator-screen-studio";
  if (entry.area === "maker-lab") return "workspace-creator-maker-lab";
  if (entry.area === "world-creator") return "workspace-creator-world-creator";
  throw new RangeError(`Unmapped Creator screen area: ${page.id}`);
}

function screenGroupFor(page: WorkspacePageDefinition): ScreenGroupId {
  if (page.workspace === "account") return "workspace-account";
  if (page.workspace === "character") return "workspace-character";
  if (page.workspace === "portal") return "workspace-portal";
  if (page.workspace === "creator") return creatorScreenGroupForWorkspacePage(page);
  if (page.id.includes("login")) return "workspace-knowhere-login";
  if (page.template === "manager-list") return "workspace-knowhere-manager";
  if (page.template === "editor") return "workspace-knowhere-editor";
  return "workspace-knowhere-designer";
}

function rolesFor(page: WorkspacePageDefinition): readonly ScreenRecordRole[] {
  if (page.workspace === "knowhere" || page.workspace === "portal") return Object.freeze(["administrator"]);
  if (page.workspace === "creator") return Object.freeze(["world-designer"]);
  return Object.freeze(["player"]);
}

const universalDesignerSlot = (): ScreenElementHierarchyNode => Object.freeze({
  id: "universal-designer-slot",
  kind: "element",
  definitionId: "designer-slot",
  order: 0,
  properties: Object.freeze({ label: "Designer" }),
  controlFunctions: Object.freeze({ leftClick: Object.freeze({ functionId: "activate" }), rightClick: Object.freeze({ functionId: "open-context-menu" }) }),
  children: Object.freeze([]),
});

export function screenRecordFromWorkspacePage(page: WorkspacePageDefinition): ScreenRecord {
  const rootId = `root-${page.id}`;
  const tags = Object.freeze(["workspace", page.workspace, page.template] satisfies ScreenRecordTag[]);
  const children: readonly ScreenElementHierarchyNode[] = [
    { id: `heading-${page.id}`, kind: "element", definitionId: "heading", order: 0, properties: { text: page.label }, children: [] },
    { id: `content-${page.id}`, kind: "element", definitionId: "container", order: 1, properties: { label: `${page.label} content` }, children: [] },
  ];
  const elements: readonly ScreenElementHierarchyNode[] = Object.freeze([universalDesignerSlot(), {
    id: rootId,
    kind: "panel",
    definitionId: "panel-page-root",
    order: 1,
    children: Object.freeze(children),
  }]);
  const record: ScreenRecord = {
    schemaVersion: SCREEN_STUDIO_SCREEN_SCHEMA_VERSION,
    id: `screen-${page.id}`,
    sourcePageId: page.id,
    displayName: page.label,
    type: "workspace",
    roles: rolesFor(page),
    tags,
    groupId: screenGroupFor(page),
    grid: screenGrid,
    elements,
    lifecycle: "draft",
    status: page.status,
    revision: Object.freeze({ revision: 1, lifecycle: "draft" }),
    ...(page.requiredCapability ? { gate: { id: `gate-${page.id}`, requiredCapability: page.requiredCapability, mode: "all", deniedMessage: `${page.label} capability is required.` } as const } : {}),
    audit,
  };
  return Object.freeze(record);
}

const specialScreen = (id: string, displayName: string, type: ScreenRecord["type"], groupId: ScreenGroupId, tags: readonly ScreenRecordTag[]): ScreenRecord => {
  const record: ScreenRecord = {
    schemaVersion: SCREEN_STUDIO_SCREEN_SCHEMA_VERSION,
    id,
    sourcePageId: null,
    displayName,
    type,
    roles: Object.freeze(["player"] as const),
    tags: Object.freeze(tags),
    groupId,
    grid: screenGrid,
    elements: Object.freeze([universalDesignerSlot(), {
      id: `root-${id}`,
      kind: "panel" as const,
      definitionId: "panel-page-root",
      order: 1,
      children: Object.freeze([]),
    }]),
    lifecycle: "draft",
    status: "planned",
    revision: Object.freeze({ revision: 1, lifecycle: "draft" }),
    audit,
  };
  return Object.freeze(record);
};

export const screenStudioRegisteredPageScreens: readonly ScreenRecord[] = Object.freeze(workspacePageRegistry.map(screenRecordFromWorkspacePage));

export type CreatorScreenGroupProjection = Readonly<{
  groupId: Extract<ScreenGroupId, "workspace-creator-screen-studio" | "workspace-creator-maker-lab" | "workspace-creator-world-creator">;
  records: readonly ScreenRecord[];
}>;

export function projectCreatorScreenGroups(records: readonly ScreenRecord[] = screenStudioRegisteredPageScreens): readonly CreatorScreenGroupProjection[] {
  const groupIds = Object.freeze(["workspace-creator-screen-studio", "workspace-creator-maker-lab", "workspace-creator-world-creator"] as const);
  const creatorPages = new Map(workspacePageRegistry.filter((page) => page.workspace === "creator").map((page) => [page.id, page]));
  const creatorRecords = records.filter((record) => record.sourcePageId !== null && creatorPages.has(record.sourcePageId) || record.groupId === "workspace-creator" || groupIds.includes(record.groupId as typeof groupIds[number]));
  const ids = new Set<string>();
  for (const record of creatorRecords) {
    if (ids.has(record.id)) throw new RangeError(`Duplicate Creator screen record: ${record.id}`);
    ids.add(record.id);
    const page = record.sourcePageId === null ? null : creatorPages.get(record.sourcePageId) ?? null;
    if (!page) throw new RangeError(`Unmapped Creator screen record: ${record.id}`);
    const expected = creatorScreenGroupForWorkspacePage(page);
    if (record.groupId !== expected) throw new RangeError(`Creator screen is assigned to the wrong subgroup: ${record.id}`);
  }
  if (creatorRecords.length !== creatorPages.size) throw new RangeError("Every Creator Workspace page must have exactly one Screen record.");
  return Object.freeze(groupIds.map((groupId) => Object.freeze({
    groupId,
    records: Object.freeze(creatorRecords.filter((record) => record.groupId === groupId).sort((a, b) => a.displayName.localeCompare(b.displayName, "en-US") || a.id.localeCompare(b.id, "en-US"))),
  })));
}

export const screenStudioScreenRecords: readonly ScreenRecord[] = Object.freeze([
  specialScreen("screen-character-hud", "Character HUD", "hud", "game-character-hud", ["game", "character", "hud"]),
  specialScreen("screen-spirit-hud", "Spirit HUD", "hud", "game-spirit-hud", ["game", "spirit", "hud"]),
  specialScreen("screen-system-login", "Login", "system", "workspace-knowhere-login", ["system", "login"]),
  ...screenStudioRegisteredPageScreens,
]);

if (screenStudioScreenRecords.some((screen) => !validateScreenRecord(screen).ok)) throw new Error("Invalid Screen Studio Screen record fixture");
projectCreatorScreenGroups(screenStudioRegisteredPageScreens);
