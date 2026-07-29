# Knowhere Web Client Design

## Current deployment naming

The configured public browser origin is `https://knowhere.fyi`, served by the
Railway Web Client from `client_web`. The distinct browser-facing Gateway/Web
Server is `https://matrix.knowhere.fyi` from `server_gateway`. The client must
not call a local host, private tunnel, Keymaster, database, or other internal
service directly merely because a public hostname exists.

## First migration slice

This repository begins with a standalone browser shell extracted from the
legacy Next prototype's document layout and visual token direction. It is a
source-only boundary: no portal runtime, inventory runtime, rendering engine,
auth provider, API route, database schema, or external configuration is
copied here.

The eventual web client consumes versioned public contracts from Web,
Gatekeeper, Messenger, and Gamemaster services. It never connects directly to
PostgreSQL and never contains service secrets.

`docs/login-to-world-acceptance.md` is the source-backed deployment parity
matrix for the login, Character Select, explicit-resume, world-admission, HUD,
and local-3D milestones. It separates browser presentation from durable
session, character, and world authority.

## Gateway health contract

`src/api/gateway-client.ts` is the typed browser-side consumer for the
Gateway `GET /v1/health` contract. Its base URL comes from the non-secret
`<meta name="knowhere-gateway-url">` value, or the current browser origin if
that value is blank. The client validates the response shape and accepts an
`AbortSignal` per request.

The health result is local UI state only: idle, checking, healthy, unavailable,
or aborted. A failed/aborted request never retries by itself, alters browser
credentials, touches another service directly, or starts/stops/restarts any
backend process. The optional UI refresh button creates one new request only.

## Protected Gateway client seam

`src/api/gateway-contract.ts` and `src/api/gateway-client.ts` define the
fail-closed browser seam for the next migration stage. The browser sends every
protected request only to the configured Gateway origin, includes browser
credentials, a protocol version, and a correlation ID, and validates every
success response before exposing it to UI code. Mutations also carry a fresh
idempotency key. Network, protocol, authorization, and downstream failures are
returned as typed local error state; they never trigger a service restart or a
direct API, Gatekeeper, Game Master, or PostgreSQL request.

The authoritative browser contract is
`K:\nowhere\dev\backend\BROWSER_GATEWAY_AUTH_CONTRACT.md`. The client matches
its `1.0` protocol header, same-origin credential policy, correlation and
idempotency headers, success/error envelopes, session lifecycle, character
selection version, and local-Gamemaster admission transport. HTTPS reads the
contracted `__Host-knowhere_csrf` cookie; loopback development must publish its
separately approved cookie name through the non-secret
`knowhere-csrf-cookie` meta value. An unconfigured or absent CSRF token
fails before an authenticated mutation is sent.

The service routes remain unavailable until Gateway/API/Gatekeeper implements
the published contract. The UI must present that state and must not substitute
fixture authentication, localStorage identity, or browser-derived eligibility.

Gateway world discovery supplies the available catalog and default `worldId`;
the client never hardcodes either. The browser receives no tunnel transport or
one-time admission ticket; it requests the ticket-free world bootstrap from the
same-origin Gateway after approved world entry. Its response
must match the local game protocol, world, and selected character before
`src/session/client-flow.ts` can enter `world-ready`. Tickets and realtime
tokens remain in memory and are never browser-session credentials.

## Third-party character preview intake

The Staxel Voxel Female is a CC-BY-4.0 source asset retained with its license
and attribution under `public/third-party/staxel_voxel_female/`. The initial
slice is isolated to the `?preview=staxel-voxel-female` view and has no account,
inventory, player-control, or gameplay authority.

The immutable `intake-manifest.json`, typed client descriptor, and empty
preview-only controller binding in
`src/characters/staxelVoxelFemale.ts` describe client-preview identity and
source metadata. The manifest freezes source hashes, provenance, rig topology,
the non-character plane exclusion, and the unclassified clip evidence. Any
later character controller must consume approved semantic animation identifiers
rather than glTF node indexes or raw mesh names.

`src/characters/CharacterControllerPreview.ts` validates `_rootJoint`, all 14
skinned meshes against the 21-joint rig, the expected non-character plane, and
the preview clip `Take 001`, then exposes local visual state only. The isolated
preview hides that plane and frames the skinned character rather than treating
the source backdrop as part of the player model.

Live character presentation additionally consumes the fail-closed readiness
result defined in `docs/player-controller-world-ready-contract.md`. It can be
constructed only after a normalized server response confirms an authenticated
session, an active character, and world admission for that same character. The
client contract derives readiness but owns none of those facts and has no auth,
database, HUD-policy, network, command, or gameplay authority.
