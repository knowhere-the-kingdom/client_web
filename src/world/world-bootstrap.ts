import type { GardenSceneProjectionV1 } from "../api/gateway-contract.ts";

export const WORLD_HUD_BOOTSTRAP_SCHEMA_VERSION = 1 as const;

export type WorldHudBootstrapV1 = Readonly<{
  schemaVersion: typeof WORLD_HUD_BOOTSTRAP_SCHEMA_VERSION;
  worldSessionId: string;
  worldId: string;
  characterId: string;
  leaseExpiresAt: string;
  serverSnapshot: Readonly<{
    contentRevision: number;
    contentHash: string;
  }>;
  hudProjectionRevision: number;
  scene: GardenSceneProjectionV1;
}>;

export type WorldHudBootstrapResult =
  | Readonly<{ ok: true; value: WorldHudBootstrapV1 }>
  | Readonly<{ ok: false; code: "invalid_bootstrap" | "expired_bootstrap" }>;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isOpaque(value: unknown, maxLength = 256): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && /^[\x21-\x7e]+$/.test(value);
}

function isRfc3339(value: unknown): value is string {
  if (typeof value !== "string" || !value.includes("T")) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function isGardenSceneProjection(value: unknown): value is GardenSceneProjectionV1 {
  if (!value || typeof value !== "object") return false;
  const scene = value as Record<string, unknown>;
  if (!hasExactKeys(scene, ["sceneId", "schemaVersion", "skybox", "sun", "voxelLandscape"])) return false;
  if (!scene.voxelLandscape || typeof scene.voxelLandscape !== "object") return false;
  if (!scene.skybox || typeof scene.skybox !== "object") return false;
  if (!scene.sun || typeof scene.sun !== "object") return false;
  const landscape = scene.voxelLandscape as Record<string, unknown>;
  const skybox = scene.skybox as Record<string, unknown>;
  const sun = scene.sun as Record<string, unknown>;
  return scene.schemaVersion === 1
    && scene.sceneId === "garden-alpha-v1"
    && hasExactKeys(landscape, ["chunkRadius", "chunkSize", "diffuse", "emissive", "kind", "specular", "voxelSizeMeters"])
    && landscape.kind === "flat-chunk-grid"
    && landscape.voxelSizeMeters === 1
    && landscape.chunkSize === 16
    && landscape.chunkRadius === 14
    && landscape.diffuse === "#3f9b45"
    && landscape.emissive === "#102d13"
    && landscape.specular === "#17351a"
    && hasExactKeys(skybox, ["dayColor", "diameter", "kind", "nightColor", "segments"])
    && skybox.kind === "solid-color-sphere"
    && skybox.diameter === 440
    && skybox.segments === 24
    && skybox.dayColor === "#55a9ed"
    && skybox.nightColor === "#020718"
    && hasExactKeys(sun, ["dayDurationSeconds", "kind", "maxIntensity", "nightDurationSeconds", "sunlight"])
    && sun.kind === "orbiting-mythic-sun"
    && sun.dayDurationSeconds === 60
    && sun.nightDurationSeconds === 60
    && sun.sunlight === "#fff3d0"
    && sun.maxIntensity === 1.25;
}

export function validateWorldHudBootstrap(
  value: unknown,
  now = Date.now(),
): WorldHudBootstrapResult {
  if (!value || typeof value !== "object") return { ok: false, code: "invalid_bootstrap" };
  const record = value as Record<string, unknown>;
  if (!hasExactKeys(record, [
    "characterId",
    "hudProjectionRevision",
    "leaseExpiresAt",
    "scene",
    "schemaVersion",
    "serverSnapshot",
    "worldId",
    "worldSessionId",
  ])) {
    return { ok: false, code: "invalid_bootstrap" };
  }
  const snapshot = record.serverSnapshot;
  if (!snapshot || typeof snapshot !== "object") return { ok: false, code: "invalid_bootstrap" };
  const snapshotRecord = snapshot as Record<string, unknown>;
  if (!hasExactKeys(snapshotRecord, ["contentHash", "contentRevision"])) {
    return { ok: false, code: "invalid_bootstrap" };
  }
  if (
    record.schemaVersion !== WORLD_HUD_BOOTSTRAP_SCHEMA_VERSION
    || !isOpaque(record.worldSessionId)
    || !isOpaque(record.worldId)
    || !isOpaque(record.characterId)
    || !isRfc3339(record.leaseExpiresAt)
    || !isPositiveInteger(snapshotRecord.contentRevision)
    || !isOpaque(snapshotRecord.contentHash)
    || !isPositiveInteger(record.hudProjectionRevision)
    || !isGardenSceneProjection(record.scene)
  ) {
    return { ok: false, code: "invalid_bootstrap" };
  }
  if (Date.parse(record.leaseExpiresAt) <= now) return { ok: false, code: "expired_bootstrap" };
  return { ok: true, value: record as WorldHudBootstrapV1 };
}
