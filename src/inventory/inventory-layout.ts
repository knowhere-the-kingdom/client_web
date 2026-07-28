export const INVENTORY_LAYOUT_VERSION = 1 as const;

export type InventoryFootprint = Readonly<{
  columns: number;
  rows: number;
}>;

export type InventoryPlacement = Readonly<{
  itemId: string;
  column: number;
  row: number;
  footprint: InventoryFootprint;
}>;

export type InventoryGrid = Readonly<{
  columns: number;
  rows: number;
}>;

export type InventoryLayout = Readonly<{
  schemaVersion: typeof INVENTORY_LAYOUT_VERSION;
  grid: InventoryGrid;
  placements: readonly InventoryPlacement[];
}>;

export type InventoryLayoutResult =
  | Readonly<{ ok: true; layout: InventoryLayout }>
  | Readonly<{
      ok: false;
      code: "invalid_item" | "invalid_layout" | "out_of_bounds" | "occupied";
    }>;

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validItemId(itemId: string): boolean {
  return typeof itemId === "string" && itemId.length > 0 && itemId.length <= 128;
}

function validGrid(grid: InventoryGrid): boolean {
  return isPositiveInteger(grid.columns)
    && isPositiveInteger(grid.rows)
    && grid.columns <= 64
    && grid.rows <= 64;
}

function validPlacement(placement: InventoryPlacement): boolean {
  return validItemId(placement.itemId)
    && isNonNegativeInteger(placement.column)
    && isNonNegativeInteger(placement.row)
    && isPositiveInteger(placement.footprint.columns)
    && isPositiveInteger(placement.footprint.rows);
}

function overlaps(left: InventoryPlacement, right: InventoryPlacement): boolean {
  return !(
    left.column + left.footprint.columns <= right.column
    || right.column + right.footprint.columns <= left.column
    || left.row + left.footprint.rows <= right.row
    || right.row + right.footprint.rows <= left.row
  );
}

export function validateInventoryLayout(layout: InventoryLayout): InventoryLayoutResult {
  if (layout.schemaVersion !== INVENTORY_LAYOUT_VERSION || !validGrid(layout.grid)) {
    return { ok: false, code: "invalid_layout" };
  }

  const seen = new Set<string>();
  for (const placement of layout.placements) {
    if (!validPlacement(placement) || seen.has(placement.itemId)) {
      return { ok: false, code: "invalid_item" };
    }
    seen.add(placement.itemId);
    if (
      placement.column + placement.footprint.columns > layout.grid.columns
      || placement.row + placement.footprint.rows > layout.grid.rows
    ) {
      return { ok: false, code: "out_of_bounds" };
    }
  }

  for (let left = 0; left < layout.placements.length; left += 1) {
    for (let right = left + 1; right < layout.placements.length; right += 1) {
      if (overlaps(layout.placements[left], layout.placements[right])) {
        return { ok: false, code: "occupied" };
      }
    }
  }

  return { ok: true, layout };
}

export function placeInventoryItem(
  layout: InventoryLayout,
  placement: InventoryPlacement,
): InventoryLayoutResult {
  if (!validPlacement(placement)) return { ok: false, code: "invalid_item" };
  const next: InventoryLayout = {
    ...layout,
    placements: [
      ...layout.placements.filter((current) => current.itemId !== placement.itemId),
      placement,
    ],
  };
  return validateInventoryLayout(next);
}

export function removeInventoryItem(
  layout: InventoryLayout,
  itemId: string,
): InventoryLayoutResult {
  if (!validItemId(itemId)) return { ok: false, code: "invalid_item" };
  return validateInventoryLayout({
    ...layout,
    placements: layout.placements.filter((placement) => placement.itemId !== itemId),
  });
}
