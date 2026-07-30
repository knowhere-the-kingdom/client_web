import { useEffect, useMemo, useState } from "react";
import type { GatewaySessionProjection } from "./api/gateway-contract";
import { DashboardSettingsPage, type SettingsDashboardPage } from "./dashboard/DashboardSettingsPages";
import type { ManagerKind } from "./dashboard/ManagerPage";

type Page =
  | "account"
  | "profile"
  | SettingsDashboardPage
  | "store"
  | "world"
  | "material"
  | "model"
  | "item"
  | "biome"
  | "generator"
  | "admin"
  | "entities"
  | ManagerKind;

type TreeId = "admin" | "creator";
type TreeLink = Readonly<{ page: Page; label: string }>;

const adminLinks: readonly TreeLink[] = [
  { page: "admin", label: "Site Settings" },
  { page: "entities", label: "Server Tools" },
  { page: "users", label: "User Management" },
  { page: "groups", label: "Group Management" },
  { page: "roles", label: "Roles & Permissions" },
  { page: "skills", label: "Skill Manager" },
  { page: "stats", label: "Stat Manager" },
  { page: "materia", label: "Materia Manager" },
];

const creatorLinks: readonly TreeLink[] = [
  { page: "material", label: "Material Editor" },
  { page: "model", label: "Model Editor" },
  { page: "biome", label: "Biome Editor" },
  { page: "world", label: "World Editor" },
  { page: "generator", label: "World Settings" },
  { page: "item", label: "Item Editor" },
];

const managerKinds: readonly ManagerKind[] = ["users", "roles", "groups", "skills", "stats", "materia"];
const gameSettingsPages: readonly Page[] = ["gameplay", "controls-actions", "controls-ui", "controls-mouse", "controls-gamepad", "controls-touch", "display", "audio"];
const knownPages = new Set<Page>([
  "account", "profile", "store",
  "gameplay", "controls-actions", "controls-ui", "controls-mouse", "controls-gamepad", "controls-touch", "display", "audio",
  "world", "material", "model", "item", "biome", "generator", "admin", "entities",
  ...managerKinds,
]);
const capabilityPages = new Set<Page>(["world", "material", "model", "item", "biome", "generator", "admin", "entities", ...managerKinds]);

const pageLabels: Partial<Record<Page, string>> = {
  store: "Store",
  world: "World Editor",
  material: "Material Editor",
  model: "Model Editor",
  item: "Item Editor",
  biome: "Biome Editor",
  generator: "World Settings",
  entities: "Server Tools",
};

function requestedPage(): Page {
  const value = new URLSearchParams(window.location.search).get("page") as Page | null;
  return value && knownPages.has(value) ? value : "account";
}

function NavigationTree({
  id,
  label,
  target,
  links,
  expanded,
  page,
  onNavigate,
  onToggle,
  available,
}: Readonly<{
  id: TreeId;
  label: string;
  target: Page;
  links: readonly TreeLink[];
  expanded: boolean;
  page: Page;
  onNavigate: (page: Page) => void;
  onToggle: () => void;
  available: boolean;
}>) {
  const selected = page === target || links.some((link) => link.page === page);
  return <section className="dashboard-navigation-tree">
    <div className="dashboard-navigation-tree__heading">
      <button type="button" aria-current={selected ? "page" : undefined} disabled={!available} title={available ? undefined : "Requires a server-validated capability projection"} onClick={() => onNavigate(target)}>{label}</button>
      <button
        type="button"
        className="dashboard-navigation-tree__toggle"
        aria-controls={`dashboard-${id}-links`}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
        disabled={!available}
        onClick={onToggle}
      ><span aria-hidden="true">▸</span></button>
    </div>
    {expanded ? <div id={`dashboard-${id}-links`} className="dashboard-navigation-tree__links">
      {links.map((link) => <button type="button" aria-current={page === link.page ? "page" : undefined} onClick={() => onNavigate(link.page)} key={`${id}-${link.label}`}>{link.label}</button>)}
    </div> : null}
  </section>;
}

