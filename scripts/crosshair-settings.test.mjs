import test from "node:test";
import assert from "node:assert/strict";
import { readCrosshairSettings } from "../src/hud/crosshairSettings.ts";

function storage(value) {
  return { getItem: () => value };
}

test("crosshair settings read the exact character preference document", () => {
  const settings = readCrosshairSettings(storage(JSON.stringify({
    version: 1,
    gameplay: {
      crosshairEnabled: false,
      crosshairPreset: "circle",
      crosshairSize: 64,
      crosshairLineWidth: 5,
      crosshairGap: 9,
      crosshairOpacity: 52,
      crosshairColor: "#ff00aa",
      crosshairOutline: false,
      crosshairOutlineColor: "#112233",
      crosshairOutlineWidth: 3,
      crosshairOutlineOpacity: 45,
      centerDot: false,
      crosshairCenterDotSize: 7,
      crosshairCenterDotColor: "#abcdef",
    },
  })), "character-1");
  assert.deepEqual(settings, { enabled: false, preset: "circle", size: 64, lineWidth: 5, gap: 9, opacity: 52, color: "#ff00aa", outline: false, outlineColor: "#112233", outlineWidth: 3, outlineOpacity: 45, centerDot: false, centerDotSize: 7, centerDotColor: "#abcdef" });
});

test("crosshair settings fail closed to bounded visual defaults", () => {
  const settings = readCrosshairSettings(storage(JSON.stringify({
    version: 1,
    gameplay: { crosshairSize: 400, crosshairOpacity: -20, crosshairColor: "url(secret)" },
  })), "character-1");
  assert.equal(settings.size, 80);
  assert.equal(settings.opacity, 0);
  assert.equal(settings.color, "#70b9b2");
  assert.equal(settings.enabled, true);
});
