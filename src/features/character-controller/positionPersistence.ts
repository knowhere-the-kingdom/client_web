export type WorldPositionIdentity = Readonly<{
  worldSessionId: string;
  worldId: string;
  characterId: string;
  leaseExpiresAt: string;
}>;

export type PersistedWorldPosition = Readonly<{
  version: 1;
  identity: Omit<WorldPositionIdentity, "leaseExpiresAt">;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotation: Readonly<{ x: number; y: number }>;
  savedAt: string;
}>;

const STORAGE_KEY = "knowhere.world-position.v1";
const MAX_POSITION_AGE_MS = 8 * 60 * 60 * 1000;
const MAX_WORLD_COORDINATE = 1_000_000;

function opaque(value: string) {
  return value.length > 0 && value.length <= 256 && /^[\x21-\x7e]+$/.test(value);
}

function finiteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_WORLD_COORDINATE;
}

function matchesIdentity(record: PersistedWorldPosition, identity: WorldPositionIdentity) {
  return record.identity.worldSessionId === identity.worldSessionId
    && record.identity.worldId === identity.worldId
    && record.identity.characterId === identity.characterId;
}

export function restoreWorldPosition(storage: Pick<Storage, "getItem" | "removeItem">, identity: WorldPositionIdentity, now = Date.now()) {
  if (![identity.worldSessionId, identity.worldId, identity.characterId].every(opaque)) return null;
  const leaseExpiresAt = Date.parse(identity.leaseExpiresAt);
  if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= now) return null;
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as PersistedWorldPosition | null;
    const savedAt = Date.parse(parsed?.savedAt ?? "");
    if (!parsed
      || parsed.version !== 1
      || !matchesIdentity(parsed, identity)
      || !Number.isFinite(savedAt)
      || savedAt > now + 5_000
      || now - savedAt > MAX_POSITION_AGE_MS
      || !finiteCoordinate(parsed.position?.x)
      || !finiteCoordinate(parsed.position?.y)
      || !finiteCoordinate(parsed.position?.z)
      || !finiteCoordinate(parsed.rotation?.x)
      || !finiteCoordinate(parsed.rotation?.y)) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function persistWorldPosition(
  storage: Pick<Storage, "setItem">,
  identity: WorldPositionIdentity,
  position: PersistedWorldPosition["position"],
  rotation: PersistedWorldPosition["rotation"],
  now = Date.now(),
) {
  if (![identity.worldSessionId, identity.worldId, identity.characterId].every(opaque)) return false;
  const leaseExpiresAt = Date.parse(identity.leaseExpiresAt);
  if (!Number.isFinite(leaseExpiresAt) || leaseExpiresAt <= now) return false;
  if (![position.x, position.y, position.z, rotation.x, rotation.y].every(finiteCoordinate)) return false;
  const record: PersistedWorldPosition = {
    version: 1,
    identity: {
      worldSessionId: identity.worldSessionId,
      worldId: identity.worldId,
      characterId: identity.characterId,
    },
    position: { ...position },
    rotation: { ...rotation },
    savedAt: new Date(now).toISOString(),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(record));
  return true;
}

export function clearPersistedWorldPosition(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(STORAGE_KEY);
}
