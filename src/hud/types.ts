export type HudMeter = {
  current: number;
  max: number;
  level: number;
  kind: "health" | "spirit";
};

export type HudLogEntry = {
  id: string;
  channel: "player" | "spirit" | "system";
  text: string;
  severity: "info" | "gain" | "damage" | "warning";
  createdAt: number;
};

export type HudMapMarkerKind = "player" | "keep" | "gate" | "objective" | "party";

export type HudMapMarker = {
  id: string;
  kind: HudMapMarkerKind;
  label: string;
  x: number;
  z: number;
  discovered: boolean;
};

export type HudMapPosition = {
  x: number;
  z: number;
  heading: number;
};

export type ItemKind =
  | "character"
  | "spirit"
  | "food"
  | "map"
  | "backpack"
  | "drink"
  | "keyhole"
  | "weapon"
  | "tool"
  | "material"
  | "consumable";

export type Item = {
  id: string;
  name: string;
  kind: ItemKind;
  size: {
    cols: number;
    rows: number;
  };
  icon: string;
  containerId?: string;
};

export type InventoryPlacement = {
  itemId: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
};

export type FixedSlot = {
  id: string;
  label: string;
  accepts: ItemKind[];
  itemId?: string;
};

export type ActionSlot = {
  id: number;
  itemId?: string;
};

export type DragSource =
  | { type: "grid"; itemId: string }
  | { type: "fixed"; slotId: string; itemId: string }
  | { type: "action"; slotId: number; itemId: string };

export type SettingsBinding = {
  id: string;
  label: string;
  group:
    | "Movement & Look"
    | "Movement Abilities"
    | "Actionbar"
    | "Tome Actions"
    | "Item Actions"
    | "General Actions"
    | "Grab & Swap"
    | "UI"
    | "Chat";
  hint?: string;
  primary: string;
  secondary: string;
  gamepad: string;
};

export type CanvasItemType =
  | "kingdom"
  | "account"
  | "character"
  | "bag"
  | "belt"
  | "outfit"
  | "tome"
  | "potion"
  | "key"
  | "gem"
  | "glasses"
  | "ring"
  | "neck"
  | "earring"
  | "phial"
  | "glove"
  | "head"
  | "feet"
  | "weapon"
  | "tool"
  | "block"
  | "skill"
  | "map"
  | "spirit"
  | "food"
  | "drink"
  | "settings";

export type CanvasItemLocation =
  | { kind: "hud"; slot: string }
  | { kind: "equip"; charId: string; slot: string }
  | { kind: "grid"; bagId: string; x: number; y: number }
  | { kind: "roster" }
  | { kind: "limbo" };

export type CanvasItem = {
  id: string;
  type: CanvasItemType;
  name: string;
  quantity?: number;
  w: number;
  h: number;
  icon: string;
  note?: string;
  grid?: {
    cols: number;
    rows: number;
  };
  stats?: {
    bagSlots?: number;
    cooldown?: number;
    cooldownRemaining?: number;
    durability?: number;
    durabilityMaximum?: number;
  };
  leftClickAction?: string;
  rightClickAction?: string;
  compatibleSlots?: string[];
  loc: CanvasItemLocation;
};

export type DemoSkill = {
  id: string;
  name: string;
  family: "attack" | "ultimate" | "restore" | "movement" | "passive";
  slot: string;
  icon: string;
  description: string;
};
