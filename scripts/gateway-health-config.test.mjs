import assert from "node:assert/strict";
import test from "node:test";

import { createGatewayClient } from "../src/api/gateway-client.ts";
import {
  PUBLIC_GATEWAY_HEALTH_ORIGIN,
  configuredGatewayHealthOrigin,
} from "../src/api/gateway-health-config.ts";

test("health uses the configured public Gateway origin without a same-origin fallback", async () => {
  assert.equal(PUBLIC_GATEWAY_HEALTH_ORIGIN, "https://matrix.knowhere.fyi");
  assert.equal(configuredGatewayHealthOrigin().href, "https://matrix.knowhere.fyi/");

  let requestedUrl = "";
  const client = createGatewayClient(configuredGatewayHealthOrigin(), async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      service: "knowhere-gateway",
      status: "ok",
      protocolVersion: "1.0.0",
      buildVersion: "test",
      startedAt: "2026-07-28T00:00:00.000Z",
      uptimeSeconds: 0,
      apiRelay: "not-probed",
    }), { headers: { "content-type": "application/json" } });
  });

  const result = await client.checkHealth();
  assert.equal(requestedUrl, "https://matrix.knowhere.fyi/v1/health");
  assert.equal(result.phase, "healthy");
});
