import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/theme/system-theme.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../src/theme/system-theme.css", import.meta.url), "utf8");

const protectedQuality = [
  [0, "Scrap", "#4b4b4b"], [1, "Common", "#e8e8e8"], [2, "Uncommon", "#4ea85a"],
  [3, "Rare", "#3f7dde"], [4, "Epic", "#8d55cc"], [5, "Relic", "#c94848"],
  [6, "Mythic", "#db7b32"], [7, "Legendary", "#d2ad48"], [8, "Cosmic", "#48d7df"], [9, "Divine", "#f8ffff"],
];

test("preserves all protected quality names and colors", () => {
  for (const [level, name, color] of protectedQuality) {
    assert.match(source, new RegExp(`level: ${level}[^}]+name: "${name}"[^}]+color: "${color}"`));
    assert.match(css, new RegExp(`data-quality="${level}"[^}]+--quality-color: ${color}`));
    assert.match(source, new RegExp(`level: ${level}[^}]+borderPattern: "[^"]+"`));
    assert.match(css, new RegExp(`data-quality="${level}"[^}]+animation: quality-`));
    assert.match(css, new RegExp(`data-quality="${level}"[^}]+data-quality-state="reduced-motion"`));
  }
});

test("covers six protected presentation states plus reduced motion", () => {
  for (const state of ["static", "reveal", "hover-focus", "held", "disabled", "reduced-motion"]) {
    if (state === "static") assert.match(source, /QUALITY_STATES = \[.*static/s);
    else assert.match(css, new RegExp(`data-quality-state="${state}"`));
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(source, /aria-disabled.*state === "disabled"/);
});

test("keeps theme contracts presentation-only and Gateway-neutral", () => {
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(executable, /fetch\(|localStorage|sessionStorage|characterId|Gateway|database|password/i);
  for (const family of ["System", "Kingdom", "Revelation", "Angelic", "Demonic", "Hybrid", "Cosmic"]) assert.match(source, new RegExp(`^  ${family}:`, "m"));
});
