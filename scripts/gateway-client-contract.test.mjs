import assert from "node:assert/strict";
import test from "node:test";

import { createGatewayClient } from "../src/api/gateway-client.ts";
import { beginWorldBootstrap, beginWorldEntry, completeWorldBootstrap } from "../src/session/client-flow.ts";

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
      : { schemaVersion: 1, worldSessionId: "session-1", worldId: "garden", characterId: "character-1", leaseExpiresAt: "2026-07-29T00:00:00.000Z", serverSnapshot: { contentRevision: 1, contentHash: "content-1" }, hudProjectionRevision: 1 };
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

test("the client flow requires a Gateway entry before a valid bootstrap", () => {
  const ready = { phase: "ready-to-enter", projection, discovery: { defaultWorldId: "garden", worlds: [{ id: "garden", displayName: "Garden", available: true, gameProtocolVersion: "1.0" }] }, worldId: "garden" };
  const entering = beginWorldEntry(ready);
  const bootstrapping = beginWorldBootstrap(entering, { session });
  const final = completeWorldBootstrap(bootstrapping, { schemaVersion: 1, worldSessionId: "session-1", worldId: "garden", characterId: "character-1", leaseExpiresAt: "2026-07-29T00:00:00.000Z", serverSnapshot: { contentRevision: 1, contentHash: "content-1" }, hudProjectionRevision: 1 });
  assert.equal(final.phase, "world-ready");
});
