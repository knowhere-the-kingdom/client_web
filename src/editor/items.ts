type TerrainBlockDocument = Readonly<{ slug: string; name: string; materialId: string; variantId?: string; lightResponse: string; generationContexts: readonly string[]; placement: Readonly<{ placeable: boolean; fluid: boolean }> }>;
const TERRAIN_BLOCK_DOCUMENTS: readonly TerrainBlockDocument[] = [];

export type ItemCategory = "weapon" | "shield" | "tool" | "block.terrain" | "armor" | "accessory" | "bag" | "consumable" | "material" | "key" | "quest" | "tome" | "map" | "settings" | "menu" | "cosmetic";
export type ItemRarity = "junk" | "common" | "uncommon" | "rare" | "epic" | "mythic" | "legendary";
export type ItemFootprint = "1x1" | "2x1" | "1x2" | "2x2" | "1x3" | "2x3";
export type ItemActionKind = "none" | "open-menu" | "open-bag" | "equip" | "unequip" | "consume" | "swing" | "power-swing" | "block" | "shield-bash" | "place-block" | "remove-block" | "mine-block" | "dig-block" | "light" | "inspect" | "select" | "cast-skill";
export type ItemActionTrigger = "leftClick" | "rightClick" | "holdLeft" | "holdRight";
export type CollectorSeedKind = "item" | "stat" | "skill" | "materia";
export type HeldItemTargetDirection = "selected" | "adjacent";
export type HeldItemTargetDiagnosticCode = "held-item.missing" | "held-item.stale" | "held-item.non-placeable" | "held-item.exhausted" | "held-item.incompatible" | "held-item.unknown";
export type EquipmentLayoutV2Stack = "left" | "right";
export type EquipmentLayoutV2RegionId = "head" | "outfit" | "belt" | "foot" | "face" | "neck" | "hands" | "ring-a" | "ring-b";
export type EquipmentLayoutV2LaneId = "glove-left" | "glove-right";
export type EquipmentLayoutV2Kind = "head" | "outfit" | "belt" | "feet" | "face" | "neck" | EquipmentLayoutV2LaneId | "ring";
export type EquipmentLayoutV2DiagnosticCode =
  | "equipment.slot.unknown"
  | "equipment.kind.mismatch"
  | "equipment.footprint.overflow"
  | "equipment.occupancy.overlap"
  | "equipment.occupancy.occupied"
  | "equipment.item.stale"
  | "equipment.assignment.earring-removed";

