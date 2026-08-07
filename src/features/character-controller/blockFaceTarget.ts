import type { HeldItemTargetAppearanceDescriptor, HeldItemTargetAppearanceResult } from "../../editor/items.ts";
import type { GameplayMouseModeState } from "./mouseMode";

export type BlockFaceTargetSource = "crosshair" | "cursor";
export type PlacementValidity = "valid" | "invalid" | "unknown";
export type PlacementStability = "stable" | "unstable" | "unknown";
export type BlockFaceTarget = Readonly<{ source: BlockFaceTargetSource; state: "targetable" | "blocked"; chunkVersion: number; chunkVersionHash: string }>;
export type AuthorityPlacementAssessment = Readonly<{ assessedItemRevision: number; assessedChunkVersion: number; assessedChunkVersionHash: string; validity: PlacementValidity; stability: PlacementStability; reason?: string }>;

export type CharacterBlockFaceTargetClearReason =
  | "target.missing"
  | "target.unloaded"
  | "target.stale"
  | "target.mode-changed"
  | "target.focus-lost"
  | "target.resized"
  | "target.pointer-left"
  | "target.camera-changed"
  | "target.chunk-changed"
  | "target.hash-changed"
  | "target.out-of-range"
  | "target.resolver-diagnostic"
  | "held-item.missing"
  | "held-item.stale"
  | "held-item.non-placeable"
  | "held-item.exhausted"
  | "held-item.incompatible"
  | "held-item.unknown"
  | "placement.missing"
  | "placement.stale"
  | "placement.unknown";

export const CHARACTER_BLOCK_FACE_TARGET_PRESENTATION_EVENT = "knowhere:block-face-target-presentation" as const;

export type CharacterBlockFaceTargetHudState = "targetable" | "place-valid" | "destructive" | "blocked";
export type CharacterBlockFaceTargetPromptKind = "target" | "place" | "destructive" | "blocked";

export type CharacterBlockFaceTargetPresentation = Readonly<{
  validity: PlacementValidity;
  stability: PlacementStability;
  state: CharacterBlockFaceTargetHudState;
  reason: string;
  prompt: string;
  promptKind: CharacterBlockFaceTargetPromptKind;
  rarity: HeldItemTargetAppearanceDescriptor["rarity"];
  rarityThemeToken: HeldItemTargetAppearanceDescriptor["rarityThemeToken"];
  targetDirection: HeldItemTargetAppearanceDescriptor["targetDirection"];
}>;

export type CharacterBlockFaceTargetIntent = Readonly<{
  source: BlockFaceTargetSource;
  target: BlockFaceTarget;
  heldItem: HeldItemTargetAppearanceDescriptor;
  placement: AuthorityPlacementAssessment;
  presentation: CharacterBlockFaceTargetPresentation;
}>;

export type CharacterBlockFaceTargetComposition = Readonly<{
  intent: CharacterBlockFaceTargetIntent | null;
  clearReason: CharacterBlockFaceTargetClearReason | null;
  diagnostics: readonly string[];
}>;

export type CharacterBlockFaceTargetLifecycleState = Readonly<{
  intent: CharacterBlockFaceTargetIntent | null;
  clearReason: CharacterBlockFaceTargetClearReason | null;
  revision: number;
}>;

export type CharacterBlockFaceTargetPresentationEventDetail = Readonly<{
  revision: number;
  intent: CharacterBlockFaceTargetIntent;
  source: BlockFaceTargetSource;
  presentation: CharacterBlockFaceTargetPresentation;
}>;

export type CharacterBlockFaceTargetSourceIntent = Readonly<{
  source: BlockFaceTargetSource;
  viewport: Readonly<{ width: number; height: number }>;
  pointer: Readonly<{ x: number; y: number }> | null;
  camera: Readonly<{ position: Readonly<{ x: number; y: number; z: number }>; yaw: number; pitch: number; revision: string }>;
}>;

export type CharacterBlockFaceTargetSourceRouting = Readonly<{
  intent: CharacterBlockFaceTargetSourceIntent | null;
  clearReason: CharacterBlockFaceTargetClearReason | null;
}>;

export function composeCharacterBlockFaceTarget(input: Readonly<{
  target: BlockFaceTarget | null;
  heldItem: HeldItemTargetAppearanceResult;
  placement: AuthorityPlacementAssessment | null;
}>): CharacterBlockFaceTargetComposition {
  if (!input.target) return clear("target.missing", "Block-face target is missing.");
  const heldItemDiagnostic = input.heldItem.diagnostics[0];
  if (!input.heldItem.descriptor) return clear((heldItemDiagnostic?.code ?? "held-item.missing") as CharacterBlockFaceTargetClearReason, heldItemDiagnostic?.message ?? "Held item target identity is missing.");
  if (!input.placement) return clear("placement.missing", "Placement assessment is missing.");

  const target = input.target;
  const heldItem = input.heldItem.descriptor;
  const placement = input.placement;
  if (placement.assessedItemRevision !== heldItem.definitionRevision) {
    return clear("held-item.stale", `Held item revision ${heldItem.definitionRevision} does not match placement assessment item revision ${placement.assessedItemRevision}.`);
  }
  if (placement.assessedChunkVersion !== target.chunkVersion || placement.assessedChunkVersionHash !== target.chunkVersionHash) {
    return clear("placement.stale", "Placement assessment does not match the target chunk revision.");
  }
  if (placement.validity === "unknown") {
    return clear("placement.unknown", placement.reason ?? "Placement validity is unknown.");
  }

  const state = presentationStateFor(target, heldItem, placement);
  return {
    intent: {
      source: target.source,
      target,
      heldItem,
      placement,
      presentation: {
        validity: placement.validity,
        stability: placement.stability,
        state,
        reason: placement.reason ?? reasonFor(state),
        prompt: promptFor(state),
        promptKind: promptKindFor(state),
        rarity: heldItem.rarity,
        rarityThemeToken: heldItem.rarityThemeToken,
        targetDirection: heldItem.targetDirection,
      },
    },
    clearReason: null,
    diagnostics: [],
  };
}

