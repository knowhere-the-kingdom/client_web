import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_TOUCH_TARGET_CSS_PX,
  observeMobileViewport,
  readMobileViewport,
} from "../src/mobile/mobile-viewport.ts";

function fakeViewport(overrides = {}) {
  const listeners = new Map();
  const visualListeners = new Map();
  const view = {
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: {
      width: 390,
      height: 500,
      scale: 1,
      addEventListener(type, listener) { visualListeners.set(type, listener); },
      removeEventListener(type, listener) {
        if (visualListeners.get(type) === listener) visualListeners.delete(type);
      },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    ...overrides,
  };
  return {
    view,
    emit(type) { (listeners.get(type) ?? visualListeners.get(type))?.(); },
    listenerCount() { return listeners.size + visualListeners.size; },
  };
}

test("reads visual viewport dimensions and detects IME occlusion", () => {
  const { view } = fakeViewport();
  assert.deepEqual(readMobileViewport(view), {
    layoutWidth: 390,
    layoutHeight: 844,
    visualWidth: 390,
    visualHeight: 500,
    scale: 1,
    orientation: "portrait",
    keyboardVisible: true,
  });
  assert.equal(MIN_TOUCH_TARGET_CSS_PX, 44);
});

test("falls back to layout viewport and reports landscape", () => {
  const { view } = fakeViewport({
    innerWidth: 844,
    innerHeight: 390,
    visualViewport: null,
  });
  assert.deepEqual(readMobileViewport(view), {
    layoutWidth: 844,
    layoutHeight: 390,
    visualWidth: 844,
    visualHeight: 390,
    scale: 1,
    orientation: "landscape",
    keyboardVisible: false,
  });
});

test("observes visual and window changes and cleans up every listener", () => {
  const { view, emit, listenerCount } = fakeViewport();
  const snapshots = [];
  const stop = observeMobileViewport(view, (snapshot) => snapshots.push(snapshot));
  assert.equal(snapshots.length, 1);
  emit("resize");
  assert.equal(snapshots.length, 2);
  stop();
  assert.equal(listenerCount(), 0);
});