export type RevisionPin = Readonly<{ definitionId: string; revision: number; slug?: string; documentVersion?: number; contentHash?: string; materialId?: string; blockId?: string; variantId?: string }>;
export type ItemAction = Readonly<{ kind: ItemActionKind; skill?: RevisionPin; label: string; repeatable?: boolean }>;
export type ItemStatSlot = Readonly<{ stat: RevisionPin; min: number; max: number; qualityCurve: "linear" | "front-loaded" | "high-end-spike"; aggregation: "add" | "multiply" | "override" | "max"; appliesWhen: "held" | "equipped" | "in-actionbar" | "in-bag" | "passive" }>;
export type MateriaSocket = Readonly<{ id: string; family: "weapon" | "shield" | "tool" | "terrain" | "armor" | "utility"; size: "minor" | "major" | "core"; acceptsTags: readonly string[]; insertedMateria: RevisionPin | null }>;
export type ItemDefinitionDocument = Readonly<{
  documentType: "item-definition";
  schemaVersion: 1;
  id: string;
  slug: string;
  displayName: string;
  category: ItemCategory;
  rarity: ItemRarity;
  qualityRange: readonly [number, number];
  footprint: ItemFootprint;
  stack: Readonly<{ max: number; mergeKey: string | null }>;
  equipment: Readonly<{ slots: readonly string[]; twoHanded?: boolean }> | null;
  bagGrid: Readonly<{ cols: number; rows: number }> | null;
  actions: Readonly<Record<ItemActionTrigger, ItemAction>>;
  stats: readonly ItemStatSlot[];
  materia: readonly MateriaSocket[];
  modelRevision: RevisionPin | null;
  materialBlock: Readonly<{ materialFamily: string; blockRevision: RevisionPin | null; variantId?: string }> | null;
  icon: string;
  tags: readonly string[];
  availability: readonly string[];
}>;
export type StatDefinitionDocument = Readonly<{
  documentType: "stat-definition";
  schemaVersion: 1;
  id: string;
  slug: string;
  displayName: string;
  namespace: string;
  unit: "points" | "multiplier" | "meters" | "seconds" | "items" | "ratio";
  format: "integer" | "decimal" | "percent";
  defaultValue: number;
  range: readonly [number, number];
  aggregation: "add" | "multiply" | "override" | "max";
  tags: readonly string[];
}>;
export type SkillDefinitionDocument = Readonly<{
  documentType: "skill-definition";
  schemaVersion: 1;
  id: string;
  slug: string;
  displayName: string;
  trigger: ItemActionKind;
  targeting: "self" | "melee" | "block" | "cone" | "inventory" | "equipment";
  cooldownSeconds: number;
  costs: ReadonlyArray<Readonly<{ resource: "spirit" | "durability" | "item-stack"; amount: number }>>;
  effects: ReadonlyArray<Readonly<Record<string, string | number | boolean>>>;
  scalingStats: readonly string[];
  prerequisites: readonly string[];
  blockedStates: readonly string[];
  allowedItemCategories: readonly ItemCategory[];
  tags: readonly string[];
}>;
export type MateriaDefinitionDocument = Readonly<{
  documentType: "materia-definition";
  schemaVersion: 1;
  id: string;
  slug: string;
  displayName: string;
  family: MateriaSocket["family"];
  size: MateriaSocket["size"];
  grantsTags: readonly string[];
  compatibleItemCategories: readonly ItemCategory[];
  effects: ReadonlyArray<Readonly<Record<string, string | number | boolean>>>;
  tags: readonly string[];
}>;
export type CollectorSeedDefinition = Readonly<{ kind: CollectorSeedKind; slug: string; name: string; schemaVersion: 1; payload: Readonly<Record<string, unknown>>; changeNote: string }>;
export type CollectorSeedReference = Readonly<{ slug: string; definitionId: string; revision: number; pin?: RevisionPin }>;
export type HeldItemTargetDiagnostic = Readonly<{ code: HeldItemTargetDiagnosticCode; message: string }>;
export type HeldItemTargetAppearanceDescriptor = Readonly<{
  definitionId: string;
  definitionRevision: number;
  definitionSlug: string;
  actionTrigger: ItemActionTrigger;
  actionKind: ItemActionKind;
  targetDirection: HeldItemTargetDirection;
  rarity: ItemRarity;
  rarityThemeToken: `--color-item-rarity-${ItemRarity}`;
}>;
export type HeldItemTargetAppearanceRequest = Readonly<{
  definitionId?: string | null;
  definitionRevision?: number | null;
  definitionSlug?: string | null;
  document?: ItemDefinitionDocument | null;
  actionTrigger?: ItemActionTrigger;
  expectedDefinitionId?: string | null;
  expectedRevision?: number | null;
  stackQuantity?: number | null;
  compatibleItemCategories?: readonly ItemCategory[];
}>;
export type HeldItemTargetAppearanceResult = Readonly<{ descriptor: HeldItemTargetAppearanceDescriptor | null; diagnostics: readonly HeldItemTargetDiagnostic[] }>;
export type EquipmentLayoutV2GridSize = Readonly<{ cols: number; rows: number }>;
export type EquipmentLayoutV2LaneDescriptor = Readonly<{ id: EquipmentLayoutV2LaneId; label: string; origin: Readonly<{ x: number; y: number }>; grid: EquipmentLayoutV2GridSize; acceptedKinds: readonly EquipmentLayoutV2Kind[] }>;
export type EquipmentLayoutV2RegionDescriptor = Readonly<{ id: EquipmentLayoutV2RegionId; label: string; stack: EquipmentLayoutV2Stack; order: number; grid: EquipmentLayoutV2GridSize; acceptedKinds: readonly EquipmentLayoutV2Kind[]; lanes?: readonly EquipmentLayoutV2LaneDescriptor[] }>;
export type EquipmentLayoutV2Diagnostic = Readonly<{ code: EquipmentLayoutV2DiagnosticCode; message: string; assignmentId?: string; regionId?: string; laneId?: string; itemId?: string }>;
export type EquipmentLayoutV2ItemReference = Readonly<{ definitionId: string; revision: number; document: ItemDefinitionDocument; expectedDefinitionId?: string | null; expectedRevision?: number | null }>;
export type EquipmentLayoutV2Assignment = Readonly<{ id?: string; regionId: string; laneId?: string | null; item: EquipmentLayoutV2ItemReference }>;
export type EquipmentLayoutV2BagPlacement = Readonly<{ itemId: string; x: number; y: number; cols: number; rows: number }>;
export type RemovedEarringAssignment = Readonly<{ assignmentId?: string; itemId: string; footprint: ItemFootprint }>;
export type EquipmentLayoutV2MigrationRequest = Readonly<{ removedEarringAssignments: readonly RemovedEarringAssignment[]; bagGrid: EquipmentLayoutV2GridSize; existingBagPlacements?: readonly EquipmentLayoutV2BagPlacement[] }>;
export type EquipmentLayoutV2MigrationResult = Readonly<{ placements: readonly EquipmentLayoutV2BagPlacement[]; recovery: readonly Readonly<{ assignmentId?: string; itemId: string; reason: "no-compatible-bag-cell" }>[]; diagnostics: readonly EquipmentLayoutV2Diagnostic[] }>;

export const ITEM_CATEGORIES: readonly ItemCategory[] = ["weapon", "shield", "tool", "block.terrain", "armor", "accessory", "bag", "consumable", "material", "key", "quest", "tome", "map", "settings", "menu", "cosmetic"];
export const ITEM_RARITIES: readonly ItemRarity[] = ["junk", "common", "uncommon", "rare", "epic", "mythic", "legendary"];
export const ITEM_FOOTPRINTS: readonly ItemFootprint[] = ["1x1", "2x1", "1x2", "2x2", "1x3", "2x3"];
export const ITEM_ACTION_TRIGGERS: readonly ItemActionTrigger[] = ["leftClick", "rightClick", "holdLeft", "holdRight"];
export const ITEM_ACTION_KINDS: readonly ItemActionKind[] = ["none", "open-menu", "open-bag", "equip", "unequip", "consume", "swing", "power-swing", "block", "shield-bash", "place-block", "remove-block", "mine-block", "dig-block", "light", "inspect", "select", "cast-skill"];
export const ITEM_RARITY_COLORS: Record<ItemRarity, string> = { junk: "grey", common: "white", uncommon: "green", rare: "blue", epic: "purple", mythic: "pink", legendary: "gold" };
export const ITEM_RARITY_THEME_TOKENS: Readonly<Record<ItemRarity, `--color-item-rarity-${ItemRarity}`>> = {
  junk: "--color-item-rarity-junk",
  common: "--color-item-rarity-common",
  uncommon: "--color-item-rarity-uncommon",
  rare: "--color-item-rarity-rare",
  epic: "--color-item-rarity-epic",
  mythic: "--color-item-rarity-mythic",
  legendary: "--color-item-rarity-legendary",
};
export const HELD_ITEM_TARGET_ACTION_DIRECTIONS: Readonly<Partial<Record<ItemActionKind, HeldItemTargetDirection>>> = {
  "place-block": "adjacent",
  "remove-block": "selected",
  "mine-block": "selected",
  "dig-block": "selected",
};
export const EQUIPMENT_LAYOUT_V2_REGIONS: readonly EquipmentLayoutV2RegionDescriptor[] = [
  { id: "head", label: "Head", stack: "left", order: 0, grid: { cols: 2, rows: 2 }, acceptedKinds: ["head"] },
  { id: "outfit", label: "Outfit", stack: "left", order: 1, grid: { cols: 2, rows: 3 }, acceptedKinds: ["outfit"] },
  { id: "belt", label: "Belt", stack: "left", order: 2, grid: { cols: 1, rows: 2 }, acceptedKinds: ["belt"] },
  { id: "foot", label: "Foot", stack: "left", order: 3, grid: { cols: 2, rows: 2 }, acceptedKinds: ["feet"] },
  { id: "face", label: "Face", stack: "right", order: 4, grid: { cols: 2, rows: 2 }, acceptedKinds: ["face"] },
  { id: "neck", label: "Neck", stack: "right", order: 5, grid: { cols: 1, rows: 2 }, acceptedKinds: ["neck"] },
  {
    id: "hands",
    label: "Hands",
    stack: "right",
    order: 6,
    grid: { cols: 2, rows: 2 },
    acceptedKinds: ["glove-left", "glove-right"],
    lanes: [
      { id: "glove-left", label: "Left Glove", origin: { x: 0, y: 0 }, grid: { cols: 1, rows: 2 }, acceptedKinds: ["glove-left"] },
      { id: "glove-right", label: "Right Glove", origin: { x: 1, y: 0 }, grid: { cols: 1, rows: 2 }, acceptedKinds: ["glove-right"] },
    ],
  },
  { id: "ring-a", label: "Ring A", stack: "right", order: 7, grid: { cols: 1, rows: 1 }, acceptedKinds: ["ring"] },
  { id: "ring-b", label: "Ring B", stack: "right", order: 8, grid: { cols: 1, rows: 1 }, acceptedKinds: ["ring"] },
] as const;

