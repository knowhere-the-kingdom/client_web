import { initialBindings } from "../hud/demoData.ts";
import type { SettingsBinding } from "../hud/types.ts";

export const SCREEN_STUDIO_BEHAVIOR_CONTRACT = "ScreenStudioBehaviorGraphV1" as const;
export const SCREEN_STUDIO_BEHAVIOR_CATEGORIES = ["Input", "Skills", "Movement", "Health", "Spirit", "Combat", "Progression", "Timing", "Logic"] as const;
export type ScreenStudioBehaviorCategory = typeof SCREEN_STUDIO_BEHAVIOR_CATEGORIES[number];
export const SCREEN_STUDIO_BEHAVIOR_KINDS = ["behavior", "trigger", "schedule"] as const;
export type ScreenStudioBehaviorKind = typeof SCREEN_STUDIO_BEHAVIOR_KINDS[number];

export type ScreenStudioBehaviorRecord = Readonly<{
  id: string; name: string; description: string; category: ScreenStudioBehaviorCategory;
  kind: ScreenStudioBehaviorKind; inputs: readonly string[]; outputs: readonly string[];
  actionBindingId?: string;
}>;

const record = (id: string, name: string, category: ScreenStudioBehaviorCategory, kind: ScreenStudioBehaviorKind, description: string, inputs: readonly string[] = [], outputs: readonly string[] = ["next"], actionBindingId?: string): ScreenStudioBehaviorRecord => Object.freeze({ id, name, category, kind, description, inputs: Object.freeze(inputs), outputs: Object.freeze(outputs), ...(actionBindingId ? { actionBindingId } : {}) });

function actionBindingCategory(group: SettingsBinding["group"]): ScreenStudioBehaviorCategory {
  if (group === "Movement & Look" || group === "Movement Abilities") return "Movement";
  if (group === "Tome Actions" || group === "Actionbar") return "Skills";
  return "Input";
}

export const SCREEN_STUDIO_ACTION_BINDING_RECORDS: readonly ScreenStudioBehaviorRecord[] = Object.freeze(initialBindings.map((binding) => record(
  `input-${binding.id}`,
  binding.label,
  actionBindingCategory(binding.group),
  "trigger",
  "Uses the current Account Settings action binding.",
  [],
  ["next"],
  binding.id,
)));

export const SCREEN_STUDIO_BEHAVIOR_CATALOG: readonly ScreenStudioBehaviorRecord[] = Object.freeze([
  ...SCREEN_STUDIO_ACTION_BINDING_RECORDS,
  record("skill-action", "Skill Action", "Skills", "trigger", "Fires when an allowlisted skill action is invoked."),
  record("movement-action", "Movement Action", "Movement", "trigger", "Fires from an allowlisted movement action."),
  record("health-lost", "Health Lost", "Health", "trigger", "Fires after validated health loss."),
  record("health-gain", "Health Gain", "Health", "trigger", "Fires after validated health gain."),
  record("spirit-lost", "Spirit Lost", "Spirit", "trigger", "Fires after validated spirit loss."),
  record("spirit-gain", "Spirit Gain", "Spirit", "trigger", "Fires after validated spirit gain."),
  record("on-kill", "On Kill", "Combat", "trigger", "Fires from a server-projected kill event."),
  record("on-death", "On Death", "Combat", "trigger", "Fires from a server-projected death event."),
  record("on-level-up", "On Level Up", "Progression", "trigger", "Fires from a server-projected level increase."),
  record("on-xp-gain", "On XP Gain", "Progression", "trigger", "Fires from a server-projected experience gain."),
  record("activate", "Activate", "Input", "behavior", "Invokes the selected local declarative activation."),
  record("open-context-menu", "Open Context Menu", "Input", "behavior", "Requests the local context menu."),
  record("return-to-game", "Return To Game", "Input", "behavior", "Returns from the Designer Workspace to the active game presentation."),
  record("delay", "Delay", "Timing", "schedule", "Waits for a bounded local duration before continuing.", ["duration"], ["complete"]),
  record("interval", "Interval", "Timing", "schedule", "Emits a bounded repeating schedule tick.", ["duration"], ["tick"]),
  record("sequence", "Sequence", "Logic", "behavior", "Runs child behavior outputs in explicit order.", ["start"], ["next"]),
  record("branch", "Branch", "Logic", "behavior", "Routes a boolean input to one of two outputs.", ["condition"], ["true", "false"]),
  record("set-local-state", "Set Local State", "Logic", "behavior", "Typed declarative state assignment; no executable code.", ["value"], ["changed"]),
].sort((a, b) => SCREEN_STUDIO_BEHAVIOR_CATEGORIES.indexOf(a.category) - SCREEN_STUDIO_BEHAVIOR_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name)));

