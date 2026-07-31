import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORLD_SPAWN_TIMINGS, createWorldFrameGuard, worldSpawnPhase, worldSunOrbit } from "../src/system-theme/world-preview-lifecycle.ts";

const source = await readFile(new URL("../src/system-theme/SystemWorldItem.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/system-theme/system-world-item.css", import.meta.url), "utf8");

test("World is a real 3D procedural item with no still-image dependency", () => {
  assert.match(source, /MeshBuilder\.CreateSphere\("system-world-planet"/);
  assert.match(source, /new DynamicTexture\("system-world-procedural-cartoon-earth"/);
  assert.match(source, /paintCartoonEarth\(earthTexture\)/);
  assert.match(source, /planet\.rotation\.y \+=/);
  assert.doesNotMatch(source, /<img|Image\(|\.png|\.jpe?g|\.webp|url\(/i);
});

test("spawn is rapid, ordered, and visibly phases from a point through magma and cooling", () => {
  const { explosionEndMs: explosion, magmaEndMs: magma, coolingEndMs: cooling } = WORLD_SPAWN_TIMINGS;
  assert.ok(explosion > 0 && explosion < magma && magma < cooling && cooling <= 1800);
  assert.deepEqual([worldSpawnPhase(0), worldSpawnPhase(explosion), worldSpawnPhase(magma), worldSpawnPhase(cooling)], ["explosion", "magma", "cooling", "mature"]);
  assert.match(source, /const scale = 0\.015 \+ easeOutBack\(progress\)/);
  assert.match(source, /planet\.material = phase === "magma" \? magmaMaterial : phase === "cooling" \? coolingMaterial : matureMaterial/);
  assert.match(source, /magmaMaterial\.diffuseColor = new Color3\(0\.72, 0\.035, 0\.012\)/);
  assert.match(source, /coolingMaterial\.diffuseColor = new Color3\(0\.015, 0\.24, 0\.78\)/);
  assert.match(source, /context\.fillStyle = "#57a94d"/);
});

test("space, equatorial Sun orbit, lighting, and camera remain presentation-local", () => {
  let networkCalls = 0;
  const guardedFetch = () => { networkCalls += 1; throw new Error("network forbidden"); };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = guardedFetch;
  try {
    assert.match(source, /system-world-space-skybox/);
    assert.match(source, /new PointLight\("system-world-sun-light"/);
    assert.match(source, /sunLight\.parent = sun/);
    const start = worldSunOrbit(0);
    const later = worldSunOrbit(500);
    assert.equal(start.y, 0);
    assert.equal(later.y, 0);
    assert.ok(Math.abs(Math.hypot(start.x, start.z) - Math.hypot(later.x, later.z)) < 1e-12);
    assert.notDeepEqual(start, later);
    assert.match(source, /sun\.position\.set\(sunOrbit\.x, sunOrbit\.y, sunOrbit\.z\)/);
    assert.match(source, /new ArcRotateCamera\("system-world-equator-camera", -Math\.PI \/ 2, Math\.PI \/ 2/);
    assert.doesNotMatch(source, /attachControl|fetch\(|XMLHttpRequest|WebSocket|Gateway|characterId|worldId|localStorage|sessionStorage/i);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preview is inert, cleans up its local scene, and has a reduced-motion static path", () => {
  assert.doesNotMatch(source, /data-grid-(?:width|height)|--2x3|onClick|onPointer/);
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(source, /stopLoop\(\);\s*draw\(performance\.now\(\), true\)/);
  const guard = createWorldFrameGuard();
  assert.equal(guard.acceptsFrame(), true);
  guard.dispose();
  assert.equal(guard.acceptsFrame(), false, "late frames are rejected after teardown");
  assert.match(source, /frameGuard\.dispose\(\)/);
  assert.match(source, /scene\?\.dispose\(\)/);
  assert.match(source, /engine\?\.dispose\(\)/);
  assert.match(css, /\.system-world-preview__canvas[\s\S]*pointer-events: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