const emptyPin = (slug: string): RevisionPin => ({ definitionId: "", revision: 0, slug });
const action = (kind: ItemActionKind, label: string, skillSlug?: string, repeatable = false): ItemAction => ({ kind, label, repeatable, ...(skillSlug ? { skill: emptyPin(skillSlug) } : {}) });
const stat = (slug: string, min: number, max: number, appliesWhen: ItemStatSlot["appliesWhen"]): ItemStatSlot => ({ stat: emptyPin(slug), min, max, qualityCurve: "linear", aggregation: "add", appliesWhen });
const socket = (id: string, family: MateriaSocket["family"], size: MateriaSocket["size"], acceptsTags: readonly string[]): MateriaSocket => ({ id, family, size, acceptsTags, insertedMateria: null });

function statDefinition(slug: string, displayName: string, namespace: string, unit: StatDefinitionDocument["unit"], format: StatDefinitionDocument["format"], defaultValue: number, range: readonly [number, number], aggregation: StatDefinitionDocument["aggregation"], tags: readonly string[]): StatDefinitionDocument {
  return { documentType: "stat-definition", schemaVersion: 1, id: slug, slug, displayName, namespace, unit, format, defaultValue, range, aggregation, tags };
}

function skillDefinition(slug: string, displayName: string, trigger: ItemActionKind, targeting: SkillDefinitionDocument["targeting"], cooldownSeconds: number, costs: SkillDefinitionDocument["costs"], scalingStats: readonly string[], allowedItemCategories: readonly ItemCategory[], tags: readonly string[]): SkillDefinitionDocument {
  return {
    documentType: "skill-definition",
    schemaVersion: 1,
    id: slug,
    slug,
    displayName,
    trigger,
    targeting,
    cooldownSeconds,
    costs,
    effects: [{ kind: trigger, typed: true }],
    scalingStats,
    prerequisites: [],
    blockedStates: ["dead", "stagger"],
    allowedItemCategories,
    tags,
  };
}

function materiaDefinition(slug: string, displayName: string, family: MateriaSocket["family"], size: MateriaSocket["size"], grantsTags: readonly string[], compatibleItemCategories: readonly ItemCategory[]): MateriaDefinitionDocument {
  return { documentType: "materia-definition", schemaVersion: 1, id: slug, slug, displayName, family, size, grantsTags, compatibleItemCategories, effects: [{ kind: "socket-family", family, typed: true }], tags: ["materia", family, size] };
}

export const COLLECTOR_STAT_DOCUMENTS: readonly StatDefinitionDocument[] = [
  statDefinition("combat.damage", "Damage", "combat", "points", "integer", 0, [0, 999], "add", ["combat", "weapon"]),
  statDefinition("combat.block", "Block", "combat", "points", "integer", 0, [0, 999], "add", ["combat", "shield"]),
  statDefinition("combat.attack-speed", "Attack Speed", "combat", "multiplier", "decimal", 1, [0.1, 5], "multiply", ["combat", "speed"]),
  statDefinition("tool.mining-power", "Mining Power", "tool", "points", "integer", 0, [0, 999], "add", ["tool", "pickaxe"]),
  statDefinition("tool.digging-power", "Digging Power", "tool", "points", "integer", 0, [0, 999], "add", ["tool", "shovel"]),
  statDefinition("tool.harvest-speed", "Harvest Speed", "tool", "multiplier", "decimal", 1, [0.1, 5], "multiply", ["tool", "speed"]),
  statDefinition("tool.reach", "Tool Reach", "tool", "meters", "decimal", 1, [0, 32], "add", ["tool", "range"]),
  statDefinition("world.block-place-range", "Block Place Range", "world", "meters", "decimal", 1, [0, 32], "add", ["terrain", "range"]),
  statDefinition("world.light-radius", "Light Radius", "world", "meters", "decimal", 0, [0, 64], "add", ["utility", "light"]),
  statDefinition("inventory.capacity-bonus", "Inventory Capacity Bonus", "inventory", "items", "integer", 0, [0, 999], "add", ["inventory", "bag"]),
  statDefinition("durability.max", "Durability Max", "durability", "points", "integer", 1, [1, 9999], "add", ["durability"]),
  statDefinition("durability.loss-rate", "Durability Loss Rate", "durability", "ratio", "decimal", 1, [0, 10], "multiply", ["durability"]),
];