const BY_ID = new Map(SCREEN_STUDIO_BEHAVIOR_CATALOG.map((entry) => [entry.id, entry]));
export function behaviorRecord(id: string): ScreenStudioBehaviorRecord | null { return BY_ID.get(id) ?? null; }
export function actionBindingForBehaviorRecord(recordId: string, bindings: readonly SettingsBinding[]): SettingsBinding | null {
  const actionBindingId = behaviorRecord(recordId)?.actionBindingId;
  return actionBindingId ? bindings.find((binding) => binding.id === actionBindingId) ?? null : null;
}
export function groupedBehaviorRecords(query = ""): readonly Readonly<{ category: ScreenStudioBehaviorCategory; records: readonly ScreenStudioBehaviorRecord[] }>[] {
  const normalized = query.trim().toLowerCase();
  return Object.freeze(SCREEN_STUDIO_BEHAVIOR_CATEGORIES.map((category) => Object.freeze({ category, records: Object.freeze(SCREEN_STUDIO_BEHAVIOR_CATALOG.filter((entry) => entry.category === category && (!normalized || `${entry.name} ${entry.id} ${entry.kind} ${entry.description}`.toLowerCase().includes(normalized)))) })).filter((group) => group.records.length));
}

export type ScreenStudioElementBehaviorBinding = Readonly<{ id: string; triggerId: string; behaviorId: string }>;
export function validateElementBehaviorBindings(bindings: readonly ScreenStudioElementBehaviorBinding[]): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const binding of bindings) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(binding.id) || ids.has(binding.id)) errors.push("behavior binding IDs must be unique safe identifiers");
    ids.add(binding.id);
    if (behaviorRecord(binding.triggerId)?.kind !== "trigger") errors.push("behavior binding trigger must reference a known trigger");
    const action = behaviorRecord(binding.behaviorId);
    if (!action || action.kind === "trigger") errors.push("behavior binding action must reference a known non-trigger record");
  }
  return Object.freeze(errors);
}

export type ScreenStudioBehaviorNode = Readonly<{ id: string; recordId: string; parentId: string | null; order: number; x: number; y: number }>;
export type ScreenStudioBehaviorWire = Readonly<{ id: string; fromNodeId: string; fromPort: string; toNodeId: string; toPort: string }>;
export type ScreenStudioBehaviorDraft = Readonly<{ contract: typeof SCREEN_STUDIO_BEHAVIOR_CONTRACT; id: string; name: string; nodes: readonly ScreenStudioBehaviorNode[]; wires: readonly ScreenStudioBehaviorWire[]; revision: number; localDraft: true }>;

const safeId = (value: string) => /^[a-z][a-z0-9-]{0,63}$/.test(value);
export function validateBehaviorDraft(draft: ScreenStudioBehaviorDraft): readonly string[] {
  const errors: string[] = [];
  if (draft.contract !== SCREEN_STUDIO_BEHAVIOR_CONTRACT || !safeId(draft.id) || !draft.name.trim()) errors.push("invalid behavior draft identity");
  if (draft.nodes.length > 128 || draft.wires.length > 256) errors.push("behavior graph exceeds local bounds");
  const ids = new Set<string>();
  for (const node of draft.nodes) {
    if (!safeId(node.id) || ids.has(node.id) || !behaviorRecord(node.recordId) || !Number.isInteger(node.order) || node.order < 0 || ![node.x, node.y].every(Number.isFinite)) errors.push("invalid behavior node");
    ids.add(node.id);
  }
  for (const node of draft.nodes) if (node.parentId !== null && (!ids.has(node.parentId) || node.parentId === node.id)) errors.push("invalid behavior parent");
  const parentOf = new Map(draft.nodes.map((node) => [node.id, node.parentId]));
  for (const node of draft.nodes) { const seen = new Set([node.id]); let parent = node.parentId; while (parent) { if (seen.has(parent)) { errors.push("behavior parenting cycle"); break; } seen.add(parent); parent = parentOf.get(parent) ?? null; } }
  const wireIds = new Set<string>();
  for (const wire of draft.wires) {
    const from = draft.nodes.find((node) => node.id === wire.fromNodeId); const to = draft.nodes.find((node) => node.id === wire.toNodeId);
    const fromRecord = from ? behaviorRecord(from.recordId) : null; const toRecord = to ? behaviorRecord(to.recordId) : null;
    if (!safeId(wire.id) || wireIds.has(wire.id) || !fromRecord?.outputs.includes(wire.fromPort) || !toRecord?.inputs.includes(wire.toPort)) errors.push("invalid behavior wire");
    wireIds.add(wire.id);
  }
  return Object.freeze([...new Set(errors)]);
}

