import assert from "node:assert/strict";
import test from "node:test";
import { CharacterController } from "./controller";
import { CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT, CharacterBlockFaceTargetLifecycle, composeCharacterBlockFaceTarget, routeCharacterBlockFaceTargetSource } from "./blockFaceTarget";
import { GameplayMouseModeController } from "./mouseMode";
import { createMovementActionsReadModel } from "./movementActions";
import { createActionbarItemAbilityContracts, createDemoSkillContracts, createItemAbilityContracts, parsePublishedItemDefinition } from "./skills";
import type { DefinitionWithRevision } from "../../api/types";
import type { DemoSkill } from "../../hud/types";
import type { SkillRuntimeContract } from "./types";
import type { AuthorityPlacementAssessment, BlockFaceTarget } from "../../../../../Clockwork/packages/rendering-babylon/src/block-face-target.ts";
import type { HeldItemTargetAppearanceResult } from "../../../../editor/src/items.ts";

const testSkill: SkillRuntimeContract = {
  id: "test-skill",
  revision: 1,
  name: "Test Skill",
  trigger: "press",
  slot: "tome.action1",
  costs: [{ resource: "spirit", amount: 10 }],
  cooldownMs: 1000,
  charges: null,
  requiredStates: ["alive"],
  blockedStates: ["dead", "dodge"],
  timing: { windupMs: 100, activeMs: 200, recoveryMs: 300 },
  animationTag: "ability.test",
  sfxEvent: "ability.cast",
  effects: [],
};

const chargedSkill: SkillRuntimeContract = {
  ...testSkill,
  id: "charged-skill",
  charges: { max: 2, rechargeMs: 500 },
  cooldownMs: 0,
};

const blockFaceTarget: BlockFaceTarget = {
  source: "crosshair",
  block: { x: 10, y: 4, z: -2 },
  adjacent: { x: 11, y: 4, z: -2 },
  faceNormal: { x: 1, y: 0, z: 0 },
  hitPoint: { x: 11, y: 4.5, z: -1.5 },
  distance: 3,
  chunk: { x: 0, y: 0, z: -1 },
  local: { x: 10, y: 4, z: 30 },
  adjacentChunk: { x: 0, y: 0, z: -1 },
  adjacentLocal: { x: 11, y: 4, z: 30 },
  chunkVersion: 7,
  chunkVersionHash: "chunk-v7",
  runtimeHash: "runtime-a",
  state: "targetable",
};

const heldItemTarget: HeldItemTargetAppearanceResult = {
  descriptor: {
    definitionId: "item-grid-block",
    definitionRevision: 5,
    definitionSlug: "grid-block",
    actionTrigger: "leftClick",
    actionKind: "place-block",
    targetDirection: "adjacent",
    rarity: "rare",
    rarityThemeToken: "--color-item-rarity-rare",
  },
  diagnostics: [],
};

const placementAssessment: AuthorityPlacementAssessment = {
  validity: "valid",
  stability: "stable",
  reason: "Placement accepted by authority read model.",
  assessmentRevision: 11,
  assessedChunkVersion: 7,
  assessedChunkVersionHash: "chunk-v7",
  assessedItemRevision: 5,
};