export const COLLECTOR_SKILL_DOCUMENTS: readonly SkillDefinitionDocument[] = [
  skillDefinition("weapon.swing", "Weapon Swing", "swing", "melee", 0.65, [{ resource: "durability", amount: 1 }], ["combat.damage"], ["weapon"], ["weapon", "attack"]),
  skillDefinition("weapon.power-swing", "Weapon Power Swing", "power-swing", "melee", 2.2, [{ resource: "spirit", amount: 8 }, { resource: "durability", amount: 2 }], ["combat.damage"], ["weapon"], ["weapon", "charged"]),
  skillDefinition("shield.block", "Shield Block", "block", "self", 0.2, [{ resource: "durability", amount: 1 }], ["combat.block"], ["shield", "weapon"], ["shield", "guard"]),
  skillDefinition("shield.bash", "Shield Bash", "shield-bash", "melee", 1.6, [{ resource: "durability", amount: 2 }], ["combat.block"], ["shield"], ["shield", "stagger"]),
  skillDefinition("tool.pickaxe.swing", "Pickaxe Swing", "mine-block", "block", 0.9, [{ resource: "durability", amount: 1 }], ["tool.mining-power", "tool.harvest-speed"], ["tool"], ["tool", "mining"]),
  skillDefinition("tool.pickaxe.power-swing", "Pickaxe Power Swing", "power-swing", "block", 2.4, [{ resource: "spirit", amount: 6 }, { resource: "durability", amount: 2 }], ["tool.mining-power"], ["tool"], ["tool", "mining", "charged"]),
  skillDefinition("tool.shovel.dig", "Shovel Dig", "dig-block", "block", 0.85, [{ resource: "durability", amount: 1 }], ["tool.digging-power", "tool.harvest-speed"], ["tool"], ["tool", "digging"]),
  skillDefinition("tool.shovel.power-dig", "Shovel Power Dig", "power-swing", "block", 2.1, [{ resource: "spirit", amount: 5 }, { resource: "durability", amount: 2 }], ["tool.digging-power"], ["tool"], ["tool", "digging", "charged"]),
  skillDefinition("utility.torch.light", "Torch Light", "light", "self", 0.3, [{ resource: "durability", amount: 1 }], ["world.light-radius"], ["tool"], ["utility", "light"]),
  skillDefinition("utility.torch.place", "Place Torch", "place-block", "block", 0.75, [{ resource: "item-stack", amount: 1 }], ["world.block-place-range"], ["tool"], ["utility", "placement"]),
  skillDefinition("terrain.place-block", "Place Terrain Block", "place-block", "block", 0.35, [{ resource: "item-stack", amount: 1 }], ["world.block-place-range"], ["block.terrain"], ["terrain", "placement"]),
  skillDefinition("terrain.remove-block", "Remove Terrain Block", "remove-block", "block", 0.45, [], ["world.block-place-range"], ["block.terrain", "tool"], ["terrain", "removal"]),
  skillDefinition("inventory.open-bag", "Open Bag", "open-bag", "inventory", 0, [], [], ["bag"], ["inventory", "bag"]),
  skillDefinition("inventory.open-menu", "Open Item Menu", "open-menu", "inventory", 0, [], [], ["bag", "menu", "map", "settings", "tome"], ["inventory", "menu"]),
  skillDefinition("equipment.equip", "Equip Item", "equip", "equipment", 0, [], [], ["weapon", "shield", "tool", "armor", "accessory", "bag", "tome"], ["equipment"]),
  skillDefinition("equipment.unequip", "Unequip Item", "unequip", "equipment", 0, [], [], ["weapon", "shield", "tool", "armor", "accessory", "bag", "tome"], ["equipment"]),
];

export const COLLECTOR_MATERIA_DOCUMENTS: readonly MateriaDefinitionDocument[] = [
  materiaDefinition("materia.weapon.minor", "Weapon Minor Materia", "weapon", "minor", ["blade", "melee"], ["weapon"]),
  materiaDefinition("materia.shield.minor", "Shield Minor Materia", "shield", "minor", ["guard", "block"], ["shield"]),
  materiaDefinition("materia.tool.minor", "Tool Minor Materia", "tool", "minor", ["mining", "digging", "harvest"], ["tool"]),
  materiaDefinition("materia.terrain.minor", "Terrain Minor Materia", "terrain", "minor", ["terrain", "placement"], ["block.terrain"]),
  materiaDefinition("materia.armor.minor", "Armor Minor Materia", "armor", "minor", ["armor", "outfit"], ["armor"]),
  materiaDefinition("materia.utility.minor", "Utility Minor Materia", "utility", "minor", ["light", "bag", "map"], ["tool", "bag", "map", "tome"]),
];

export const PLACEABLE_TERRAIN_BLOCK_DOCUMENTS: readonly TerrainBlockDocument[] = TERRAIN_BLOCK_DOCUMENTS.filter((document) => document.placement.placeable && !document.placement.fluid);

