import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "s"))?.[1] ?? "";
}

test("Wake Up passage scales the measured 816 by 1006 concept-art composition", () => {
  const stage = rule(".system-character-stage");
  const layout = rule(".system-passage-layout");

  assert.match(stage, /--system-passage-width:\s*min\(51rem,[^;]+81\.1dvh[^;]+\);/s);
  assert.match(layout, /width:\s*var\(--system-passage-width\);/);
  assert.match(layout, /aspect-ratio:\s*816\s*\/\s*1006;/);
  assert.match(layout, /position:\s*relative;/);
  assert.match(rule(".system-character-composition"), /display:\s*contents;/);
});

test("Designer, Spirit, World, and Character use measured artboard anchors", () => {
  assert.match(styles, /\.system-passage-slot--designer\s*\{\s*top:\s*0;[\s\S]*?left:\s*0;[\s\S]*?width:\s*16\.42%;[\s\S]*?height:\s*12\.92%;/);
  assert.match(styles, /\.system-passage-slot--spirit\s*\{\s*top:\s*0;[\s\S]*?right:\s*0;[\s\S]*?width:\s*16\.18%;[\s\S]*?height:\s*12\.92%;/);
  assert.match(styles, /\.system-passage-slot--world\s*\{\s*top:\s*21\.27%;[\s\S]*?left:\s*21\.94%;[\s\S]*?width:\s*56\.25%;[\s\S]*?height:\s*42\.64%;/);
  assert.match(styles, /\.system-passage-slot--character\s*\{\s*top:\s*65\.81%;[\s\S]*?left:\s*36\.03%;[\s\S]*?width:\s*27\.94%;[\s\S]*?height:\s*34\.19%;/);
  assert.doesNotMatch(styles, /\.system-passage-slot--(?:designer|spirit|world|character)\s*\{[^}]*position:\s*fixed/s);
  assert.match(rule(".system-passage-slot--designer > .atlas-seated-awareness"), /position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*transform:\s*none;/);
});

test("semantic footprints draw every internal grid division", () => {
  const overlay = rule(".system-grid-slot::before");

  assert.match(rule(".system-grid-slot--2x2"), /--system-grid-columns:\s*2;[\s\S]*--system-grid-rows:\s*2;/);
  assert.match(rule(".system-grid-slot--2x3"), /--system-grid-columns:\s*2;[\s\S]*--system-grid-rows:\s*3;/);
  assert.match(rule(".system-grid-slot--3x3"), /--system-grid-columns:\s*3;[\s\S]*--system-grid-rows:\s*3;/);
  assert.match(overlay, /100%\s*\/\s*var\(--system-grid-columns\)/);
  assert.match(overlay, /100%\s*\/\s*var\(--system-grid-rows\)/);
  assert.match(overlay, /pointer-events:\s*none;/);
  assert.match(styles, /\.system-passage-slot--designer \.prototype-designer-access__slot \.atlas-slot\s*\{[^}]+linear-gradient\(90deg,[^}]+linear-gradient\(transparent calc\(50%/s);
});

test("passage connectors scale with the artboard without intercepting input", () => {
  const connectors = rule(".system-passage-connectors");

  assert.match(connectors, /position:\s*absolute;/);
  assert.match(connectors, /inset:\s*0;/);
  assert.match(connectors, /width:\s*100%;[\s\S]*height:\s*100%;/);
  assert.match(connectors, /pointer-events:\s*none;/);
  assert.match(styles, /\.system-passage-connectors path,[\s\S]*?\.system-passage-connectors polyline\s*\{[^}]+vector-effect:\s*non-scaling-stroke;/);
});

test("the World presentation host stays inert while remaining keyboard inspectable", () => {
  assert.match(rule(".system-world-item"), /cursor:\s*default;/);
  assert.match(rule(".system-world-item:focus-visible"), /outline:\s*2px solid #56f2f6;/);
  assert.match(rule(".system-world-item canvas"), /pointer-events:\s*none;/);
  assert.doesNotMatch(styles, /\.system-world-item:hover/);
});