const publishedSwordRecord: DefinitionWithRevision = {
  definition: {
    id: "item-sunline-sword",
    kind: "item",
    slug: "starter-sword",
    name: "Sunline Sword",
    ownerUserId: null,
    lifecycle: "published",
    currentRevision: 3,
    updatedAt: "2026-07-10T00:00:00.000Z",
  },
  revision: {
    definitionId: "item-sunline-sword",
    revision: 3,
    schemaVersion: 1,
    status: "published",
    actorUserId: null,
    changeNote: "test",
    createdAt: "2026-07-10T00:00:00.000Z",
    payload: {
      documentType: "item-definition",
      schemaVersion: 1,
      id: "starter-sword",
      slug: "starter-sword",
      displayName: "Sunline Sword",
      category: "weapon",
      rarity: "common",
      qualityRange: [16, 35],
      footprint: "1x3",
      stack: { max: 1, mergeKey: null },
      equipment: { slots: ["mainHand"] },
      bagGrid: null,
      actions: {
        leftClick: { kind: "swing", label: "Swing", skill: { definitionId: "skill-swing", revision: 2, slug: "weapon.swing" } },
        rightClick: { kind: "block", label: "Guard", skill: { definitionId: "skill-block", revision: 1, slug: "shield.block" } },
        holdLeft: { kind: "power-swing", label: "Power swing", skill: { definitionId: "skill-power-swing", revision: 4, slug: "weapon.power-swing" } },
        holdRight: { kind: "block", label: "Hold guard", repeatable: true, skill: { definitionId: "skill-block", revision: 1, slug: "shield.block" } },
      },
      stats: [],
      materia: [],
      modelRevision: null,
      materialBlock: null,
      icon: "sword",
      tags: ["starter", "weapon"],
      availability: ["starter-catalog"],
    },
  },
};

test("ability activation spends resources and advances through timed phases", () => {
  const controller = new CharacterController();
  controller.configureSkills([testSkill]);

  assert.equal(controller.activateSlot("tome.action1", 1000), true);
  assert.equal(controller.getSnapshot().resources.spirit.current, 33);
  assert.equal(controller.getSnapshot().abilityPhase, "windup");
  assert.equal(controller.activateSlot("tome.action1", 1001), false);

  controller.tick(1100, 0.1);
  assert.equal(controller.getSnapshot().abilityPhase, "active");
  controller.tick(1300, 0.2);
  assert.equal(controller.getSnapshot().abilityPhase, "recovery");
  controller.tick(1600, 0.3);
  assert.equal(controller.getSnapshot().abilityPhase, "none");
  assert.equal(controller.activateSlot("tome.action1", 1601), false);
  assert.equal(controller.activateSlot("tome.action1", 2001), true);
});

test("ability activation rejects insufficient resources", () => {
  const controller = new CharacterController();
  controller.configureSkills([testSkill]);
  controller.setMeter("spirit", 5, 100);

  assert.equal(controller.activateSlot("tome.action1", 1000), false);
  assert.equal(controller.getSnapshot().abilityPhase, "none");
  assert.equal(controller.getSnapshot().resources.spirit.current, 5);
});

test("configured pointer bindings activate selected item hand contracts", () => {
  const controller = new CharacterController();
  const contracts = createItemAbilityContracts({
    id: "test-sword",
    type: "weapon",
    name: "Test Sword",
    w: 1,
    h: 2,
    icon: "sword",
    leftClickAction: "attack",
    rightClickAction: "guard",
    loc: { kind: "hud", slot: "action0" },
  });
  controller.configureSkills(contracts);
  controller.configureBindings([
    { id: "left-hand", primary: "Mouse 1", secondary: "Unbound" },
    { id: "right-hand", primary: "Mouse 2", secondary: "Unbound" },
  ]);
  let prevented = false;

  controller.handlePointerDown({ button: 0, target: null, preventDefault: () => { prevented = true; } } as MouseEvent);

  assert.equal(prevented, true);
  assert.equal(controller.getSnapshot().activeAbilityId, "item:test-sword:left:item.leftHand");
  assert.equal(controller.getSnapshot().abilityPhase, "windup");
});

