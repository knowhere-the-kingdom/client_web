import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateWorldHudBootstrap } from "../src/world/world-bootstrap.ts";
import {
  rendererGateState,
  validatePresentationProjection,
} from "../src/world/renderer-gate.ts";

const now = Date.parse("2026-07-28T12:00:00.000Z");
const valid = {
  schemaVersion: 1,
  worldSessionId: "world-session-1",
  worldId: "garden",
  characterId: "character-1",
  leaseExpiresAt: "2026-07-28T12:05:00.000Z",
  serverSnapshot: { contentRevision: 7, contentHash: "sha256:content-7" },
  hudProjectionRevision: 3,
  scene: {
    schemaVersion: 1,
    sceneId: "garden-alpha-v1",
    voxelLandscape: { kind: "flat-chunk-grid", voxelSizeMeters: 1, chunkSize: 16, chunkRadius: 14, diffuse: "#3f9b45", emissive: "#102d13", specular: "#17351a" },
    skybox: { kind: "solid-color-sphere", diameter: 440, segments: 24, dayColor: "#55a9ed", nightColor: "#020718" },
    sun: { kind: "orbiting-mythic-sun", dayDurationSeconds: 60, nightDurationSeconds: 60, sunlight: "#fff3d0", maxIntensity: 1.25 },
  },
};

test("world bootstrap validates the ticket-free HUD projection", () => {
  const result = validateWorldHudBootstrap(valid, now);
  assert.equal(result.ok, true);
  assert.equal(rendererGateState(result.value, null), "awaiting-presentation-permission");
  const presentation = validatePresentationProjection({ owner: "presentation-lane" }, (value) => (
    Boolean(value) && typeof value === "object" && value.owner === "presentation-lane"
  ));
  assert.equal(presentation.ok, true);
  assert.equal(rendererGateState(result.value, presentation.value), "ready");
});

test("world bootstrap fails closed for expiry, schema, and authority-shaped fields", () => {
  assert.deepEqual(validateWorldHudBootstrap({ ...valid, leaseExpiresAt: "2026-07-28T11:59:59.000Z" }, now), {
    ok: false,
    code: "expired_bootstrap",
  });
  assert.deepEqual(validateWorldHudBootstrap({ ...valid, schemaVersion: 2 }, now), {
    ok: false,
    code: "invalid_bootstrap",
  });
  assert.deepEqual(validateWorldHudBootstrap({ ...valid, ticket: "must-not-be-client-data" }, now), {
    ok: false,
    code: "invalid_bootstrap",
  });
  assert.deepEqual(validateWorldHudBootstrap({ ...valid, privateField: "must-not-cross-boundary" }, now), {
    ok: false,
    code: "invalid_bootstrap",
  });
  assert.deepEqual(validateWorldHudBootstrap({ ...valid, scene: { ...valid.scene, sun: { ...valid.scene.sun, maxIntensity: 99 } } }, now), {
    ok: false,
    code: "invalid_bootstrap",
  });
  assert.deepEqual(validatePresentationProjection({ owner: "unapproved" }, () => false), {
    ok: false,
    code: "invalid_presentation_projection",
  });
  assert.deepEqual(validatePresentationProjection({}, null), {
    ok: false,
    code: "presentation_projection_unavailable",
  });
});

test("Babylon renders the validated Garden landscape, skybox, and orbiting sun projection", async () => {
  const source = await readFile(new URL("../src/scene/BabylonScene.tsx", import.meta.url), "utf8");
  assert.match(source, /projection\.voxelLandscape\.diffuse/);
  assert.match(source, /projection\.skybox\.diameter/);
  assert.match(source, /projection\.skybox\.dayColor/);
  assert.match(source, /projection\.sun\.dayDurationSeconds/);
  assert.match(source, /projection\.sun\.maxIntensity/);
  assert.match(source, /garden-solid-color-skybox/);
  assert.match(source, /distant-volumetric-sun/);
});