export function createBehaviorDraft(id = "local-behavior-1", name = "Unnamed Behavior"): ScreenStudioBehaviorDraft {
  return Object.freeze({ contract: SCREEN_STUDIO_BEHAVIOR_CONTRACT, id, name, nodes: Object.freeze([]), wires: Object.freeze([]), revision: 1, localDraft: true as const });
}
export function updateBehaviorDraft(draft: ScreenStudioBehaviorDraft, patch: Partial<Pick<ScreenStudioBehaviorDraft, "name" | "nodes" | "wires">>): ScreenStudioBehaviorDraft {
  const candidate = Object.freeze({ ...draft, ...patch, revision: draft.revision + 1 });
  return validateBehaviorDraft(candidate).length ? draft : candidate;
}
export function addBehaviorNode(draft: ScreenStudioBehaviorDraft, recordId: string, parentId: string | null = null): ScreenStudioBehaviorDraft {
  if (!behaviorRecord(recordId) || (parentId !== null && !draft.nodes.some((node) => node.id === parentId))) return draft;
  let serial = draft.nodes.length + 1; let id = `behavior-node-${serial}`; while (draft.nodes.some((node) => node.id === id)) id = `behavior-node-${++serial}`;
  const siblings = draft.nodes.filter((node) => node.parentId === parentId);
  return updateBehaviorDraft(draft, { nodes: Object.freeze([...draft.nodes, Object.freeze({ id, recordId, parentId, order: siblings.length, x: 2 + siblings.length * 3, y: 2 + siblings.length * 2 })]) });
}
export function removeBehaviorNode(draft: ScreenStudioBehaviorDraft, nodeId: string): ScreenStudioBehaviorDraft {
  const removed = new Set<string>(); const visit = (id: string) => { removed.add(id); draft.nodes.filter((node) => node.parentId === id).forEach((node) => visit(node.id)); }; visit(nodeId);
  return updateBehaviorDraft(draft, { nodes: Object.freeze(draft.nodes.filter((node) => !removed.has(node.id))), wires: Object.freeze(draft.wires.filter((wire) => !removed.has(wire.fromNodeId) && !removed.has(wire.toNodeId))) });
}
export function parentBehaviorNode(draft: ScreenStudioBehaviorDraft, nodeId: string, parentId: string | null): ScreenStudioBehaviorDraft {
  if (nodeId === parentId || !draft.nodes.some((node) => node.id === nodeId) || (parentId !== null && !draft.nodes.some((node) => node.id === parentId))) return draft;
  const siblings = draft.nodes.filter((node) => node.parentId === parentId && node.id !== nodeId);
  return updateBehaviorDraft(draft, { nodes: Object.freeze(draft.nodes.map((node) => node.id === nodeId ? Object.freeze({ ...node, parentId, order: siblings.length }) : node)) });
}
export function reorderBehaviorNode(draft: ScreenStudioBehaviorDraft, nodeId: string, targetId: string): ScreenStudioBehaviorDraft {
  const node = draft.nodes.find((entry) => entry.id === nodeId); const target = draft.nodes.find((entry) => entry.id === targetId);
  if (!node || !target || node.parentId !== target.parentId || nodeId === targetId) return draft;
  const siblings = draft.nodes.filter((entry) => entry.parentId === node.parentId).sort((a, b) => a.order - b.order).filter((entry) => entry.id !== nodeId);
  siblings.splice(siblings.findIndex((entry) => entry.id === targetId), 0, node);
  const orders = new Map(siblings.map((entry, index) => [entry.id, index]));
  return updateBehaviorDraft(draft, { nodes: Object.freeze(draft.nodes.map((entry) => orders.has(entry.id) ? Object.freeze({ ...entry, order: orders.get(entry.id)! }) : entry)) });
}

export function moveBehaviorNode(draft: ScreenStudioBehaviorDraft, nodeId: string, x: number, y: number): ScreenStudioBehaviorDraft {
  if (![x, y].every(Number.isFinite) || Math.abs(x) > 32768 || Math.abs(y) > 32768) return draft;
  return updateBehaviorDraft(draft, { nodes: Object.freeze(draft.nodes.map((node) => node.id === nodeId ? Object.freeze({ ...node, x, y }) : node)) });
}

export function connectBehaviorNodes(draft: ScreenStudioBehaviorDraft, fromNodeId: string, fromPort: string, toNodeId: string, toPort: string): ScreenStudioBehaviorDraft {
  const from = draft.nodes.find((node) => node.id === fromNodeId);
  const to = draft.nodes.find((node) => node.id === toNodeId);
  if (!from || !to || fromNodeId === toNodeId || !behaviorRecord(from.recordId)?.outputs.includes(fromPort) || !behaviorRecord(to.recordId)?.inputs.includes(toPort)) return draft;
  if (draft.wires.some((wire) => wire.fromNodeId === fromNodeId && wire.fromPort === fromPort && wire.toNodeId === toNodeId && wire.toPort === toPort)) return draft;
  let serial = draft.wires.length + 1;
  let id = `behavior-wire-${serial}`;
  while (draft.wires.some((wire) => wire.id === id)) id = `behavior-wire-${++serial}`;
  return updateBehaviorDraft(draft, { wires: Object.freeze([...draft.wires, Object.freeze({ id, fromNodeId, fromPort, toNodeId, toPort })]) });
}

export function disconnectBehaviorWire(draft: ScreenStudioBehaviorDraft, wireId: string): ScreenStudioBehaviorDraft {
  return updateBehaviorDraft(draft, { wires: Object.freeze(draft.wires.filter((wire) => wire.id !== wireId)) });
}
