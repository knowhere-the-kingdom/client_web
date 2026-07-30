import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { voxelHeadingFromForward } from "../src/scene/compass-heading.ts";

test("voxel compass maps Babylon X/Z forward vectors to exact cardinal headings", () => {
  assert.equal(voxelHeadingFromForward({ x: 0, z: 1 }), 0);
  assert.equal(voxelHeadingFromForward({ x: 1, z: 0 }), 90);
  assert.equal(voxelHeadingFromForward({ x: 0, z: -1 }), 180);
  assert.equal(voxelHeadingFromForward({ x: -1, z: 0 }), 270);
});

test("voxel compass preserves continuous intermediate headings", () => {
  assert.equal(voxelHeadingFromForward({ x: Math.SQRT1_2, z: Math.SQRT1_2 }), 45);
  assert.equal(voxelHeadingFromForward({ x: Math.sin(Math.PI / 8), z: Math.cos(Math.PI / 8) }), 22.5);
  assert.equal(voxelHeadingFromForward({ x: 0, z: 0 }), 0);
});

test("HUD compass and action clusters retain continuous and grid-aligned geometry", async () => {
  const hud = await readFile(new URL("../src/hud/KnowhereHud.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(hud, /Math\.round\(heading \/ 45\)/);
  assert.match(hud, /\(bearing - heading\) \/ 315/);
  assert.match(hud, /oddActionIndices\.filter\(\(index\) => index !== selectedLeftIndex\)/);
  assert.match(hud, /evenActionIndices\.filter\(\(index\) => index !== selectedRightIndex\)/);
  assert.match(styles, /--knowhere-grid-unit: 2rem/);
  assert.match(styles, /prototype-hud__action-grid > :nth-child\(4\).*grid-column: 2.*grid-row: 3/);
  assert.match(styles, /--prototype-action-cell: calc\(var\(--knowhere-grid-unit\) \* 2\)/);
  assert.match(styles, /grid-template-columns: repeat\(3, var\(--prototype-action-cell\)\)/);
  assert.match(styles, /grid-template-rows: repeat\(3, var\(--prototype-action-cell\)\)/);
  assert.match(styles, /prototype-hud__hand-action[\s\S]*grid-column: 2;[\s\S]*grid-row: 2/);
  assert.match(hud, /hotkey=\{bindingLabel\("left-hand"\)\}/);
  assert.match(hud, /hotkey=\{bindingLabel\("right-hand"\)\}/);
  assert.match(hud, /bindingLabel\("character"\), "prototype-hud__character-anchor"/);
  assert.match(styles, /prototype-hud__action-vital[\s\S]*width: var\(--knowhere-grid-unit\);[\s\S]*height: calc\(var\(--knowhere-grid-unit\) \* 6\)/);
  assert.match(styles, /prototype-hud__action-vital[\s\S]*left: 50%;[\s\S]*transform: translateX\(-50%\)/);
  assert.match(styles, /grid-template-rows: repeat\(6, var\(--knowhere-grid-unit\)\)/);
  assert.match(hud, /\[5, 4, 3, 2, 1, 0\]\.map/);
  assert.match(hud, /prototype-hud__creature[\s\S]*prototype-hud__agility/);
  assert.doesNotMatch(hud, /prototype-hud__character-loadout[\s\S]{0,260}prototype-hud__agility/);
  assert.match(styles, /prototype-hud__creature \.prototype-hud__agility[\s\S]*grid-template-columns: repeat\(4, var\(--knowhere-grid-unit\)\)/);
  assert.match(styles, /grid-template-rows: calc\(var\(--knowhere-grid-unit\) \* 2\) var\(--knowhere-grid-unit\);[\s\S]*row-gap: var\(--knowhere-grid-unit\)/);
  assert.match(styles, /prototype-hud \.prototype-hud__actionbar[\s\S]*left: 50%;[\s\S]*grid-template-columns: calc\(var\(--prototype-action-cell\) \* 3\) calc\(var\(--knowhere-grid-unit\) \* 2\) calc\(var\(--prototype-action-cell\) \* 3\)/);
  assert.match(styles, /--prototype-character-action-gap: var\(--knowhere-grid-unit\)[\s\S]*column-gap: var\(--prototype-character-action-gap\)/);
  assert.match(styles, /prototype-hud__creature[\s\S]*justify-self: center;[\s\S]*justify-items: center/);
  assert.match(styles, /prototype-hud__spirit[\s\S]*position: fixed[\s\S]*right: max\(var\(--knowhere-grid-unit\)/);
  assert.match(styles, /prototype-hud \.atlas-compass[\s\S]*background: none/);
});
