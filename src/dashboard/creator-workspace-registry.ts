import type { AuthorizationCapability } from "../api/gateway-contract.ts";
import type { ScreenStatus } from "./screen-studio-model.ts";
import { SCREEN_STUDIO_SCREEN_GROUPS } from "./screen-studio-model.ts";

export const CREATOR_WORKSPACE_CONTRACT = "CreatorWorkspaceRegistryV1" as const;
export type CreatorWorkspaceArea = "screen-studio" | "maker-lab" | "world-creator";
export type CreatorRenderMode = "manager" | "grid-editor" | "model-focus";
export type CreatorPageType = "hud" | "page";
export type CreatorManagementListManager = "screens";

export type CreatorWorkspaceEntry = Readonly<{
  id: string;
  slug: string;
  label: string;
  area: CreatorWorkspaceArea;
  parentId: string | null;
  renderMode: CreatorRenderMode;
  pageType: CreatorPageType;
  status: ScreenStatus;
  requiredCapability: AuthorizationCapability;
  description: string;
}>;

export type CreatorScreenRecord = Readonly<{
  id: string;
  slug: string;
  displayName: string;
  renderMode: CreatorRenderMode;
  pageType: CreatorPageType;
  status: ScreenStatus;
  requiredCapability: AuthorizationCapability;
  source: "predefined";
}>;

const CREATOR_CAPABILITY: AuthorizationCapability = "world.designer.read";
const entry = (id: string, slug: string, label: string, area: CreatorWorkspaceArea, parentId: string | null, renderMode: CreatorRenderMode, description: string, pageType: CreatorPageType = "page", status: ScreenStatus = "planned"): CreatorWorkspaceEntry => Object.freeze({ id, slug, label, area, parentId, renderMode, pageType, status, requiredCapability: CREATOR_CAPABILITY, description });

export const CREATOR_WORKSPACE_REGISTRY: readonly CreatorWorkspaceEntry[] = Object.freeze([
  entry("screen-designer", "screen-designer", "Screen Designer", "screen-studio", null, "grid-editor", "Full Screen Studio grid authoring surface.", "page", "started"),
  entry("styles", "styles", "Styles", "screen-studio", null, "manager", "Theme and style records manager."),
  entry("elements", "elements", "Elements", "screen-studio", null, "manager", "Fused Element and Panel catalog and editor."),
  entry("screens", "screens", "Screens", "screen-studio", null, "manager", "Predefined screen records and local editors."),
  entry("behaviors", "behaviors", "Behaviors", "screen-studio", null, "manager", "Typed behavior, trigger, schedule, and visual logic records.", "page", "started"),
  entry("model-designer", "model-designer", "Model Designer", "maker-lab", null, "model-focus", "Initial blank model authoring surface."),
  entry("materials", "materials", "Materials", "maker-lab", null, "manager", "Material records and local editors."),
  entry("items", "items", "Items", "maker-lab", null, "manager", "Item records and local editors."),
  entry("properties", "properties", "Properties", "maker-lab", null, "manager", "Property records and local editors."),
  entry("abilities", "abilities", "Abilities", "maker-lab", null, "manager", "Ability records and local editors."),
  entry("effects", "effects", "Effects", "maker-lab", null, "manager", "Effect records and local editors."),
  entry("entities", "entities", "Entities", "maker-lab", null, "manager", "Entity authoring group."),
  entry("behavior-designer", "behavior-designer", "Behavior Designer", "maker-lab", "entities", "grid-editor", "Grid-based behavior authoring surface."),
  entry("creatures", "creatures", "Creatures", "maker-lab", "entities", "model-focus", "Model Designer focused on Creatures."),
  entry("characters", "characters", "Characters", "maker-lab", "entities", "model-focus", "Model Designer focused on Characters."),
  entry("world-creator", "world-creator", "World Creator", "world-creator", null, "manager", "World authoring workspace; formerly World Creation."),
  entry("blocks", "blocks", "Blocks", "world-creator", "world-creator", "model-focus", "Model Designer focused on Blocks."),
  entry("objects", "objects", "Objects", "world-creator", "world-creator", "model-focus", "Model Designer focused on Objects."),
  entry("structures", "structures", "Structures", "world-creator", "world-creator", "model-focus", "Model Designer focused on Structures."),
  entry("biomes", "biomes", "Biomes", "world-creator", "world-creator", "grid-editor", "Biome grid authoring surface."),
  entry("generators", "generators", "Generators", "world-creator", "world-creator", "manager", "World generator records and local editors."),
  entry("layers", "layers", "Layers", "world-creator", "world-creator", "manager", "World layer records and local editors."),
]);

