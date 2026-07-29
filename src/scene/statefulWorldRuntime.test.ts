import assert from "node:assert/strict";
import test from "node:test";
import { loadActiveStatefulWorld } from "./statefulWorldRuntime.ts";

const world = { recipe: { recipeHash: "recipe", runtimeHash: "runtime", rendererReady: true, tides: { amplitudeMeters: 2, elapsedGameDays: 1 }, rendererPolicy: {} } };
const chunk = {
  runtimeHash: "runtime", chunkHash: "chunk", environmentHash: "environment", reservoirHash: "reservoir", renderHash: "render",
  renderComposites: [{
    local: { x: 0, y: 0, z: 0 },
    near: { lod: "near", appearance: { tintMultiplier: [1, 1, 1], statuses: ["wet"] }, voxels: [] },
    mid: { lod: "mid", appearance: { tintMultiplier: [1, 1, 1], statuses: ["wet"] } },
    far: { lod: "far", appearance: { tintMultiplier: [1, 1, 1], statuses: ["wet"] } },
  }],
};

test("active world loader accepts only matching renderer-ready authoritative payloads", async () => {
  const fetcher = async (path: string) => new Response(JSON.stringify(path === "/api/world" ? world : chunk), { status: 200 });
  const result = await loadActiveStatefulWorld(fetcher as typeof fetch);
  assert.equal(result.runtimeHash, "runtime"); assert.equal(result.chunk.renderHash, "render");
});

test("active world loader rejects mismatched authoritative runtime hashes", async () => {
  const fetcher = async (path: string) => new Response(JSON.stringify(path === "/api/world" ? world : { ...chunk, runtimeHash: "wrong" }), { status: 200 });
  await assert.rejects(() => loadActiveStatefulWorld(fetcher as typeof fetch), /runtime\/hash validation/);
});
