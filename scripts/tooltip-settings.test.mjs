import assert from "node:assert/strict";
import test from "node:test";

import {
  TOOLTIP_PLACEMENTS,
  defaultTooltipSettings,
  readTooltipSettings,
  saveTooltipSettings,
} from "../src/hud/tooltipSettings.ts";

function storage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    value: () => value,
  };
}

test("tooltip placement defaults to the right and accepts every bounded preference", () => {
  assert.equal(defaultTooltipSettings.placement, "right");
  for (const placement of TOOLTIP_PLACEMENTS) {
    const target = storage();
    saveTooltipSettings(target, placement);
    assert.equal(readTooltipSettings(target).placement, placement);
  }
});

test("tooltip settings reject malformed and unrecognized stored values", () => {
  assert.deepEqual(readTooltipSettings(storage("{")), defaultTooltipSettings);
  assert.deepEqual(readTooltipSettings(storage(JSON.stringify({ version: 1, placement: "screen-edge" }))), defaultTooltipSettings);
  assert.deepEqual(readTooltipSettings(storage(JSON.stringify({ version: 2, placement: "left" }))), defaultTooltipSettings);
});