export const CREATOR_SCREEN_RECORDS: readonly CreatorScreenRecord[] = Object.freeze([
  ["screen-record-management-list", "screen-record-management-list", "Management List", "manager"],
  ["screen-record-grid-layout-editor", "screen-record-grid-layout-editor", "Grid Layout Editor", "grid-editor"],
  ["screen-record-screen-designer", "screen-record-screen-designer", "Screen Designer", "grid-editor"],
  ["screen-record-behavior-designer", "screen-record-behavior-designer", "Behavior Designer", "grid-editor"],
  ["screen-record-model-designer", "screen-record-model-designer", "Model Designer", "model-focus"],
  ["screen-record-biome-designer", "screen-record-biome-designer", "Biome Designer", "grid-editor"],
  ["screen-record-world-designer", "screen-record-world-designer", "World Designer", "model-focus"],
  ["screen-record-logic-designer", "screen-record-logic-designer", "Logic Designer", "grid-editor"],
].map(([id, slug, displayName, renderMode]) => Object.freeze({ id, slug, displayName, renderMode: renderMode as CreatorRenderMode, pageType: "page" as const, status: "planned" as const, requiredCapability: CREATOR_CAPABILITY, source: "predefined" as const })));

export const CREATOR_WORKSPACE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  editor: "screen-designer", "screen-studio-editor": "screen-designer", "page-template-editor": "screen-designer", "page-screen-studio-editor": "screen-designer",
  themes: "styles", "screen-studio-themes": "styles", "pages": "screens", "screen-studio-pages": "screens", "screen-studio-screens": "screens", "panels": "elements", "screen-studio-panels": "elements", "screen-studio-elements": "elements", "screen-studio-behaviors": "behaviors", "world-creation": "world-creator",
  "maker-designer": "model-designer", "maker-materials": "materials", "maker-items": "items", "maker-properties": "properties", "maker-abilities": "abilities", "maker-effects": "effects", "maker-entities": "entities", "maker-behaviors": "behavior-designer", "maker-critters": "creatures", "maker-creatures": "creatures", "maker-characters": "characters",
  "world-blocks": "blocks", "world-objects": "objects", "world-structures": "structures", "world-biomes": "biomes", "world-generators": "generators", "world-layers": "layers",
});

export const CREATOR_MANAGEMENT_LIST_GROUPS: Readonly<Record<CreatorManagementListManager, readonly string[]>> = Object.freeze({
  screens: Object.freeze(SCREEN_STUDIO_SCREEN_GROUPS.map((group) => group.id)),
});

export function getManagementListGroupIds(manager: CreatorManagementListManager): readonly string[] {
  return CREATOR_MANAGEMENT_LIST_GROUPS[manager];
}

export function initialCollapsedManagementListGroups(manager: CreatorManagementListManager): ReadonlySet<string> {
  return Object.freeze(new Set(getManagementListGroupIds(manager)));
}

export function canonicalCreatorWorkspaceId(id: string | null): string | null {
  if (!id) return null;
  const canonical = CREATOR_WORKSPACE_ALIASES[id] ?? id;
  return CREATOR_WORKSPACE_REGISTRY.some((item) => item.id === canonical) || CREATOR_SCREEN_RECORDS.some((item) => item.id === canonical) ? canonical : null;
}

export function creatorWorkspaceEntry(id: string | null): CreatorWorkspaceEntry | null {
  const canonical = canonicalCreatorWorkspaceId(id);
  return CREATOR_WORKSPACE_REGISTRY.find((item) => item.id === canonical) ?? null;
}

export function creatorWorkspaceChildren(parentId: string | null): readonly CreatorWorkspaceEntry[] {
  return CREATOR_WORKSPACE_REGISTRY.filter((item) => item.parentId === parentId);
}
