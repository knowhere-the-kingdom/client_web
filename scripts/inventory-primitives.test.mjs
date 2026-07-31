import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  AWARENESS_INSTANCE,
  AWARENESS_ITEM,
  DESIGNER_RECEPTACLE,
  createInventoryCatalogAdapter,
  inventoryQualityName,
  slotAcceptsItem,
} from "../src/inventory/inventory-model.ts";
import {
  EMPTY_INVENTORY_MOVEMENT,
  cancelInventoryMovement,
  pickUpInventoryItem,
  placeHeldInventoryItem,
} from "../src/inventory/inventory-movement.ts";

test("Awareness preserves the authoritative Designer item definition", async () => {
  assert.deepEqual(AWARENESS_ITEM, {
    id: "awareness",
    name: "Awareness",
    itemType: "Key",
    itemCategory: "Designer",
    description: "Once the pattern is seen, nothing appears accidental.",
    quality: 8,
    materialType: "cosmic",
    iconPath: "/inventory/items/icons/awareness.svg",
    gridSize: { width: 2, height: 2 },
  });
  assert.equal(inventoryQualityName(AWARENESS_ITEM.quality), "Cosmic");
  const icon = (await readFile(new URL("../public/inventory/items/icons/awareness.svg", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  assert.match(icon, /linearGradient id="gold"/);
  assert.match(icon, /m26 25 25 25/);
  assert.equal(createHash("sha256").update(icon).digest("hex"), "48725cf85464141766316fe836b87833ef15650c92dd4a451f819a19a68ac3c0");

  const keyhole = (await readFile(new URL("../public/inventory/items/icons/designer-keyhole.svg", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(keyhole).digest("hex"), "d217fa52aa330fe0dc7513c1d9a664ba221adf487ebfb26cc9a4b6b0276a5386");
});

test("the Designer receptacle accepts Awareness and rejects unrelated keys", () => {
  assert.equal(slotAcceptsItem(DESIGNER_RECEPTACLE, AWARENESS_ITEM), true);
  assert.equal(slotAcceptsItem(DESIGNER_RECEPTACLE, { ...AWARENESS_ITEM, id: "other-key" }), false);
  assert.equal(slotAcceptsItem(DESIGNER_RECEPTACLE, {
    ...AWARENESS_ITEM,
    gridSize: { width: 3, height: 2 },
  }), false);
});

test("the catalog adapter is a validated read-only projection seam", () => {
  const adapter = createInventoryCatalogAdapter({
    protocolVersion: "1.0.0",
    sourceRevision: "legacy-inventory-items-r1",
    items: [AWARENESS_ITEM],
    slots: [DESIGNER_RECEPTACLE],
  });
  assert.deepEqual(adapter.getItem("awareness"), AWARENESS_ITEM);
  assert.deepEqual(adapter.getSlot("designer"), DESIGNER_RECEPTACLE);
  assert.equal(adapter.getItem("profile-owned-item"), null);
  assert.throws(() => createInventoryCatalogAdapter({
    protocolVersion: "1.0.0",
    sourceRevision: "legacy-inventory-items-r1",
    items: [AWARENESS_ITEM, AWARENESS_ITEM],
    slots: [],
  }), /invalid inventory item projection/);
});

test("inventory movement must pick up the exact instance before placement", () => {
  assert.deepEqual(
    placeHeldInventoryItem(EMPTY_INVENTORY_MOVEMENT, AWARENESS_INSTANCE, true),
    { ok: false, code: "nothing_held" },
  );

  const held = pickUpInventoryItem(AWARENESS_INSTANCE);
  assert.deepEqual(held, { heldInstanceId: "designer-awareness-001" });
  const placed = placeHeldInventoryItem(held, AWARENESS_INSTANCE, true);
  assert.equal(placed.ok, true);
  assert.deepEqual(placed.state, EMPTY_INVENTORY_MOVEMENT);

  assert.deepEqual(placeHeldInventoryItem(
    pickUpInventoryItem({ ...AWARENESS_INSTANCE, instanceId: "wrong-instance" }),
    AWARENESS_INSTANCE,
    true,
  ), { ok: false, code: "wrong_instance" });

  assert.deepEqual(placeHeldInventoryItem(
    held,
    AWARENESS_INSTANCE,
    false,
  ), { ok: false, code: "slot_rejected" });
});

test("reusable inventory markup retains compatibility selectors and accessible movement hooks", async () => {
  const component = await readFile(new URL("../src/inventory/InventoryPrimitives.tsx", import.meta.url), "utf8");
  assert.match(component, /className="inventory-item-shell"/);
  assert.match(component, /className={`inventory-item/);
  assert.match(component, /data-item-quality/);
  assert.match(component, /onClick={placeHeld}/);
  assert.match(component, /onClick=\{\(event\) => onPickUp\(instance\.instanceId/);
  assert.match(component, /x: event\.clientX/);
  assert.match(component, /y: event\.clientY/);
  assert.match(component, /onKeyDown={handleKeyDown}/);
  assert.match(component, /onDrop={handleDrop}/);
  assert.match(component, /onDragEnd={cancelOnDragEnd \? onCancel : undefined}/);
  assert.match(component, /event\.stopPropagation\(\)/);
  assert.match(component, /onPointerCancel={onCancel}/);
  assert.match(component, /onTouchCancel={onCancel}/);
  assert.match(component, /onLostPointerCapture={onCancel}/);
  assert.match(component, /event\.key === "Escape"/);
});

test("mobile inventory preserves the visual grid while providing a 44px hit target", async () => {
  const styles = await readFile(new URL("../src/inventory/inventory-primitives.css", import.meta.url), "utf8");
  assert.match(styles, /width: max\(calc\(var\(--inventory-grid-unit\) \* var\(--item-width\)\), 44px\)/);
  assert.match(styles, /\.inventory-item__visual\s*\{/);
  assert.match(styles, /min-height: 100svh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /orientation: landscape/);
  assert.match(styles, /\.item-slot\s*\{[\s\S]*touch-action: manipulation/);
  assert.match(styles, /\.item-slot\.is-compatible-snap-target\s*\{[\s\S]*touch-action: none/);
});

test("phone and tablet touch parity keeps valid placement local and cancellation scroll-safe", async () => {
  const component = await readFile(new URL("../src/inventory/InventoryPrimitives.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/inventory/inventory-primitives.css", import.meta.url), "utf8");
  const held = pickUpInventoryItem(AWARENESS_INSTANCE);
  assert.equal(placeHeldInventoryItem(held, AWARENESS_INSTANCE, slotAcceptsItem(DESIGNER_RECEPTACLE, AWARENESS_ITEM)).ok, true);
  assert.deepEqual(cancelInventoryMovement(), EMPTY_INVENTORY_MOVEMENT);
  assert.match(component, /onTouchCancel={onCancel}/);
  assert.match(component, /onClick={placeHeld}/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /touch-action: none/);
});

test("cancel clears the complete local held-item state", () => {
  assert.deepEqual(cancelInventoryMovement(), EMPTY_INVENTORY_MOVEMENT);
  assert.deepEqual(cancelInventoryMovement(), { heldInstanceId: null });
});

test("the mounted System key gate uses inventory primitives without the obsolete dotted scaffold", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const login = await readFile(new URL("../src/system-theme/SystemThemeExperience.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const inventoryStyles = await readFile(new URL("../src/inventory/inventory-primitives.css", import.meta.url), "utf8");
  assert.match(app, /<SystemThemeExperience gateway=\{gateway\}/);
  assert.match(login, /InventoryItem/);
  assert.match(login, /InventorySlot/);
  assert.match(login, /held \? <div className="system-designer"/);
  assert.match(login, /placeHeldInventoryItem/);
  assert.match(login, /system-seated-key/);
  assert.match(inventoryStyles, /inventory-designer-slot-reveal/);
  assert.doesNotMatch(login, /className="designer-key"|designer-slot__mark/);
  assert.doesNotMatch(styles, /\.designer-key|border:\s*1px dashed/);
});
