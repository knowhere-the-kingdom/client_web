import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { characterInputSettingsStorageKey, readCharacterInputSettings } from "../src/features/character-controller/runtimeSettings.ts";
import { applyGamepadDeadzone, gamepadDirectionalAxisValue, normalizedGamepadBinding, standardGamepadButtonIndex } from "../src/features/character-controller/gamepadInput.ts";

function storage(values = {}) {
  return { getItem: (key) => values[key] ?? null };
}

test("character input settings are read only from the exact account key", () => {
  const accountA = "character-a";
  const accountB = "character-b";
  const values = {
    [characterInputSettingsStorageKey(accountA)]: JSON.stringify({ version: 1, controls: { mouseX: 61, deadzone: 24, gamepadEnabled: false, bindings: [{ id: "jump", primary: "J", secondary: "Unbound", gamepad: "Left Bumper" }] } }),
    [characterInputSettingsStorageKey(accountB)]: JSON.stringify({ version: 1, controls: { mouseX: 17, deadzone: 4, gamepadEnabled: true, bindings: [] } }),
  };
  const settings = readCharacterInputSettings(storage(values), accountA);
  assert.equal(settings.accountId, accountA);
  assert.equal(settings.mouseX, 61);
  assert.equal(settings.deadzone, 24);
  assert.equal(settings.gamepadEnabled, false);
  assert.equal(settings.bindings[0]?.gamepad, "Left Bumper");
});

test("character input settings fail closed to bounded defaults", () => {
  const settings = readCharacterInputSettings(storage({
    [characterInputSettingsStorageKey("character-a")]: JSON.stringify({ version: 1, controls: { mouseX: 999, mouseY: -20, deadzone: Number.NaN, invertMouseY: true, invertGamepadY: true, bindings: [{ id: 4 }] } }),
  }), "character-a");
  assert.equal(settings.mouseX, 100);
  assert.equal(settings.mouseY, 0);
  assert.equal(settings.deadzone, 12);
  assert.equal(settings.invertMouseY, true);
  assert.equal(settings.invertGamepadY, true);
  assert.deepEqual(settings.bindings, []);
});

test("controller consumes saved gamepad enable, inversion, deadzone, and remapped standard buttons", () => {
  const source = readFileSync(new URL("../src/features/character-controller/controller.ts", import.meta.url), "utf8");
  assert.match(source, /configureGamepad\(settings: CharacterGamepadSettings\)/);
  assert.match(source, /!this\.gamepadSettings\.enabled/);
  assert.match(source, /applyGamepadDeadzone\(gamepad\.axes\[0\]/);
  assert.match(source, /this\.gamepadSettings\.invertY \? -1 : 1/);
  assert.match(source, /standardGamepadButtonIndex\(gamepadBinding\)/);
});

test("standard gamepad bindings and deadzones are deterministic", () => {
  assert.equal(normalizedGamepadBinding("Left Trigger (Hold)"), "left trigger");
  assert.equal(standardGamepadButtonIndex("South Button"), 0);
  assert.equal(standardGamepadButtonIndex("D-Pad Up"), 12);
  assert.equal(standardGamepadButtonIndex("not-a-button"), undefined);
  assert.equal(applyGamepadDeadzone(0.1, 0.12), 0);
  assert.ok(applyGamepadDeadzone(0.5, 0.12) > 0.4);
  assert.equal(gamepadDirectionalAxisValue("left stick up", 0, -0.75), 0.75);
  assert.equal(gamepadDirectionalAxisValue("left stick right", 0.5, 0), 0.5);
});
