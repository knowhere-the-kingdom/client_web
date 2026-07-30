import assert from "node:assert/strict";
import test from "node:test";

import { createGatewayClient } from "../src/api/gateway-client.ts";
import { beginWorldBootstrap, completeWorldBootstrap, stateFromSession } from "../src/session/client-flow.ts";

const session = {
  authenticated: true,
  lifecycle: "active",
  expiresAt: "2026-07-29T00:00:00.000Z",
  authorizationRevision: 1,
  requiresExplicitResume: false,
};
const projection = {
  session,
  selection: { version: 1, selectedCharacterId: "character-1", characters: [], canEnterWorld: true, resumeStage: "world-entry", reason: null },
};
const scene = {
  schemaVersion: 1,
  sceneId: "garden-alpha-v1",
  voxelLandscape: { kind: "flat-chunk-grid", voxelSizeMeters: 1, chunkSize: 16, chunkRadius: 14, diffuse: "#3f9b45", emissive: "#102d13", specular: "#17351a" },
  skybox: { kind: "solid-color-sphere", diameter: 440, segments: 24, dayColor: "#55a9ed", nightColor: "#020718" },
  sun: { kind: "orbiting-mythic-sun", dayDurationSeconds: 60, nightDurationSeconds: 60, sunlight: "#fff3d0", maxIntensity: 1.25 },
};

test("the live client may use Knowhere's public Gateway subdomain", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { origin: "https://knowhere.fyi" } };
  try {
    assert.doesNotThrow(() => createGatewayClient("https://matrix.knowhere.fyi"));
    assert.throws(
      () => createGatewayClient("https://gateway.attacker.example"),
      /same-origin public surface/,
    );
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("world entry and bootstrap stay on the configured credentialed Gateway surface", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input: String(input), init });
    const path = new URL(input).pathname;
    const data = path === "/v1/worlds/entry"
      ? { session }
      : { schemaVersion: 1, worldSessionId: "session-1", worldId: "garden", characterId: "character-1", leaseExpiresAt: "2099-07-29T00:00:00.000Z", serverSnapshot: { contentRevision: 1, contentHash: "content-1" }, hudProjectionRevision: 1, scene };
    return new Response(JSON.stringify({ protocolVersion: "1.0", correlationId: "correlation-1", data }), { headers: { "content-type": "application/json" } });
  };
  const client = createGatewayClient("https://client.example", request, { readCsrfToken: () => "csrf" });
  const entry = await client.enterWorld("garden");
  assert.equal(entry.ok, true);
  const bootstrap = await client.getWorldBootstrap();
  assert.equal(bootstrap.ok, true);
  assert.deepEqual(requests.map(({ input }) => input), ["https://client.example/v1/worlds/entry", "https://client.example/v1/worlds/bootstrap"]);
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[0].init.headers.authorization, undefined);
});

test("placing Awareness prewarms only the anonymous Garden template", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify({ protocolVersion: "1.0", correlationId: "correlation-1", data: { worldId: "garden", status: "ready", sceneRevision: 1 } }), { headers: { "content-type": "application/json" } });
  };
  const client = createGatewayClient("https://client.example", request);
  const result = await client.prewarmGarden();
  assert.equal(result.ok, true);
  assert.equal(requests[0].input, "https://client.example/v1/worlds/prewarm");
  assert.deepEqual(JSON.parse(requests[0].init.body), { worldId: "garden" });
  assert.equal(requests[0].init.headers.authorization, undefined);
  assert.equal(requests[0].init.headers["x-knowhere-csrf"], undefined);
});

test("Garden prewarm rejects noncanonical or authority-shaped projections", async () => {
  for (const data of [
    { worldId: "other", status: "ready", sceneRevision: 1 },
    { worldId: "garden", status: "starting", sceneRevision: 1 },
    { worldId: "garden", status: "ready", sceneRevision: 1, privateUrl: "http://127.0.0.1" },
  ]) {
    const request = async () => new Response(JSON.stringify({ protocolVersion: "1.0", correlationId: "correlation-1", data }), { headers: { "content-type": "application/json" } });
    const result = await createGatewayClient("https://client.example", request).prewarmGarden();
    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid_response");
  }
});

test("the client flow requires a Gateway entry before a valid bootstrap", () => {
  const entering = stateFromSession(projection);
  assert.equal(entering.phase, "gateway-entry");
  const bootstrapping = beginWorldBootstrap(entering, { session });
  const final = completeWorldBootstrap(bootstrapping, { schemaVersion: 1, worldSessionId: "session-1", worldId: "garden", characterId: "character-1", leaseExpiresAt: "2099-07-29T00:00:00.000Z", serverSnapshot: { contentRevision: 1, contentHash: "content-1" }, hudProjectionRevision: 1, scene });
  assert.equal(final.phase, "world-ready");
});

test("normal character flow contains no world picker", async () => {
  const appSource = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/App.tsx", import.meta.url), "utf8"));
  assert.doesNotMatch(appSource, /Find available world|Enter world/);
  assert.match(appSource, /enterWorld\("garden"\)/);
});
