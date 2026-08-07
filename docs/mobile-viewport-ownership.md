# Mobile viewport and input portability slice

This slice ports the legacy Android shell's safe viewport/IME/orientation
observation into a browser-only, projection-free utility:
`src/mobile/mobile-viewport.ts`.

It reads the layout and visual viewport, reports portrait/landscape state,
detects likely IME occlusion, emits changes for window and visual-viewport
resize/scroll, and guarantees listener cleanup. It exposes the 44 CSS-pixel
minimum touch-target constant from the mobile acceptance criteria. It does not
render controls, mutate Gateway/session state, issue commands, open a local
Gamemaster connection, or infer safe-area values from server data.

Ownership is intentionally separate from Interfacer's shared `App.tsx`,
`package.json`, and `styles.css` mount work and Puppetmaster's renderer lifecycle
and input-intent adapters. A future presentation owner may consume snapshots to
apply CSS safe-area/IME layout and cancel active gestures on orientation change;
this slice itself has no UI integration.
