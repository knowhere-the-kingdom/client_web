import { useMemo, useState } from "react";

export type ManagerKind = "users" | "roles" | "groups" | "skills" | "stats" | "materia";

type ManagerRow = Readonly<{
  id: string;
  name: string;
  subtitle: string;
  status: "active" | "draft" | "review" | "system" | "suspended";
  columns: readonly string[];
  summary: string;
  references: readonly string[];
  audit: readonly string[];
}>;

type ManagerDefinition = Readonly<{
  title: string;
  eyebrow: "Social" | "System";
  description: string;
  createLabel: string;
  searchPlaceholder: string;
  columns: readonly string[];
  filters: readonly string[];
  rows: readonly ManagerRow[];
}>;

const definitions: Record<ManagerKind, ManagerDefinition> = {
  users: {
    title: "User Manager", eyebrow: "Social", createLabel: "Create User", searchPlaceholder: "Search username, role, or status…", columns: ["User", "Status", "Roles", "Last Active"], filters: ["All users", "Active", "Suspended"], description: "Registered accounts, sessions, roles, groups, and access history.",
    rows: [
      row("testadmin", "Test Admin", "Development administrator", "active", ["active", "Player + Designer + Admin", "now"], "Development seed with World Designer and Admin capabilities.", ["roles: player, world-designer, administrator", "groups: none"], ["Login allowed", "Admin capability read allowed"]),
      row("testuser", "TestUser", "Development player", "active", ["active", "Player", "now"], "Development seed with player-only capabilities.", ["roles: player", "groups: none"], ["Login allowed", "Admin capability read denied"])
    ]
  },
  roles: {
    title: "Role Manager", eyebrow: "Social", createLabel: "Create Role", searchPlaceholder: "Search role or permission…", columns: ["Role", "Type", "Grants", "Members"], filters: ["All roles", "System", "Custom"], description: "Reusable permission bundles with scoped allow/deny grants.",
    rows: [
      row("administrator", "Administrator", "System role", "system", ["system", "21 grants", "1"], "Audited administration capabilities without implicit owner bypass.", ["admin.*", "world.*"], ["Seeded by local identity store"]),
      row("world-designer", "World Designer", "System role", "system", ["system", "11 grants", "1"], "Material, model, item, biome, and world recipe authoring.", ["world.designer.read", "world.*.read/edit"], ["Seeded by local identity store"]),
      row("player", "Player", "System role", "system", ["system", "5 grants", "2"], "Self-service profile, knowledge, and settings capabilities.", ["profile.*.self", "knowledge.read.self", "settings.*.self"], ["Seeded by local identity store"])
    ]
  },
  groups: {
    title: "Group Manager", eyebrow: "Social", createLabel: "Create Group", searchPlaceholder: "Search group or member…", columns: ["Group", "Status", "Roles", "Members"], filters: ["All groups", "Active", "Archived"], description: "Organizational membership, scoped roles, and shared resource access.",
    rows: [
      row("keepers", "The Keepers", "Kingdom stewards", "draft", ["draft", "Administrator", "0"], "Administrative group prepared for audited membership management.", ["role: administrator", "scope: global"], ["Definition draft created"]),
      row("world-builders", "World Builders", "Authoring team", "draft", ["draft", "World Designer", "0"], "Creators responsible for materials, models, items, and worlds.", ["role: world-designer", "scope: world/content"], ["Definition draft created"])
    ]
  },
  skills: {
    title: "Skill Manager", eyebrow: "System", createLabel: "Create Skill", searchPlaceholder: "Search skill, tag, or effect…", columns: ["Skill", "State", "Trigger", "References"], filters: ["All skills", "Draft", "Published", "Deprecated"], description: "Typed combat, movement, utility, and item-granted abilities.",
    rows: [
      row("swing", "Swing", "Melee weapon action", "draft", ["draft", "action", "strength, weapon damage"], "A short melee arc using typed targeting, cost, cooldown, and scaling effects.", ["stat: strength", "stat: physical-damage", "item categories: weapon, tool"], ["Draft example for World Designer authoring"]),
      row("throw", "Throw", "Projectile item action", "draft", ["draft", "action", "strength, projectile speed"], "Throws an equipped compatible item and resolves impact through typed effects.", ["stat: strength", "stat: projectile-speed", "requires throwable item"], ["Draft example for World Designer authoring"])
    ]
  },
  stats: {
    title: "Stat Manager", eyebrow: "System", createLabel: "Create Stat", searchPlaceholder: "Search stat, namespace, or formula…", columns: ["Stat", "State", "Unit", "Aggregation"], filters: ["All stats", "Core", "Combat", "Elemental", "Utility"], description: "Typed RPG attributes, derived formulas, ranges, and aggregation rules.",
    rows: [
      row("strength", "Strength", "core.strength", "draft", ["draft", "points", "additive"], "Core attribute used by melee and throwing skills.", ["skills: swing, throw", "items: strength modifiers"], ["Draft example"]),
      row("crit-chance", "Critical Chance", "combat.critChance", "draft", ["draft", "percent", "capped additive"], "Chance for eligible damage effects to critically strike.", ["crit damage", "damage effects"], ["Draft example"]),
      row("cooldown", "Cooldown", "combat.cooldown", "draft", ["draft", "seconds", "replace / modifier"], "Base recovery time applied to equipped items and skills. HUD slots expose remaining time and radial progress when this stat is present.", ["items: equipped actions", "skills: active abilities", "HUD: cooldown overlay"], ["HUD contract added"]),
      row("fire-damage", "Fire Damage", "elemental.fire.damage", "draft", ["draft", "damage", "additive/multiplicative"], "Typed elemental damage channel for items, skills, and materia.", ["fire resistance", "burn effect"], ["Draft example"])
    ]
  },
  materia: {
    title: "Materia Manager", eyebrow: "System", createLabel: "Create Materia", searchPlaceholder: "Search materia, socket, stat, or skill…", columns: ["Materia", "State", "Socket", "Grants"], filters: ["All materia", "Draft", "Published", "Archived"], description: "Socketable gear augments combining validated stat modifiers and skill grants.",
    rows: [
      row("ember-core", "Ember Core", "Fire offense materia", "draft", ["draft", "red", "+fire damage"], "Adds fire damage and may grant a typed burn skill at higher tiers.", ["stat: fire-damage", "skill: burn", "gear: weapon/accessory"], ["Draft example"]),
      row("gale-shard", "Gale Shard", "Movement materia", "draft", ["draft", "green", "+movement / throw"], "Improves movement and projectile behavior for compatible gear.", ["stat: movement-speed", "stat: projectile-speed", "skill: throw"], ["Draft example"])
    ]
  }
};

