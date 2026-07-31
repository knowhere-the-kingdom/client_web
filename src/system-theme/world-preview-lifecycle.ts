export const WORLD_SPAWN_TIMINGS = Object.freeze({
  explosionEndMs: 260,
  magmaEndMs: 850,
  coolingEndMs: 1450,
});

export type WorldSpawnPhase = "explosion" | "magma" | "cooling" | "mature";

export function worldSpawnPhase(elapsedMs: number): WorldSpawnPhase {
  if (elapsedMs < WORLD_SPAWN_TIMINGS.explosionEndMs) return "explosion";
  if (elapsedMs < WORLD_SPAWN_TIMINGS.magmaEndMs) return "magma";
  if (elapsedMs < WORLD_SPAWN_TIMINGS.coolingEndMs) return "cooling";
  return "mature";
}

export function worldSunOrbit(elapsedMs: number, reducedMotion = false) {
  const angle = reducedMotion ? -0.62 : Math.max(0, elapsedMs) * 0.0016;
  const radius = 2.18;
  return Object.freeze({ x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius });
}

export function createWorldFrameGuard() {
  let active = true;
  return Object.freeze({
    acceptsFrame: () => active,
    dispose: () => { active = false; },
  });
}