test("published item definitions expose press and hold hand contracts without slot collisions", () => {
  const controller = new CharacterController();
  const source = parsePublishedItemDefinition(publishedSwordRecord);
  assert.ok(source);
  const contracts = createItemAbilityContracts({
    id: "sword1",
    type: "weapon",
    name: "Sunline Sword",
    w: 1,
    h: 3,
    icon: "sword",
    leftClickAction: "prototype attack",
    rightClickAction: "prototype guard",
    loc: { kind: "hud", slot: "action0" },
  }, source);

  controller.configureSkills(contracts);

  assert.equal(controller.getSkillForSlot("item.leftHand")?.effects[0].action, "swing");
  assert.equal(controller.getSkillForSlot("item.leftHand", "hold")?.effects[0].action, "power-swing");
  assert.equal(controller.getSkillForSlot("item.rightHand")?.effects[0].action, "block");
  assert.equal(controller.getSkillForSlot("item.rightHand", "hold")?.effects[0].repeatable, true);
  assert.equal(controller.activateSlot("item.leftHand", 1000, "hold"), true);
  assert.equal(controller.getSnapshot().activeAbilityId, "item:starter-sword:holdLeft:item.leftHand");
});

test("actionbar item contracts prefer published left-click item actions", () => {
  const controller = new CharacterController();
  const source = parsePublishedItemDefinition(publishedSwordRecord);
  assert.ok(source);
  const contracts = createActionbarItemAbilityContracts([{
    id: "sword1",
    type: "weapon",
    name: "Sunline Sword",
    w: 1,
    h: 3,
    icon: "sword",
    leftClickAction: "prototype attack",
    loc: { kind: "hud", slot: "action0" },
  }], [source]);

  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].slot, "actionbar.1");
  assert.equal(contracts[0].effects[0].action, "swing");
  assert.equal(contracts[0].effects[0].skillSlug, "weapon.swing");

  controller.configureSkills(contracts);

  assert.equal(controller.activateSlot("actionbar.1", 1000), true);
  assert.equal(controller.getSnapshot().activeAbilityId, "item:starter-sword:leftClick:actionbar.1");
});

test("frame exposes remaining timers for ability phases and cooldowns", () => {
  const controller = new CharacterController();
  controller.configureSkills([testSkill]);

  assert.equal(controller.activateSlot("tome.action1", 1000), true);
  const frame = controller.tick(1040, 0.04);

  assert.equal(frame.timers.abilityPhaseRemainingMs, 60);
  assert.equal(frame.timers.cooldownsRemainingMs["test-skill"], 960);
});

test("look input is normalized per frame and cleared after consumption", () => {
  const controller = new CharacterController();

  controller.handleLookInput(400, -300, 800, 600);

  assert.deepEqual(controller.tick(1000, 0.016).look, { yaw: 0.5, pitch: -0.5 });
  assert.deepEqual(controller.tick(1016, 0.016).look, { yaw: 0, pitch: 0 });
});

test("gameplay mouse mode toggles capture through tab and reconciles denied pointer lock", () => {
  let pointerLockElement: Element | null = null;
  const previousDocument = "document" in globalThis ? globalThis.document : undefined;
  const canvas = { requestPointerLock: () => undefined } as unknown as HTMLCanvasElement;
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    get pointerLockElement() { return pointerLockElement; },
    exitPointerLock: () => { pointerLockElement = null; },
  } });
  try {
    const controller = new GameplayMouseModeController();
    let prevented = false;
    const handled = controller.handleTabToggle({
      key: "Tab",
      repeat: false,
      target: null,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => undefined,
    } as KeyboardEvent, canvas);

    assert.equal(handled, true);
    assert.equal(prevented, true);
    assert.equal(controller.getSnapshot().requestedMode, "captured");
    controller.reconcilePointerLock(canvas);
    assert.equal(controller.getSnapshot().actualMode, "free");

    pointerLockElement = canvas;
    controller.reconcilePointerLock(canvas);
    assert.equal(controller.getSnapshot().actualMode, "captured");
  } finally {
    Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
  }
});

