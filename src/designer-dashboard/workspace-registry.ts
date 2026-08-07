import type { AuthorizationCapability } from "../api/gateway-contract.ts";
import { CREATOR_WORKSPACE_REGISTRY, canonicalCreatorWorkspaceId, type CreatorWorkspaceEntry } from "../dashboard/creator-workspace-registry.ts";
import type { ProjectStatus, ScreenPageTemplate, WorkspaceDefinition, WorkspaceId, WorkspacePageDefinition } from "./workspace-model.ts";

export const workspaceDefinitions: readonly WorkspaceDefinition[] = Object.freeze([
  Object.freeze({ id: "account", label: "Account", description: "Account, interface, and game preferences." }),
  Object.freeze({ id: "character", label: "Character", description: "The selected character and character tools." }),
  Object.freeze({ id: "knowhere", label: "Knowhere", description: "Kingdom administration tools.", requiredCapability: "admin.dashboard.read" }),
  Object.freeze({ id: "portal", label: "Portal", description: "Portal administration and configuration.", requiredCapability: "admin.dashboard.read" }),
  Object.freeze({ id: "creator", label: "Creator", description: "Screen Studio, Maker Lab, and world creation.", requiredCapability: "world.designer.read" }),
]);

type PageSeed = readonly [
  id: string,
  label: string,
  workspace: WorkspaceId,
  parentId: string | null,
  status: ProjectStatus,
  template: ScreenPageTemplate,
  description: string,
  blocker?: string,
];

export const PORTAL_PRESENTATION_BLOCKER = "Presentation only; no reviewed Portal Gateway persistence or mutation contract is mounted.";

// Screen Studio is the canonical navigation entry for its grid authoring
// surface. Keep screen-designer routable for saved URLs and session restore,
// but do not render it as a redundant child link.
export const WORKSPACE_NAVIGATION_HIDDEN_PAGE_IDS: ReadonlySet<string> = new Set(["screen-designer", "model-designer"]);

const creatorTemplate: Readonly<Record<CreatorWorkspaceEntry["renderMode"], ScreenPageTemplate>> = Object.freeze({
  manager: "manager-list",
  "grid-editor": "screen-studio-editor",
  "model-focus": "editor",
});

function creatorParentId(entry: CreatorWorkspaceEntry): string | null {
  if (entry.parentId) return entry.parentId;
  if (entry.area === "screen-studio") return "screen-studio";
  if (entry.area === "maker-lab") return "maker-lab";
  return null;
}

function creatorPageSeed(entry: CreatorWorkspaceEntry): PageSeed {
  return [entry.id, entry.label, "creator", creatorParentId(entry), entry.status, creatorTemplate[entry.renderMode], entry.description];
}

