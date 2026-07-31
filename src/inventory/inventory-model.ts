export const INVENTORY_QUALITY_NAMES = [
  "Scrap",
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Relic",
  "Mythic",
  "Legendary",
  "Cosmic",
  "Divine",
] as const;

export type InventoryQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type InventoryFootprintV1 = Readonly<{
  width: number;
  height: number;
}>;

export type InventoryItemDefinitionV1 = Readonly<{
  id: string;
  name: string;
  itemType: string;
  itemCategory: string;
  description: string;
  quality: InventoryQuality;
  materialType: string;
  iconPath: string;
  gridSize: InventoryFootprintV1;
}>;

export type InventoryItemInstanceV1 = Readonly<{
  instanceId: string;
  itemId: string;
  quantity: number;
}>;

export type InventorySlotDefinitionV1 = Readonly<{
  id: string;
  label: string;
  gridSize: InventoryFootprintV1;
  acceptedItemTypes: readonly string[];
  acceptedItemIds?: readonly string[];
}>;

/** Versioned, validated catalog data supplied by an owning adapter. */
export type InventoryCatalogProjectionV1 = Readonly<{
  protocolVersion: "1.0.0";
  sourceRevision: string;
  items: readonly InventoryItemDefinitionV1[];
  slots: readonly InventorySlotDefinitionV1[];
}>;

/** Read-only lookup seam; it has no profile, database, or login authority. */
export type InventoryCatalogAdapterV1 = Readonly<{
  getItem: (itemId: string) => InventoryItemDefinitionV1 | null;
  getSlot: (slotId: string) => InventorySlotDefinitionV1 | null;
}>;

export function createInventoryCatalogAdapter(
  projection: InventoryCatalogProjectionV1,
): InventoryCatalogAdapterV1 {
  if (projection.protocolVersion !== "1.0.0" || !projection.sourceRevision.trim()) {
    throw new Error("invalid inventory catalog projection");
  }

  const items = new Map<string, InventoryItemDefinitionV1>();
  for (const item of projection.items) {
    if (!item.id.trim() || items.has(item.id)) throw new Error("invalid inventory item projection");
    items.set(item.id, item);
  }

  const slots = new Map<string, InventorySlotDefinitionV1>();
  for (const slot of projection.slots) {
    if (!slot.id.trim() || slots.has(slot.id)) throw new Error("invalid inventory slot projection");
    slots.set(slot.id, slot);
  }

  return Object.freeze({
    getItem: (itemId: string) => items.get(itemId) ?? null,
    getSlot: (slotId: string) => slots.get(slotId) ?? null,
  });
}

export const AWARENESS_ITEM: InventoryItemDefinitionV1 = Object.freeze({
  id: "awareness",
  name: "Awareness",
  itemType: "Key",
  itemCategory: "Designer",
  description: "Once the pattern is seen, nothing appears accidental.",
  quality: 8,
  materialType: "cosmic",
  iconPath: "/inventory/items/icons/awareness-key.png",
  gridSize: Object.freeze({ width: 2, height: 2 }),
});

export const AWARENESS_INSTANCE: InventoryItemInstanceV1 = Object.freeze({
  instanceId: "designer-awareness-001",
  itemId: AWARENESS_ITEM.id,
  quantity: 1,
});

export const DESIGNER_RECEPTACLE: InventorySlotDefinitionV1 = Object.freeze({
  id: "designer",
  label: "Designer Slot",
  gridSize: Object.freeze({ width: 2, height: 2 }),
  acceptedItemTypes: Object.freeze(["Key"]),
  acceptedItemIds: Object.freeze([AWARENESS_ITEM.id]),
});

export const ACCOUNT_SOUL_ITEM: InventoryItemDefinitionV1 = Object.freeze({
  id: "account-soul-v1",
  name: "Account Soul",
  itemType: "Soul",
  itemCategory: "Spirit",
  description: "The authenticated account spirit and its accumulated history.",
  quality: 8,
  materialType: "cosmic",
  iconPath: "/inventory/items/icons/account-soul.svg",
  gridSize: Object.freeze({ width: 2, height: 2 }),
});

export const CHARACTER_SOUL_ITEM: InventoryItemDefinitionV1 = Object.freeze({
  id: "character-soul-v1",
  name: "Character Soul",
  itemType: "Character",
  itemCategory: "Spirit",
  description: "A playable character possessed by the authenticated account.",
  quality: 6,
  materialType: "spirit",
  iconPath: "/inventory/items/icons/character-soul.svg",
  gridSize: Object.freeze({ width: 2, height: 3 }),
});

export const GARDEN_WORLD_ITEM: InventoryItemDefinitionV1 = Object.freeze({
  id: "garden-world-v1",
  name: "Garden",
  itemType: "World",
  itemCategory: "World",
  description: "The player's local Garden world.",
  quality: 7,
  materialType: "world",
  iconPath: "/inventory/items/icons/garden-world.svg",
  gridSize: Object.freeze({ width: 3, height: 3 }),
});

export const SPIRIT_RECEPTACLE: InventorySlotDefinitionV1 = Object.freeze({
  id: "spirit-account",
  label: "Spirit Slot",
  gridSize: Object.freeze({ width: 2, height: 2 }),
  acceptedItemTypes: Object.freeze(["Soul"]),
  acceptedItemIds: Object.freeze([ACCOUNT_SOUL_ITEM.id]),
});

export const CHARACTER_RECEPTACLE: InventorySlotDefinitionV1 = Object.freeze({
  id: "active-character",
  label: "Character Slot",
  gridSize: Object.freeze({ width: 2, height: 3 }),
  acceptedItemTypes: Object.freeze(["Character"]),
  acceptedItemIds: Object.freeze([CHARACTER_SOUL_ITEM.id]),
});

export const WORLD_RECEPTACLE: InventorySlotDefinitionV1 = Object.freeze({
  id: "wake-world",
  label: "World Slot",
  gridSize: Object.freeze({ width: 3, height: 3 }),
  acceptedItemTypes: Object.freeze(["World"]),
  acceptedItemIds: Object.freeze([GARDEN_WORLD_ITEM.id]),
});

export function inventoryQualityName(quality: InventoryQuality): typeof INVENTORY_QUALITY_NAMES[number] {
  return INVENTORY_QUALITY_NAMES[quality];
}

export function slotAcceptsItem(
  slot: InventorySlotDefinitionV1,
  item: InventoryItemDefinitionV1,
): boolean {
  const fits = item.gridSize.width <= slot.gridSize.width
    && item.gridSize.height <= slot.gridSize.height;
  if (!fits) return false;
  if (slot.acceptedItemIds) return slot.acceptedItemIds.includes(item.id);
  return slot.acceptedItemTypes.includes(item.itemType);
}
