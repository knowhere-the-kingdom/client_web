import assert from "node:assert/strict";
import test from "node:test";
import {
  FLIGHT_SPRINT_MAX_MULTIPLIER,
  GROUND_SPRINT_MAX_MULTIPLIER,
  sprintSpeedMultiplier,
} from "../src/features/character-controller/movementSpeed.ts";

test("ground sprint is faster while retaining a bounded ramp", () => {
  assert.equal(sprintSpeedMultiplier(0, false), 1);
  assert.equal(sprintSpeedMultiplier(1, false), GROUND_SPRINT_MAX_MULTIPLIER);
  assert.ok(sprintSpeedMultiplier(0.5, false) > 1.5);
});

test("flight sprint accelerates exponentially to its bounded travel speed", () => {
  const quarter = sprintSpeedMultiplier(0.25, true);
  const half = sprintSpeedMultiplier(0.5, true);
  const full = sprintSpeedMultiplier(1, true);
  assert.equal(full, FLIGHT_SPRINT_MAX_MULTIPLIER);
  assert.ok(half - quarter < full - half);
  assert.ok(full > sprintSpeedMultiplier(1, false));
});

test("movement skill modifiers apply to both sprint modes", () => {
  assert.equal(sprintSpeedMultiplier(1, false, 1.2), GROUND_SPRINT_MAX_MULTIPLIER * 1.2);
  assert.equal(sprintSpeedMultiplier(1, true, 1.2), FLIGHT_SPRINT_MAX_MULTIPLIER * 1.2);
});
