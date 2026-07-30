import assert from "node:assert/strict";
import test from "node:test";
import { prototypeSunPositionAt } from "../src/scene/sun-orbit.ts";

const camera = { x: 12, y: 34, z: 56 };

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be near ${expected}`);
}

test("prototype sun follows the voxel east-up-west cardinal orbit", () => {
  assert.deepEqual(prototypeSunPositionAt(0, camera), { x: 192, y: 34, z: 56 });

  const noon = prototypeSunPositionAt(Math.PI / 2, camera);
  near(noon.x, 12);
  near(noon.y, 114);
  assert.equal(noon.z, 56);

  const sunset = prototypeSunPositionAt(Math.PI, camera);
  near(sunset.x, -168);
  near(sunset.y, 34);
  assert.equal(sunset.z, 56);
});

test("prototype sun remains camera-relative without north-south drift", () => {
  const first = prototypeSunPositionAt(Math.PI / 3, camera);
  const moved = prototypeSunPositionAt(Math.PI / 3, { x: -400, y: 80, z: 900 });
  near(moved.x - first.x, -412);
  near(moved.y - first.y, 46);
  assert.equal(moved.z - first.z, 844);
});