export const STARTER_ITEM_DOCUMENTS: readonly ItemDefinitionDocument[] = [
  {
    documentType: "item-definition", schemaVersion: 1, id: "starter-sword", slug: "starter-sword", displayName: "Sunline Sword", category: "weapon", rarity: "common", qualityRange: [16, 35], footprint: "1x3",
    stack: { max: 1, mergeKey: null }, equipment: { slots: ["main-hand", "off-hand"] }, bagGrid: null,
    actions: { leftClick: action("swing", "Swing", "weapon.swing"), rightClick: action("block", "Guard", "shield.block"), holdLeft: action("power-swing", "Power swing", "weapon.power-swing"), holdRight: action("block", "Hold guard", "shield.block", true) },
    stats: [stat("combat.damage", 4, 9, "held"), stat("combat.attack-speed", 0.8, 1.1, "held"), stat("durability.max", 80, 120, "held")],
    materia: [socket("weapon-minor-1", "weapon", "minor", ["blade", "melee"])], modelRevision: null, materialBlock: null, icon: "sword", tags: ["starter", "melee", "weapon"], availability: ["starter-catalog"],
  },
  {
    documentType: "item-definition", schemaVersion: 1, id: "starter-shield", slug: "starter-shield", displayName: "Field Shield", category: "shield", rarity: "common", qualityRange: [16, 35], footprint: "2x2",
    stack: { max: 1, mergeKey: null }, equipment: { slots: ["off-hand"] }, bagGrid: null,
    actions: { leftClick: action("shield-bash", "Shield bash", "shield.bash"), rightClick: action("block", "Block", "shield.block", true), holdLeft: action("power-swing", "Charged bash", "shield.bash"), holdRight: action("block", "Hold block", "shield.block", true) },
    stats: [stat("combat.block", 3, 8, "held"), stat("durability.max", 100, 150, "held")],
    materia: [socket("shield-minor-1", "shield", "minor", ["guard", "block"])], modelRevision: null, materialBlock: null, icon: "shield", tags: ["starter", "shield"], availability: ["starter-catalog"],
  },
  {
    documentType: "item-definition", schemaVersion: 1, id: "starter-pickaxe", slug: "starter-pickaxe", displayName: "Neon Pickaxe", category: "tool", rarity: "common", qualityRange: [16, 35], footprint: "2x3",
    stack: { max: 1, mergeKey: null }, equipment: { slots: ["main-hand"], twoHanded: true }, bagGrid: null,
    actions: { leftClick: action("mine-block", "Mine block", "tool.pickaxe.swing", true), rightClick: action("inspect", "Inspect material"), holdLeft: action("swing", "Repeat mine", "tool.pickaxe.swing", true), holdRight: action("power-swing", "Power mine", "tool.pickaxe.power-swing") },
    stats: [stat("tool.mining-power", 2, 7, "held"), stat("tool.harvest-speed", 0.9, 1.25, "held"), stat("tool.reach", 2, 4, "held"), stat("durability.max", 90, 140, "held")],
    materia: [socket("tool-minor-1", "tool", "minor", ["mining", "stone"])], modelRevision: null, materialBlock: null, icon: "pickaxe", tags: ["starter", "tool", "mining"], availability: ["starter-catalog"],
  },
  {
    documentType: "item-definition", schemaVersion: 1, id: "starter-shovel", slug: "starter-shovel", displayName: "Garden Shovel", category: "tool", rarity: "common", qualityRange: [16, 35], footprint: "1x3",
    stack: { max: 1, mergeKey: null }, equipment: { slots: ["main-hand"] }, bagGrid: null,
    actions: { leftClick: action("dig-block", "Dig block", "tool.shovel.dig", true), rightClick: action("inspect", "Inspect soil"), holdLeft: action("dig-block", "Repeat dig", "tool.shovel.dig", true), holdRight: action("power-swing", "Power dig", "tool.shovel.power-dig") },
    stats: [stat("tool.digging-power", 2, 7, "held"), stat("tool.harvest-speed", 0.9, 1.25, "held"), stat("tool.reach", 2, 4, "held"), stat("durability.max", 80, 125, "held")],
    materia: [socket("tool-minor-1", "tool", "minor", ["digging", "soil"])], modelRevision: null, materialBlock: null, icon: "shovel", tags: ["starter", "tool", "digging"], availability: ["starter-catalog"],
  },
  {
    documentType: "item-definition", schemaVersion: 1, id: "starter-torch", slug: "starter-torch", displayName: "Wayfinder Torch", category: "tool", rarity: "common", qualityRange: [16, 35], footprint: "1x2",
    stack: { max: 16, mergeKey: "starter-torch" }, equipment: { slots: ["main-hand", "off-hand"] }, bagGrid: null,
    actions: { leftClick: action("light", "Light", "utility.torch.light"), rightClick: action("place-block", "Place torch", "utility.torch.place"), holdLeft: action("light", "Hold light", "utility.torch.light", true), holdRight: action("none", "No hold action") },
    stats: [stat("world.light-radius", 4, 8, "held"), stat("durability.loss-rate", 0.7, 1.2, "held")],
    materia: [], modelRevision: null, materialBlock: null, icon: "torch", tags: ["starter", "tool", "light"], availability: ["starter-catalog"],
  },
  {
    documentType: "item-definition", schemaVersion: 1, id: "starter-fieldpack", slug: "starter-fieldpack", displayName: "Field Backpack", category: "bag", rarity: "common", qualityRange: [16, 35], footprint: "2x3",
    stack: { max: 1, mergeKey: null }, equipment: { slots: ["back"] }, bagGrid: { cols: 6, rows: 4 },
    actions: { leftClick: action("open-bag", "Open bag", "inventory.open-bag"), rightClick: action("open-menu", "Bag menu", "inventory.open-menu"), holdLeft: action("none", "No hold action"), holdRight: action("none", "No hold action") },
    stats: [stat("inventory.capacity-bonus", 24, 24, "equipped")],
    materia: [], modelRevision: null, materialBlock: null, icon: "backpack", tags: ["starter", "bag"], availability: ["starter-catalog"],
  },
  ...PLACEABLE_TERRAIN_BLOCK_DOCUMENTS.map((document) => terrainBlockItem(document)),
] as const;

export function buildStarterItemDocumentsWithReferences(references: readonly CollectorSeedReference[]): readonly ItemDefinitionDocument[] {
  const bySlug = new Map(references.map((entry) => [entry.slug, entry]));
  const pinFor = (pin: RevisionPin): RevisionPin => {
    if (!pin.slug) return pin;
    const reference = bySlug.get(pin.slug);
    return reference ? reference.pin ?? { definitionId: reference.definitionId, revision: reference.revision, slug: pin.slug } : pin;
  };
  const optionalPinForSlug = (slug: string): RevisionPin | null => {
    const reference = bySlug.get(slug);
    return reference ? reference.pin ?? { definitionId: reference.definitionId, revision: reference.revision, slug } : null;
  };
  return STARTER_ITEM_DOCUMENTS.map((document) => ({
    ...document,
    actions: {
      leftClick: pinAction(document.actions.leftClick, pinFor),
      rightClick: pinAction(document.actions.rightClick, pinFor),
      holdLeft: pinAction(document.actions.holdLeft, pinFor),
      holdRight: pinAction(document.actions.holdRight, pinFor),
    },
    stats: document.stats.map((slot) => ({ ...slot, stat: pinFor(slot.stat) })),
    materialBlock: document.materialBlock
      ? { ...document.materialBlock, blockRevision: optionalPinForSlug(document.slug) ?? document.materialBlock.blockRevision }
      : null,
  }));
}

