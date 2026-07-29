import { useMemo, useState } from "react";
import type { GatewaySessionProjection } from "./api/gateway-contract";
import { DashboardSettingsPage, type SettingsDashboardPage } from "./dashboard/DashboardSettingsPages";
import { KnowledgePage, type KnowledgePageKind } from "./dashboard/KnowledgePages";
import { ManagerOverview, ManagerPage, type ManagerKind } from "./dashboard/ManagerPage";

type Page = "profile" | "account" | KnowledgePageKind | SettingsDashboardPage | "world" | "material" | "model" | "item" | "biome" | "generator" | "admin" | "entities" | ManagerKind;
type Entry = Readonly<{ page: Page; label: string; available: boolean; section?: string }>;
type Group = Readonly<{ id: string; label: string; entries: readonly Entry[] }>;

const groups: readonly Group[] = [
  { id: "account", label: "Account", entries: [{ page: "profile", label: "Profile Page", available: true }, { page: "account", label: "Account Settings", available: true }] },
  { id: "knowledge", label: "Knowledge", entries: [{ page: "avatars", label: "Avatars", available: true }, { page: "collections", label: "Collections", available: true }, { page: "reputation", label: "Reputation", available: true }, { page: "achievements", label: "Achievements", available: true }] },
  { id: "game", label: "Game Settings", entries: [{ page: "gameplay", label: "Gameplay", available: true }, { page: "controls-actions", label: "Game Actions", available: true, section: "Controls" }, { page: "controls-ui", label: "UI Controls", available: true, section: "Controls" }, { page: "controls-mouse", label: "Mouse Settings", available: true, section: "Controls" }, { page: "controls-gamepad", label: "Gamepad", available: true, section: "Controls" }, { page: "display", label: "Display", available: true }, { page: "audio", label: "Audio", available: true }] },
  { id: "world", label: "World Designer", entries: [{ page: "world", label: "World Designer Overview", available: false }, { page: "material", label: "Material Editor", available: false }, { page: "model", label: "Model Editor", available: false }, { page: "item", label: "Item Editor", available: false }, { page: "biome", label: "Biome Graphs", available: false }, { page: "generator", label: "World Generator", available: false }] },
  { id: "admin", label: "Admin", entries: [{ page: "admin", label: "Admin Overview", available: false }, { page: "entities", label: "Entity Manager", available: false, section: "Clockwork" }, { page: "users", label: "User Manager", available: false, section: "Social" }, { page: "roles", label: "Role Manager", available: false, section: "Social" }, { page: "groups", label: "Group Manager", available: false, section: "Social" }, { page: "skills", label: "Skill Manager", available: false, section: "System" }, { page: "stats", label: "Stat Manager", available: false, section: "System" }, { page: "materia", label: "Materia Manager", available: false, section: "System" }] },
];

function requestedPage(): Page {
  const value = new URLSearchParams(window.location.search).get("page") as Page | null;
  return groups.some((group) => group.entries.some((entry) => entry.page === value)) ? value! : "profile";
}

export function Dashboard({ projection, onBack, onLogout }: Readonly<{ projection: GatewaySessionProjection; onBack: () => void; onLogout: () => void }>) {
  const [page, setPage] = useState<Page>(requestedPage);
  const [open, setOpen] = useState(() => new Set(groups.map((group) => group.id)));
  const [railVisible, setRailVisible] = useState(true);
  const selected = projection.selection.characters.find((character) => character.id === projection.selection.selectedCharacterId) ?? projection.selection.characters[0];
  const user = useMemo(() => ({ id: selected?.id ?? "authenticated-user", username: selected?.displayName ?? "traveler", displayName: selected?.displayName ?? "Traveler" }), [selected]);
  const navigate = (next: Page) => { const url = new URL(window.location.href); url.searchParams.set("page", next); window.history.pushState({}, "", url); setPage(next); };
  const entry = groups.flatMap((group) => group.entries).find((candidate) => candidate.page === page);
  const managerKinds: readonly ManagerKind[] = ["users", "roles", "groups", "skills", "stats", "materia"];

  return <main className={`dashboard-page app-page ${railVisible ? "dashboard-rail-visible" : "dashboard-rail-hidden"}`} aria-label="Knowhere Dashboard">
    <aside className="dashboard-sidebar"><header><div className="dashboard-sidebar-topline"><button className="dashboard-back-link" type="button" onClick={onBack}>← Back to Game</button><button className="kh-button kh-button-ghost dashboard-rail-toggle" type="button" onClick={() => setRailVisible(false)}>◀</button></div><button className="dashboard-brand" type="button" onClick={() => navigate("profile")}><b>Knowhere</b><span>the Kingdom</span></button></header>
      <nav>{groups.map((group) => <section className="dashboard-nav-group" key={group.id}><button className="kh-button kh-button-outline dashboard-nav-trigger" type="button" aria-expanded={open.has(group.id)} onClick={() => setOpen((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}><span>{open.has(group.id) ? "▾" : "▸"}</span><span className="dashboard-nav-label">{group.label}</span></button>{open.has(group.id) ? <div className="dashboard-nav-content">{group.entries.map((item, index) => <span className={`dashboard-nav-entry dashboard-nav-entry-${item.available ? "complete" : "not-started"}`} key={item.page}>{item.section && item.section !== group.entries[index - 1]?.section ? <em>{item.section}</em> : null}<button className={`kh-button kh-button-ghost${page === item.page ? " active" : ""}`} type="button" disabled={!item.available} title={item.available ? item.label : `${item.label} — server contract unavailable`} onClick={() => navigate(item.page)}><span className="dashboard-nav-label">{item.label}</span><span className={`dashboard-status-dot dashboard-status-dot-${item.available ? "complete" : "not-started"}`} /></button></span>)}</div> : null}</section>)}</nav>
      <footer><button className="kh-button kh-button-outline" type="button" onClick={onLogout}>Sign Out</button></footer>
    </aside>
    {!railVisible ? <button className="dashboard-rail-reveal" type="button" onClick={() => setRailVisible(true)}>☰ <span>Show navigation</span></button> : null}
    <section className="dashboard-content">
      {!entry?.available ? <article className="dashboard-card"><span>Visible · unavailable</span><h1>{entry?.label}</h1><p>This legacy workspace is preserved exactly in navigation, but its mutations remain disabled until an owning service publishes the required audited API.</p><div className="dashboard-placeholder">No browser or local-storage authority is substituted.</div></article>
        : managerKinds.includes(page as ManagerKind) ? <ManagerPage kind={page as ManagerKind} onBack={() => navigate("admin")} />
        : page === "admin" ? <ManagerOverview onPreview={(kind) => navigate(kind)} />
        : (["avatars", "collections", "reputation", "achievements"] as Page[]).includes(page) ? <KnowledgePage kind={page as KnowledgePageKind} userId={user.id} />
        : (["profile", "account", "gameplay", "controls-actions", "controls-ui", "controls-mouse", "controls-gamepad", "display", "audio"] as Page[]).includes(page) ? <DashboardSettingsPage page={page as SettingsDashboardPage} user={user} onNavigate={(next) => navigate(next as Page)} />
        : <article className="dashboard-card"><span>Dashboard</span><h1>{entry?.label ?? "Knowhere"}</h1><p>The legacy dashboard presentation is connected to the authenticated Gateway session.</p></article>}
    </section>
  </main>;
}
