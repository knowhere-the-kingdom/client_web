export const PLAYER_PRESENTATION_READINESS_CHANGED_EVENT = "knowhere:player-presentation-readiness-changed";
export const PLAYER_PRESENTATION_READINESS_REQUEST_EVENT = "knowhere:player-presentation-readiness-request";

export type PlayerWorldAuthoritySnapshot = Readonly<{
  schemaVersion: 1;
  sequence: number;
  session: Readonly<{
    lifecycle: "unknown" | "anonymous" | "authenticated" | "expired";
    sessionId: string | null;
  }>;
  activeCharacter: Readonly<{
    lifecycle: "unknown" | "none" | "active";
    characterId: string | null;
  }>;
  worldAdmission: Readonly<{
    lifecycle: "idle" | "pending" | "admitted" | "denied" | "ended";
    admissionId: string | null;
    worldId: string | null;
    characterId: string | null;
  }>;
}>;

export type PlayerPresentationReadiness =
  | Readonly<{
      schemaVersion: 1;
      sequence: number;
      lifecycle: "inactive";
      reason:
        | "authority-snapshot-invalid"
        | "session-unavailable"
        | "active-character-unavailable"
        | "world-not-admitted"
        | "admitted-character-mismatch";
      worldReady: false;
    }>
  | Readonly<{
      schemaVersion: 1;
      sequence: number;
      lifecycle: "ready";
      reason: null;
      worldReady: true;
      sessionId: string;
      characterId: string;
      worldId: string;
      admissionId: string;
    }>;

function present(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Derives client readiness from a normalized server-response snapshot. The
 * caller that validates Gatekeeper/Game Master responses owns construction of
 * the input; DOM state, HUD visibility, storage, and query parameters are not
 * valid inputs to this boundary.
 */
export function derivePlayerPresentationReadiness(
  authority: PlayerWorldAuthoritySnapshot,
): PlayerPresentationReadiness {
  const base = { schemaVersion: 1 as const, sequence: authority.sequence };

  if (authority.schemaVersion !== 1 || !Number.isSafeInteger(authority.sequence) || authority.sequence < 1) {
    return Object.freeze({ ...base, lifecycle: "inactive", reason: "authority-snapshot-invalid", worldReady: false });
  }

  if (authority.session.lifecycle !== "authenticated" || !present(authority.session.sessionId)) {
    return Object.freeze({ ...base, lifecycle: "inactive", reason: "session-unavailable", worldReady: false });
  }

  if (authority.activeCharacter.lifecycle !== "active" || !present(authority.activeCharacter.characterId)) {
    return Object.freeze({ ...base, lifecycle: "inactive", reason: "active-character-unavailable", worldReady: false });
  }

  const admission = authority.worldAdmission;
  if (
    admission.lifecycle !== "admitted" ||
    !present(admission.admissionId) ||
    !present(admission.worldId) ||
    !present(admission.characterId)
  ) {
    return Object.freeze({ ...base, lifecycle: "inactive", reason: "world-not-admitted", worldReady: false });
  }

  if (admission.characterId !== authority.activeCharacter.characterId) {
    return Object.freeze({ ...base, lifecycle: "inactive", reason: "admitted-character-mismatch", worldReady: false });
  }

  return Object.freeze({
    ...base,
    lifecycle: "ready",
    reason: null,
    worldReady: true,
    sessionId: authority.session.sessionId,
    characterId: authority.activeCharacter.characterId,
    worldId: admission.worldId,
    admissionId: admission.admissionId,
  });
}