function row(id: string, name: string, subtitle: string, status: ManagerRow["status"], columns: readonly string[], summary: string, references: readonly string[], audit: readonly string[]): ManagerRow {
  return { id, name, subtitle, status, columns, summary, references, audit };
}

export function ManagerPage({ kind, onBack }: Readonly<{ kind: ManagerKind; onBack?: () => void }>) {
  const definition = definitions[kind];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(definition.filters[0]);
  const [selectedId, setSelectedId] = useState(definition.rows[0]?.id ?? "");
  const [tab, setTab] = useState<"overview" | "references" | "audit">("overview");
  const visibleRows = useMemo(() => definition.rows.filter((entry) => {
    const haystack = `${entry.name} ${entry.subtitle} ${entry.status} ${entry.columns.join(" ")}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const normalizedFilter = filter.toLowerCase();
    const matchesFilter = normalizedFilter.startsWith("all ") || haystack.includes(normalizedFilter);
    return matchesQuery && matchesFilter;
  }), [definition, filter, query]);
  const selected = visibleRows.find((entry) => entry.id === selectedId) ?? visibleRows[0];

  return <section className="manager-page" aria-label={definition.title}>
    <header className="manager-header"><div>{onBack ? <button type="button" onClick={onBack}>← Admin</button> : null}<span>{definition.eyebrow} manager · shared workspace</span><h1>{definition.title}</h1><p>{definition.description}</p></div><div className="manager-header-actions"><i>UI implemented</i><button type="button" disabled title="Requires audited server mutation endpoints">{definition.createLabel}</button></div></header>
    <div className="manager-summary"><article><span>Records</span><b>{definition.rows.length}</b></article><article><span>Visible</span><b>{visibleRows.length}</b></article><article><span>Drafts</span><b>{definition.rows.filter((entry) => entry.status === "draft").length}</b></article><article><span>Backend</span><b>Planned</b></article></div>
    <div className="manager-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={definition.searchPlaceholder} aria-label={`Search ${definition.title}`} /><select value={filter} onChange={(event) => setFilter(event.target.value)}>{definition.filters.map((entry) => <option key={entry}>{entry}</option>)}</select><button type="button" disabled>Bulk Actions</button></div>
    <div className="manager-workspace">
      <section className="manager-list"><header>{definition.columns.map((entry) => <span key={entry}>{entry}</span>)}</header>{visibleRows.map((entry) => <button type="button" className={entry.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(entry.id)} key={entry.id}><span><b>{entry.name}</b><small>{entry.subtitle}</small></span>{entry.columns.map((value, index) => <span key={`${entry.id}-${index}`}>{index === 0 ? <i className={`manager-status manager-status-${entry.status}`}>{value}</i> : value}</span>)}</button>)}{visibleRows.length === 0 ? <p>No records match this search.</p> : null}</section>
      <aside className="manager-inspector">{selected ? <><header><div><span>{selected.status}</span><h2>{selected.name}</h2><small>{selected.id}</small></div><button type="button" disabled>Edit</button></header><nav>{(["overview", "references", "audit"] as const).map((entry) => <button type="button" className={tab === entry ? "active" : ""} onClick={() => setTab(entry)} key={entry}>{entry}</button>)}</nav>{tab === "overview" ? <section><h3>Summary</h3><p>{selected.summary}</p><label>Stable ID<input value={selected.id} readOnly /></label><label>Status<input value={selected.status} readOnly /></label></section> : null}{tab === "references" ? <section><h3>References</h3>{selected.references.map((entry) => <div className="manager-reference" key={entry}>{entry}</div>)}</section> : null}{tab === "audit" ? <section><h3>Audit preview</h3>{selected.audit.map((entry) => <div className="manager-audit" key={entry}><i />{entry}</div>)}</section> : null}<footer><button type="button" disabled>Archive</button><button type="button" disabled>Save Draft</button></footer></> : <p>Select a record.</p>}</aside>
    </div>
  </section>;
}

export function ManagerOverview({ onPreview }: Readonly<{ onPreview: (kind: ManagerKind) => void }>) {
  return <article className="dashboard-card manager-overview"><span>Admin system</span><h1>Administration</h1><p>All six managers use one list, filter, selection, inspector, reference, and audit model. Read-only administration is implemented; privileged writes stay disabled until persistent repositories and audited permission middleware are complete.</p><div>{(Object.keys(definitions) as ManagerKind[]).map((kind) => <section key={kind}><b>{definitions[kind].title}</b><small>{definitions[kind].eyebrow} · UI implemented</small><p>{definitions[kind].description}</p><button type="button" onClick={() => onPreview(kind)}>Open Manager</button></section>)}</div></article>;
}
