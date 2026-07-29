import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { initialLoginFlowState, reduceLoginFlow } from "../src/login/login-flow.ts";
import { createUnavailableLoginGateway } from "../src/login/login-gateway.ts";

const selection = {
  version: 1,
  selectedCharacterId: null,
  characters: [{ id: "character-1", displayName: "Traveler", archetype: "Explorer", selectable: true }],
};

test("the key opens login and only a successful login opens character selection", () => {
  const login = reduceLoginFlow(initialLoginFlowState, { type: "key_placed" });
  assert.deepEqual(login, { stage: "login_ready", error: null });

  const submitting = reduceLoginFlow(login, { type: "login_submitted" });
  assert.deepEqual(submitting, { stage: "submitting" });

  const characters = reduceLoginFlow(submitting, { type: "login_succeeded", selection });
  assert.deepEqual(characters, { stage: "character_selection", selection });
});

test("login failure returns to the prompt without creating a session state", () => {
  const login = reduceLoginFlow(initialLoginFlowState, { type: "key_placed" });
  const submitting = reduceLoginFlow(login, { type: "login_submitted" });
  const failed = reduceLoginFlow(submitting, { type: "login_failed", message: "Unavailable" });
  assert.deepEqual(failed, { stage: "login_ready", error: "Unavailable" });
});

test("success cannot skip the key and login states", () => {
  assert.equal(reduceLoginFlow(initialLoginFlowState, { type: "login_succeeded", selection }), initialLoginFlowState);
});

test("the default Gateway seam fails closed", async () => {
  const gateway = createUnavailableLoginGateway();
  const result = await gateway.login({ identifier: "traveler", password: "not-stored" }, new AbortController().signal);
  assert.equal(result.ok, false);
  assert.match(result.message, /not available yet/i);
});

test("character selection exposes a placeholder creator with a back action", async () => {
  const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(appSource, /href="\/characters\/new"/);
  assert.match(appSource, />Create a new character<\/a>/);
  assert.match(appSource, />Back to characters<\/button>/);
  assert.match(appSource, /route === "\/characters\/new"/);
});
