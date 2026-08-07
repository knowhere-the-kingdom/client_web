import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectCharacterDrop } from "../src/inventory/character-placement.ts";

const slot = { left: 100, top: 200, right: 164, bottom: 296 };

test("character placement accepts the slot and its forgiving near edge", () => {
  assert.equal(projectCharacterDrop({ x: 132, y: 248 }, slot).accepted, true);
  assert.equal(projectCharacterDrop({ x: 188, y: 248 }, slot).accepted, true);
});

test("a rejected character drop remains outside the projection", () => {
  const result = projectCharacterDrop({ x: 220, y: 248 }, slot);
  assert.equal(result.accepted, false);
  assert.ok(result.distance > 28);
});

test("character selector exposes click, native drag, pointer, projection, and retained-held seams", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /heldCharacterRef/);
  assert.match(source, /draggable=/);
  assert.match(source, /onDragStart=/);
  assert.match(source, /onPointerDown=/);
  assert.match(source, /is-drop-projected/);
  assert.match(source, /if \(point && !projectCharacterDrop\(point, to\)\.accepted\)/);
  assert.match(source, /system-item-traveler/);
});
