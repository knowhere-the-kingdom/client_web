import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const experience = await readFile(new URL("../src/system-theme/SystemThemeExperience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/system-theme/system-flow.css", import.meta.url), "utf8");

test("App mounts the System experience before authenticated client flow", () => {
  assert.match(app, /<SystemThemeExperience gateway=\{gateway\} onSessionReady=/);
  assert.doesNotMatch(app, /function KeyGate\(/);
  assert.doesNotMatch(app, /function LoginPanel\(/);
  assert.doesNotMatch(app, /void restore\(controller\.signal\)/);
});

test("the System handoff preserves the existing server-owned client flow", () => {
  assert.match(app, /setGateUnlocked\(true\); if \(source === "login"\)/);
  assert.match(app, /if \(signal\.aborted\) return; setGateUnlocked\(true\)/);
  assert.match(app, /await continueFromProjection\(projection\)/);
  assert.match(app, /stateFromSession\(projection\)/);
  assert.match(app, /gateway\.selectCharacter\(characterId, projection\.selection\.version\)/);
  assert.match(app, /gateway\.enterWorld\("garden"\)/);
  assert.match(app, /gateway\.getWorldBootstrap\(\)/);
  assert.match(experience, /void gateway\.prewarmGarden\(\)/);
  const acceptSession = experience.slice(experience.indexOf("async function acceptSession"), experience.indexOf("async function checkSession"));
  assert.doesNotMatch(acceptSession, /prewarmGarden/);
  assert.match(app, /attempt < 4/);
  assert.match(app, /if \(source === "login"\).*phase: "character-select"/s);
});

test("fresh login renders exactly four System Spirit positions before Garden entry", () => {
  assert.match(app, /Array\.from\(\{ length: 4 \}/);
  assert.match(app, /className="system-character-grid"/);
  assert.match(app, /New Character/);
  assert.match(app, /Empty Spirit position/);
  assert.match(app, /href="\/characters\/new"/);
});

test("unapproved System actions remain inert placeholders", () => {
  assert.match(experience, /disabled title="Recovery is not configured">Forgot Password/);
  assert.match(experience, /disabled title="Discord state and PKCE handshake is not configured">.*Login with Discord/);
  assert.match(experience, /disabled title="Registration is not configured">Register/);
  assert.match(experience, /QRCode\.toDataURL\("https:\/\/knowhere\.fyi"/);
  assert.match(experience, /href="https:\/\/knowhere\.fyi"/);
  assert.match(experience, /className="system-login-form"/);
  assert.doesNotMatch(experience, /gateway\.(register|recover|discord)/);
});

test("credentials and post-login failures stay client-safe", () => {
  assert.match(experience, /const data = new FormData\(form\); form\.reset\(\)/);
  assert.match(experience, /if \(!result\.ok\).*fail\(g, result\.code\)/s);
  assert.doesNotMatch(app, /message: result\.message/);
  assert.match(app, /message: safeGatewayMessage\(result\.code\)/);
  assert.match(experience, /loginForm\.current\?\.reset\(\)/);
});

test("logout requires a confirmed Gateway revocation before local reset", () => {
  assert.match(experience, /const result = await gateway\.logout\(\)/);
  assert.match(experience, /if \(!result\.ok\).*fail\(g, result\.code\).*return/s);
  assert.match(app, /if \(!result\.ok\).*gatewayFailure\(result/s);
});

test("Awareness placement is accepted only by the Designer receptacle", () => {
  assert.match(experience, /<InventorySlot[^>]+onPlace=\{insertKey\}/);
  assert.match(experience, /className="designer-slot system-designer__slot"/);
  assert.match(experience, /held \? <div className="system-designer"/);
  assert.match(experience, /className=\{`inventory-cursor-item system-key-cursor/);
  assert.match(experience, /window\.addEventListener\("pointermove", followPointer\)/);
  assert.match(experience, /showTooltip=\{flow\.stage !== "splash"\}/);
  assert.doesNotMatch(experience, /system-tooltip/);
  assert.doesNotMatch(experience, /quality-backdrop/);
  assert.doesNotMatch(experience, /system-splash"[^>]+onDrop=/);
});

test("Awareness discovery is a distinct first click before cursor pickup", () => {
  const firstClick = experience.slice(experience.indexOf("onPickUp={(_, pointer) => {"), experience.indexOf("onCancel={cancelMovement}", experience.indexOf("onPickUp={(_, pointer) => {")));
  assert.match(firstClick, /if \(flow\.stage === "splash"\)/);
  assert.match(firstClick, /dispatch\(\{ type: "identify" \}\);\s*return;/);
  assert.match(firstClick, /setMovement\(pickUpInventoryItem\(AWARENESS_INSTANCE\)\)/);
  assert.match(firstClick, /dispatch\(\{ type: "hold-key" \}\)/);
  assert.ok(firstClick.indexOf("return;") < firstClick.indexOf("pickUpInventoryItem"), "unknown discovery must return before pickup");
});

test("Awareness visibly travels into and out of the cursor inventory", () => {
  assert.match(experience, /kind: "pickup"/);
  assert.match(experience, /kind: "place"/);
  assert.match(experience, /transfer\.to\.x - transfer\.from\.x/);
  assert.match(experience, /window\.setTimeout\(finishInsertKey, 220\)/);
  assert.match(css, /@keyframes system-item-pickup-transfer/);
  assert.match(css, /@keyframes system-item-place-transfer/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("System login chrome uses rounded controls and an unframed QR", () => {
  assert.match(css, /\.system-panel\s*\{[^}]+border-radius: 1\.25rem/s);
  assert.match(css, /\.system-login-submit\s*\{[^}]+border-radius: 0\.75rem/s);
  assert.match(css, /\.system-login-secondary button\s*\{[^}]+border-radius: 0\.75rem/s);
  assert.match(css, /\.system-qr\s*\{[^}]+border: 0;[^}]+background: transparent/s);
  assert.match(css, /\.system-qr img\s*\{[^}]+border: 0;/s);
});
