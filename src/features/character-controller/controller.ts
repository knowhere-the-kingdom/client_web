import type { AbilitySlot, CharacterControllerState, CharacterMovementModifiers, EntityRuntimeContract, EntityRuntimeSnapshotInput, MovementDirection, CharacterActionId, CharacterBindings, CharacterControllerFrame, CharacterControllerTimers, CharacterRenderEvent, SkillRuntimeContract } from "./types";
import { createMovementActionsReadModel } from "./movementActions";

const DOUBLE_TAP_MS = 280;
const DODGE_DURATION_MS = 320;
const JUMP_DURATION_MS = 520;
const DYING_DURATION_MS = 900;
const RESPAWN_DURATION_MS = 700;
const SPRINT_RAMP_SECONDS = 3.2;

const actionSlots: Readonly<Partial<Record<CharacterActionId, AbilitySlot>>> = {
  "tome-ultimate": "tome.ultimate",
  "tome-action-1": "tome.action1",
  "tome-action-2": "tome.action2",
  "left-hand": "item.leftHand",
  "right-hand": "item.rightHand",
  "actionbar-1": "actionbar.1",
  "actionbar-2": "actionbar.2",
  "actionbar-3": "actionbar.3",
  "actionbar-4": "actionbar.4",
  "actionbar-5": "actionbar.5",
  "actionbar-6": "actionbar.6",
  "actionbar-7": "actionbar.7",
  "actionbar-8": "actionbar.8",
  "actionbar-9": "actionbar.9",
};

const actionAliases: Readonly<Record<string, CharacterActionId>> = {
  ultimate: "tome-ultimate",
  "skill-1": "tome-action-1",
  "skill-2": "tome-action-2",
};

const movementDirections: Readonly<Partial<Record<CharacterActionId, MovementDirection>>> = {
  "move-forward": "forward",
  "move-back": "back",
  "strafe-left": "left",
  "strafe-right": "right",
};

const defaultKeys: Readonly<Record<string, CharacterActionId>> = {
  w: "move-forward",
  s: "move-back",
  a: "strafe-left",
  d: "strafe-right",
  shift: "sprint",
  " ": "jump",
  control: "crouch",
  alt: "flight",
};

function initialState(): CharacterControllerState {
  return {
    entityId: "local-player",
    sequence: 0,
    lifecycle: "alive",
    movementMode: "idle",
    abilityPhase: "none",
    activeAbilityId: null,
    timers: { abilityPhaseEndsAt: null, cooldowns: {}, charges: {} },
    dodgeDirection: null,
    health: { current: 68, maximum: 100 },
    resources: { spirit: { current: 43, maximum: 100 } },
    flags: {
      grounded: true,
      flying: false,
      crouched: false,
      sprinting: false,
      dead: false,
      inputLocked: false,
      invulnerable: false,
    },
  };
}

function normalizedKey(value: string) {
  if (value === "Space") return " ";
  if (value === "Ctrl") return "control";
  return value.toLowerCase();
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.tagName === "SELECT" || element?.isContentEditable === true;
}

