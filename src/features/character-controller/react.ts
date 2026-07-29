import { useSyncExternalStore } from "react";
import { characterController } from "./controller";

export function useCharacterControllerState() {
  return useSyncExternalStore(characterController.subscribe, characterController.getSnapshot, characterController.getSnapshot);
}