export function buildCollectorSeedDefinitions(items: readonly ItemDefinitionDocument[] = STARTER_ITEM_DOCUMENTS): readonly CollectorSeedDefinition[] {
  return [
    ...COLLECTOR_STAT_DOCUMENTS.map((document) => seedDefinition("stat", document.slug, document.displayName, document, "Collector starter stat seed")),
    ...COLLECTOR_SKILL_DOCUMENTS.map((document) => seedDefinition("skill", document.slug, document.displayName, document, "Collector starter skill seed")),
    ...COLLECTOR_MATERIA_DOCUMENTS.map((document) => seedDefinition("materia", document.slug, document.displayName, document, "Collector starter materia seed")),
    ...items.map((document) => seedDefinition("item", document.slug, document.displayName, document, "Collector starter item seed")),
  ];
}

function terrainBlockItem(block: TerrainBlockDocument): ItemDefinitionDocument {
  const qualityRange: readonly [number, number] = block.variantId || block.lightResponse !== "neutral" ? [36, 50] : [16, 35];
  return {
    documentType: "item-definition", schemaVersion: 1, id: block.slug, slug: block.slug, displayName: `${block.name} Block`, category: "block.terrain", rarity: qualityRange[0] >= 36 ? "uncommon" : "common", qualityRange, footprint: "1x1",
    stack: { max: 64, mergeKey: block.slug }, equipment: null, bagGrid: null,
    actions: { leftClick: action("place-block", "Place block", "terrain.place-block", true), rightClick: action("remove-block", "Remove block", "terrain.remove-block", true), holdLeft: action("place-block", "Repeat place", "terrain.place-block", true), holdRight: action("remove-block", "Repeat remove", "terrain.remove-block", true) },
    stats: [stat("world.block-place-range", 2, 4, "in-actionbar")],
    materia: [], modelRevision: null, materialBlock: { materialFamily: block.materialId, blockRevision: null, ...(block.variantId ? { variantId: block.variantId } : {}) }, icon: "block", tags: ["terrain", "block", block.materialId, block.slug, ...block.generationContexts], availability: ["starter-catalog", "stateful-world-pipeline"],
  };
}

export function isItemDefinitionDocument(value: Readonly<Record<string, unknown>>): value is ItemDefinitionDocument {
  return value.documentType === "item-definition" && value.schemaVersion === 1 && typeof value.slug === "string" && typeof value.displayName === "string" && typeof value.actions === "object";
}

export function getEquipmentLayoutV2Region(regionId: string): EquipmentLayoutV2RegionDescriptor | undefined {
  return EQUIPMENT_LAYOUT_V2_REGIONS.find((entry) => entry.id === regionId);
}

export function validateEquipmentLayoutV2Assignments(assignments: readonly EquipmentLayoutV2Assignment[]): readonly EquipmentLayoutV2Diagnostic[] {
  const diagnostics: EquipmentLayoutV2Diagnostic[] = [];
  const occupiedDestinations = new Map<string, EquipmentLayoutV2Assignment>();
  const occupiedCells = new Map<string, EquipmentLayoutV2Assignment>();

  for (const assignment of assignments) {
    const region = getEquipmentLayoutV2Region(assignment.regionId);
    const item = assignment.item;
    const assignmentContext = { assignmentId: assignment.id, regionId: assignment.regionId, laneId: assignment.laneId ?? undefined, itemId: item.definitionId };
    if (assignment.regionId.toLowerCase().includes("earring") || (assignment.laneId ?? "").toLowerCase().includes("earring") || equipmentKinds(item.document).includes("earring")) {
      diagnostics.push(equipmentDiagnostic("equipment.assignment.earring-removed", "Earring assignments are removed in Equipment Layout V2 and must be migrated without loss.", assignmentContext));
      continue;
    }
    if (!region) {
      diagnostics.push(equipmentDiagnostic("equipment.slot.unknown", `Equipment region is unknown: ${assignment.regionId}.`, assignmentContext));
      continue;
    }
    const lane = assignment.laneId ? region.lanes?.find((entry) => entry.id === assignment.laneId) : undefined;
    if (region.lanes && !lane) {
      diagnostics.push(equipmentDiagnostic("equipment.slot.unknown", `Equipment lane is required for ${region.label}.`, assignmentContext));
      continue;
    }
    if (!region.lanes && assignment.laneId) {
      diagnostics.push(equipmentDiagnostic("equipment.slot.unknown", `${region.label} does not contain lane ${assignment.laneId}.`, assignmentContext));
      continue;
    }
    if (item.expectedDefinitionId && item.expectedDefinitionId !== item.definitionId) {
      diagnostics.push(equipmentDiagnostic("equipment.item.stale", `Equipment item definition mismatch: expected ${item.expectedDefinitionId}, received ${item.definitionId}.`, assignmentContext));
    }
    if (item.expectedRevision !== undefined && item.expectedRevision !== null && item.expectedRevision !== item.revision) {
      diagnostics.push(equipmentDiagnostic("equipment.item.stale", `Equipment item revision mismatch: expected ${item.expectedRevision}, received ${item.revision}.`, assignmentContext));
    }
    const acceptedKinds = lane?.acceptedKinds ?? region.acceptedKinds;
    const authoredKinds = equipmentKinds(item.document);
    if (!authoredKinds.some((kind) => kind !== "earring" && acceptedKinds.includes(kind))) {
      diagnostics.push(equipmentDiagnostic("equipment.kind.mismatch", `${item.document.displayName} is not compatible with ${lane?.label ?? region.label}.`, assignmentContext));
    }
    const footprint = parseItemFootprint(item.document.footprint);
    const grid = lane?.grid ?? region.grid;
    if (footprint.cols > grid.cols || footprint.rows > grid.rows) {
      diagnostics.push(equipmentDiagnostic("equipment.footprint.overflow", `${item.document.displayName} footprint ${item.document.footprint} does not fit ${lane?.label ?? region.label} ${grid.cols}x${grid.rows}.`, assignmentContext));
    }
    const destinationKey = `${region.id}:${lane?.id ?? "region"}`;
    const existingDestination = occupiedDestinations.get(destinationKey);
    if (existingDestination) {
      diagnostics.push(equipmentDiagnostic("equipment.occupancy.occupied", `${lane?.label ?? region.label} is already occupied.`, assignmentContext));
    } else {
      occupiedDestinations.set(destinationKey, assignment);
    }
    const origin = lane?.origin ?? { x: 0, y: 0 };
    for (let y = 0; y < Math.min(footprint.rows, grid.rows); y += 1) {
      for (let x = 0; x < Math.min(footprint.cols, grid.cols); x += 1) {
        const cellKey = `${region.id}:${origin.x + x}:${origin.y + y}`;
        const existingCell = occupiedCells.get(cellKey);
        if (existingCell && existingCell !== assignment) {
          diagnostics.push(equipmentDiagnostic("equipment.occupancy.overlap", `${item.document.displayName} overlaps another equipment item in ${region.label}.`, assignmentContext));
        } else {
          occupiedCells.set(cellKey, assignment);
        }
      }
    }
  }

  return diagnostics;
}

