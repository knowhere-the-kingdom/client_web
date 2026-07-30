import type { DefinitionWithRevision } from "../../api/legacy-types";
import type { DemoSkill } from "../../hud/types";
import type { CanvasItem } from "../../hud/types";
import type { AbilitySlot, SkillRuntimeContract } from "./types";
import { isItemDefinitionDocument } from "../../editor/items";
import type { ItemAction, ItemActionTrigger, ItemDefinitionDocument } from "../../editor/items";

const demoSlots: Readonly<Record<string, AbilitySlot | undefined>> = {
  ultimate: "tome.ultimate",
  "action-1": "tome.action1",
  "action-2": "tome.action2",
  "augmented-attack": "actionbar.1",
  restore: "actionbar.2",
  sprint: "movement.sprint",
  dodge: "movement.dodge",
  jump: "movement.jump",
  sneak: "movement.crouch",
  flight: "movement.flight",
};

const demoBalance: Readonly<Record<string, Readonly<{ spirit: number; cooldownMs: number; timing: SkillRuntimeContract["timing"]; charges?: SkillRuntimeContract["charges"] }>>> = {
  "solar-overdrive": { spirit: 20, cooldownMs: 12000, timing: { windupMs: 500, activeMs: 1200, recoveryMs: 400 }, charges: { max: 1, rechargeMs: 30000 } },
  "phase-lunge": { spirit: 8, cooldownMs: 2500, timing: { windupMs: 120, activeMs: 220, recoveryMs: 260 }, charges: { max: 2, rechargeMs: 8000 } },
  "gravity-hook": { spirit: 12, cooldownMs: 5000, timing: { windupMs: 300, activeMs: 420, recoveryMs: 350 } },
  "augmented-strike": { spirit: 4, cooldownMs: 1000, timing: { windupMs: 100, activeMs: 180, recoveryMs: 220 } },
  "restore-loop": { spirit: 0, cooldownMs: 6000, timing: { windupMs: 240, activeMs: 120, recoveryMs: 300 }, charges: { max: 2, rechargeMs: 12000 } },
};

const demoMovementEffects: Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>> = {
  "rift-step": [{ type: "movement-modifier", sprintMultiplier: 1.18, dodgeMultiplier: 1.12 }],
  "low-gravity-jump": [{ type: "movement-modifier", jumpMultiplier: 1.35 }],
  "silent-crouch": [{ type: "movement-modifier", crouchMultiplier: 1.2 }],
  "hover-flight": [{ type: "movement-modifier", flightMultiplier: 1.25 }],
};

export function createDemoSkillContracts(skills: readonly DemoSkill[]): SkillRuntimeContract[] {
  return skills.flatMap((skill) => {
    const slot = demoSlots[skill.slot];
    if (!slot) return [];
    const balance = demoBalance[skill.id] ?? { spirit: 5, cooldownMs: 2000, timing: { windupMs: 150, activeMs: 200, recoveryMs: 250 } };
    return [{
      id: skill.id,
      revision: 0,
      name: skill.name,
      trigger: slot.startsWith("movement.") ? "passive" : "press",
      slot,
      costs: balance.spirit > 0 ? [{ resource: "spirit", amount: balance.spirit }] : [],
      cooldownMs: balance.cooldownMs,
      charges: balance.charges ?? null,
      requiredStates: ["alive"],
      blockedStates: ["dodge", "stagger", "dying", "dead", "respawning"],
      timing: balance.timing,
      animationTag: `ability.${skill.id}`,
      sfxEvent: `ability.${skill.family}`,
      effects: demoMovementEffects[skill.id] ?? (skill.id === "restore-loop" ? [{ type: "restore-spirit", amount: 18 }] : []),
    }];
  });
}

export type PublishedItemDefinition = Readonly<{
  definitionId: string;
  slug: string;
  name: string;
  revision: number;
  document: ItemDefinitionDocument;
}>;

