# Player Controller World-Ready Contract

## Authority boundary

The browser may create a player controller, HUD world-ready presentation, or
character visual only after one normalized snapshot contains all three facts:

1. Gatekeeper has confirmed an authenticated session with a non-empty opaque
   session ID.
2. Server authority has confirmed one active character with a non-empty ID.
3. Game Master has admitted that same character to a world and returned
   non-empty admission and world IDs.

`src/characters/playerPresentationContract.ts` is the client-local handoff
shape and derives a frozen `ready` or `inactive` result. The adapter that
validates the future Gatekeeper/Game Master response is the only allowed
publisher of its input. DOM state, HUD visibility, storage, query parameters,
and a loaded renderer are not authority. A mismatched active/admitted character
fails closed.

The HUD-facing replay contract uses `window` events. A runtime publisher emits
`knowhere:player-presentation-readiness-changed` with the complete frozen
`PlayerPresentationReadiness` as `CustomEvent.detail` and answers
`knowhere:player-presentation-readiness-request` by replaying the current
snapshot. These events expose derived presentation readiness only; they are not
commands and are never accepted as authority input.

The derived readiness snapshot is shared presentation data. HUD may display it
and the renderer may consume it, but neither may create session, character, or
admission facts. Revocation, logout, world exit, character change, disconnect,
or a higher-sequence inactive snapshot must dispose the local controller and
its animation mixer. The server remains authoritative for presence and motion
outcomes.

## Local multi-player presentation registry

`createLocalGamemasterPlayerPresentationRegistry` accepts only a normalized,
sequenced local Gamemaster player-presence snapshot. For each currently
admitted opaque presence ID, it holds at most one local visual instance. A
departed, replaced, invalid, or newer malformed snapshot disposes affected
instances; a replayed snapshot cannot resurrect or alter them. The caller owns
both transport/schema validation and the renderer-specific Staxel visual
factory.

The registry accepts no browser identity, DOM state, storage, query parameter,
network response, command, movement, or mutation input. Presence is authority
data supplied by the local Gamemaster; the registry only creates and disposes
client-local visuals.

## Staxel presentation boundary

`createAdmittedStaxelCharacterPresentation` is the sole live-player factory for
this candidate asset. It returns `activated:false` without loading controller
presentation when readiness is inactive. On readiness it creates only a local
Three.js animation presentation tied to the admitted character ID. It does not
authenticate, select a character, request admission, submit movement, update
HUD policy, persist state, or communicate with a database/service.

The retained raw glTF name `Take 001` remains preview-only. No idle, walking,
running, crouching, jumping, flying, released-control, or interaction state is
mapped until art review classifies and approves a clip. Controller consumers
use semantic animation IDs; raw clip/node/mesh identifiers stay inside the
asset descriptor, manifest, and visual adapter.

## Still required for real world attachment

- Versioned Gatekeeper/Game Master response schemas and a validating client
  bridge that produces `PlayerWorldAuthoritySnapshot`.
- A renderer-owned spawn/transform attachment point and disposal lifecycle.
- An approved character-model selection field or client presentation registry.
- Art approval for scale, facing, floor contact, materials, and animation
  semantics.

This contract authorizes no server implementation, auth/database work,
production build, deployment, routing, or GitHub release.
