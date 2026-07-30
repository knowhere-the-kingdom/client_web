import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { persistWorldPosition, restoreWorldPosition } from "../src/features/character-controller/positionPersistence.ts";

function memoryStorage() {
  let value = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { value = null; },
  };
}

const now = Date.parse("2026-07-29T12:00:00.000Z");
const identity = {
  worldSessionId: "world-session-1",
  worldId: "garden",
  characterId: "character-1",
  leaseExpiresAt: "2026-07-29T13:00:00.000Z",
};

test("world position restores only for the same active world session and character", () => {
  const storage = memoryStorage();
  assert.equal(persistWorldPosition(storage, identity, { x: 12, y: 8, z: -4 }, { x: 0.1, y: 1.2 }, now), true);
  assert.deepEqual(restoreWorldPosition(storage, identity, now + 1_000)?.position, { x: 12, y: 8, z: -4 });
  assert.equal(restoreWorldPosition(storage, { ...identity, characterId: "character-2" }, now + 1_000), null);
});

test("world position rejects expired leases, stale records, and unsafe coordinates", () => {
  const expiredStorage = memoryStorage();
  assert.equal(persistWorldPosition(expiredStorage, { ...identity, leaseExpiresAt: "2026-07-29T11:59:59.000Z" }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0 }, now), false);
  const staleStorage = memoryStorage();
  assert.equal(persistWorldPosition(staleStorage, { ...identity, leaseExpiresAt: "2026-07-30T12:00:00.000Z" }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0 }, now), true);
  assert.equal(restoreWorldPosition(staleStorage, { ...identity, leaseExpiresAt: "2026-07-30T12:00:00.000Z" }, now + 8 * 60 * 60 * 1000 + 1), null);
  assert.equal(persistWorldPosition(memoryStorage(), identity, { x: Number.NaN, y: 0, z: 0 }, { x: 0, y: 0 }, now), false);
});

test("Babylon movement uses the controller and the prototype walk speed", () => {
  const source = readFileSync(new URL("../src/scene/BabylonScene.tsx", import.meta.url), "utf8");
  assert.match(source, /const BASE_CAMERA_SPEED = 6;/);
  assert.match(source, /removeByType\("FreeCameraKeyboardMoveInput"\)/);
  assert.match(source, /characterController\.pollGamepads/);
  assert.match(source, /const PLAYER_GRAVITY = -18;/);
});