const itemActionTriggers = ["leftClick", "rightClick", "holdLeft", "holdRight"] as const;
const itemActionSlots: Readonly<Record<ItemActionTrigger, AbilitySlot>> = {
  leftClick: "item.leftHand",
  rightClick: "item.rightHand",
  holdLeft: "item.leftHand",
  holdRight: "item.rightHand",
};
const itemActionRuntimeTriggers: Readonly<Record<ItemActionTrigger, SkillRuntimeContract["trigger"]>> = {
  leftClick: "press",
  rightClick: "press",
  holdLeft: "hold",
  holdRight: "hold",
};
const itemActionNames: Readonly<Record<ItemActionTrigger, string>> = {
  leftClick: "Primary",
  rightClick: "Secondary",
  holdLeft: "Hold Primary",
  holdRight: "Hold Secondary",
};

function safeEventSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

function normalizedLookup(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function createItemActionContract(
  item: CanvasItem,
  trigger: ItemActionTrigger,
  action: ItemAction,
  source: PublishedItemDefinition | null,
  slot: AbilitySlot,
): SkillRuntimeContract[] {
  if (action.kind === "none") return [];
  const runtimeTrigger = itemActionRuntimeTriggers[trigger];
  const cooldownMs = Math.max(0, (item.stats?.cooldown ?? 0.4) * 1000);
  const sourceSlug = source?.document.slug ?? item.id;
  return [{
    id: `item:${sourceSlug}:${trigger}:${slot}`,
    revision: source?.revision ?? 0,
    name: `${item.name} ${action.label || itemActionNames[trigger]}`,
    trigger: runtimeTrigger,
    slot,
    costs: [],
    cooldownMs,
    charges: null,
    requiredStates: ["alive"],
    blockedStates: ["dodge", "stagger", "dying", "dead", "respawning"],
    timing: { windupMs: 80, activeMs: 120, recoveryMs: 140 },
    animationTag: `item.${safeEventSegment(source?.document.category ?? item.type)}.${safeEventSegment(action.kind)}.${safeEventSegment(trigger)}`,
    sfxEvent: `item.${safeEventSegment(action.kind)}`,
    effects: [{
      type: "item-action",
      itemId: item.id,
      itemDefinitionId: source?.definitionId ?? null,
      itemDefinitionSlug: source?.document.slug ?? null,
      action: action.kind,
      actionLabel: action.label,
      actionTrigger: trigger,
      repeatable: action.repeatable === true,
      skillDefinitionId: action.skill?.definitionId ?? null,
      skillRevision: action.skill?.revision ?? null,
      skillSlug: action.skill?.slug ?? null,
    }],
  }];
}

function createPrototypeActionContract(item: CanvasItem, hand: "left" | "right", action: string | undefined, slot: AbilitySlot): SkillRuntimeContract[] {
  if (!action) return [];
  const cooldownMs = Math.max(0, (item.stats?.cooldown ?? 0.4) * 1000);
  return [{
    id: `item:${item.id}:${hand}:${slot}`,
    revision: 0,
    name: `${item.name} ${hand === "left" ? "Primary" : "Secondary"}`,
    trigger: "press",
    slot,
    costs: [],
    cooldownMs,
    charges: null,
    requiredStates: ["alive"],
    blockedStates: ["dodge", "stagger", "dying", "dead", "respawning"],
    timing: { windupMs: 80, activeMs: 120, recoveryMs: 140 },
    animationTag: `item.${item.type}.${hand}`,
    sfxEvent: `item.${safeEventSegment(action)}`,
    effects: [{ type: "item-action", itemId: item.id, action }],
  }];
}

export function createItemAbilityContracts(item: CanvasItem | undefined, source: PublishedItemDefinition | null = null): SkillRuntimeContract[] {
  if (!item) return [];
  if (source) {
    return itemActionTriggers.flatMap((trigger) => createItemActionContract(item, trigger, source.document.actions[trigger], source, itemActionSlots[trigger]));
  }
  return [
    ...createPrototypeActionContract(item, "left", item.leftClickAction, "item.leftHand"),
    ...createPrototypeActionContract(item, "right", item.rightClickAction, "item.rightHand"),
  ];
}

export function createActionbarItemAbilityContracts(items: readonly (CanvasItem | undefined)[], sources: readonly PublishedItemDefinition[]): SkillRuntimeContract[] {
  return items.flatMap((item, index) => {
    if (!item || index >= 10) return [];
    const slot = `actionbar.${index + 1}` as AbilitySlot;
    const source = findPublishedItemDefinition(item, sources);
    if (source) return createItemActionContract(item, "leftClick", source.document.actions.leftClick, source, slot);
    return createPrototypeActionContract(item, "left", item.leftClickAction, slot);
  });
}

export function parsePublishedItemDefinition(record: DefinitionWithRevision): PublishedItemDefinition | null {
  if (record.definition.kind !== "item" || !isItemDefinitionDocument(record.revision.payload)) return null;
  return {
    definitionId: record.definition.id,
    slug: record.definition.slug,
    name: record.definition.name,
    revision: record.revision.revision,
    document: record.revision.payload,
  };
}

export function findPublishedItemDefinition(item: CanvasItem | undefined, sources: readonly PublishedItemDefinition[]) {
  if (!item) return null;
  const itemKeys = new Set([normalizedLookup(item.id), normalizedLookup(item.name)].filter((value) => value.length > 0));
  return sources.find((source) => {
    const document = source.document;
    return [source.slug, source.name, document.id, document.slug, document.displayName].some((value) => itemKeys.has(normalizedLookup(value)));
  }) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberField(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

const validStates = new Set(["idle", "locomotion", "sprint", "dodge", "jump", "airborne", "crouch", "flight", "land", "spawning", "alive", "stagger", "dying", "dead", "respawning", "despawned"]);

export function parsePublishedSkill(record: DefinitionWithRevision): SkillRuntimeContract | null {
  const payload = record.revision.payload;
  const slot = payload.slot;
  const validSlot = typeof slot === "string" && /^(movement\.(sprint|dodge|jump|crouch|flight)|tome\.(ultimate|action1|action2)|item\.(leftHand|rightHand)|actionbar\.(?:[1-9]|10))$/.test(slot);
  if (!validSlot) return null;
  const timing = isRecord(payload.timing) ? payload.timing : {};
  const chargesPayload = isRecord(payload.charges) ? payload.charges : null;
  const maxCharges = chargesPayload ? numberField(chargesPayload.max, 0) : 0;
  const rechargeMs = chargesPayload ? numberField(chargesPayload.rechargeMs, 0) : 0;
  const costs = Array.isArray(payload.costs) ? payload.costs.flatMap((value) => {
    if (!isRecord(value) || (value.resource !== "health" && value.resource !== "spirit") || typeof value.amount !== "number" || value.amount < 0) return [];
    return [{ resource: value.resource, amount: value.amount } as const];
  }) : [];
  const states = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && validStates.has(entry)) : [];
  return {
    id: record.definition.slug,
    revision: record.revision.revision,
    name: record.definition.name,
    trigger: payload.trigger === "hold" || payload.trigger === "release" || payload.trigger === "double-tap" || payload.trigger === "passive" ? payload.trigger : "press",
    slot: slot as AbilitySlot,
    costs,
    cooldownMs: numberField(payload.cooldownMs, 0),
    charges: maxCharges > 0 && rechargeMs > 0 ? { max: maxCharges, rechargeMs } : null,
    requiredStates: states(payload.requiredStates) as SkillRuntimeContract["requiredStates"],
    blockedStates: states(payload.blockedStates) as SkillRuntimeContract["blockedStates"],
    timing: {
      windupMs: numberField(timing.windupMs, 0),
      activeMs: numberField(timing.activeMs, 1),
      recoveryMs: numberField(timing.recoveryMs, 0),
    },
    animationTag: typeof payload.animationTag === "string" ? payload.animationTag : `ability.${record.definition.slug}`,
    sfxEvent: typeof payload.sfxEvent === "string" ? payload.sfxEvent : "ability.cast",
    effects: Array.isArray(payload.effects) ? payload.effects.filter(isRecord) : [],
  };
}
