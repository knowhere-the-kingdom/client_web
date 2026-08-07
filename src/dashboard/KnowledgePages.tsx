import { useMemo, useState } from "react";

export type KnowledgePageKind = "avatars" | "collections" | "reputation" | "achievements";

type KnowledgeRecord = Readonly<{
  id: string;
  name: string;
  subtitle: string;
  category: string;
  state: "collected" | "unlocked" | "progress" | "locked" | "honored" | "friendly" | "neutral";
  progress: number;
  glyph: string;
  description: string;
  details: readonly string[];
}>;

type KnowledgeDefinition = Readonly<{
  title: string;
  description: string;
  searchPlaceholder: string;
  actionLabel: string;
  records: readonly KnowledgeRecord[];
}>;

const definitions: Record<KnowledgePageKind, KnowledgeDefinition> = {
  avatars: {
    title: "Avatars",
    description: "Collected identities and playable spirit forms available to this account.",
    searchPlaceholder: "Search avatar, lineage, or role…",
    actionLabel: "Use Avatar",
    records: [
      record("wanderer", "Garden Wanderer", "Human explorer", "Humanoid", "collected", 100, "GW", "A balanced traveler attuned to Garden paths and local settlements.", ["Lineage: Human", "Role: Explorer", "Source: Starting collection"]),
      record("wraith", "Silver Wraith", "Spectral scout", "Spirit", "collected", 100, "SW", "A quiet spirit form with a silverwhite presence and swift traversal profile.", ["Lineage: Spirit", "Role: Scout", "Source: First Steps"]),
      record("keeper", "Keeper Initiate", "Kingdom steward", "Humanoid", "unlocked", 100, "KI", "An initiate of the Keepers carrying the marks of local service.", ["Lineage: Human", "Role: Steward", "Source: Keepers reputation"]),
      record("ember", "Ember Construct", "Volcanic guardian", "Construct", "locked", 35, "EC", "A material-bound guardian assembled from basalt and ember cores.", ["Lineage: Construct", "Role: Guardian", "Unlock: Volcanic collection 35%"]),
    ],
  },
  collections: {
    title: "Collections",
    description: "Every discovered block, material, item, model, and materia entry grouped by category.",
    searchPlaceholder: "Search collected items…",
    actionLabel: "Pin Entry",
    records: [
      record("grass-block", "Grass Block", "Temperate surface voxel", "Blocks", "collected", 100, "GB", "Soil capped with living grass for temperate terrain.", ["Material: Soil + vegetation", "Biome: Temperate", "Rarity: Common"]),
      record("basalt", "Basalt", "Volcanic base material", "Materials", "collected", 100, "BA", "Dense dark volcanic stone used by terrain, models, and crafted items.", ["Family: Stone", "Subtype: Volcanic", "Editor: Material planned"]),
      record("glass-blade", "Glass Blade", "One-handed weapon", "Items", "collected", 100, "GL", "A lightweight blade represented in the current inventory prototype.", ["Category: Weapon", "Skills: Swing", "Rarity: Uncommon"]),
      record("lantern", "Keeper Lantern", "Portable utility model", "Models", "collected", 100, "KL", "A compact model for light-bearing equipment and world props.", ["Category: Tool", "Layers: 3", "Model editor compatible"]),
      record("ember-core", "Ember Core", "Fire offense socket", "Materia", "progress", 60, "EM", "A socketable fire augmentation referencing fire damage and burn effects.", ["Socket: Red", "Tier: I", "Discovery: 3 / 5 fragments"]),
      record("ice", "Glacial Ice", "Frozen terrain voxel", "Blocks", "unlocked", 100, "GI", "Cold-climate terrain material used for frozen water and mountain shelves.", ["Material: Ice", "Biome: Tundra", "Rarity: Common"]),
    ],
  },
  reputation: {
    title: "Reputation",
    description: "Faction standing, current rank, rewards, and progress toward the next threshold.",
    searchPlaceholder: "Search faction or standing…",
    actionLabel: "Track Faction",
    records: [
      record("keepers", "The Keepers", "Kingdom stewards", "Kingdom", "honored", 68, "TK", "Stewards of safe paths, archives, and the shared systems of Knowhere.", ["Standing: Honored", "Next rank: Revered", "Reward: Keeper avatar"]),
      record("wraith-market", "Wraith Market", "Spectral traders", "Independent", "neutral", 32, "WM", "A loose network trading rare spirit materials and forgotten objects.", ["Standing: Neutral", "Next rank: Friendly", "Reward: Wraithcloth recipes"]),
      record("garden-circle", "Garden Circle", "Growers and naturalists", "Garden", "friendly", 54, "GC", "Naturalists cataloging biomes, plants, soil, and water systems.", ["Standing: Friendly", "Next rank: Honored", "Reward: Seed collection"]),
      record("ember-court", "Ember Court", "Volcanic enclave", "Outer Kingdom", "neutral", 18, "EC", "An isolated court surrounding the volcanic provinces and lava fields.", ["Standing: Neutral", "Next rank: Friendly", "Reward: Ember fragments"]),
    ],
  },
  achievements: {
    title: "Achievements",
    description: "Account and world milestones with category, unlock state, and measured progress.",
    searchPlaceholder: "Search achievement or category…",
    actionLabel: "Track Achievement",
    records: [
      record("first-steps", "First Steps", "Enter the Garden", "Exploration", "unlocked", 100, "FS", "Enter a playable Garden world for the first time.", ["Reward: Silver Wraith avatar", "Unlocked locally", "Score: 10"]),
      record("bag-hoarder", "Bag Hoarder", "Collect five containers", "Collection", "progress", 60, "BH", "Discover or equip five distinct inventory containers.", ["Progress: 3 / 5", "Reward: Expanded collection badge", "Score: 20"]),
      record("world-reader", "World Reader", "Inspect every map layer", "World", "progress", 42, "WR", "Inspect the major terrain, climate, hydrology, and biome map outputs.", ["Progress: 5 / 12", "Reward: Cartographer title", "Score: 30"]),
      record("nine-lives", "Nine Lives", "Survive nine critical falls", "Challenge", "locked", 11, "NL", "Recover from nine falls that would otherwise end an expedition.", ["Progress: 1 / 9", "Reward: Wraithstep effect", "Score: 50"]),
    ],
  },
};