export function Dashboard({ projection, onBack, onLogout }: Readonly<{
  projection: GatewaySessionProjection;
  onBack: () => void;
  onLogout: () => void;
}>) {
  const [page, setPage] = useState<Page>(requestedPage);
  const [openTrees, setOpenTrees] = useState<ReadonlySet<TreeId>>(() => new Set());
  const selected = projection.selection.characters.find((character) => character.id === projection.selection.selectedCharacterId)
    ?? projection.selection.characters[0];
  const user = useMemo(() => ({
    id: selected?.id ?? "authenticated-user",
    username: selected?.displayName ?? "traveler",
    displayName: selected?.displayName ?? "Traveler",
  }), [selected]);

  const navigate = (next: Page) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", next);
    window.history.pushState({}, "", url);
    setPage(next);
  };
  const toggleTree = (id: TreeId) => setOpenTrees((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  useEffect(() => {
    const returnToGame = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      event.preventDefault();
      onBack();
    };
    window.addEventListener("keydown", returnToGame);
    return () => window.removeEventListener("keydown", returnToGame);
  }, [onBack]);

  return <main className="dashboard-page app-page" aria-label="Knowhere Dashboard">
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <button className="dashboard-brand" type="button" onClick={onBack} aria-label="Return to game">
        <img src="/dashboard/escape.svg" alt="" />
        <span className="dashboard-brand__copy"><strong>Knowhere</strong><span>Dashboard Prototype</span></span>
      </button>

      <nav className="dashboard-navigation__top" aria-label="Primary">
        <button type="button" aria-current={page === "account" || page === "profile" ? "page" : undefined} onClick={() => navigate("account")}>Account Settings</button>
        <button type="button" aria-current={gameSettingsPages.includes(page) ? "page" : undefined} onClick={() => navigate("gameplay")}>Game Settings</button>
      </nav>

      <nav className="dashboard-navigation__middle" aria-label="Store">
        <button type="button" aria-current={page === "store" ? "page" : undefined} onClick={() => navigate("store")}>Store</button>
      </nav>

      <div className="dashboard-navigation__lower">
        <nav className="dashboard-navigation__admin" aria-label="Administration">
          <NavigationTree id="admin" label="Admin Tools" target="admin" links={adminLinks} expanded={openTrees.has("admin")} page={page} onNavigate={navigate} onToggle={() => toggleTree("admin")} available />
        </nav>
        <nav className="dashboard-navigation__admin" aria-label="Creator tools">
          <NavigationTree id="creator" label="Creator Tools" target="world" links={creatorLinks} expanded={openTrees.has("creator")} page={page} onNavigate={navigate} onToggle={() => toggleTree("creator")} available />
        </nav>
      </div>

      <nav className="dashboard-navigation__bottom" aria-label="Session">
        <button type="button" onClick={onLogout}>Logout</button>
      </nav>
    </aside>

    <section className="dashboard-content">
      {gameSettingsPages.includes(page) ? <nav className="dashboard-prototype-tabs" aria-label="Game settings categories">
        <button type="button" className={page === "gameplay" ? "active" : ""} onClick={() => navigate("gameplay")}>Game</button>
        <button type="button" className={page.startsWith("controls-") ? "active" : ""} onClick={() => navigate("controls-actions")}>Controls</button>
        <button type="button" className={page === "display" ? "active" : ""} onClick={() => navigate("display")}>Display</button>
        <button type="button" className={page === "audio" ? "active" : ""} onClick={() => navigate("audio")}>Audio</button>
      </nav> : null}

      {page === "account" ? <article className="dashboard-account-landing">
          <p className="dashboard-eyebrow">Account</p>
          <h1>Account Settings</h1>
          <button type="button" className="dashboard-account-identity" onClick={() => navigate("profile")} aria-label="Open account profile settings">{user.username} · Player</button>
        </article>
        : page === "profile" ? <DashboardSettingsPage page="profile" user={user} onNavigate={(next) => navigate(next as Page)} />
        : page === "store" ? <article className="dashboard-prototype-placeholder"><p className="dashboard-eyebrow">Store</p><h1>Store</h1><p>Store inventory will be added here.</p></article>
        : capabilityPages.has(page) ? <article className="dashboard-prototype-placeholder"><p className="dashboard-eyebrow">Unavailable</p><h1>Capability required</h1><p>This panel requires a server-validated capability projection.</p></article>
        : (["gameplay", "controls-actions", "controls-ui", "controls-mouse", "controls-gamepad", "controls-touch", "display", "audio"] as Page[]).includes(page) ? <DashboardSettingsPage page={page as SettingsDashboardPage} user={user} onNavigate={(next) => navigate(next as Page)} />
        : <article className="dashboard-prototype-placeholder"><p className="dashboard-eyebrow">Creator Tools</p><h1>{pageLabels[page] ?? "Knowhere"}</h1><p>This workspace is preserved in navigation while its server-owned editing contract remains unavailable.</p></article>}
    </section>
  </main>;
}
