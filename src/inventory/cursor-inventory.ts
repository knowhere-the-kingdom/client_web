import type { CanvasItem, CanvasItemLocation } from "../hud/types";

export type CursorInventoryState = Readonly<{
  heldItemId: string | null;
  pointerX: number;
  pointerY: number;
}>;

export type CursorSwapResult =
  | Readonly<{
    ok: true;
    heldItemId: string | null;
    movedItemId: string;
    destination: CanvasItemLocation;
    swappedItemId: string | null;
  }>
  | Readonly<{
    ok: false;
    code: "cursor_empty" | "item_missing" | "incompatible" | "occupied_grid";
  }>;

export const EMPTY_CURSOR_INVENTORY: CursorInventoryState = Object.freeze({
  heldItemId: null,
  pointerX: 0,
  pointerY: 0,
});

export function holdCursorItem(state: CursorInventoryState, itemId: string, x = state.pointerX, y = state.pointerY): CursorInventoryState {
  return { heldItemId: itemId, pointerX: x, pointerY: y };
}

export function moveCursor(state: CursorInventoryState, x: number, y: number): CursorInventoryState {
  return { ...state, pointerX: x, pointerY: y };
}

export function clearCursorInventory(state: CursorInventoryState): CursorInventoryState {
  return { ...state, heldItemId: null };
}

export function planCursorPlacement(
  state: CursorInventoryState,
  items: Readonly<Record<string, CanvasItem>>,
  destination: CanvasItemLocation,
  acceptsHeldItem: boolean,
  occupantId: string | null,
  gridFootprintAvailable = true,
): CursorSwapResult {
  if (!state.heldItemId) return { ok: false, code: "cursor_empty" };
  const held = items[state.heldItemId];
  if (!held) return { ok: false, code: "item_missing" };
  if (!acceptsHeldItem) return { ok: false, code: "incompatible" };
  if (!gridFootprintAvailable && !occupantId) return { ok: false, code: "occupied_grid" };
  if (occupantId && !items[occupantId]) return { ok: false, code: "item_missing" };
  return {
    ok: true,
    heldItemId: occupantId,
    movedItemId: held.id,
    destination,
    swappedItemId: occupantId,
  };
}
