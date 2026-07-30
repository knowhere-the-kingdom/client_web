import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("wide-screen HUD event logs move inward on the canonical grid", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const leftRule = [...styles.matchAll(/\.prototype-hud \.atlas-center-stage \.atlas-event-log-left \{([\s\S]*?)\n\}/g)]
    .map((match) => match[1])
    .find((rule) => rule.includes("safe-area-inset-left")) ?? "";
  const rightRule = [...styles.matchAll(/\.prototype-hud \.atlas-center-stage \.atlas-event-log-right \{([\s\S]*?)\n\}/g)]
    .map((match) => match[1])
    .find((rule) => rule.includes("safe-area-inset-right")) ?? "";

  for (const rule of [leftRule, rightRule]) {
    assert.match(rule, /calc\(var\(--knowhere-grid-unit\) \* 20\)/);
    assert.match(rule, /calc\(var\(--knowhere-grid-unit\) \* 6\)/);
    assert.match(rule, /calc\(50vw - 20rem\)/);
  }
  assert.match(leftRule, /env\(safe-area-inset-left\)/);
  assert.match(rightRule, /env\(safe-area-inset-right\)/);
});

test("small HUD viewports continue to suppress edge event logs", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /@media \(max-width: 52rem\)/);
  assert.match(styles, /\.atlas-event-log \{ display: none; \}/);
});