export function migrateRemovedEarringAssignmentsToEquipmentLayoutV2(request: EquipmentLayoutV2MigrationRequest): EquipmentLayoutV2MigrationResult {
  const placements: EquipmentLayoutV2BagPlacement[] = [];
  const recovery: EquipmentLayoutV2MigrationResult["recovery"][number][] = [];
  const diagnostics: EquipmentLayoutV2Diagnostic[] = [];
  const occupied = [...request.existingBagPlacements ?? []];

  for (const assignment of request.removedEarringAssignments) {
    diagnostics.push(equipmentDiagnostic("equipment.assignment.earring-removed", "Removed earring assignment migrated without deletion.", { assignmentId: assignment.assignmentId, itemId: assignment.itemId }));
    const existing = occupied.find((entry) => entry.itemId === assignment.itemId) ?? placements.find((entry) => entry.itemId === assignment.itemId);
    if (existing) {
      placements.push(existing);
      continue;
    }
    const footprint = parseItemFootprint(assignment.footprint);
    const location = findFirstBagPlacement(request.bagGrid, occupied, footprint);
    if (!location) {
      recovery.push({ assignmentId: assignment.assignmentId, itemId: assignment.itemId, reason: "no-compatible-bag-cell" });
      continue;
    }
    const placement = { itemId: assignment.itemId, x: location.x, y: location.y, cols: footprint.cols, rows: footprint.rows };
    placements.push(placement);
    occupied.push(placement);
  }

  return { placements, recovery, diagnostics };
}

export function readHeldItemTargetAppearance(request: HeldItemTargetAppearanceRequest): HeldItemTargetAppearanceResult {
  const diagnostics: HeldItemTargetDiagnostic[] = [];
  const document = request.document ?? null;
  const definitionId = request.definitionId ?? "";
  const definitionRevision = request.definitionRevision ?? 0;
  const actionTrigger = request.actionTrigger ?? "leftClick";

  if (!document) diagnostics.push(diagnostic("held-item.missing", "Held item definition is missing."));
  if (!definitionId || definitionRevision < 1) diagnostics.push(diagnostic("held-item.missing", "Held item definition id and revision are required."));
  if (request.expectedDefinitionId && definitionId && request.expectedDefinitionId !== definitionId) {
    diagnostics.push(diagnostic("held-item.stale", `Held item definition mismatch: expected ${request.expectedDefinitionId}, received ${definitionId}.`));
  }
  if (request.expectedRevision !== undefined && request.expectedRevision !== null && definitionRevision > 0 && request.expectedRevision !== definitionRevision) {
    diagnostics.push(diagnostic("held-item.stale", `Held item revision mismatch: expected ${request.expectedRevision}, received ${definitionRevision}.`));
  }
  if (!ITEM_ACTION_TRIGGERS.includes(actionTrigger)) {
    diagnostics.push(diagnostic("held-item.unknown", `Held item action trigger is unknown: ${String(actionTrigger)}.`));
  }
  if (!document) return { descriptor: null, diagnostics };

  const actionEntry = document.actions[actionTrigger];
  if (!ITEM_RARITIES.includes(document.rarity)) {
    diagnostics.push(diagnostic("held-item.unknown", `Held item rarity is not canonical: ${String(document.rarity)}.`));
  }
  if (request.compatibleItemCategories && !request.compatibleItemCategories.includes(document.category)) {
    diagnostics.push(diagnostic("held-item.incompatible", `Held item category ${document.category} is incompatible with the target action.`));
  }
  if (!actionEntry) {
    diagnostics.push(diagnostic("held-item.unknown", `Held item action is missing for ${actionTrigger}.`));
  }

  const targetDirection = actionEntry ? HELD_ITEM_TARGET_ACTION_DIRECTIONS[actionEntry.kind] : undefined;
  if (actionEntry && !targetDirection) {
    diagnostics.push(diagnostic("held-item.non-placeable", `Held item action ${actionEntry.kind} does not target a block face.`));
  }
  if (document.category === "block.terrain" && !document.materialBlock) {
    diagnostics.push(diagnostic("held-item.incompatible", "Terrain block item is missing its material/block reference."));
  }
  if (targetDirection === "adjacent" && request.stackQuantity !== undefined && request.stackQuantity !== null && request.stackQuantity <= 0) {
    diagnostics.push(diagnostic("held-item.exhausted", "Held item stack is exhausted."));
  }
  if (diagnostics.length > 0 || !targetDirection || !ITEM_RARITIES.includes(document.rarity)) return { descriptor: null, diagnostics };

  return {
    descriptor: {
      definitionId,
      definitionRevision,
      definitionSlug: request.definitionSlug ?? document.slug,
      actionTrigger,
      actionKind: actionEntry.kind,
      targetDirection,
      rarity: document.rarity,
      rarityThemeToken: ITEM_RARITY_THEME_TOKENS[document.rarity],
    },
    diagnostics,
  };
}

