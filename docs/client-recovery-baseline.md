# Client recovery baseline

## Compared sources

- Canonical migration client: `K:\nowhere\dev\frontend\client_web`
- Prior playable reference: `R:\dev\Knowhere`

The canonical client currently provides a small Vite/React shell, Gateway health
configuration, an in-progress login-to-world state machine, and isolated
character-asset preview work. Its shared `App.tsx`, stylesheet, package files,
Gateway client, session flow, and character preview files already contain
concurrent changes and are not owned by this recovery slice.

The prior playable reference contains 68 files under `app/src`, including a
Babylon scene, character controller, HUD, inventory, action bar, chat, map,
settings, dashboard/admin, and world-authoring surfaces. It is a reference, not
a source of authority: it used local API and browser-owned demo state that must
not cross the current Gateway-only browser boundary.

## Ownership and slice order

1. Creator: login and public authentication presentation.
2. Administrator: `Dashboard`, `AdminDashboard`, and `dashboard/**`.
3. Interfacer: non-dashboard shell/navigation, character selection, mediated
   world bootstrap, renderer/HUD, inventory, messaging, and client configuration.

Interfacer recovery slices:

1. Pure inventory layout/state rules with durable tests.
2. Ticket-free admitted-world bootstrap projection and validation.
3. Renderer lifecycle shell driven only by validated bootstrap data.
4. HUD, inventory, map, action-bar, and messaging presentation.
5. Shared application integration after Creator and Administrator reconcile the
   shell entry point and stylesheet ownership.

## Safety blockers

- The current dirty Gateway contract still contains legacy browser-visible
  admission tickets, local Gamemaster URLs, and realtime tokens. Recovery must
  use the approved ticket-free Gateway bootstrap contract instead.
- Credentialed login/session and world-entry routes remain operationally gated;
  UI may fail closed but must not claim readiness.
- The legacy Babylon renderer and large stylesheet need dependency, asset,
  lifecycle, and responsive-layout review before they can be mounted.
- No client code may use private API/Keymaster paths, `sessionRef`, private
  identity headers, Tunnel/local URLs, or raw downstream bodies.
