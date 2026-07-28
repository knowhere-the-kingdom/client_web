export type DashboardEntryState = "available" | "in-progress" | "planned" | "capability-required";

export type DashboardEntry = Readonly<{
  id: string;
  label: string;
  description: string;
  state: DashboardEntryState;
  owner?: string;
  capability?: string;
}>;

export type DashboardGroup = Readonly<{
  id: string;
  label: string;
  initiallyOpen: boolean;
  entries: readonly DashboardEntry[];
}>;

export const dashboardGroups: readonly DashboardGroup[] = [
  {
    id: "account",
    label: "Account",
    initiallyOpen: true,
    entries: [
      { id: "overview", label: "Overview", description: "Client restoration status and safe next steps.", state: "available" },
      { id: "login", label: "Login & session", description: "Gateway-mediated sign-in and session restoration.", state: "in-progress", owner: "Creator" },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    initiallyOpen: false,
    entries: [
      { id: "characters", label: "Characters", description: "Eligible character selection supplied by the Gateway.", state: "in-progress", owner: "Interfacer" },
      { id: "collections", label: "Collections", description: "Account-owned collection presentation.", state: "planned" },
      { id: "achievements", label: "Achievements", description: "Account and world achievement presentation.", state: "planned" },
    ],
  },
  {
    id: "settings",
    label: "Game Settings",
    initiallyOpen: false,
    entries: [
      { id: "service-status", label: "Service status", description: "Credential-free public Gateway health.", state: "available" },
      { id: "controls", label: "Controls", description: "Input and accessibility preferences.", state: "planned" },
      { id: "display", label: "Display", description: "Renderer and display preferences.", state: "planned" },
      { id: "audio", label: "Audio", description: "Client audio preferences.", state: "planned" },
    ],
  },
  {
    id: "world-designer",
    label: "World Designer",
    initiallyOpen: false,
    entries: [
      { id: "materials", label: "Materials", description: "Material authoring requires an approved capability projection.", state: "capability-required", capability: "world.designer.read" },
      { id: "models", label: "Models", description: "Voxel model authoring requires an approved capability projection.", state: "capability-required", capability: "world.designer.read" },
      { id: "world-generator", label: "World Generator", description: "World generation requires an approved capability projection.", state: "capability-required", capability: "world.designer.read" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    initiallyOpen: false,
    entries: [
      { id: "users", label: "Users", description: "User administration requires an approved capability projection.", state: "capability-required", capability: "admin.dashboard.read" },
      { id: "roles", label: "Roles", description: "Role administration requires an approved capability projection.", state: "capability-required", capability: "admin.dashboard.read" },
      { id: "systems", label: "Systems", description: "System administration requires an approved capability projection.", state: "capability-required", capability: "admin.dashboard.read" },
    ],
  },
];

export const dashboardEntries = dashboardGroups.flatMap((group) => group.entries);

export function resolveDashboardPage(value: string | null): DashboardEntry {
  return dashboardEntries.find((entry) => entry.id === value && entry.state === "available")
    ?? dashboardEntries[0];
}

export function dashboardEntryAvailable(entry: DashboardEntry): boolean {
  return entry.state === "available";
}

export function dashboardEntryStatus(entry: DashboardEntry): string {
  if (entry.state === "available") return "Available";
  if (entry.state === "in-progress") return entry.owner ? `In progress · ${entry.owner}` : "In progress";
  if (entry.state === "capability-required") return `Requires ${entry.capability}`;
  return "Planned";
}
