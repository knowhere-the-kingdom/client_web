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
  iconPath: "/inventory/items/icons/awareness.svg",
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
