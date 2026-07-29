# Inventory Login Port Provenance

This isolated port keeps inventory behavior in reusable `src/inventory/`
primitives. `src/login/LoginExperience.tsx` only supplies the Awareness item,
Designer receptacle, and the `awareness_placed` login event. The source of
truth for this table is the live legacy checkout at
`R:\dev\prototypes\Inventory_System`.

## Port map

| Ported primitive/style/behavior/asset | Legacy evidence | Ported form |
| --- | --- | --- |
| Awareness catalog definition | `items.json:273-283`, fields `id`, `name`, `itemType`, `itemCategory`, `description`, `quality`, `materialType`, `iconPath`, `gridSize` | `src/inventory/inventory-model.ts:AWARENESS_ITEM`; exact values and description retained. |
| Future catalog adapter seam | `items.json:273-283` and the standalone catalog JSON contract | `InventoryCatalogProjectionV1` / `createInventoryCatalogAdapter`; versioned read-only item/slot lookup with duplicate-ID validation. It accepts a supplied projection only and does not read profiles, databases, or login state. |
| Awareness instance | `inventory.json:5-10`, `containers.designer.slot`, `instanceId=designer-awareness-001`, `itemId=awareness`, `quantity=1`, position `0,0` | `AWARENESS_INSTANCE`; login starts with one bounded reusable instance. |
| Designer receptacle | `index.html:15-22`, `.item-slot.designer-slot`, `--slot-width:2`, `--slot-height:2`, `data-primary-hud-slot`, `data-accepted-item-types="Key"`, `aria-label="Designer Slot"` | `DESIGNER_RECEPTACLE` plus `InventorySlot`; exact 2x2/Key/label contract, with an explicit Awareness ID allowlist. |
| Grid sizing and slot/item tokens | `design.md:14-21,38-42`; `css/inventory.css:1-34`, variables `--inventory-grid-unit`, `--inventory-slot-border-width`, quality colors, hover and valid-placement colors | `src/inventory/inventory-primitives.css`; reusable CSS variables and integer footprint sizing. |
| Item frame and metadata | `design.md:751-758`; legacy `.inventory-item`, `data-item-quality`, catalog-derived footprint/icon/quantity | `InventoryItemCard`; data attributes, quality-colored border, icon, quantity, tooltip, keyboard/click pickup, and native drag hook. |
| Slot compatibility and valid placement | `design.md:63-67,79-81,578-585`; legacy `data-accepted-item-types`, restricted Awareness Designer destination, green valid-placement cue | `slotAcceptsItem` and `InventorySlot`; bounded footprint/type/ID checks and compatible snap-target styling. |
| Pickup, drag, drop, and cancel behavior | `scripts.js:5064-5104` (`startHolding`), `5123-5211` (pointer movement/drop), `5221-5242` (cancel), `5339-5364` (world/context actions) | `inventory-movement.ts` and `InventoryPrimitives.tsx`; exact-instance pickup, accepted-slot placement, keyboard activation, native drag, and fail-closed rejection. |
| Awareness placement transition | `scripts.js:4861-4869`, `design.md:69-76`; Awareness in `.designer-slot` starts the login/dashboard transition | `LoginExperience.tsx` dispatches only `awareness_placed`; existing login reducer still gates submit, failure, success, and character selection. |
| Pointer/keyboard/touch cancellation and mobile hit target | `scripts.js:5221-5242,5339-5364` covers cancel/Escape paths; `design.md:14-21` defines the 32px visual grid | `InventoryItemCard` and `InventorySlot` clear on drag-end, pointer-cancel, touch-cancel, lost capture, and Escape. A transparent hit button is at least 44 CSS px while `.inventory-item__visual` preserves the legacy cell geometry; ordinary slots use `touch-action: manipulation` for scroll, and compatible held targets use `touch-action: none` for local placement. |
| Awareness icon | `items/icons/awareness.svg`; legacy catalog path `items/icons/awareness.svg` | `public/inventory/items/icons/awareness.svg`; SHA-256 `48725cf85464141766316fe836b87833ef15650c92dd4a451f819a19a68ac3c0`, matching the legacy file. |
| Designer keyhole asset | `items/icons/designer-keyhole.svg`; legacy `.designer-slot::before` and inserted-key mask references in `css/inventory.css:122-135,734-746` | `public/inventory/items/icons/designer-keyhole.svg`; SHA-256 `d217fa52aa330fe0dc7513c1d9a664ba221adf487ebfb26cc9a4b6b0276a5386`, matching the legacy file. |

## Deliberate deviations

- The legacy DOM/script system is adapted into typed React primitives rather
  than copied wholesale. Inventory ownership stays in `src/inventory/`; login
  owns only the Awareness-to-login transition.
- The port intentionally removes the legacy ritual/portal animation path,
  including `portalController.keyPickedUp()` / `keyInserted()` behavior and
  the cyan portal placeholder. No animation or gameplay authority is added.
- The legacy Designer slot has a dashed grid and a hidden/revealed HUD-slot
  lifecycle. The login slice uses a visible, solid-bordered receptacle with
  the canonical keyhole asset; the obsolete dotted placeholder scaffold is
  removed as required for this port.
- The legacy source supports broader inventory destinations, profile
  persistence, world-drop/logout behavior, and full HUD presentation. Those
  behaviors are deliberately out of scope; this port exposes only the
  reusable primitive contract needed by login.
- The legacy catalog path is relative to its standalone root. The client port
  uses `/inventory/items/icons/...` so Vite serves the copied, hash-verified
  assets from `public/`.
- The 44 CSS-pixel interaction target, cancellation hooks, and safe-area/
  dynamic-viewport rules are deliberate accessibility and mobile-resilience
  hardening; they do not change the legacy visual cell geometry or the App
  hotspot.

## Rights gate

The Awareness and Designer keyhole SVGs are byte-identical to the legacy
copies and their hashes are recorded above, but no explicit license or
attribution record was found for either icon in the legacy root or this port.
The nearby Kenney license covers only Kenney input prompts and is not a rights
claim for these SVGs. Creator ownership/licensing confirmation or an approved
provenance record is required before release or publication.

## Validation anchors

`npm test` includes `scripts/inventory-primitives.test.mjs`, which asserts the
catalog values, icon hashes, exact-instance movement, slot rejection, markup
hooks, and removal of the obsolete key/dotted-slot scaffold. The complete
port also requires `npm run typecheck`, `npm run build`, and `git diff --check`.