export class CharacterBlockFaceTargetLifecycle {
  private state: CharacterBlockFaceTargetLifecycleState = { intent: null, clearReason: null, revision: 0 };

  getSnapshot = () => this.state;

  setTarget(composition: CharacterBlockFaceTargetComposition) {
    this.state = {
      intent: composition.intent,
      clearReason: composition.clearReason,
      revision: this.state.revision + 1,
    };
    return this.state;
  }

  clear(reason: CharacterBlockFaceTargetClearReason) {
    if (!this.state.intent && this.state.clearReason === reason) return this.state;
    this.state = { intent: null, clearReason: reason, revision: this.state.revision + 1 };
    return this.state;
  }

  getPresentationEventDetail(): CharacterBlockFaceTargetPresentationEventDetail | null {
    if (!this.state.intent) return null;
    return {
      revision: this.state.revision,
      intent: this.state.intent,
      source: this.state.intent.source,
      presentation: this.state.intent.presentation,
    };
  }
}

export function routeCharacterBlockFaceTargetSource(input: Readonly<{
  mouseMode: GameplayMouseModeState;
  viewport: Readonly<{ width: number; height: number }>;
  pointer: Readonly<{ x: number; y: number }> | null;
  camera: Readonly<{ position: Readonly<{ x: number; y: number; z: number }>; yaw: number; pitch: number }>;
}>): CharacterBlockFaceTargetSourceRouting {
  const width = Math.max(0, input.viewport.width);
  const height = Math.max(0, input.viewport.height);
  if (width <= 0 || height <= 0) return { intent: null, clearReason: "target.resized" };
  if (input.mouseMode.actualMode === "captured" || input.mouseMode.pointerLocked) {
    return {
      intent: {
        source: "crosshair",
        viewport: { width, height },
        pointer: null,
        camera: withCameraRevision(input.camera),
      },
      clearReason: null,
    };
  }
  if (!input.pointer || input.pointer.x < 0 || input.pointer.y < 0 || input.pointer.x > width || input.pointer.y > height) {
    return { intent: null, clearReason: "target.pointer-left" };
  }
  return {
    intent: {
      source: "cursor",
      viewport: { width, height },
      pointer: { x: input.pointer.x, y: input.pointer.y },
      camera: withCameraRevision(input.camera),
    },
    clearReason: null,
  };
}

function clear(clearReason: CharacterBlockFaceTargetClearReason, diagnostic: string): CharacterBlockFaceTargetComposition {
  return { intent: null, clearReason, diagnostics: [diagnostic] };
}

function presentationStateFor(target: BlockFaceTarget, heldItem: HeldItemTargetAppearanceDescriptor, placement: AuthorityPlacementAssessment): CharacterBlockFaceTargetHudState {
  if (target.state === "blocked") return "blocked";
  if (placement.validity !== "valid") return "blocked";
  if (heldItem.actionKind === "place-block") return "place-valid";
  if (heldItem.actionKind === "remove-block" || heldItem.actionKind === "mine-block" || heldItem.actionKind === "dig-block") return "destructive";
  return "targetable";
}

function reasonFor(state: CharacterBlockFaceTargetHudState) {
  if (state === "blocked") return "Target is blocked.";
  if (state === "destructive") return "Target can be modified.";
  if (state === "place-valid") return "Placement is valid.";
  return "Target acquired.";
}

function promptFor(state: CharacterBlockFaceTargetHudState) {
  if (state === "blocked") return "Blocked";
  if (state === "destructive") return "Modify block";
  if (state === "place-valid") return "Place block";
  return "Target block";
}

function promptKindFor(state: CharacterBlockFaceTargetHudState): CharacterBlockFaceTargetPromptKind {
  if (state === "place-valid") return "place";
  if (state === "destructive") return "destructive";
  if (state === "blocked") return "blocked";
  return "target";
}

function withCameraRevision(camera: Readonly<{ position: Readonly<{ x: number; y: number; z: number }>; yaw: number; pitch: number }>) {
  const position = {
    x: finiteNumber(camera.position.x),
    y: finiteNumber(camera.position.y),
    z: finiteNumber(camera.position.z),
  };
  const yaw = finiteNumber(camera.yaw);
  const pitch = finiteNumber(camera.pitch);
  return {
    position,
    yaw,
    pitch,
    revision: `${position.x.toFixed(4)}:${position.y.toFixed(4)}:${position.z.toFixed(4)}:${yaw.toFixed(6)}:${pitch.toFixed(6)}`,
  };
}

function finiteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}
