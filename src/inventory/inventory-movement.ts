import type { InventoryItemInstanceV1 } from "./inventory-model";

export type InventoryMovementState = Readonly<{
  heldInstanceId: string | null;
}>;

export type InventoryPlacementResult =
  | Readonly<{ ok: true; state: InventoryMovementState; instance: InventoryItemInstanceV1 }>
  | Readonly<{ ok: false; code: "nothing_held" | "wrong_instance" | "slot_rejected" }>;

export const EMPTY_INVENTORY_MOVEMENT: InventoryMovementState = Object.freeze({ heldInstanceId: null });

export function pickUpInventoryItem(instance: InventoryItemInstanceV1): InventoryMovementState {
  return { heldInstanceId: instance.instanceId };
}

export function cancelInventoryMovement(): InventoryMovementState {
  return EMPTY_INVENTORY_MOVEMENT;
}

export function placeHeldInventoryItem(
  state: InventoryMovementState,
  instance: InventoryItemInstanceV1,
  slotAccepted: boolean,
): InventoryPlacementResult {
  if (!state.heldInstanceId) return { ok: false, code: "nothing_held" };
  if (state.heldInstanceId !== instance.instanceId) return { ok: false, code: "wrong_instance" };
  if (!slotAccepted) return { ok: false, code: "slot_rejected" };
  return { ok: true, state: EMPTY_INVENTORY_MOVEMENT, instance };
}