export function validateItemDefinition(document: ItemDefinitionDocument, options: Readonly<{ strictReferences?: boolean }> = {}): readonly string[] {
  const diagnostics: string[] = [];
  if (!ITEM_CATEGORIES.includes(document.category)) diagnostics.push("Category is not supported.");
  if (!ITEM_RARITIES.includes(document.rarity)) diagnostics.push("Rarity is not supported.");
  if (!ITEM_FOOTPRINTS.includes(document.footprint)) diagnostics.push("Footprint must be one of the approved item grid sizes.");
  if (document.qualityRange[0] < 0 || document.qualityRange[1] > 100 || document.qualityRange[0] > document.qualityRange[1]) diagnostics.push("Quality range must be 0-100 and min cannot exceed max.");
  if (document.category === "block.terrain" && document.stack.max !== 64) diagnostics.push("Terrain block items must use a 64 item stack.");
  if (document.category === "block.terrain" && !document.materialBlock) diagnostics.push("Terrain block items must reference a material/block family.");
  if (document.category === "bag" && (!document.bagGrid || document.bagGrid.cols < 1 || document.bagGrid.rows < 1)) diagnostics.push("Bag items must define a usable grid.");
  for (const trigger of ITEM_ACTION_TRIGGERS) {
    if (!document.actions[trigger]) diagnostics.push(`${trigger} action is required.`);
  }
  for (const slot of document.stats) {
    if (slot.min > slot.max) diagnostics.push(`${slot.stat.slug ?? slot.stat.definitionId}: stat min cannot exceed max.`);
  }
  if (options.strictReferences) {
    if (!document.modelRevision?.definitionId && document.category !== "block.terrain") diagnostics.push("Publish requires a pinned model revision for non-block items.");
    if (document.category === "block.terrain" && !document.materialBlock?.blockRevision?.definitionId) diagnostics.push("Publish requires a pinned material/block revision for terrain blocks.");
    if (document.category === "block.terrain" && document.materialBlock?.blockRevision?.definitionId) {
      const pin = document.materialBlock.blockRevision;
      if (pin.documentVersion !== 2 || !pin.contentHash || !pin.materialId || !pin.blockId) diagnostics.push("Publish requires an exact Stateful Material V2 block pin for terrain blocks.");
      if (document.materialBlock.variantId && pin.variantId !== document.materialBlock.variantId) diagnostics.push("Terrain block item variant must match its pinned material/block revision.");
    }
    for (const slot of document.stats) if (!slot.stat.definitionId) diagnostics.push(`Publish requires stat revision for ${slot.stat.slug ?? "stat slot"}.`);
    for (const actionEntry of Object.values(document.actions)) if (actionEntry.skill && !actionEntry.skill.definitionId) diagnostics.push(`Publish requires skill revision for ${actionEntry.skill.slug ?? actionEntry.label}.`);
    for (const socketEntry of document.materia) if (socketEntry.insertedMateria && !socketEntry.insertedMateria.definitionId) diagnostics.push(`Publish requires materia revision for ${socketEntry.id}.`);
  }
  return diagnostics;
}

function title(value: string): string {
  return value.split("-").map((part) => part.replace(/^./, (letter) => letter.toUpperCase())).join(" ");
}

function pinAction(actionEntry: ItemAction, pinFor: (pin: RevisionPin) => RevisionPin): ItemAction {
  return actionEntry.skill ? { ...actionEntry, skill: pinFor(actionEntry.skill) } : actionEntry;
}

function diagnostic(code: HeldItemTargetDiagnosticCode, message: string): HeldItemTargetDiagnostic {
  return { code, message };
}

function equipmentDiagnostic(code: EquipmentLayoutV2DiagnosticCode, message: string, context: Omit<EquipmentLayoutV2Diagnostic, "code" | "message"> = {}): EquipmentLayoutV2Diagnostic {
  return { code, message, ...context };
}

function parseItemFootprint(footprint: ItemFootprint): EquipmentLayoutV2GridSize {
  const [cols, rows] = footprint.split("x").map(Number);
  return { cols, rows };
}

function equipmentKinds(document: ItemDefinitionDocument): readonly (EquipmentLayoutV2Kind | "earring")[] {
  return document.equipment?.slots.filter((slot): slot is EquipmentLayoutV2Kind | "earring" => (
    slot === "head" || slot === "outfit" || slot === "belt" || slot === "feet" || slot === "face" || slot === "neck" || slot === "glove-left" || slot === "glove-right" || slot === "ring" || slot === "earring"
  )) ?? [];
}

function findFirstBagPlacement(grid: EquipmentLayoutV2GridSize, occupied: readonly EquipmentLayoutV2BagPlacement[], footprint: EquipmentLayoutV2GridSize): Readonly<{ x: number; y: number }> | null {
  if (footprint.cols > grid.cols || footprint.rows > grid.rows) return null;
  for (let y = 0; y <= grid.rows - footprint.rows; y += 1) {
    for (let x = 0; x <= grid.cols - footprint.cols; x += 1) {
      const candidate = { itemId: "__candidate__", x, y, cols: footprint.cols, rows: footprint.rows };
      if (!occupied.some((entry) => rectanglesOverlap(candidate, entry))) return { x, y };
    }
  }
  return null;
}

function rectanglesOverlap(a: EquipmentLayoutV2BagPlacement, b: EquipmentLayoutV2BagPlacement): boolean {
  return a.x < b.x + b.cols && a.x + a.cols > b.x && a.y < b.y + b.rows && a.y + a.rows > b.y;
}

function seedDefinition(kind: CollectorSeedKind, slug: string, name: string, payload: Readonly<Record<string, unknown>>, changeNote: string): CollectorSeedDefinition {
  return { kind, slug, name, schemaVersion: 1, payload, changeNote };
}
