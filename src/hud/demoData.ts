import type { ActionSlot, CanvasItem, FixedSlot, HudLogEntry, HudMeter, InventoryPlacement, Item, SettingsBinding } from "./types";

export const actionSlotOrder = [7, 5, 3, 1, 9, 2, 4, 6, 8] as const;

export const initialMeters: Record<"health" | "spirit", HudMeter> = {
  health: { kind: "health", current: 68, max: 100, level: 4 },
  spirit: { kind: "spirit", current: 43, max: 100, level: 3 }
};

export const initialLogs: HudLogEntry[] = [
  { id: "player-1", channel: "player", text: "Damage taken: 12", severity: "damage", createdAt: 1 },
  { id: "player-2", channel: "player", text: "Picked up Wraithcloth", severity: "gain", createdAt: 2 },
  { id: "player-3", channel: "player", text: "XP gained: 45", severity: "gain", createdAt: 3 },
  { id: "spirit-1", channel: "spirit", text: "Damage out: 18", severity: "info", createdAt: 4 },
  { id: "spirit-2", channel: "spirit", text: "Message received", severity: "info", createdAt: 5 },
  { id: "system-1", channel: "system", text: "Garden local server linked", severity: "info", createdAt: 6 },
  { id: "system-2", channel: "system", text: "Boss threat: Hollow King stirring", severity: "warning", createdAt: 7 }
];

export const initialItems: Record<string, Item> = {
  character: { id: "character", name: "Guest Spirit", kind: "character", size: { cols: 1, rows: 1 }, icon: "C" },
  spirit: { id: "spirit", name: "Spirit Core", kind: "spirit", size: { cols: 1, rows: 1 }, icon: "S" },
  apple: { id: "apple", name: "Garden Apple", kind: "food", size: { cols: 1, rows: 1 }, icon: "F" },
  map: { id: "map", name: "Field Map", kind: "map", size: { cols: 2, rows: 1 }, icon: "M" },
  backpack: { id: "backpack", name: "Worn Pack", kind: "backpack", size: { cols: 2, rows: 2 }, icon: "B", containerId: "wornBackpack" },
  drink: { id: "drink", name: "Mist Flask", kind: "drink", size: { cols: 1, rows: 2 }, icon: "D" },
  keyhole: { id: "keyhole", name: "Keyhole", kind: "keyhole", size: { cols: 1, rows: 1 }, icon: "K" },
  blade: { id: "blade", name: "Glass Blade", kind: "weapon", size: { cols: 1, rows: 3 }, icon: "W" },
  lantern: { id: "lantern", name: "Lantern", kind: "tool", size: { cols: 2, rows: 2 }, icon: "L" },
  stone: { id: "stone", name: "Echo Stone", kind: "material", size: { cols: 3, rows: 2 }, icon: "E" },
  phial: { id: "phial", name: "Phial", kind: "consumable", size: { cols: 1, rows: 2 }, icon: "P" }
};

export const initialFixedSlots: Record<string, FixedSlot> = {
  "left-character": { id: "left-character", label: "Character", accepts: ["character", "keyhole"], itemId: "character" },
  "left-spirit": { id: "left-spirit", label: "Spirit", accepts: ["spirit", "keyhole"], itemId: "spirit" },
  "left-food": { id: "left-food", label: "Food", accepts: ["food", "consumable"], itemId: "apple" },
  "right-map": { id: "right-map", label: "Map", accepts: ["map"], itemId: "map" },
  "right-backpack": { id: "right-backpack", label: "Backpack", accepts: ["backpack"], itemId: "backpack" },
  "right-drink": { id: "right-drink", label: "Drink", accepts: ["drink", "consumable"], itemId: "drink" }
};

export const initialActionSlots: Record<number, ActionSlot> = Object.fromEntries(
  actionSlotOrder.map((id) => [id, { id, itemId: id === 9 ? "keyhole" : undefined }])
) as Record<number, ActionSlot>;

export const initialInventoryPlacements: InventoryPlacement[] = [
  { itemId: "blade", x: 0, y: 0, cols: 1, rows: 3 },
  { itemId: "lantern", x: 2, y: 0, cols: 2, rows: 2 },
  { itemId: "stone", x: 5, y: 1, cols: 3, rows: 2 },
  { itemId: "phial", x: 9, y: 0, cols: 1, rows: 2 }
];

