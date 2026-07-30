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
  assert.match(styles, /prototype-hud__spirit[\s\S]*position: fixed[\s\S]*right: max\(var\(--knowhere-grid-unit\)/);
  assert.match(styles, /prototype-hud \.atlas-compass[\s\S]*background: none/);
});
