import assert from "node:assert/strict";
import test from "node:test";
import {
  PROTOTYPE_SUN_ORBIT,
  isSunInVisibleDaylightArc,
  prototypeSunPositionAt,
  safeSunVisualScale,
} from "../src/scene/sun-orbit.ts";

const camera = { x: 12, y: 34, z: 56 };

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be near ${expected}`);
}

test("prototype sun follows the voxel east-up-west cardinal orbit", () => {
  const sunrise = prototypeSunPositionAt(0, camera);
  assert.ok(sunrise.x > camera.x);
  assert.ok(sunrise.y > camera.y);

  const noon = prototypeSunPositionAt(Math.PI / 2, camera);
  near(noon.x, 12);
  near(noon.y, 1834);
  assert.equal(noon.z, 56);

  const sunset = prototypeSunPositionAt(Math.PI, camera);
  assert.ok(sunset.x < camera.x);
  near(sunset.y, sunrise.y);
  assert.equal(sunset.z, 56);
});

test("prototype sun remains camera-relative without north-south drift", () => {
  const first = prototypeSunPositionAt(Math.PI / 3, camera);
  const moved = prototypeSunPositionAt(Math.PI / 3, { x: -400, y: 80, z: 900 });
  near(moved.x - first.x, -412);
  near(moved.y - first.y, 46);
  assert.equal(moved.z - first.z, 844);
});

test("the visible east-to-west arc remains safely above the local horizon", () => {
  for (let step = 0; step <= 180; step += 1) {
    const position = prototypeSunPositionAt(step * Math.PI / 180, camera);
    assert.ok(
      position.y + 1e-9 >= camera.y + Math.sin(PROTOTYPE_SUN_ORBIT.horizonElevationRadians) * PROTOTYPE_SUN_ORBIT.skyRadius,
      `daylight phase ${step} dropped below its terrain clearance`,
    );
  }
});

test("the Gateway diameter receives a stable bounded celestial scale", () => {
  const projectedDiameter = 52;
  const distance = PROTOTYPE_SUN_ORBIT.skyRadius;
  const scale = safeSunVisualScale(projectedDiameter, distance);
  const apparentDiameter = 2 * Math.atan(projectedDiameter * scale * 0.5 / distance);
  assert.ok(scale >= PROTOTYPE_SUN_ORBIT.minimumVisualScale);
  near(apparentDiameter, PROTOTYPE_SUN_ORBIT.apparentDiameterRadians);
  assert.ok(scale <= PROTOTYPE_SUN_ORBIT.maximumVisualScale);
});

test("only the raised east-to-west daylight arc is visible", () => {
  assert.equal(isSunInVisibleDaylightArc(0), true);
  assert.equal(isSunInVisibleDaylightArc(Math.PI / 2), true);
  assert.equal(isSunInVisibleDaylightArc(Math.PI), true);
  assert.equal(isSunInVisibleDaylightArc(Math.PI * 1.5), false);
});