const seeds: readonly PageSeed[] = [
  ["account-settings", "Account Settings", "account", null, "complete", "settings", "Profile and account presentation settings."],
  ["social-settings", "Social Settings", "account", null, "planned", "settings", "Account social preferences.", "Awaiting a reviewed Gateway preference projection."],
  ["game-settings", "Game Settings", "account", null, "complete", "settings", "Gameplay and input preferences."],
  ["interface-settings", "Interface Settings", "account", null, "started", "settings", "Interface and tooltip preferences."],
  ["display-settings", "Display Settings", "account", null, "complete", "settings", "Display and renderer preferences."],
  ["audio-settings", "Audio Settings", "account", null, "complete", "settings", "Audio preferences."],
  ["help", "Help", "account", null, "planned", "custom", "Help and support resources."],

  ["current-character", "Current Character and Needs", "character", null, "started", "custom", "Safe server-projected character summary."],
  ["character-wants", "Wants", "character", "current-character", "planned", "custom", "Character wants projection."],
  ["character-energy", "Energy", "character", "current-character", "planned", "custom", "Character energy projection."],
  ["character-bladder", "Bladder", "character", "current-character", "planned", "custom", "Character bladder projection."],
  ["create-character", "Create a Character", "character", null, "started", "editor", "Character creation route."],
  ["character-editor", "Character Editor", "character", null, "planned", "editor", "Character 3D model sculptor."],
  ["skill-perfector", "Skill Perfector", "character", null, "planned", "editor", "Unique player-skill editor."],
  ["style-editor", "Style Editor", "character", null, "planned", "editor", "Quick character style editing."],
  ["animator", "Animator", "character", null, "planned", "editor", "Character animation editor."],
  ["aspirations", "Aspirations", "character", null, "planned", "manager-list", "Aspirations manager and editor."],
  ["talents", "Talents", "character", null, "planned", "manager-list", "Talents manager and editor."],

  ["knowhere-site-settings", "Site Settings", "knowhere", null, "started", "settings", "Knowhere site settings foundation."],
  ["knowhere-permissions", "Permissions", "knowhere", null, "started", "manager-list", "Permission records and editors."],
  ["knowhere-roles", "Roles", "knowhere", null, "started", "manager-list", "Role records and capability references."],
  ["knowhere-accounts", "Accounts", "knowhere", null, "started", "manager-list", "Account records and editors."],
  ["knowhere-groups", "Groups", "knowhere", null, "started", "manager-list", "Group records and editors."],
  ["knowhere-rewards", "Rewards", "knowhere", null, "planned", "manager-list", "Reward records and editors."],
  ["knowhere-tags", "Tags", "knowhere", null, "planned", "manager-list", "Tag records and editors."],

  ["portal-social", "Social Settings", "portal", null, "planned", "settings", "Portal social administration."],
  ["portal-site-settings", "Portal Site Settings", "portal", "portal-social", "planned", "settings", "Portal site settings."],
  ["portal-users", "User Management", "portal", "portal-social", "planned", "manager-list", "Portal user records and editors."],
  ["portal-groups", "Group Management", "portal", "portal-social", "planned", "manager-list", "Portal group records and editors."],
  ["portal-roles", "Role Management", "portal", "portal-social", "planned", "manager-list", "Portal role records and editors."],
  ["portal-calendar", "Calendar", "portal", "portal-social", "planned", "manager-list", "Portal calendar records and editors."],
  ["portal-rewards", "Rewards", "portal", "portal-social", "planned", "manager-list", "Portal reward records and editors."],
  ["portal-configuration", "Portal Configuration", "portal", null, "planned", "settings", "Portal configuration tools."],
  ["portal-settings", "Portal Settings", "portal", "portal-configuration", "planned", "settings", "Portal configuration settings."],
  ["portal-world-configuration", "World Configuration", "portal", "portal-configuration", "planned", "settings", "Portal world settings."],
  ["portal-world-events", "World Events", "portal", "portal-world-configuration", "planned", "manager-list", "World event records and editors."],
  ["portal-game-tasks", "Game Tasks", "portal", "portal-world-configuration", "planned", "manager-list", "Game task records and editors."],
  ["portal-entities", "Entity Manager", "portal", "portal-world-configuration", "planned", "manager-list", "Portal entity records and editors."],
  ["portal-denizens", "Denizens", "portal", "portal-entities", "planned", "manager-list", "Denizen records and editors."],
  ["portal-guilds", "Guilds", "portal", "portal-entities", "planned", "manager-list", "Guild records and editors."],
  ["portal-towns", "Towns", "portal", "portal-entities", "planned", "manager-list", "Town records and editors."],
  ["portal-nations", "Nations", "portal", "portal-entities", "planned", "manager-list", "Nation records and editors."],

  ["screen-studio", "Screen Studio", "creator", null, "started", "custom", "Screen composition workspace shell."],
  ["maker-lab", "Maker Lab", "creator", null, "started", "custom", "Material, item, and entity authoring shell."],
  ...CREATOR_WORKSPACE_REGISTRY.map(creatorPageSeed),
];

const workspaceCapabilities: Readonly<Partial<Record<WorkspaceId, AuthorizationCapability>>> = Object.freeze({
  knowhere: "admin.dashboard.read",
  portal: "admin.dashboard.read",
  creator: "world.designer.read",
});

export const workspacePageRegistry: readonly WorkspacePageDefinition[] = Object.freeze(seeds.map(([id, label, workspace, parentId, status, template, description, blocker]) => Object.freeze({
  id,
  label,
  workspace,
  parentId,
  route: `/dashboard?workspace=${workspace}&page=${id}`,
  status,
  description,
  requiredCapability: workspaceCapabilities[workspace],
  template,
  blocker: blocker ?? (workspace === "portal" ? PORTAL_PRESENTATION_BLOCKER : undefined),
})));

export function workspacePages(workspace: WorkspaceId): readonly WorkspacePageDefinition[] {
  return workspacePageRegistry.filter((page) => page.workspace === workspace);
}

export function childPages(workspace: WorkspaceId, parentId: string | null): readonly WorkspacePageDefinition[] {
  return workspacePageRegistry.filter((page) => page.workspace === workspace && page.parentId === parentId);
}

export function navigationChildPages(workspace: WorkspaceId, parentId: string | null): readonly WorkspacePageDefinition[] {
  return childPages(workspace, parentId).filter((page) => !WORKSPACE_NAVIGATION_HIDDEN_PAGE_IDS.has(page.id));
}

export function findWorkspacePage(pageId: string | null): WorkspacePageDefinition | null {
  return workspacePageRegistry.find((page) => page.id === pageId) ?? null;
}

export function canonicalWorkspacePageId(pageId: string | null): string | null {
  if (!pageId) return null;
  return canonicalCreatorWorkspaceId(pageId) ?? pageId;
}

export function selectedWorkspaceAncestorIds(pageId: string): readonly string[] {
  const ancestors: string[] = [];
  let current = findWorkspacePage(pageId);
  while (current?.parentId) {
    ancestors.unshift(current.parentId);
    current = findWorkspacePage(current.parentId);
  }
  return Object.freeze(ancestors);
}