test("free drag-look pans while double-click captures and suppresses gameplay actions", () => {
  let pointerLockElement: Element | null = null;
  let pointerLockRequests = 0;
  const previousDocument = "document" in globalThis ? globalThis.document : undefined;
  const canvas = { requestPointerLock: () => { pointerLockRequests += 1; } } as unknown as HTMLCanvasElement;
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    get pointerLockElement() { return pointerLockElement; },
    exitPointerLock: () => { pointerLockElement = null; },
  } });
  try {
    const controller = new GameplayMouseModeController();
    const down = controller.handlePointerDown({
      button: 0,
      detail: 1,
      clientX: 0,
      clientY: 0,
      target: null,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as MouseEvent, canvas, 1000);
    assert.equal(down.allowGameplayAction, false);
    assert.equal(pointerLockRequests, 0);
    assert.equal(controller.getSnapshot().requestedMode, "free");
    assert.equal(controller.getSnapshot().freeDragActive, true);
    assert.deepEqual(controller.handlePointerMove({ movementX: 12, movementY: -8 } as MouseEvent).lookDelta, { x: 12, y: -8 });
    assert.deepEqual(controller.handlePointerMove({ movementX: 0, movementY: 0, clientX: 24, clientY: 13 } as MouseEvent).lookDelta, { x: 24, y: 13 });
    assert.deepEqual(controller.handlePointerMove({ movementX: 0, movementY: 0, clientX: 30, clientY: 9 } as MouseEvent).lookDelta, { x: 6, y: -4 });
    assert.equal(controller.handlePointerUp({ button: 0 } as MouseEvent), true);
    assert.equal(controller.getSnapshot().freeDragActive, false);

    const doubleClick = controller.handlePointerDown({
      button: 0,
      detail: 2,
      target: null,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as MouseEvent, canvas, 1200);
    assert.equal(doubleClick.allowGameplayAction, false);
    assert.equal(pointerLockRequests, 1);
    assert.equal(controller.getSnapshot().requestedMode, "captured");

    pointerLockElement = canvas;
    controller.reconcilePointerLock(canvas);
    assert.equal(controller.handlePointerDown({ button: 0, detail: 1, target: null } as MouseEvent, canvas, 1300).allowGameplayAction, false);
    assert.equal(controller.handlePointerDown({ button: 0, detail: 1, target: null } as MouseEvent, canvas, 1700).allowGameplayAction, true);
  } finally {
    Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
  }
});

