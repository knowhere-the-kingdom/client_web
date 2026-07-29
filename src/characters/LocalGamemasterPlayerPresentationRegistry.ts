export type LocalGamemasterPlayerPresenceSnapshot = Readonly<{
  schemaVersion: 1;
  sequence: number;
  worldId: string;
  players: readonly LocalGamemasterPlayerPresence[];
}>;

export type LocalGamemasterPlayerPresence =
  | Readonly<{
      lifecycle: "admitted";
      presenceId: string;
      characterId: string;
      admissionId: string;
    }>
  | Readonly<{
      lifecycle: "left";
      presenceId: string;
      characterId: string | null;
      admissionId: string | null;
    }>;

export type AdmittedPlayerVisual = Readonly<{
  dispose: () => void;
}>;

export type AdmittedPlayerVisualFactory = (
  presence: Extract<LocalGamemasterPlayerPresence, { lifecycle: "admitted" }>,
) => AdmittedPlayerVisual;

export type LocalGamemasterPlayerPresentationRegistry = Readonly<{
  apply: (snapshot: unknown) => PlayerPresentationRegistryResult;
  dispose: () => void;
  activePresenceIds: () => readonly string[];
}>;

export type PlayerPresentationRegistryResult = Readonly<{
  applied: boolean;
  reason: "applied" | "stale-or-replayed" | "snapshot-invalid" | "visual-spawn-failed";
  activePresenceIds: readonly string[];
}>;

type ActiveVisual = Readonly<{
  characterId: string;
  admissionId: string;
  visual: AdmittedPlayerVisual;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function admittedPresence(value: unknown): Extract<LocalGamemasterPlayerPresence, { lifecycle: "admitted" }> | null {
  if (!isRecord(value) || value.lifecycle !== "admitted") return null;
  if (!nonEmpty(value.presenceId) || !nonEmpty(value.characterId) || !nonEmpty(value.admissionId)) return null;
  return Object.freeze({
    lifecycle: "admitted",
    presenceId: value.presenceId,
    characterId: value.characterId,
    admissionId: value.admissionId,
  });
}

function validLeftPresence(value: unknown): value is Readonly<{ lifecycle: "left"; presenceId: string }> {
  return isRecord(value) && value.lifecycle === "left" && nonEmpty(value.presenceId);
}

function admittedPlayers(snapshot: unknown): Map<string, Extract<LocalGamemasterPlayerPresence, { lifecycle: "admitted" }>> | null {
  if (!isRecord(snapshot) || snapshot.schemaVersion !== 1 || !nonEmpty(snapshot.worldId) || !Array.isArray(snapshot.players)) {
    return null;
  }

  const result = new Map<string, Extract<LocalGamemasterPlayerPresence, { lifecycle: "admitted" }>>();
  const seenPresenceIds = new Set<string>();
  for (const player of snapshot.players) {
    const admitted = admittedPresence(player);
    const presenceId = admitted?.presenceId ?? (validLeftPresence(player) ? player.presenceId : null);
    if (!presenceId || seenPresenceIds.has(presenceId)) return null;
    seenPresenceIds.add(presenceId);
    if (admitted) result.set(admitted.presenceId, admitted);
  }
  return result;
}

/**
 * Maintains local Staxel visual instances from already-authoritative local
 * Gamemaster presence snapshots. It deliberately has no browser identity,
 * storage, DOM, transport, input, or gameplay-authority dependency.
 */
export function createLocalGamemasterPlayerPresentationRegistry(
  createVisual: AdmittedPlayerVisualFactory,
): LocalGamemasterPlayerPresentationRegistry {
  let latestSequence = 0;
  const active = new Map<string, ActiveVisual>();

  const activePresenceIds = (): readonly string[] => Object.freeze([...active.keys()].sort());
  const result = (applied: boolean, reason: PlayerPresentationRegistryResult["reason"]): PlayerPresentationRegistryResult => Object.freeze({
    applied,
    reason,
    activePresenceIds: activePresenceIds(),
  });
  const disposeAll = () => {
    for (const entry of active.values()) entry.visual.dispose();
    active.clear();
  };

  return Object.freeze({
    apply(snapshot) {
      const sequence = isRecord(snapshot) && validSequence(snapshot.sequence) ? snapshot.sequence : null;
      if (sequence !== null && sequence <= latestSequence) return result(false, "stale-or-replayed");

      const admitted = admittedPlayers(snapshot);
      if (sequence === null || admitted === null) {
        if (sequence !== null) latestSequence = sequence;
        disposeAll();
        return result(false, "snapshot-invalid");
      }

      latestSequence = sequence;
      for (const [presenceId, current] of active) {
        const next = admitted.get(presenceId);
        if (!next || next.characterId !== current.characterId || next.admissionId !== current.admissionId) {
          current.visual.dispose();
          active.delete(presenceId);
        }
      }

      try {
        for (const [presenceId, player] of admitted) {
          if (!active.has(presenceId)) {
            active.set(presenceId, Object.freeze({
              characterId: player.characterId,
              admissionId: player.admissionId,
              visual: createVisual(player),
            }));
          }
        }
      } catch {
        disposeAll();
        return result(false, "visual-spawn-failed");
      }

      return result(true, "applied");
    },
    dispose() {
      disposeAll();
    },
    activePresenceIds,
  });
}
