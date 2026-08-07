import type { InventoryPlacement } from "./types";

export const backpackGrid = {
  cols: 12,
  rows: 5
} as const;

export function canPlaceItem(
  placements: InventoryPlacement[],
  next: InventoryPlacement,
  ignoredItemId = next.itemId
) {
  if (next.x < 0 || next.y < 0) return false;
  if (next.x + next.cols > backpackGrid.cols) return false;
  if (next.y + next.rows > backpackGrid.rows) return false;

  return placements.every((current) => {
    if (current.itemId === ignoredItemId) return true;

    const separated =
      next.x + next.cols <= current.x ||
      current.x + current.cols <= next.x ||
      next.y + next.rows <= current.y ||
      current.y + current.rows <= next.y;

    return separated;
  });
}

export function placeItem(
  placements: InventoryPlacement[],
  next: InventoryPlacement
) {
  if (!canPlaceItem(placements, next)) return placements;

  return [
    ...placements.filter((placement) => placement.itemId !== next.itemId),
    next
  ];
}

export function removePlacement(placements: InventoryPlacement[], itemId: string) {
  return placements.filter((placement) => placement.itemId !== itemId);
}