test("free drag-look clears on cancellation without requesting pointer lock", () => {
  let pointerLockRequests = 0;
  const canvas = { requestPointerLock: () => { pointerLockRequests += 1; } } as unknown as HTMLCanvasElement;
  const controller = new GameplayMouseModeController();

  controller.handlePointerDown({
    button: 0,
    detail: 1,
    clientX: 80,
    clientY: 90,
    target: null,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as MouseEvent, canvas, 1000);

  assert.equal(pointerLockRequests, 0);
  assert.equal(controller.getSnapshot().freeDragActive, true);
  assert.deepEqual(controller.handlePointerMove({ movementX: 0, movementY: 0, clientX: 86, clientY: 101 } as MouseEvent).lookDelta, { x: 6, y: 11 });
  assert.equal(controller.cancelFreeDrag(), true);
  assert.equal(controller.getSnapshot().freeDragActive, false);
  assert.equal(controller.handlePointerMove({ movementX: 8, movementY: 8, clientX: 94, clientY: 109 } as MouseEvent).lookDelta, null);
});

test("double-click event requests pointer lock when pointerdown detail does not expose click count", () => {
  let pointerLockRequests = 0;
  const canvas = { requestPointerLock: () => { pointerLockRequests += 1; } } as unknown as HTMLCanvasElement;
  const controller = new GameplayMouseModeController();

  controller.handlePointerDown({
    button: 0,
    detail: 1,
    clientX: 40,
    clientY: 50,
    target: null,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as MouseEvent, canvas, 1000);

  assert.equal(pointerLockRequests, 0);
  assert.equal(controller.getSnapshot().freeDragActive, true);
  const handled = controller.handleDoubleClick({
    button: 0,
    target: null,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as MouseEvent, canvas, 1120);

  assert.equal(handled, true);
  assert.equal(pointerLockRequests, 1);
  assert.equal(controller.getSnapshot().requestedMode, "captured");
  assert.equal(controller.getSnapshot().freeDragActive, false);
});

test("block-face target composition strict-matches held item and authority revisions", () => {
  const result = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: heldItemTarget,
    placement: placementAssessment,
  });

  assert.equal(result.clearReason, null);
  assert.equal(result.intent?.source, "crosshair");
  assert.equal(result.intent?.presentation.state, "place-valid");
  assert.equal(result.intent?.presentation.prompt, "Place block");
  assert.equal(result.intent?.presentation.promptKind, "place");
  assert.equal(result.intent?.presentation.rarityThemeToken, "--color-item-rarity-rare");
  assert.equal(result.intent?.presentation.stability, "stable");
  assert.equal(result.intent?.presentation.targetDirection, "adjacent");
});

test("block-face target composition fails closed for stale and unknown inputs", () => {
  const staleItem = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: heldItemTarget,
    placement: { ...placementAssessment, assessedItemRevision: 4 },
  });
  assert.equal(staleItem.intent, null);
  assert.equal(staleItem.clearReason, "held-item.stale");

  const staleChunk = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: heldItemTarget,
    placement: { ...placementAssessment, assessedChunkVersionHash: "old" },
  });
  assert.equal(staleChunk.intent, null);
  assert.equal(staleChunk.clearReason, "placement.stale");

  const unknown = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: heldItemTarget,
    placement: { ...placementAssessment, validity: "unknown", stability: "unknown", reason: undefined },
  });
  assert.equal(unknown.intent, null);
  assert.equal(unknown.clearReason, "placement.unknown");

  const missingItem = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: { descriptor: null, diagnostics: [{ code: "held-item.exhausted", message: "Stack empty." }] },
    placement: placementAssessment,
  });
  assert.equal(missingItem.intent, null);
  assert.equal(missingItem.clearReason, "held-item.exhausted");
});

test("block-face target lifecycle exposes composed presentation event detail with revision", () => {
  const lifecycle = new CharacterBlockFaceTargetLifecycle();
  const composed = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: heldItemTarget,
    placement: placementAssessment,
  });

  assert.equal(lifecycle.setTarget(composed).intent?.target.chunkVersionHash, "chunk-v7");
  const presentationEvent = lifecycle.getPresentationEventDetail();
  assert.equal(CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT, "knowhere:block-face-target-presentation");
  assert.equal(presentationEvent?.revision, 1);
  assert.equal(presentationEvent?.source, "crosshair");
  assert.equal(presentationEvent?.presentation.state, "place-valid");
  assert.equal(presentationEvent?.presentation.validity, "valid");
  assert.equal(presentationEvent?.presentation.rarityThemeToken, "--color-item-rarity-rare");
  const cleared = lifecycle.clear("target.mode-changed");
  assert.equal(cleared.intent, null);
  assert.equal(cleared.clearReason, "target.mode-changed");
  assert.equal(cleared.revision, 2);
  assert.equal(lifecycle.getPresentationEventDetail(), null);
});

test("block-face target presentation event maps destructive and blocked states without HUD inference", () => {
  const destructive = composeCharacterBlockFaceTarget({
    target: { ...blockFaceTarget, state: "destructive" },
    heldItem: {
      descriptor: { ...heldItemTarget.descriptor!, actionKind: "mine-block", targetDirection: "selected" },
      diagnostics: [],
    },
    placement: placementAssessment,
  });
  assert.equal(destructive.intent?.presentation.state, "destructive");
  assert.equal(destructive.intent?.presentation.prompt, "Modify block");
  assert.equal(destructive.intent?.presentation.promptKind, "destructive");

  const blocked = composeCharacterBlockFaceTarget({
    target: blockFaceTarget,
    heldItem: heldItemTarget,
    placement: { ...placementAssessment, validity: "invalid", stability: "unstable", reason: "No support below target." },
  });
  assert.equal(blocked.intent?.presentation.state, "blocked");
  assert.equal(blocked.intent?.presentation.reason, "No support below target.");
  assert.equal(blocked.intent?.presentation.prompt, "Blocked");
  assert.equal(blocked.intent?.presentation.promptKind, "blocked");
});

