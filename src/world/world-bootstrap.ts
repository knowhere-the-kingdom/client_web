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
  ) {
    return { ok: false, code: "invalid_bootstrap" };
  }
  if (Date.parse(record.leaseExpiresAt) <= now) return { ok: false, code: "expired_bootstrap" };
  return { ok: true, value: record as WorldHudBootstrapV1 };
}
