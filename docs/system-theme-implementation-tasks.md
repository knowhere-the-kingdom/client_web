# System Theme Implementation Tasks

Canonical design: [`system-theme-login-character-flow.md`](system-theme-login-character-flow.md)

Related celestial-occlusion and Gamer Settings text/chat requirements are
tracked as independent acceptance items in
[`current-ui-world-work-order.md`](current-ui-world-work-order.md). They are not
part of the System-theme implementation slice and must not be silently bundled
into it.

## 2026-07-31 concept-art fidelity follow-up

This is a presentation-only source slice on alpha base
`dfd42296b8102f29cfe7e2e0abee5f2befd1699e`. It does not publish an inventory
item, select a World, admit a character, activate Kingdom, or change an auth or
Gateway contract.

- [x] **Interfacer:** split the visual, renderer, and boundary-review lanes;
  preserve the dirty K-drive checkout and notify Ringmaster of the scope.
- [x] **Starving Artist:** measure the supplied composition and define one
  responsive `816 x 1006` passage artboard: Designer upper-left, Spirit
  upper-right, World centered, and Character centered below it.
- [x] **World preview:** replace the still World glyph with an item-local Babylon
  canvas using procedural cartoon Earth and space textures, a rapid
  point/explosion -> magma -> cooling -> mature lifecycle, an equatorial Sun
  orbit whose local light shades the planet, and a camera whose horizon is the
  planet equator.
- [x] Keep the World preview inert and non-authoritative: no Gateway, inventory,
  session, admission, gameplay-camera, fetch, storage, or private-service seam.
- [x] Classify Character presentation as a true `2 x 3` grid and draw internal
  thirds; keep Designer and Spirit `2 x 2`, and the World host `3 x 3`.
- [x] Run focused lifecycle/layout/authority tests (37/37), typecheck, build,
  diff-check, and a local browser load that remains at the expected Splash
  boundary without fixture-auth or DOM injection.
- [ ] Restore the pre-existing Staxel manifest length expectation so the full
  suite is green (108/109; `source/scene.gltf` is 106717 bytes while the stale
  expectation is 101349), then capture authenticated desktop and narrow passage
  evidence through the reviewed session flow.
- [ ] Obtain independent Bug Eater and physical Android/WebView evidence before
  any release-readiness claim.

### Existing alpha integration boundary

The System item and World projections are now part of the current alpha
service contract. This visual slice consumes those existing server-owned
projections and preserves the established explicit Wake Up action:

- [x] Fetch World discovery from the configured Gateway only and render its
  display name, description, availability, and current player count.
- [x] Keep the procedural World canvas presentation-local while the surrounding
  3x3 World item remains the explicit button into the existing Garden entry and
  bootstrap flow.
- [x] Preserve same-origin Gateway authentication, logout, character selection,
  world entry, and bootstrap behavior; do not add direct service or database
  access from the presentation component.
- [ ] Capture authenticated desktop, narrow viewport, and physical Android
  evidence against the exact integrated revision after publication.

## Client surfaces

- [ ] Build theme tokens and shared System frame/panel/input/button components.
- [ ] Add all ten quality backdrops without changing protected names/colors.
- [ ] Implement unknown-key identification, tooltip decode, Designer reveal,
  forgiving placement, and tube-close cancellation.
- [ ] Implement Login, Register, Forgot Password, progress/error, QR placeholder,
  Character Select, Create Character, and Garden-entry stages.
- [ ] Ensure System reload starts Splash and key removal logs out from every stage.
- [ ] Switch to Kingdom only after server-confirmed Garden admission/bootstrap.

## Service contracts

- [ ] Define Gateway-safe session-awareness, login, Discord, registration,
  recovery, logout, progress, and client-safe error envelopes.
- [ ] Require username/password/phone and allow optional email for registration.
- [ ] Define the account Soul projection, all owned 2x3 character items, one
  empty 2x3 create affordance, the active 2x3 character receptacle, and the 3x3
  Garden world item without browser-owned authority.
- [ ] Define active-character disposition and Garden theme handoff.
- [ ] Freeze same-origin endpoint names, protocol versions, CSRF/session rules,
  correlation/idempotency, timeout/cancellation, CSP/origin, and generic failure
  envelopes. Reject browser-direct Keymaster/API/Game Server/DB/Tunnel/private
  origins, tokens, tickets, raw URLs, or client-supplied authority.
- [ ] Define username/phone/email normalization and uniqueness, password policy,
  phone/email verification, PII minimization/retention/redaction, rate limits,
  and non-enumerating account errors. Login does not silently require phone or
  email.
- [ ] Define Discord OAuth state/PKCE, Gateway callback, collision confirmation,
  unlink/revocation, and recovery without exposing provider tokens.
- [ ] Define recovery possession proof, one-time expiry/replay protection,
  session invalidation, generic responses, rate limits, and audit semantics.
- [ ] Define remember-me preference, TTL/max lifetime, device/session binding,
  revocation/logout, and cross-device behavior with no browser-stored authority.
- [ ] Keep the QR placeholder inert: no encoded credential, scanner route,
  external image URL, or reuse of the concept-art QR.
- [ ] Freeze a finite versioned client-safe error set without account/character
  enumeration, raw exceptions, SQL, stacks, private URLs, or topology details.
- [ ] Make logout/key removal idempotent with request-abort order, correlation,
  session-revocation timing, stale-response rejection, and reload-race rules.
- [ ] Version session, PII-safe profile, Spirit/character ownership, active
  character, disposition, and Garden admission/bootstrap projections.
- [ ] Make progress monotonic and correlated; reject stale/out-of-order updates.

## Verification and delivery

- [ ] Add state-transition, stale-response, cancellation, key-removal, safe-error,
  accessibility, reduced-motion, and responsive tests.
- [ ] Validate mouse, keyboard, touch, and physical Android/WebView flows.
- [ ] Preserve concept-art hashes and prototype-source provenance.
- [ ] Produce a clean integrated candidate; Server Guy reviews current main,
  rollback, database/service configuration, push, deploy, and live observation.
