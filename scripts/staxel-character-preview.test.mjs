import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "third-party", "staxel_voxel_female", "source");

test("Staxel preview source retains required rig, clip, and license evidence", async () => {
  const gltf = JSON.parse(await readFile(path.join(source, "scene.gltf"), "utf8"));
  const license = await readFile(path.join(source, "license.txt"), "utf8");
  const attribution = await readFile(path.join(root, "public", "third-party", "staxel_voxel_female", "ATTRIBUTION.md"), "utf8");

  assert.equal(gltf.asset.version, "2.0");
  assert.ok(gltf.nodes.some((node) => node.name === "_rootJoint"));
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0].joints.length, 21);
  assert.ok(gltf.animations.some((animation) => animation.name === "Take 001"));
  assert.match(license, /CC-BY-4\.0/);
  assert.match(license, /andruha1801/);
  assert.match(attribution, /andruha1801/);
  assert.match(attribution, /CC-BY-4\.0/);
});
