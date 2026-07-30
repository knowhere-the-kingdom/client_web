import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveBoundKeyboardAction } from "../src/features/character-controller/actionBindings.ts";
import { initialBindings } from "../src/hud/demoData.ts";

test("inventory actions use the controller resolved bindings and honor remaps", () => {
  const bindings = [
    { id: "stash", primary: "K", secondary: "Unbound" },
    { id: "backpack", primary: "O", secondary: "Unbound" },
    { id: "lunchbox", primary: "P", secondary: "Unbound" },
  ];
  assert.equal(resolveBoundKeyboardAction(bindings, "K"), "stash");
  assert.equal(resolveBoundKeyboardAction(bindings, "o"), "backpack");
  assert.equal(resolveBoundKeyboardAction(bindings, "P"), "lunchbox");
  assert.equal(resolveBoundKeyboardAction(bindings, "I"), null, "a remapped stash must not retain its old default");
});

test("settings expose I, B, and L only as editable default bindings", async () => {
  assert.equal(initialBindings.find((binding) => binding.id === "stash")?.primary, "I");
  assert.equal(initialBindings.find((binding) => binding.id === "backpack")?.primary, "B");
  assert.equal(initialBindings.find((binding) => binding.id === "lunchbox")?.primary, "L");

  const hud = await readFile(new URL("../src/hud/KnowhereHud.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(hud, /event\.key\.toLowerCase\(\) === ["'](?:i|b|l)["']/i);
  assert.match(hud, /subscribeActionSignals/);
  assert.match(hud, /bindingLabel\("backpack"\)/);
  assert.match(hud, /bindingLabel\("lunchbox"\)/);
  const controller = await readFile(new URL("../src/features/character-controller/controller.ts", import.meta.url), "utf8");
  assert.match(controller, /this\.keyActions\.get\(normalizeActionKey\(event\.key\)\)/);
  assert.match(controller, /this\.emitActionSignal\(\{ actionId: action, phase: "pressed" \}\)/);
});

test("inventory surfaces preserve prototype 32px footprint variables", async () => {
  const hud = await readFile(new URL("../src/hud/KnowhereHud.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(hud, /prototype-inventory-grid/);
  assert.match(hud, /"--item-columns": item\.w/);
  assert.match(hud, /"--item-rows": item\.h/);
  assert.match(styles, /--prototype-inventory-unit: var\(--knowhere-grid-unit, 32px\)/);
  assert.match(styles, /width: calc\(var\(--prototype-inventory-unit\) \* var\(--item-columns\)\)/);
  assert.match(styles, /height: calc\(var\(--prototype-inventory-unit\) \* var\(--item-rows\)\)/);
});

test("stash, backpack, and lunchbox remain independent draggable windows", async () => {
  const hud = await readFile(new URL("../src/hud/KnowhereHud.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(hud, /const \[openBagIds, setOpenBagIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(hud, /openBagIds\.map\(\(bagId\)/);
  assert.match(hud, /onPointerDown=\{startWindowDrag\}/);
  assert.match(hud, /setOpenBagIds\(\(current\) => current\.includes\(bagId\)/);
  assert.match(hud, /destination\.bagId === "stashVault" && projection && onInventoryMove/);
  assert.match(styles, /\.prototype-inventory-window--backpack/);
  assert.match(styles, /\.prototype-inventory-window--lunchbox/);
  assert.match(styles, /\.prototype-inventory-window--stash/);
});
