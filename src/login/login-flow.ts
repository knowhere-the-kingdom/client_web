export type CharacterSummary = {
  id: string;
  displayName: string;
  archetype: string;
  selectable: boolean;
};

export type CharacterSelectionProjection = {
  version: number;
  selectedCharacterId: string | null;
  characters: CharacterSummary[];
};

export type LoginFlowState =
  | { stage: "key_ready" }
  | { stage: "login_ready"; error: string | null }
  | { stage: "submitting" }
  | { stage: "character_selection"; selection: CharacterSelectionProjection };

export type LoginFlowEvent =
  | { type: "key_placed" }
  | { type: "login_submitted" }
  | { type: "login_failed"; message: string }
  | { type: "login_succeeded"; selection: CharacterSelectionProjection };

export const initialLoginFlowState: LoginFlowState = { stage: "key_ready" };

export function reduceLoginFlow(state: LoginFlowState, event: LoginFlowEvent): LoginFlowState {
  switch (event.type) {
    case "key_placed":
      return state.stage === "key_ready" ? { stage: "login_ready", error: null } : state;
    case "login_submitted":
      return state.stage === "login_ready" ? { stage: "submitting" } : state;
    case "login_failed":
      return state.stage === "submitting" ? { stage: "login_ready", error: event.message } : state;
    case "login_succeeded":
      return state.stage === "submitting"
        ? { stage: "character_selection", selection: event.selection }
        : state;
  }
}
