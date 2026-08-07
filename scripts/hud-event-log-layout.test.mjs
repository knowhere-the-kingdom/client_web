import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("../src/styles.css", import.meta.url);

test("wide-screen HUD event logs use a ten-cell target without crossing the reticle corridor", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const finalGeometry = styles.slice(styles.lastIndexOf("/* Final HUD anchors."));

  assert.match(finalGeometry, /--hud-event-log-inset: clamp\(/);
  assert.match(finalGeometry, /calc\(var\(--knowhere-grid-unit\) \* 10\)/);
  assert.match(finalGeometry, /calc\(var\(--knowhere-grid-unit\) \* 4\)/);
  assert.match(finalGeometry, /calc\(50vw - var\(--hud-reticle-corridor-half\) - var\(--hud-event-log-width\)\)/);
  assert.match(finalGeometry, /atlas-event-log-left[\s\S]*left: max\(env\(safe-area-inset-left\), var\(--hud-event-log-inset\)\)/);
  assert.match(finalGeometry, /atlas-event-log-right[\s\S]*right: max\(env\(safe-area-inset-right\), var\(--hud-event-log-inset\)\)/);
});

test("compact HUD viewports suppress edge event logs before constraints collide", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const finalGeometry = styles.slice(styles.lastIndexOf("/* Final HUD anchors."));

  assert.match(finalGeometry, /@media \(max-width: 68rem\)/);
  assert.match(finalGeometry, /atlas-center-stage > \.atlas-event-log-left,[\s\S]*atlas-center-stage > \.atlas-event-log-right \{ display: none; \}/);
});

test("top HUD utilities use independent fixed anchors", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const finalGeometry = styles.slice(styles.lastIndexOf("/* Final HUD anchors."));

  assert.match(styles, /prototype-hud__designer,[\s\S]*atlas-seated-awareness \{[\s\S]*position: fixed[\s\S]*left: max\(var\(--knowhere-grid-unit\), env\(safe-area-inset-left\)\)/);
  assert.match(styles, /prototype-hud__spirit \{[\s\S]*position: fixed[\s\S]*right: max\(var\(--knowhere-grid-unit\), env\(safe-area-inset-right\)\)/);
  assert.match(finalGeometry, /prototype-hud__top > \.atlas-compass,[\s\S]*position: fixed[\s\S]*left: 50%[\s\S]*translateX\(-50%\)/);
  assert.match(finalGeometry, /prototype-hud__top > \.atlas-compass \{[\s\S]*background: none[\s\S]*backdrop-filter: none/);
});

test("shared live and preview reticles override legacy nth-child corner geometry", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const finalGeometry = styles.slice(styles.lastIndexOf("/* Final HUD anchors."));

  assert.match(finalGeometry, /atlas-crosshair-reticle > i\[class\^="reticle-part-"\][\s\S]*inset: auto[\s\S]*border: 0/);
  assert.match(finalGeometry, /i\.reticle-part-top,[\s\S]*i\.reticle-part-bottom[\s\S]*left: 50%/);
  assert.match(finalGeometry, /i\.reticle-part-left,[\s\S]*i\.reticle-part-right[\s\S]*top: 50%/);
  assert.match(finalGeometry, /var\(--atlas-crosshair-size, 1\.42rem\) \/ 2/);
});