function record(id: string, name: string, subtitle: string, category: string, state: KnowledgeRecord["state"], progress: number, glyph: string, description: string, details: readonly string[]): KnowledgeRecord {
  return { id, name, subtitle, category, state, progress, glyph, description, details };
}

function selectionKey(userId: string, kind: KnowledgePageKind) {
  return `knowhere.dashboard.knowledge.v1.${userId}.${kind}`;
}

export function KnowledgePage({ kind, userId }: Readonly<{ kind: KnowledgePageKind; userId: string }>) {
  const definition = definitions[kind];
  const categories = useMemo(() => ["All categories", ...new Set(definition.records.map((entry) => entry.category))], [definition]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [selectedId, setSelectedId] = useState(definition.records[0]?.id ?? "");
  const [trackedId, setTrackedId] = useState(() => window.localStorage.getItem(selectionKey(userId, kind)) ?? "");
  const visible = useMemo(() => definition.records.filter((entry) => {
    const matchesCategory = category === "All categories" || entry.category === category;
    const haystack = `${entry.name} ${entry.subtitle} ${entry.category} ${entry.state} ${entry.details.join(" ")}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [category, definition, query]);
  const selected = visible.find((entry) => entry.id === selectedId) ?? visible[0];
  const completed = definition.records.filter((entry) => entry.progress === 100).length;
  const average = Math.round(definition.records.reduce((sum, entry) => sum + entry.progress, 0) / Math.max(1, definition.records.length));
  const track = (id: string) => {
    window.localStorage.setItem(selectionKey(userId, kind), id);
    setTrackedId(id);
  };

  return <section className="knowledge-page" aria-label={definition.title}>
    <header className="knowledge-header"><div><span>Knowledge</span><h1>{definition.title}</h1><p>{definition.description}</p></div><i>Local catalog</i></header>
    <div className="knowledge-summary"><article><span>Entries</span><b>{definition.records.length}</b></article><article><span>Visible</span><b>{visible.length}</b></article><article><span>Complete</span><b>{completed}</b></article><article><span>Progress</span><b>{average}%</b></article></div>
    <div className="knowledge-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={definition.searchPlaceholder} aria-label={`Search ${definition.title}`} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={`${definition.title} category`}>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select></div>
    <div className="knowledge-workspace">
      <section className="knowledge-grid" aria-label={`${definition.title} entries`}>{visible.map((entry) => <button type="button" className={`${entry.id === selected?.id ? "active" : ""} ${entry.id === trackedId ? "tracked" : ""}`} onClick={() => setSelectedId(entry.id)} key={entry.id}><span className="knowledge-glyph">{entry.glyph}</span><span><b>{entry.name}</b><small>{entry.subtitle}</small></span><i className={`knowledge-state knowledge-state-${entry.state}`}>{entry.state}</i><div><span style={{ width: `${entry.progress}%` }} /></div></button>)}{visible.length === 0 ? <p>No collected entries match these filters.</p> : null}</section>
      <aside className="knowledge-inspector">{selected ? <><header><span className="knowledge-glyph">{selected.glyph}</span><div><small>{selected.category}</small><h2>{selected.name}</h2><i className={`knowledge-state knowledge-state-${selected.state}`}>{selected.state}</i></div></header><section><p>{selected.description}</p><div className="knowledge-progress"><span><b>Progress</b><output>{selected.progress}%</output></span><div><span style={{ width: `${selected.progress}%` }} /></div></div><h3>Details</h3>{selected.details.map((entry) => <div className="knowledge-detail" key={entry}>{entry}</div>)}</section><footer><button className={selected.id === trackedId ? "dashboard-primary" : ""} type="button" onClick={() => track(selected.id)}>{selected.id === trackedId ? "Selected" : definition.actionLabel}</button></footer></> : <p>Select a collected entry.</p>}</aside>
    </div>
    <p className="knowledge-source-note">This UI uses the current local demonstration catalog. Authoritative unlocks and rewards will replace these records through the Knowledge repository without changing the page model.</p>
  </section>;
}