test("block-face target source routing follows free cursor and captured crosshair modes", () => {
  const camera = { position: { x: 1, y: 2, z: 3 }, yaw: 0.25, pitch: -0.15 };
  const free = routeCharacterBlockFaceTargetSource({
    mouseMode: { requestedMode: "free", actualMode: "free", pointerLocked: false, freeDragActive: false, suppressPointerActionsUntil: 0 },
    viewport: { width: 800, height: 600 },
    pointer: { x: 320, y: 240 },
    camera,
  });
  assert.equal(free.clearReason, null);
  assert.equal(free.intent?.source, "cursor");
  assert.deepEqual(free.intent?.pointer, { x: 320, y: 240 });

  const captured = routeCharacterBlockFaceTargetSource({
    mouseMode: { requestedMode: "captured", actualMode: "captured", pointerLocked: true, freeDragActive: false, suppressPointerActionsUntil: 0 },
    viewport: { width: 800, height: 600 },
    pointer: { x: 20, y: 30 },
    camera,
  });
  assert.equal(captured.clearReason, null);
  assert.equal(captured.intent?.source, "crosshair");
  assert.equal(captured.intent?.pointer, null);

  const pointerLeft = routeCharacterBlockFaceTargetSource({
    mouseMode: { requestedMode: "free", actualMode: "free", pointerLocked: false, freeDragActive: false, suppressPointerActionsUntil: 0 },
    viewport: { width: 800, height: 600 },
    pointer: null,
    camera,
  });
  assert.equal(pointerLeft.intent, null);
  assert.equal(pointerLeft.clearReason, "target.pointer-left");
});

test("ability charges are consumed and recharge over time", () => {
  const controller = new CharacterController();
  controller.configureSkills([chargedSkill]);

  assert.equal(controller.activateSlot("tome.action1", 1000), true);
  controller.tick(1000, 0);
  assert.equal(controller.getSnapshot().timers.charges["charged-skill"].current, 1);

  controller.tick(1500, 0.5);
  assert.equal(controller.getSnapshot().timers.charges["charged-skill"].current, 2);
});

test("movement demo skills expose passive movement modifiers", () => {
  const controller = new CharacterController();
  const skills = createDemoSkillContracts([
    { id: "rift-step", name: "Rift Step", family: "movement", slot: "sprint", icon: "drop", description: "" },
    { id: "low-gravity-jump", name: "Low Gravity Jump", family: "movement", slot: "jump", icon: "orb", description: "" },
  ] satisfies DemoSkill[]);

  controller.configureSkills(skills);
  const frame = controller.tick(1000, 0.016);

  assert.equal(frame.movementModifiers.sprintMultiplier, 1.18);
  assert.equal(frame.movementModifiers.dodgeMultiplier, 1.12);
  assert.equal(frame.movementModifiers.jumpMultiplier, 1.35);
});

test("movement actions read model exposes stable ordering and bindings", () => {
  const controller = new CharacterController();
  controller.configureBindings([
    { id: "sprint", primary: "Shift", secondary: "Unbound" },
    { id: "jump", primary: "Space", secondary: "J" },
    { id: "crouch", primary: "C", secondary: "Unbound" },
    { id: "flight", primary: "F", secondary: "Unbound" },
  ]);
  const readModel = controller.getMovementActionsReadModel(1000);

  assert.equal(readModel.sectionLabel, "Movement Actions");
  assert.deepEqual(readModel.actions.map((action) => action.id), ["movement.sprint", "movement.dodge", "movement.jump", "movement.crouch", "movement.flight"]);
  assert.deepEqual(readModel.actions.map((action) => action.order), [0, 1, 2, 3, 4]);
  assert.equal(readModel.actions[0]?.label, "Sprint");
  assert.equal(readModel.actions[1]?.binding, "Double-tap WASD");
  assert.equal(readModel.actions[2]?.binding, "Space");
  assert.equal(readModel.actions[3]?.binding, "C");
  assert.equal(readModel.actions[4]?.binding, "F");
});

