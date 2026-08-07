import assert from "node:assert/strict";
import test from "node:test";
import { initialSystemFlowState, reduceSystemFlow, safeSystemError } from "../src/system-theme/system-flow.ts";

const projection = {
  session: { authenticated: true, lifecycle: "active", expiresAt: "2099-01-01T00:00:00Z", authorizationRevision: 1, requiresExplicitResume: false },
  selection: { version: 3, selectedCharacterId: null, characters: [{ id: "c1", displayName: "A", archetype: "Spirit", selectable: true }], canEnterWorld: false, resumeStage: "character", reason: "character_required" },
};

test("reload begins splash and insertion is required before session awareness", () => {
  let state = initialSystemFlowState;
  state = reduceSystemFlow(state, { type: "session-ready", generation: 0, projection });
  assert.equal(state.stage, "splash");
  state = reduceSystemFlow(state, { type: "identify" });
  state = reduceSystemFlow(state, { type: "hold-key" });
  state = reduceSystemFlow(state, { type: "insert-key" });
  assert.equal(state.stage, "session-check");
});

test("key removal resets every System stage, is idempotent, and rejects late responses", () => {
  for (const stage of ["identified", "designer-ready", "session-check", "login", "registering", "recovering", "connecting", "character-select", "character-create", "garden-entry", "garden"]) {
    let state = { ...initialSystemFlowState, stage, generation: 8 };
    state = reduceSystemFlow(state, { type: "remove-key" });
    assert.equal(state.stage, "splash", stage);
    assert.equal(state.generation, 9, stage);
    assert.equal(reduceSystemFlow(state, { type: "remove-key" }), state, stage);
    assert.equal(reduceSystemFlow(state, { type: "session-ready", generation: 8, projection }), state, stage);
  }
});

test("progress is correlated and monotonic", () => {
  let state = { ...initialSystemFlowState, stage: "connecting", generation: 2 };
  state = reduceSystemFlow(state, { type: "progress", generation: 2, progress: { correlationId: "r1", sequence: 1, percent: 20, message: "Connecting to server" } });
  const accepted = state;
  state = reduceSystemFlow(state, { type: "progress", generation: 2, progress: { correlationId: "r1", sequence: 2, percent: 10, message: "Message received" } });
  assert.equal(state, accepted);
  state = reduceSystemFlow(state, { type: "progress", generation: 2, progress: { correlationId: "r2", sequence: 3, percent: 80, message: "Message received" } });
  assert.equal(state, accepted);
});

test("unknown and private failures collapse to a finite safe error", () => {
  assert.equal(safeSystemError("invalid_credentials"), "credentials-denied");
  assert.equal(safeSystemError("SQL connection refused at private.internal"), "service-unavailable");
});