export class CharacterController {
  private state = initialState();
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: CharacterRenderEvent) => void>();
  private readonly held = new Set<CharacterActionId>();
  private readonly keyActions = new Map<string, CharacterActionId>();
  private readonly pointerActions = new Map<number, CharacterActionId>();
  private readonly lastMovementTap = new Map<MovementDirection, number>();
  private dodgeStartedAt = 0;
  private jumpStartedAt = 0;
  private lifecycleStartedAt = 0;
  private sprintCharge = 0;
  private lookIntent = { yaw: 0, pitch: 0 };
  private lastAnimationTag: string | null = null;
  private readonly skills = new Map<string, SkillRuntimeContract>();
  private readonly skillsBySlot = new Map<string, string>();
  private bindings: CharacterBindings = [];

  constructor() {
    Object.entries(defaultKeys).forEach(([key, action]) => this.keyActions.set(key, action));
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  subscribeEvents = (listener: (event: CharacterRenderEvent) => void) => {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  };

  configureSkills(skills: readonly SkillRuntimeContract[]) {
    this.skills.clear();
    this.skillsBySlot.clear();
    skills.forEach((skill) => {
      this.skills.set(skill.id, skill);
      this.skillsBySlot.set(this.slotTriggerKey(skill.slot, skill.trigger), skill.id);
    });
    const charges = Object.fromEntries(skills.flatMap((skill) => skill.charges ? [[skill.id, { current: skill.charges.max, max: skill.charges.max, nextRechargeAt: null }]] : []));
    this.patch({ timers: { ...this.state.timers, charges } });
  }

  configureBindings(bindings: CharacterBindings) {
    this.bindings = bindings;
    this.keyActions.clear();
    this.pointerActions.clear();
    Object.entries(defaultKeys).forEach(([key, action]) => this.keyActions.set(key, action));
    bindings.forEach((binding) => {
      const action = actionAliases[binding.id] ?? binding.id as CharacterActionId;
      for (const value of [binding.primary, binding.secondary]) {
        const mouse = /^Mouse (\d+)$/.exec(value);
        if (mouse) {
          this.pointerActions.set(Number(mouse[1]) - 1, action);
          continue;
        }
        if (value === "Unbound" || value === "Hardcoded" || value.startsWith("Double-tap") || value.startsWith("Mouse")) continue;
        this.keyActions.set(normalizedKey(value), action);
      }
    });
  }

  handlePointerDown(event: MouseEvent) {
    if (isEditableTarget(event.target) || this.state.flags.inputLocked) return;
    const action = this.pointerActions.get(event.button);
    const slot = action ? actionSlots[action] : undefined;
    if (!slot) return;
    event.preventDefault();
    this.activateSlot(slot, performance.now(), "press");
  }

  handleLookInput(deltaX: number, deltaY: number, viewportWidth: number, viewportHeight: number) {
    if (this.state.flags.inputLocked || viewportWidth <= 0 || viewportHeight <= 0) return;
    this.lookIntent = {
      yaw: Math.max(-1, Math.min(1, deltaX / viewportWidth)),
      pitch: Math.max(-1, Math.min(1, deltaY / viewportHeight)),
    };
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.repeat || isEditableTarget(event.target)) return;
    const action = this.keyActions.get(normalizedKey(event.key));
    if (!action || this.state.flags.inputLocked) return;
    event.preventDefault();
    this.held.add(action);
    const now = performance.now();
    const direction = movementDirections[action];
    if (direction) {
      const previous = this.lastMovementTap.get(direction) ?? -Infinity;
      this.lastMovementTap.set(direction, now);
      if (now - previous <= DOUBLE_TAP_MS) this.startDodge(direction, now);
    } else if (action === "dodge") {
      this.startDodge(this.currentDirection() ?? "forward", now);
    } else if (action === "jump" && !this.state.flags.flying) {
      this.jumpStartedAt = now;
      this.patch({ movementMode: "jump", flags: { ...this.state.flags, grounded: false } });
      this.emit({ abilityId: null, animationTag: "jump.start", sfxEvent: "jump" });
    } else if (action === "crouch") {
      const crouched = !this.state.flags.crouched;
      this.patch({ movementMode: crouched ? "crouch" : "idle", flags: { ...this.state.flags, crouched } });
      this.emit({ abilityId: null, animationTag: crouched ? "crouch.idle" : "idle", sfxEvent: crouched ? "crouch.enter" : "crouch.exit" });
    } else if (action === "flight") {
      const flying = !this.state.flags.flying;
      this.patch({ movementMode: flying ? "flight" : "idle", flags: { ...this.state.flags, flying, grounded: !flying } });
      this.emit({ abilityId: null, animationTag: flying ? "flight.idle" : "idle", sfxEvent: flying ? "flight.start" : "flight.end" });
    } else if (actionSlots[action]) {
      this.activateSlot(actionSlots[action], now, "press");
    }
    this.updateMovementMode();
  }

  handleKeyUp(event: KeyboardEvent) {
    const action = this.keyActions.get(normalizedKey(event.key));
    if (!action) return;
    this.held.delete(action);
    this.updateMovementMode();
  }

  tick(now: number, deltaSeconds: number): CharacterControllerFrame {
    const sprinting = this.held.has("sprint") && this.hasMovement() && !this.state.flags.crouched && !this.state.flags.flying;
    this.sprintCharge = Math.max(0, Math.min(1, this.sprintCharge + deltaSeconds / SPRINT_RAMP_SECONDS * (sprinting ? 1 : -2.4)));

    if (this.state.lifecycle === "dying" && now - this.lifecycleStartedAt >= DYING_DURATION_MS) {
      this.patch({ lifecycle: "dead", movementMode: "idle", flags: { ...this.state.flags, dead: true, inputLocked: true } });
      this.emit({ abilityId: null, animationTag: "death", sfxEvent: "death" });
    } else if (this.state.lifecycle === "respawning" && now - this.lifecycleStartedAt >= RESPAWN_DURATION_MS) {
      this.patch({ lifecycle: "alive", movementMode: "idle", health: { ...this.state.health, current: this.state.health.maximum }, flags: { ...this.state.flags, dead: false, inputLocked: false, invulnerable: false } });
      this.emit({ abilityId: null, animationTag: "idle", sfxEvent: "respawn" });
    }

    if (this.state.timers.abilityPhaseEndsAt !== null && now >= this.state.timers.abilityPhaseEndsAt) this.advanceAbility(now);
    const activeCooldowns = Object.fromEntries(Object.entries(this.state.timers.cooldowns).filter(([, endsAt]) => endsAt > now));
    if (Object.keys(activeCooldowns).length !== Object.keys(this.state.timers.cooldowns).length) {
      this.patch({ timers: { ...this.state.timers, cooldowns: activeCooldowns } });
    }
    this.rechargeAbilityCharges(now);

    const dodgeElapsed = now - this.dodgeStartedAt;
    if (this.state.movementMode === "dodge" && dodgeElapsed >= DODGE_DURATION_MS) this.updateMovementMode(true);
    const jumpElapsed = now - this.jumpStartedAt;
    if ((this.state.movementMode === "jump" || this.state.movementMode === "airborne") && jumpElapsed >= JUMP_DURATION_MS) {
      this.patch({ movementMode: this.hasMovement() ? "locomotion" : "idle", flags: { ...this.state.flags, grounded: true } });
    } else if (this.state.movementMode === "jump" && jumpElapsed >= 140) {
      this.patch({ movementMode: "airborne" });
    }

    const move = this.movementVector();
    const look = this.lookIntent;
    this.lookIntent = { yaw: 0, pitch: 0 };
    if (this.state.abilityPhase === "none") this.emitAnimation(this.animationTagForMovement(), null);
    return {
      state: this.state,
      move,
      look,
      sprintCharge: this.sprintCharge,
      movementModifiers: this.movementModifiers(),
      timers: this.frameTimers(now),
      dodge: this.state.movementMode === "dodge" && this.state.dodgeDirection ? { direction: this.state.dodgeDirection, progress: Math.min(1, dodgeElapsed / DODGE_DURATION_MS) } : null,
      verticalVelocity: this.state.movementMode === "jump" || this.state.movementMode === "airborne" ? Math.cos(Math.min(1, jumpElapsed / JUMP_DURATION_MS) * Math.PI) * 7 : 0,
    };
  }

  damage(amount: number) {
    if (amount <= 0 || this.state.flags.invulnerable || this.state.flags.dead) return;
    const current = Math.max(0, this.state.health.current - amount);
    this.patch({ health: { ...this.state.health, current } });
    this.emit({ abilityId: null, animationTag: "stagger", sfxEvent: "damage" });
    if (current === 0) {
      this.lifecycleStartedAt = performance.now();
      this.held.clear();
      this.patch({ lifecycle: "dying", movementMode: "idle", flags: { ...this.state.flags, inputLocked: true } });
    }
  }

  heal(amount: number) {
    if (amount <= 0 || this.state.lifecycle !== "alive") return;
    this.patch({ health: { ...this.state.health, current: Math.min(this.state.health.maximum, this.state.health.current + amount) } });
  }

  spendSpirit(amount: number) {
    if (amount <= 0 || this.state.lifecycle !== "alive") return;
    const spirit = this.state.resources.spirit;
    this.patch({ resources: { spirit: { ...spirit, current: Math.max(0, spirit.current - amount) } } });
  }

  restoreSpirit(amount: number) {
    if (amount <= 0 || this.state.lifecycle !== "alive") return;
    const spirit = this.state.resources.spirit;
    this.patch({ resources: { spirit: { ...spirit, current: Math.min(spirit.maximum, spirit.current + amount) } } });
  }

  setMeter(kind: "health" | "spirit", current: number, maximum: number) {
    const safeMaximum = Math.max(1, maximum);
    const safeCurrent = Math.max(0, Math.min(safeMaximum, current));
    if (kind === "health") {
      this.patch({ health: { current: safeCurrent, maximum: safeMaximum } });
      if (safeCurrent === 0 && this.state.lifecycle === "alive") {
        this.lifecycleStartedAt = performance.now();
        this.patch({ lifecycle: "dying", movementMode: "idle", flags: { ...this.state.flags, inputLocked: true } });
      }
      return;
    }
    this.patch({ resources: { spirit: { current: safeCurrent, maximum: safeMaximum } } });
  }

  respawn() {
    if (this.state.lifecycle !== "dead") return;
    this.lifecycleStartedAt = performance.now();
    this.patch({ lifecycle: "respawning", flags: { ...this.state.flags, invulnerable: true } });
    this.emit({ abilityId: null, animationTag: "respawn", sfxEvent: null });
  }

  activateSlot(slot: AbilitySlot, now = performance.now(), trigger: SkillRuntimeContract["trigger"] = "press") {
    const skillId = this.skillsBySlot.get(this.slotTriggerKey(slot, trigger));
    if (!skillId) return false;
    const skill = this.skills.get(skillId);
    if (!skill || skill.trigger !== trigger || this.state.lifecycle !== "alive" || this.state.abilityPhase !== "none") return this.rejectAbility(skill ?? null);
    if ((this.state.timers.cooldowns[skill.id] ?? 0) > now) return this.rejectAbility(skill);
    const chargeState = this.state.timers.charges[skill.id];
    if (skill.charges && (!chargeState || chargeState.current <= 0)) return this.rejectAbility(skill);
    const currentStates = new Set<string>([this.state.lifecycle, this.state.movementMode]);
    if (skill.requiredStates.length > 0 && !skill.requiredStates.some((state) => currentStates.has(state))) return this.rejectAbility(skill);
    if (skill.blockedStates.some((state) => currentStates.has(state))) return this.rejectAbility(skill);
    if (skill.costs.some((cost) => cost.resource === "health" ? this.state.health.current <= cost.amount : this.state.resources.spirit.current < cost.amount)) return this.rejectAbility(skill);

    let health = this.state.health;
    let resources = this.state.resources;
    skill.costs.forEach((cost) => {
      if (cost.resource === "health") health = { ...health, current: health.current - cost.amount };
      else resources = { spirit: { ...resources.spirit, current: resources.spirit.current - cost.amount } };
    });
    const cooldowns = { ...this.state.timers.cooldowns, [skill.id]: now + skill.cooldownMs };
    const charges = skill.charges && chargeState
      ? {
          ...this.state.timers.charges,
          [skill.id]: {
            ...chargeState,
            current: Math.max(0, chargeState.current - 1),
            nextRechargeAt: chargeState.current >= chargeState.max ? now + skill.charges.rechargeMs : chargeState.nextRechargeAt ?? now + skill.charges.rechargeMs,
          },
        }
      : this.state.timers.charges;
    this.patch({
      activeAbilityId: skill.id,
      abilityPhase: "windup",
      health,
      resources,
      timers: { abilityPhaseEndsAt: now + skill.timing.windupMs, cooldowns, charges },
    });
    this.emit({ abilityId: skill.id, animationTag: `${skill.animationTag}.windup`, sfxEvent: skill.sfxEvent });
    if (skill.timing.windupMs === 0) this.advanceAbility(now);
    return true;
  }

  getSkillForSlot(slot: AbilitySlot, trigger: SkillRuntimeContract["trigger"] = "press") {
    const id = this.skillsBySlot.get(this.slotTriggerKey(slot, trigger));
    return id ? this.skills.get(id) ?? null : null;
  }

  getMovementActionsReadModel(now = performance.now()) {
    return createMovementActionsReadModel({
      state: this.state,
      skills: [...this.skills.values()],
      bindings: this.bindings,
      now,
    });
  }

  private slotTriggerKey(slot: AbilitySlot, trigger: SkillRuntimeContract["trigger"]) {
    return `${slot}:${trigger}`;
  }

  createEntityRuntimeSnapshot(input: EntityRuntimeSnapshotInput): EntityRuntimeContract {
    const chunk = input.chunk ?? {
      x: Math.floor(input.position.x / 512),
      y: Math.floor(input.position.y / 512),
      z: Math.floor(input.position.z / 512),
    };
    return {
      entityId: this.state.entityId,
      controllerOwner: "local-player",
      health: {
        current: this.state.health.current,
        maximum: this.state.health.maximum,
        deadAt: this.state.flags.dead ? new Date().toISOString() : null,
      },
      resources: { spirit: this.state.resources.spirit },
      renderable: input.renderable ?? { modelId: null, renderKind: "actor" },
      collider: {
        radius: this.state.flags.crouched ? 0.38 : 0.45,
        height: this.state.flags.crouched ? 1.15 : 1.8,
        stepHeight: this.state.flags.flying ? 0 : 0.45,
      },
      clockworkSync: {
        position: input.position,
        velocity: input.velocity,
        chunk,
        revision: this.state.sequence,
        lastInputSequence: this.state.sequence,
      },
    };
  }

  private startDodge(direction: MovementDirection, now: number) {
    if (this.state.flags.flying || this.state.flags.crouched || this.state.movementMode === "dodge") return;
    this.dodgeStartedAt = now;
    this.patch({ movementMode: "dodge", dodgeDirection: direction });
    this.emit({ abilityId: null, animationTag: `dodge.${direction}`, sfxEvent: "dodge" });
  }

  private advanceAbility(now: number) {
    const skill = this.state.activeAbilityId ? this.skills.get(this.state.activeAbilityId) : null;
    if (!skill) {
      this.patch({ activeAbilityId: null, abilityPhase: "none", timers: { ...this.state.timers, abilityPhaseEndsAt: null } });
      return;
    }
    if (this.state.abilityPhase === "windup") {
      this.applyEffects(skill);
      this.patch({ abilityPhase: "active", timers: { ...this.state.timers, abilityPhaseEndsAt: now + skill.timing.activeMs } });
      this.emit({ abilityId: skill.id, animationTag: `${skill.animationTag}.active`, sfxEvent: null });
      return;
    }
    if (this.state.abilityPhase === "active") {
      this.patch({ abilityPhase: "recovery", timers: { ...this.state.timers, abilityPhaseEndsAt: now + skill.timing.recoveryMs } });
      this.emit({ abilityId: skill.id, animationTag: `${skill.animationTag}.recovery`, sfxEvent: null });
      return;
    }
    this.patch({ activeAbilityId: null, abilityPhase: "none", timers: { ...this.state.timers, abilityPhaseEndsAt: null } });
    this.emit({ abilityId: skill.id, animationTag: this.animationTagForMovement(), sfxEvent: null });
  }

  private applyEffects(skill: SkillRuntimeContract) {
    skill.effects.forEach((effect) => {
      if (effect.type === "restore-spirit" && typeof effect.amount === "number") this.restoreSpirit(effect.amount);
      if (effect.type === "heal" && typeof effect.amount === "number") this.heal(effect.amount);
    });
  }

  private rejectAbility(skill: SkillRuntimeContract | null) {
    this.emit({ abilityId: skill?.id ?? null, animationTag: "ability.fail", sfxEvent: "ability.fail" });
    return false;
  }

  private animationTagForMovement() {
    if (this.state.movementMode === "idle") return "idle";
    if (this.state.movementMode === "locomotion") return "walk";
    if (this.state.movementMode === "sprint") return "sprint";
    if (this.state.movementMode === "crouch") return "crouch.idle";
    if (this.state.movementMode === "flight") return "flight.idle";
    if (this.state.movementMode === "jump" || this.state.movementMode === "airborne") return "jump.loop";
    if (this.state.movementMode === "land") return "land";
    return this.state.movementMode;
  }

  private frameTimers(now: number): CharacterControllerTimers {
    const abilityPhaseRemainingMs = this.state.timers.abilityPhaseEndsAt === null ? 0 : Math.max(0, this.state.timers.abilityPhaseEndsAt - now);
    const cooldownsRemainingMs = Object.fromEntries(Object.entries(this.state.timers.cooldowns).map(([id, endsAt]) => [id, Math.max(0, endsAt - now)]));
    const dodgeRemainingMs = this.state.movementMode === "dodge" ? Math.max(0, DODGE_DURATION_MS - (now - this.dodgeStartedAt)) : 0;
    const jumpRemainingMs = this.state.movementMode === "jump" || this.state.movementMode === "airborne" ? Math.max(0, JUMP_DURATION_MS - (now - this.jumpStartedAt)) : 0;
    const lifecycleDuration = this.state.lifecycle === "dying" ? DYING_DURATION_MS : this.state.lifecycle === "respawning" ? RESPAWN_DURATION_MS : 0;
    const lifecycleRemainingMs = lifecycleDuration > 0 ? Math.max(0, lifecycleDuration - (now - this.lifecycleStartedAt)) : 0;
    return { abilityPhaseRemainingMs, cooldownsRemainingMs, dodgeRemainingMs, jumpRemainingMs, lifecycleRemainingMs };
  }

  private rechargeAbilityCharges(now: number) {
    let changed = false;
    const charges = { ...this.state.timers.charges };
    for (const [skillId, chargeState] of Object.entries(this.state.timers.charges)) {
      const skill = this.skills.get(skillId);
      if (!skill?.charges || chargeState.current >= chargeState.max || chargeState.nextRechargeAt === null || now < chargeState.nextRechargeAt) continue;
      const elapsed = now - chargeState.nextRechargeAt;
      const recovered = 1 + Math.floor(elapsed / skill.charges.rechargeMs);
      const current = Math.min(chargeState.max, chargeState.current + recovered);
      charges[skillId] = {
        ...chargeState,
        current,
        nextRechargeAt: current >= chargeState.max ? null : chargeState.nextRechargeAt + recovered * skill.charges.rechargeMs,
      };
      changed = true;
    }
    if (changed) this.patch({ timers: { ...this.state.timers, charges } });
  }

  private movementModifiers(): CharacterMovementModifiers {
    const modifiers: CharacterMovementModifiers = {
      speedMultiplier: 1,
      sprintMultiplier: 1,
      dodgeMultiplier: 1,
      jumpMultiplier: 1,
      crouchMultiplier: 1,
      flightMultiplier: 1,
    };
    for (const skill of this.skills.values()) {
      if (skill.trigger !== "passive" || !skill.slot.startsWith("movement.")) continue;
      for (const effect of skill.effects) {
        if (effect.type !== "movement-modifier") continue;
        this.multiplyModifier(modifiers, "speedMultiplier", effect.speedMultiplier);
        this.multiplyModifier(modifiers, "sprintMultiplier", effect.sprintMultiplier);
        this.multiplyModifier(modifiers, "dodgeMultiplier", effect.dodgeMultiplier);
        this.multiplyModifier(modifiers, "jumpMultiplier", effect.jumpMultiplier);
        this.multiplyModifier(modifiers, "crouchMultiplier", effect.crouchMultiplier);
        this.multiplyModifier(modifiers, "flightMultiplier", effect.flightMultiplier);
      }
    }
    return modifiers;
  }

  private multiplyModifier(modifiers: Record<keyof CharacterMovementModifiers, number>, key: keyof CharacterMovementModifiers, value: unknown) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) modifiers[key] *= value;
  }

  private emit(event: Omit<CharacterRenderEvent, "entityId">) {
    const payload = { ...event, entityId: this.state.entityId };
    this.eventListeners.forEach((listener) => listener(payload));
    this.emitAnimation(payload.animationTag, payload.abilityId);
    if (payload.sfxEvent) this.emitSfx(payload.sfxEvent, payload.abilityId, payload.abilityId ? "ability" : payload.animationTag === "death" || payload.animationTag === "respawn" ? "lifecycle" : "character");
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("knowhere:character-controller-render", { detail: payload }));
  }

  private emitAnimation(animationTag: string, abilityId: string | null) {
    if (this.lastAnimationTag === animationTag) return;
    this.lastAnimationTag = animationTag;
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("knowhere:character-animation", { detail: { entityId: this.state.entityId, animationTag, abilityId, sequence: this.state.sequence } }));
  }

  private emitSfx(sfxEvent: string, abilityId: string | null, emitter: "character" | "ability" | "lifecycle") {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("knowhere:character-sfx", { detail: { entityId: this.state.entityId, sfxEvent, abilityId, emitter, sequence: this.state.sequence } }));
  }

  private currentDirection(): MovementDirection | null {
    if (this.held.has("move-forward")) return "forward";
    if (this.held.has("move-back")) return "back";
    if (this.held.has("strafe-left")) return "left";
    if (this.held.has("strafe-right")) return "right";
    return null;
  }

  private hasMovement() {
    return this.currentDirection() !== null;
  }

  private movementVector() {
    return {
      forward: Number(this.held.has("move-forward")) - Number(this.held.has("move-back")),
      right: Number(this.held.has("strafe-right")) - Number(this.held.has("strafe-left")),
    };
  }

  private updateMovementMode(force = false) {
    if (!force && ["dodge", "jump", "airborne"].includes(this.state.movementMode)) return;
    if (this.state.flags.flying) this.patch({ movementMode: "flight" });
    else if (this.state.flags.crouched) this.patch({ movementMode: "crouch" });
    else if (this.held.has("sprint") && this.hasMovement()) this.patch({ movementMode: "sprint", flags: { ...this.state.flags, sprinting: true } });
    else this.patch({ movementMode: this.hasMovement() ? "locomotion" : "idle", flags: { ...this.state.flags, sprinting: false } });
  }

  private patch(next: Partial<CharacterControllerState>) {
    this.state = { ...this.state, ...next, sequence: this.state.sequence + 1 };
    this.listeners.forEach((listener) => listener());
  }
}

export const characterController = new CharacterController();