export const initialBindings: SettingsBinding[] = [
  { id: "move-forward", group: "Movement & Look", label: "Forward", primary: "W", secondary: "Unbound", gamepad: "Left Stick Up" },
  { id: "move-back", group: "Movement & Look", label: "Backward", primary: "S", secondary: "Unbound", gamepad: "Left Stick Down" },
  { id: "strafe-left", group: "Movement & Look", label: "Strafe Left", primary: "A", secondary: "Unbound", gamepad: "Left Stick Left" },
  { id: "strafe-right", group: "Movement & Look", label: "Strafe Right", primary: "D", secondary: "Unbound", gamepad: "Left Stick Right" },
  { id: "look", group: "Movement & Look", label: "Camera Look", primary: "Mouse Move", secondary: "Unbound", gamepad: "Right Stick" },
  { id: "sprint", group: "Movement Abilities", label: "Sprint", primary: "Shift", secondary: "Unbound", gamepad: "Left Stick Press" },
  { id: "dodge", group: "Movement Abilities", label: "Dodge", hint: "Double-tap any movement direction, or assign a dedicated key.", primary: "Double-tap WASD", secondary: "Unbound", gamepad: "Unbound" },
  { id: "jump", group: "Movement Abilities", label: "Jump", primary: "Space", secondary: "Unbound", gamepad: "South Button" },
  { id: "crouch", group: "Movement Abilities", label: "Stealth", primary: "Ctrl", secondary: "Unbound", gamepad: "East Button" },
  { id: "flight", group: "Movement Abilities", label: "Flight", primary: "Alt", secondary: "Unbound", gamepad: "North Button" },
  { id: "actionbar-1", group: "Actionbar", label: "Actionbar 1", primary: "1", secondary: "Unbound", gamepad: "D-Pad Left" },
  { id: "actionbar-2", group: "Actionbar", label: "Actionbar 2", primary: "2", secondary: "Unbound", gamepad: "D-Pad Right" },
  { id: "actionbar-3", group: "Actionbar", label: "Actionbar 3", primary: "3", secondary: "Unbound", gamepad: "D-Pad Down" },
  { id: "actionbar-4", group: "Actionbar", label: "Actionbar 4", primary: "4", secondary: "Unbound", gamepad: "D-Pad Up" },
  { id: "actionbar-5", group: "Actionbar", label: "Actionbar 5", primary: "5", secondary: "Unbound", gamepad: "Left Bumper" },
  { id: "actionbar-6", group: "Actionbar", label: "Actionbar 6", primary: "6", secondary: "Unbound", gamepad: "Right Bumper" },
  { id: "actionbar-7", group: "Actionbar", label: "Actionbar 7", primary: "7", secondary: "Unbound", gamepad: "Left Trigger" },
  { id: "actionbar-8", group: "Actionbar", label: "Actionbar 8", primary: "8", secondary: "Unbound", gamepad: "Right Trigger" },
  { id: "actionbar-9", group: "Actionbar", label: "Actionbar 9", primary: "9", secondary: "Unbound", gamepad: "Start" },
  { id: "actionbar-10", group: "Actionbar", label: "Actionbar 10", primary: "0", secondary: "Unbound", gamepad: "Unbound" },
  { id: "previous-action-slot", group: "Actionbar", label: "Previous Action Slot", hint: "Scrolls through odd-numbered left action items.", primary: "Scroll Up", secondary: "Unbound", gamepad: "Unbound" },
  { id: "next-action-slot", group: "Actionbar", label: "Next Action Slot", hint: "Scrolls through odd-numbered left action items.", primary: "Scroll Down", secondary: "Unbound", gamepad: "Unbound" },
  { id: "right-action-scroll-modifier", group: "Actionbar", label: "Right Action Scroll Modifier", hint: "Hold this while scrolling to rotate through even-numbered right action items.", primary: "Mouse 2 (Hold)", secondary: "Unbound", gamepad: "Left Trigger (Hold)" },
  { id: "ultimate", group: "Tome Actions", label: "Tome Ultimate", primary: "Q", secondary: "Unbound", gamepad: "Y" },
  { id: "skill-1", group: "Tome Actions", label: "Tome Action 1", primary: "E", secondary: "Unbound", gamepad: "X" },
  { id: "skill-2", group: "Tome Actions", label: "Tome Action 2", primary: "F", secondary: "Unbound", gamepad: "A" },
  { id: "left-hand", group: "Item Actions", label: "Left Click Action", hint: "Uses the primary action of the selected odd-numbered item.", primary: "Mouse 1", secondary: "Unbound", gamepad: "Right Trigger" },
  { id: "right-hand", group: "Item Actions", label: "Right Click Action", hint: "Uses the secondary action of the selected even-numbered item.", primary: "Mouse 2", secondary: "Unbound", gamepad: "Left Trigger" },
  { id: "restore", group: "General Actions", label: "Restore/Reload", primary: "R", secondary: "Unbound", gamepad: "B" },
  { id: "grab", group: "Grab & Swap", label: "Grab", primary: "G", secondary: "Unbound", gamepad: "Right Stick Press" },
  { id: "swap", group: "Grab & Swap", label: "Swap Action Loadout", hint: "Cycles between three action-item loadouts.", primary: "X", secondary: "Unbound", gamepad: "View" },
  { id: "escape", group: "UI", label: "Release Mouse", primary: "Escape", secondary: "Hardcoded", gamepad: "Menu" },
  { id: "map-zoom-in", group: "UI", label: "Map Zoom In", primary: "Scroll Up", secondary: "=", gamepad: "Right Bumper" },
  { id: "map-zoom-out", group: "UI", label: "Map Zoom Out", primary: "Scroll Down", secondary: "-", gamepad: "Left Bumper" },
  { id: "backpack", group: "UI", label: "Backpack", primary: "B", secondary: "Unbound", gamepad: "Menu Right" },
  { id: "stash", group: "UI", label: "Stash", primary: "I", secondary: "Unbound", gamepad: "Unbound" },
  { id: "character", group: "UI", label: "Character", primary: "C", secondary: "Unbound", gamepad: "Menu Left" },
  { id: "open-chat", group: "Chat", label: "Toggle Chat", primary: "T", secondary: "Unbound", gamepad: "Unbound" }
];

