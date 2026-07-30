import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hudPath = new URL("../src/hud/KnowhereHud.tsx", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);
const controllerPath = new URL("../src/features/character-controller/controller.ts", import.meta.url);
const controllerTypesPath = new URL("../src/features/character-controller/types.ts", import.meta.url);

test("equipment uses the exact six-slot dev_prototype geometry", async () => {
  const hud = await readFile(hudPath, "utf8");
  const expected = [
    ["head", 2, 2, 2, 1],
    ["left", 2, 3, 1, 2],
    ["outfit", 2, 3, 2, 2],
    ["right", 2, 3, 3, 2],
    ["belt", 2, 1, 2, 3],
    ["footwear", 2, 2, 2, 4],
  ];
  for (const [id, cols, rows, column, row] of expected) {
    const pattern = new RegExp(`id: "${id}"[^\\n]+cols: ${cols}, rows: ${rows}, column: ${column}, row: ${row}`);
    assert.match(hud, pattern, `${id} must retain its prototype footprint and position`);
  }
  assert.match(hud, /atlas-equipment-prototype-slot--\$\{slot\.id\}/);
});

test("equipment grows upward from the fixed character anchor", async () => {
  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--equipment-grid-unit:\s*clamp\(2\.25rem, 4\.35vmin, 3rem\)/);
  assert.match(css, /grid-template-rows:\s*calc\(var\(--equipment-grid-unit\) \* 2\)\s*calc\(var\(--equipment-grid-unit\) \* 3\)\s*var\(--equipment-grid-unit\)\s*calc\(var\(--equipment-grid-unit\) \* 2\)/);
  assert.match(css, /atlas-equipment-prototype-slot--footwear\s*\{\s*grid-area:\s*4 \/ 2;/);
  assert.match(css, /repeating-linear-gradient\(to bottom, var\(--atlas-gold-muted\)/, "empty equipment slots expose the dashed subgrid");
  assert.match(css, /prototype-hud__creature\s*\{[\s\S]*?position:\s*relative;[\s\S]*?width:\s*calc\(var\(--knowhere-grid-unit\) \* 2\);/);
});

test("configured Character action toggles equipment and C is not hardwired", async () => {
  const hud = await readFile(hudPath, "utf8");
  const controller = await readFile(controllerPath, "utf8");
  const controllerTypes = await readFile(controllerTypesPath, "utf8");
  assert.match(hud, /signal\.actionId === "character"/);
  assert.match(hud, /current === "equipment" \? null : "equipment"/);
  assert.doesNotMatch(hud, /event\.key\.toLowerCase\(\) === "c"/);
  assert.match(controllerTypes, /\| "character"/);
  assert.match(controller, /"character",\s*\n\s*"actionbar-1"/, "Character must be available to the controller's configured gamepad/action signal path");
});