test("movement actions read model projects cooldowns charges active state and disabled reasons", () => {
  const controller = new CharacterController();
  const sprintSkill: SkillRuntimeContract = {
    ...chargedSkill,
    id: "charged-sprint",
    name: "Charged Sprint",
    slot: "movement.sprint",
    trigger: "passive",
    cooldownMs: 3000,
    charges: { max: 2, rechargeMs: 5000 },
  };
  controller.configureSkills([sprintSkill]);
  assert.equal(controller.activateSlot("movement.sprint", 1000, "passive"), true);
  controller.tick(1000, 0);
  controller.handleKeyDown({ key: "w", repeat: false, target: null, preventDefault: () => undefined } as KeyboardEvent);
  controller.handleKeyDown({ key: "Shift", repeat: false, target: null, preventDefault: () => undefined } as KeyboardEvent);
  controller.tick(1500, 0.1);

  const readModel = controller.getMovementActionsReadModel(1500);
  const sprint = readModel.actions.find((action) => action.id === "movement.sprint");
  assert.equal(sprint?.active, true);
  assert.equal(sprint?.selected, true);
  assert.equal(sprint?.skillId, "charged-sprint");
  assert.deepEqual(sprint?.cooldown, { totalMs: 3000, remainingMs: 2500 });
  assert.deepEqual(sprint?.charges, { current: 1, max: 2, nextRechargeRemainingMs: 4500 });

  const disabled = createMovementActionsReadModel({
    state: { ...controller.getSnapshot(), lifecycle: "dead", flags: { ...controller.getSnapshot().flags, dead: true, inputLocked: true } },
    skills: [sprintSkill],
    bindings: [{ id: "sprint", primary: "Unbound", secondary: "Unbound" }],
    now: 1500,
  });
  assert.equal(disabled.actions[0]?.disabled, true);
  assert.equal(disabled.actions[0]?.disabledReason, "Character is dead.");
});

test("entity runtime snapshot maps controller state to Clockwork-compatible fields", () => {
  const controller = new CharacterController();
  const snapshot = controller.createEntityRuntimeSnapshot({
    position: { x: 1025, y: 80, z: -1 },
    velocity: { x: 2, y: 0, z: -3 },
  });

  assert.equal(snapshot.entityId, "local-player");
  assert.equal(snapshot.controllerOwner, "local-player");
  assert.deepEqual(snapshot.clockworkSync.chunk, { x: 2, y: 0, z: -1 });
  assert.equal(snapshot.clockworkSync.revision, controller.getSnapshot().sequence);
  assert.equal(snapshot.health.current, controller.getSnapshot().health.current);
});

test("semantic animation and sfx adapter events are dispatched separately", () => {
  const dispatched: CustomEvent[] = [];
  const previousWindow = "window" in globalThis ? globalThis.window : undefined;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    dispatchEvent: (event: Event) => { dispatched.push(event as CustomEvent); return true; },
  } });
  try {
    const controller = new CharacterController();
    controller.configureSkills([testSkill]);

    assert.equal(controller.activateSlot("tome.action1", 1000), true);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }

  assert.equal(dispatched.some((event) => event.type === "knowhere:character-animation" && event.detail.animationTag === "ability.test.windup"), true);
  assert.equal(dispatched.some((event) => event.type === "knowhere:character-sfx" && event.detail.sfxEvent === "ability.cast"), true);
});