export const CONTROL_BINDINGS_STORAGE_KEY = "knowhere.controls.bindings.v1";

export function loadControlBindings(): SettingsBinding[] {
  if (typeof window === "undefined") return initialBindings.map((binding) => ({ ...binding }));
  try {
    const stored = JSON.parse(window.localStorage.getItem(CONTROL_BINDINGS_STORAGE_KEY) ?? "[]") as SettingsBinding[];
    const byId = new Map(stored.map((binding) => [binding.id, binding]));
    return initialBindings.map((binding) => ({ ...binding, ...byId.get(binding.id), id: binding.id, group: binding.group, label: binding.label, hint: binding.hint }));
  } catch {
    return initialBindings.map((binding) => ({ ...binding }));
  }
}

export function saveControlBindings(bindings: readonly SettingsBinding[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTROL_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  window.dispatchEvent(new CustomEvent("knowhere:control-bindings-changed", { detail: bindings }));
}

export const initialCanvasItems: Record<string, CanvasItem> = {
  kingdom: { id: "kingdom", type: "kingdom", name: "Kingdom of Knowhere", w: 1, h: 1, icon: "castle", loc: { kind: "hud", slot: "account" } },
  acctUser: { id: "acctUser", type: "account", name: "User", w: 1, h: 1, icon: "account", loc: { kind: "limbo" } },
  acctAdmin: { id: "acctAdmin", type: "account", name: "Admin", w: 1, h: 1, icon: "account", loc: { kind: "limbo" } },
  charA: { id: "charA", type: "character", name: "Aveline", w: 1, h: 1, icon: "character", note: "Character", loc: { kind: "hud", slot: "character" } },
  charB: { id: "charB", type: "character", name: "Bram", w: 1, h: 1, icon: "person", note: "Character", loc: { kind: "roster" } },
  charC: { id: "charC", type: "character", name: "Mau the Cat", w: 1, h: 1, icon: "cat", note: "Playable avatar", loc: { kind: "roster" } },
  fieldpack: { id: "fieldpack", type: "bag", name: "Field Backpack", w: 2, h: 3, icon: "backpack", grid: { cols: 6, rows: 4 }, loc: { kind: "hud", slot: "backpack" } },
  voidpack: { id: "voidpack", type: "bag", name: "Voidweave Backpack", w: 3, h: 3, icon: "backpack", grid: { cols: 9, rows: 9 }, loc: { kind: "grid", bagId: "fieldpack", x: 3, y: 0 } },
  satchel: { id: "satchel", type: "bag", name: "Traveler's Satchel", w: 3, h: 3, icon: "pouch", grid: { cols: 3, rows: 3 }, loc: { kind: "grid", bagId: "fieldpack", x: 0, y: 0 } },
  pouch: { id: "pouch", type: "bag", name: "Coin Pouch", w: 2, h: 2, icon: "pouch", grid: { cols: 2, rows: 2 }, loc: { kind: "grid", bagId: "voidpack", x: 0, y: 0 } },
  belt1: { id: "belt1", type: "belt", name: "Porter's Belt", w: 2, h: 1, icon: "belt", stats: { bagSlots: 2 }, loc: { kind: "equip", charId: "charA", slot: "belt" } },
  outfit1: { id: "outfit1", type: "outfit", name: "Courier's Outfit", w: 2, h: 3, icon: "outfit", stats: { bagSlots: 2 }, loc: { kind: "equip", charId: "charA", slot: "outfit" } },
	  tome1: { id: "tome1", type: "tome", name: "Tome of Knowhere", w: 2, h: 2, icon: "tome", loc: { kind: "hud", slot: "tome" } },
  lunchbox1: { id: "lunchbox1", type: "bag", name: "Garden Lunchbox", w: 2, h: 2, icon: "food", grid: { cols: 4, rows: 3 }, loc: { kind: "hud", slot: "lunchbox" } },
  spiritBox1: { id: "spiritBox1", type: "bag", name: "Spirit Box", w: 2, h: 2, icon: "spirit", grid: { cols: 4, rows: 4 }, loc: { kind: "limbo" } },
  stashVault: { id: "stashVault", type: "bag", name: "Personal Stash", w: 2, h: 2, icon: "backpack", grid: { cols: 18, rows: 18 }, loc: { kind: "limbo" } },
  stashVeyra: { id: "stashVeyra", type: "character", name: "Soul Gem — Veyra", w: 2, h: 2, icon: "cat", note: "Selected spirit character", loc: { kind: "grid", bagId: "stashVault", x: 0, y: 0 } },
  stashUtilityBelt: { id: "stashUtilityBelt", type: "belt", name: "Utility Belt", w: 2, h: 1, icon: "belt", loc: { kind: "grid", bagId: "stashVault", x: 4, y: 0 } },
  stashMilitaryPack: { id: "stashMilitaryPack", type: "bag", name: "Military Pack", w: 2, h: 2, icon: "backpack", loc: { kind: "grid", bagId: "stashVault", x: 6, y: 0 } },
  stashIronShield: { id: "stashIronShield", type: "tool", name: "Iron Shield", w: 2, h: 3, icon: "target", loc: { kind: "grid", bagId: "stashVault", x: 8, y: 0 } },
  stashIronHelm: { id: "stashIronHelm", type: "head", name: "Iron Helm", w: 2, h: 2, icon: "helm", loc: { kind: "grid", bagId: "stashVault", x: 10, y: 0 } },
  stashWarrior: { id: "stashWarrior", type: "tome", name: "Way of the Warrior", w: 2, h: 2, icon: "sword", loc: { kind: "grid", bagId: "stashVault", x: 0, y: 4 } },
  stashGospel: { id: "stashGospel", type: "tome", name: "The Gospel", w: 2, h: 2, icon: "tome", loc: { kind: "grid", bagId: "stashVault", x: 2, y: 4 } },
  stashPsychicCodex: { id: "stashPsychicCodex", type: "tome", name: "The Psychic Codex", w: 2, h: 2, icon: "orb", loc: { kind: "grid", bagId: "stashVault", x: 4, y: 4 } },
  stashGrimoire: { id: "stashGrimoire", type: "tome", name: "Creator's Grimoire", w: 2, h: 2, icon: "tome", loc: { kind: "grid", bagId: "stashVault", x: 6, y: 4 } },
  stashAlmanac: { id: "stashAlmanac", type: "tome", name: "Hunter's Almanac", w: 2, h: 2, icon: "target", loc: { kind: "grid", bagId: "stashVault", x: 8, y: 4 } },
  stashLedger: { id: "stashLedger", type: "tome", name: "The Sovereign's Ledger", w: 2, h: 2, icon: "castle", loc: { kind: "grid", bagId: "stashVault", x: 10, y: 4 } },
  stashAkashic: { id: "stashAkashic", type: "tome", name: "The Akashic Records", w: 2, h: 2, icon: "orb", loc: { kind: "grid", bagId: "stashVault", x: 12, y: 4 } },
  stashLamb: { id: "stashLamb", type: "food", name: "Lamb", quantity: 6, w: 1, h: 1, icon: "food", loc: { kind: "grid", bagId: "stashVault", x: 0, y: 7 } },
  stashChicken: { id: "stashChicken", type: "food", name: "Chicken Leg", quantity: 8, w: 1, h: 1, icon: "food", loc: { kind: "grid", bagId: "stashVault", x: 1, y: 7 } },
  stashCorn: { id: "stashCorn", type: "food", name: "Corn Cob", quantity: 8, w: 1, h: 1, icon: "food", loc: { kind: "grid", bagId: "stashVault", x: 2, y: 7 } },
  stashFlask: { id: "stashFlask", type: "potion", name: "Flask", w: 1, h: 2, icon: "flask", loc: { kind: "grid", bagId: "stashVault", x: 3, y: 7 } },
  stashWaterPouch: { id: "stashWaterPouch", type: "drink", name: "Water Pouch", w: 1, h: 2, icon: "drink", loc: { kind: "grid", bagId: "stashVault", x: 4, y: 7 } },
  stashAtlas: { id: "stashAtlas", type: "map", name: "Atlas", w: 2, h: 2, icon: "map", loc: { kind: "grid", bagId: "stashVault", x: 6, y: 7 } },
  stashPaperLunch: { id: "stashPaperLunch", type: "bag", name: "Paper Lunch Sack", w: 2, h: 2, icon: "food", loc: { kind: "grid", bagId: "stashVault", x: 0, y: 10 } },
  stashTinLunch: { id: "stashTinLunch", type: "bag", name: "Tin Lunch Box", w: 2, h: 2, icon: "food", loc: { kind: "grid", bagId: "stashVault", x: 2, y: 10 } },
  stashPicnicCooler: { id: "stashPicnicCooler", type: "bag", name: "Picnic Cooler", w: 2, h: 2, icon: "food", loc: { kind: "grid", bagId: "stashVault", x: 4, y: 10 } },
  stashSoulPhilo: { id: "stashSoulPhilo", type: "gem", name: "Soul Gem — Philo", w: 2, h: 2, icon: "gem", loc: { kind: "grid", bagId: "stashVault", x: 0, y: 13 } },
  stashSoulTiger: { id: "stashSoulTiger", type: "gem", name: "Greater Soul Gem — Tiger", w: 2, h: 2, icon: "cat", loc: { kind: "grid", bagId: "stashVault", x: 2, y: 13 } },
  stashSoulHawk: { id: "stashSoulHawk", type: "gem", name: "Soul Gem — Hawk", w: 2, h: 2, icon: "spirit", loc: { kind: "grid", bagId: "stashVault", x: 4, y: 13 } },
  spirit1: { id: "spirit1", type: "spirit", name: "Aveline's Spirit", w: 1, h: 1, icon: "spirit", note: "Bound player spirit", loc: { kind: "hud", slot: "spirit" } },
  food1: { id: "food1", type: "food", name: "Roasted Wayfarer Ration", w: 1, h: 1, icon: "food", quantity: 3, note: "Restores health over time", loc: { kind: "hud", slot: "food" } },
  drink1: { id: "drink1", type: "drink", name: "Springwater Flask", w: 1, h: 1, icon: "drink", quantity: 2, note: "Restores spirit over time", loc: { kind: "hud", slot: "drink" } },
	  worldMap1: { id: "worldMap1", type: "map", name: "Field Map", w: 2, h: 2, icon: "map", leftClickAction: "open map", rightClickAction: "inspect map", compatibleSlots: ["map"], loc: { kind: "hud", slot: "map" } },
	  settings1: { id: "settings1", type: "settings", name: "Settings Keyhole", w: 1, h: 1, icon: "keyhole", leftClickAction: "open settings", rightClickAction: "inspect controls", compatibleSlots: ["settings"], loc: { kind: "hud", slot: "settings" } },
	  potion1: { id: "potion1", type: "potion", name: "Phial of Mist", w: 1, h: 1, icon: "flask", loc: { kind: "grid", bagId: "fieldpack", x: 0, y: 3 } },
  key1: { id: "key1", type: "key", name: "Ghost Iron Key", w: 1, h: 1, icon: "key", loc: { kind: "grid", bagId: "fieldpack", x: 1, y: 3 } },
  gem1: { id: "gem1", type: "gem", name: "Spectral Shard", w: 1, h: 1, icon: "gem", loc: { kind: "grid", bagId: "fieldpack", x: 2, y: 3 } },
  glasses1: { id: "glasses1", type: "glasses", name: "Seer Glasses", w: 2, h: 1, icon: "glasses", loc: { kind: "grid", bagId: "fieldpack", x: 3, y: 3 } },
  ring1: { id: "ring1", type: "ring", name: "Band of Echoes", w: 1, h: 1, icon: "ring", loc: { kind: "grid", bagId: "fieldpack", x: 5, y: 3 } },
  neck1: { id: "neck1", type: "neck", name: "Wraith Amulet", w: 2, h: 1, icon: "neck", loc: { kind: "grid", bagId: "satchel", x: 0, y: 0 } },
  ear1: { id: "ear1", type: "earring", name: "Whisper Earring", w: 1, h: 1, icon: "earring", loc: { kind: "grid", bagId: "satchel", x: 2, y: 0 } },
  ear2: { id: "ear2", type: "earring", name: "Whisper Earring", w: 1, h: 1, icon: "earring", loc: { kind: "grid", bagId: "satchel", x: 0, y: 1 } },
  phial1: { id: "phial1", type: "phial", name: "Phial of Souls", w: 1, h: 1, icon: "phial", loc: { kind: "grid", bagId: "satchel", x: 1, y: 1 } },
  glove1: { id: "glove1", type: "glove", name: "Mist Glove", w: 1, h: 2, icon: "glove", loc: { kind: "grid", bagId: "voidpack", x: 2, y: 0 } },
  glove2: { id: "glove2", type: "glove", name: "Mist Glove", w: 1, h: 2, icon: "glove", loc: { kind: "grid", bagId: "voidpack", x: 3, y: 0 } },
  helm1: { id: "helm1", type: "head", name: "Spectral Helm", w: 2, h: 2, icon: "helm", loc: { kind: "grid", bagId: "voidpack", x: 4, y: 0 } },
  boots1: { id: "boots1", type: "feet", name: "Wraith Boots", w: 2, h: 2, icon: "boots", loc: { kind: "grid", bagId: "voidpack", x: 6, y: 0 } }
  ,sword1: { id: "sword1", type: "weapon", name: "Sunline Sword", w: 1, h: 3, icon: "sword", stats: { cooldown: 6, cooldownRemaining: 0, durability: 78, durabilityMaximum: 100 }, leftClickAction: "attack", rightClickAction: "guard", compatibleSlots: ["action", "weapon"], loc: { kind: "hud", slot: "action0" } }
  ,pickaxe1: { id: "pickaxe1", type: "tool", name: "Neon Pickaxe", w: 2, h: 3, icon: "pickaxe", leftClickAction: "mine", rightClickAction: "inspect material", compatibleSlots: ["action", "tool"], loc: { kind: "grid", bagId: "voidpack", x: 0, y: 3 } }
  ,gridBlock1: { id: "gridBlock1", type: "block", name: "Grid Block", w: 1, h: 1, icon: "block", stats: { cooldown: 1.5, cooldownRemaining: 0 }, leftClickAction: "place block", rightClickAction: "pick compatible block", compatibleSlots: ["action", "block"], loc: { kind: "hud", slot: "action1" } }
  ,skillAugment1: { id: "skillAugment1", type: "skill", name: "Augmented Strike", w: 1, h: 1, icon: "sword", stats: { cooldown: 4, cooldownRemaining: 0 }, leftClickAction: "cast augment", rightClickAction: "select skill", compatibleSlots: ["tome", "action"], loc: { kind: "hud", slot: "action2" } }
};

export const initialCanvasLog = [
  { id: "log-keyhole", text: "The keyhole stirs", icon: "key" },
  { id: "log-ectoplasm", text: "+3 Ectoplasm", icon: "drop" },
  { id: "log-shard", text: "Spectral Shard acquired", icon: "gem" },
  { id: "log-oil", text: "Lantern Oil used", icon: "flask" },
  { id: "log-souls", text: "+12 Souls", icon: "orb" }
];
