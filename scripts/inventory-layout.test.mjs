import assert from "node:assert/strict";
import test from "node:test";

import {
  placeInventoryItem,
  removeInventoryItem,
  validateInventoryLayout,
} from "../src/inventory/inventory-layout.ts";

const emptyLayout = Object.freeze({
  schemaVersion: 1,
  grid: Object.freeze({ columns: 12, rows: 5 }),
  placements: Object.freeze([]),
});

test("inventory layout places, moves, and removes bounded items immutably", () => {
  const placed = placeInventoryItem(emptyLayout, {
    itemId: "item.backpack-map",
    column: 1,
    row: 1,
    footprint: { columns: 2, rows: 2 },
  });
  assert.equal(placed.ok, true);
  assert.deepEqual(emptyLayout.placements, []);

  const moved = placeInventoryItem(placed.layout, {
    itemId: "item.backpack-map",
    column: 8,
    row: 2,
    footprint: { columns: 2, rows: 2 },
  });
  assert.equal(moved.ok, true);
  assert.equal(moved.layout.placements.length, 1);
  assert.equal(moved.layout.placements[0].column, 8);

  const removed = removeInventoryItem(moved.layout, "item.backpack-map");
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.layout.placements, []);
});

test("inventory layout rejects overlap and out-of-bounds placement", () => {
  const first = placeInventoryItem(emptyLayout, {
    itemId: "item.first",
    column: 0,
    row: 0,
    footprint: { columns: 3, rows: 2 },
  });
  assert.equal(first.ok, true);

  assert.deepEqual(placeInventoryItem(first.layout, {
    itemId: "item.overlap",
    column: 2,
    row: 1,
    footprint: { columns: 1, rows: 1 },
  }), { ok: false, code: "occupied" });

  assert.deepEqual(placeInventoryItem(first.layout, {
    itemId: "item.outside",
    column: 11,
    row: 4,
    footprint: { columns: 2, rows: 1 },
  }), { ok: false, code: "out_of_bounds" });
});

test("inventory layout rejects malformed, duplicate, and unbounded input", () => {
  assert.deepEqual(placeInventoryItem(emptyLayout, {
    itemId: "",
    column: 0,
    row: 0,
    footprint: { columns: 1, rows: 1 },
  }), { ok: false, code: "invalid_item" });

  assert.deepEqual(validateInventoryLayout({
    schemaVersion: 1,
    grid: { columns: 65, rows: 5 },
    placements: [],
  }), { ok: false, code: "invalid_layout" });

  assert.deepEqual(validateInventoryLayout({
    schemaVersion: 1,
    grid: { columns: 12, rows: 5 },
    placements: [
      { itemId: "duplicate", column: 0, row: 0, footprint: { columns: 1, rows: 1 } },
      { itemId: "duplicate", column: 2, row: 0, footprint: { columns: 1, rows: 1 } },
    ],
  }), { ok: false, code: "invalid_item" });
});
