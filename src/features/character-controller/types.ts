import type { SettingsBinding } from "../../hud/types";

export type CharacterActionId =
  | "move-forward"
  | "move-back"
  | "strafe-left"
  | "strafe-right"
  | "look"
  | "sprint"
  | "dodge"
  | "jump"
  | "crouch"
  | "flight"
  | "tome-ultimate"
  | "tome-action-1"
  | "tome-action-2"
  | "left-hand"
  | "right-hand"
  | `actionbar-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export type MovementDirection = "forward" | "back" | "left" | "right";
export type CharacterMovementMode = "idle" | "locomotion" | "sprint" | "dodge" | "jump" | "airborne" | "crouch" | "flight" | "land";
export type CharacterAbilityPhase = "none" | "windup" | "active" | "recovery" | "cooldown" | "interrupted";
export type CharacterLifecycleState = "spawning" | "alive" | "stagger" | "dying" | "dead" | "respawning" | "despawned";
export type AbilitySlot =
  | "movement.sprint"
  | "movement.dodge"
  | "movement.jump"
  | "movement.crouch"
  | "movement.flight"
  | "tome.ultimate"
  | "tome.action1"
  | "tome.action2"
  | "item.leftHand"
  | "item.rightHand"
  | `actionbar.${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export type SkillRuntimeContract = Readonly<{
  id: string;
  revision: number;
  name: string;
  trigger: "press" | "hold" | "release" | "double-tap" | "passive";
  slot: AbilitySlot;
  costs: ReadonlyArray<Readonly<{ resource: "health" | "spirit"; amount: number }>>;
  cooldownMs: number;
  charges: Readonly<{ max: number; rechargeMs: number }> | null;
  requiredStates: ReadonlyArray<CharacterMovementMode | CharacterLifecycleState>;
  blockedStates: ReadonlyArray<CharacterMovementMode | CharacterLifecycleState>;
  timing: Readonly<{ windupMs: number; activeMs: number; recoveryMs: number }>;
  animationTag: string;
  sfxEvent: string;
  effects: ReadonlyArray<Readonly<Record<string, unknown>>>;
}>;

export type AbilityRuntimeChargeState = Readonly<{
  current: number;
  max: number;
  nextRechargeAt: number | null;
}>;

export type CharacterMovementModifiers = Readonly<{
  speedMultiplier: number;
  sprintMultiplier: number;
  dodgeMultiplier: number;
  jumpMultiplier: number;
  crouchMultiplier: number;
  flightMultiplier: number;
}>;

export type CharacterRenderEvent = Readonly<{
  entityId: string;
  abilityId: string | null;
  animationTag: string;
  sfxEvent: string | null;
}>;

export type CharacterAnimationAdapterEvent = Readonly<{
  entityId: string;
  animationTag: string;
  abilityId: string | null;
  sequence: number;
}>;

export type CharacterSfxAdapterEvent = Readonly<{
  entityId: string;
  sfxEvent: string;
  abilityId: string | null;
  emitter: "character" | "ability" | "lifecycle";
  sequence: number;
}>;

export type EntityRuntimeSnapshotInput = Readonly<{
  position: Readonly<{ x: number; y: number; z: number }>;
  velocity: Readonly<{ x: number; y: number; z: number }>;
  chunk?: Readonly<{ x: number; y: number; z: number }>;
  renderable?: Readonly<{ modelId: string | null; renderKind: "actor" | "instance" | "debris" }>;
}>;

export type EntityRuntimeContract = Readonly<{
  entityId: string;
  controllerOwner: "local-player" | "remote-player" | "npc" | "system";
  health: Readonly<{ current: number; maximum: number; deadAt: string | null }>;
  resources: Readonly<Record<string, Readonly<{ current: number; maximum: number }>>>;
  renderable: Readonly<{ modelId: string | null; renderKind: "actor" | "instance" | "debris" }>;
  collider: Readonly<{ radius: number; height: number; stepHeight: number }>;
  clockworkSync: Readonly<{
    position: Readonly<{ x: number; y: number; z: number }>;
    velocity: Readonly<{ x: number; y: number; z: number }>;
    chunk: Readonly<{ x: number; y: number; z: number }>;
    revision: number;
    lastInputSequence: number;
  }>;
}>;

export type CharacterControllerState = Readonly<{
  entityId: string;
  sequence: number;
  lifecycle: CharacterLifecycleState;
  movementMode: CharacterMovementMode;
  abilityPhase: CharacterAbilityPhase;
  activeAbilityId: string | null;
  timers: Readonly<{
    abilityPhaseEndsAt: number | null;
    cooldowns: Readonly<Record<string, number>>;
    charges: Readonly<Record<string, AbilityRuntimeChargeState>>;
  }>;
  dodgeDirection: MovementDirection | null;
  health: Readonly<{ current: number; maximum: number }>;
  resources: Readonly<{ spirit: Readonly<{ current: number; maximum: number }> }>;
  flags: Readonly<{
    grounded: boolean;
    flying: boolean;
    crouched: boolean;
    sprinting: boolean;
    dead: boolean;
    inputLocked: boolean;
    invulnerable: boolean;
  }>;
}>;

export type CharacterBindings = ReadonlyArray<
  Pick<SettingsBinding, "id" | "primary" | "secondary">
  & Partial<Pick<SettingsBinding, "gamepad">>
>;

export type CharacterActionSignal = Readonly<{
  actionId: CharacterActionId;
  phase: "pressed" | "released";
  value?: number;
  source?: "touch" | "gamepad" | "accessibility";
}>;

export type CharacterControllerTimers = Readonly<{
  abilityPhaseRemainingMs: number;
  cooldownsRemainingMs: Readonly<Record<string, number>>;
  dodgeRemainingMs: number;
  jumpRemainingMs: number;
  lifecycleRemainingMs: number;
}>;

export type CharacterControllerFrame = Readonly<{
  state: CharacterControllerState;
  move: Readonly<{ forward: number; right: number }>;
  look: Readonly<{ yaw: number; pitch: number }>;
  sprintCharge: number;
  movementModifiers: CharacterMovementModifiers;
  timers: CharacterControllerTimers;
  dodge: Readonly<{ direction: MovementDirection; progress: number }> | null;
  verticalVelocity: number;
  verticalIntent: number;
  jumpRequested: boolean;
}>;

export type MovementActionId = "movement.sprint" | "movement.dodge" | "movement.jump" | "movement.crouch" | "movement.flight";

export type MovementActionReadModel = Readonly<{
  sectionLabel: "Movement Actions";
  actions: readonly MovementActionSlotReadModel[];
}>;

export type MovementActionSlotReadModel = Readonly<{
  id: MovementActionId;
  order: number;
  label: "Sprint" | "Dodge" | "Jump" | "Crouch" | "Flight";
  icon: string;
  binding: string;
  bound: boolean;
  disabled: boolean;
  disabledReason: string | null;
  cooldown: Readonly<{ totalMs: number; remainingMs: number }> | null;
  charges: Readonly<{ current: number; max: number; nextRechargeRemainingMs: number | null }> | null;
  active: boolean;
  selected: boolean;
  skillId: string | null;
}>;
