import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_CURSOR_INVENTORY,
  clearCursorInventory,
  holdCursorItem,
  looseWorldLocation,
  moveCursor,
  planCursorPlacement,
} from "../src/inventory/cursor-inventory.ts";

const items = {
  key: { id: "key", type: "key", name: "Awareness", w: 2, h: 2, icon: "key", loc: { kind: "grid", bagId: "stash", x: 0, y: 0 } },
  map: { id: "map", type: "map", name: "Garden Map", w: 2, h: 2, icon: "map", loc: { kind: "hud", slot: "map" } },
};

test("cursor inventory holds one item, follows the pointer, and cancels without losing identity", () => {
  const held = holdCursorItem(EMPTY_CURSOR_INVENTORY, "key", 120, 240);
  assert.deepEqual(held, { heldItemId: "key", pointerX: 120, pointerY: 240 });
  assert.deepEqual(moveCursor(held, 160, 280), { heldItemId: "key", pointerX: 160, pointerY: 280 });
  assert.deepEqual(clearCursorInventory(held), { heldItemId: null, pointerX: 120, pointerY: 240 });
});

test("compatible occupied placement becomes a swap and keeps the occupant in the cursor", () => {
  const held = holdCursorItem(EMPTY_CURSOR_INVENTORY, "key");
  assert.deepEqual(planCursorPlacement(held, items, items.map.loc, true, "map"), {
    ok: true,
    heldItemId: "map",
    movedItemId: "key",
    destination: items.map.loc,
    swappedItemId: "map",
  });
});

test("incompatible swaps and blocked grid placement fail closed", () => {
  const held = holdCursorItem(EMPTY_CURSOR_INVENTORY, "key");
  assert.deepEqual(planCursorPlacement(held, items, items.map.loc, false, "map"), { ok: false, code: "incompatible" });
  assert.deepEqual(planCursorPlacement(held, items, { kind: "grid", bagId: "stash", x: 2, y: 2 }, true, null, false), { ok: false, code: "occupied_grid" });
  assert.equal(held.heldItemId, "key");
});

test("loose world placement is normalized to the visible game screen", () => {
  assert.deepEqual(looseWorldLocation(960, 540, 1920, 1080), { kind: "world", x: 0.5, y: 0.5 });
  assert.deepEqual(looseWorldLocation(-10, 1200, 1920, 1080), { kind: "world", x: 0, y: 1 });
});
