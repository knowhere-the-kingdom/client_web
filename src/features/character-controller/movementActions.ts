import type { CharacterBindings, CharacterControllerState, MovementActionId, MovementActionReadModel, MovementActionSlotReadModel, SkillRuntimeContract } from "./types";

type MovementActionDefinition = Readonly<{
  id: MovementActionId;
  actionId: "sprint" | "dodge" | "jump" | "crouch" | "flight";
  label: MovementActionSlotReadModel["label"];
  icon: string;
}>;

const movementActions = [
  { id: "movement.sprint", actionId: "sprint", label: "Sprint", icon: "sprint" },
  { id: "movement.dodge", actionId: "dodge", label: "Dodge", icon: "target" },
  { id: "movement.jump", actionId: "jump", label: "Jump", icon: "orb" },
  { id: "movement.crouch", actionId: "crouch", label: "Crouch", icon: "person" },
  { id: "movement.flight", actionId: "flight", label: "Flight", icon: "flight" },
] as const satisfies readonly MovementActionDefinition[];

const defaultBindings: Readonly<Record<MovementActionDefinition["actionId"], string>> = {
  sprint: "Shift",
  dodge: "Double-tap WASD",
  jump: "Space",
  crouch: "Ctrl",
  flight: "Alt",
};

export function createMovementActionsReadModel(input: Readonly<{
  state: CharacterControllerState;
  skills: readonly SkillRuntimeContract[];
  bindings?: CharacterBindings;
  now?: number;
}>): MovementActionReadModel {
  const now = input.now ?? 0;
  const skillsBySlot = new Map(input.skills.map((skill) => [skill.slot, skill]));
  return {
    sectionLabel: "Movement Actions",
    actions: movementActions.map((action, index) => {
      const skill = skillsBySlot.get(action.id) ?? null;
      const binding = bindingLabel(action.actionId, input.bindings);
      const bound = binding !== "Unbound";
      const cooldownRemainingMs = skill ? Math.max(0, (input.state.timers.cooldowns[skill.id] ?? 0) - now) : 0;
      const chargeState = skill ? input.state.timers.charges[skill.id] ?? null : null;
      return {
        id: action.id,
        order: index,
        label: action.label,
        icon: action.icon,
        binding,
        bound,
        disabled: disabledReason(input.state, bound, action.id, skill) !== null,
        disabledReason: disabledReason(input.state, bound, action.id, skill),
        cooldown: skill && skill.cooldownMs > 0 ? { totalMs: skill.cooldownMs, remainingMs: cooldownRemainingMs } : null,
        charges: chargeState ? {
          current: chargeState.current,
          max: chargeState.max,
          nextRechargeRemainingMs: chargeState.nextRechargeAt === null ? null : Math.max(0, chargeState.nextRechargeAt - now),
        } : null,
        active: activeState(input.state, action.id),
        selected: activeState(input.state, action.id),
        skillId: skill?.id ?? null,
      };
    }),
  };
}

function bindingLabel(actionId: MovementActionDefinition["actionId"], bindings: CharacterBindings | undefined) {
  if (actionId === "dodge") return "Double-tap WASD";
  const configured = bindings?.find((binding) => binding.id === actionId);
  const values = [configured?.primary, configured?.secondary].filter((value): value is string => Boolean(value && value !== "Hardcoded"));
  return values.find((value) => value !== "Unbound") ?? defaultBindings[actionId];
}

function disabledReason(state: CharacterControllerState, bound: boolean, slot: MovementActionId, skill: SkillRuntimeContract | null) {
  if (state.lifecycle === "dead" || state.flags.dead) return "Character is dead.";
  if (state.flags.inputLocked) return "Input is locked.";
  if (!bound) return "No binding assigned.";
  if (skill?.requiredStates.length && !skill.requiredStates.includes(state.lifecycle) && !skill.requiredStates.includes(state.movementMode)) return "Required state is not active.";
  if (skill?.blockedStates.includes(state.lifecycle) || skill?.blockedStates.includes(state.movementMode)) return "Current state blocks this action.";
  if (slot === "movement.sprint" && (state.flags.crouched || state.flags.flying)) return state.flags.crouched ? "Cannot sprint while crouched." : "Cannot sprint while flying.";
  if (slot === "movement.dodge" && (state.flags.crouched || state.flags.flying || state.movementMode === "dodge")) return state.movementMode === "dodge" ? "Dodge is already active." : state.flags.crouched ? "Cannot dodge while crouched." : "Cannot dodge while flying.";
  if (slot === "movement.jump" && state.flags.flying) return "Cannot jump while flying.";
  return null;
}

function activeState(state: CharacterControllerState, slot: MovementActionId) {
  if (slot === "movement.sprint") return state.movementMode === "sprint" || state.flags.sprinting;
  if (slot === "movement.dodge") return state.movementMode === "dodge";
  if (slot === "movement.jump") return state.movementMode === "jump" || state.movementMode === "airborne";
  if (slot === "movement.crouch") return state.flags.crouched;
  return state.flags.flying;
}
