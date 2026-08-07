# Mobile Gateway Login-to-World Acceptance

**Status:** Planning criteria for development acceptance. The current Web
Client implements only Gateway health discovery; these criteria do not claim
that login, character selection, admission, HUD, or local-world integration is
implemented. They authorize no production or server operation.

## Scope and authority

This plan covers the phone/tablet path:

```text
Launch -> Gateway availability -> Login -> Character Select
       -> World admission -> HUD + local world
```

The client owns presentation, accessibility, transient request state, and local
renderer lifecycle. It does not authenticate accounts, infer cookie validity,
select a durable character, issue admission tickets, or admit a player.

- Every browser HTTP request uses the configured Gateway origin. The client
  never calls API, Gatekeeper, PostgreSQL, Messenger, or Game Master directly.
- Gateway/API responses must use the approved protocol version, correlation ID,
  stable result/error code, bounded timeout, and retry classification.
- Session credentials are opaque and protected from client JavaScript. There is
  no token/local-storage/profile fallback.
- HUD and world rendering start only after a current admitted-world response.
  Cached UI state, a selected card, or a renderer-ready event is not admission.
- A client crash, reload, network loss, or renderer failure affects only that
  client. It never starts, stops, restarts, or reconfigures a service.

## Required test viewports

Run each critical path at normal scale with browser text scaling at 100% and
200% where supported.

| Class | Required viewport | Orientation |
| --- | --- | --- |
| Narrow Android phone | `360 x 800` | Portrait |
| Reference Android phone | `384 x 832` | Portrait |
| Phone landscape | `844 x 390` | Landscape |
| Small tablet | `768 x 1024` | Portrait |
| Tablet landscape | `1024 x 768` | Landscape |

At every stage, the document must not exceed the visual viewport, fixed UI must
honor safe-area insets and the on-screen keyboard, and primary controls must
retain at least a `44 x 44` CSS-pixel hit region. Orientation or visual-viewport
changes cancel active gestures and preserve the last server-confirmed stage.

## Acceptance state matrix

| ID | State | Mobile acceptance | Authority/evidence |
| --- | --- | --- | --- |
| M-GW-01 | Initial launch | A bounded loading state appears without exposing credentials or stale identity. Login controls are not enabled until the client knows whether a current session exists. | Network trace contains Gateway-origin requests only. |
| M-GW-02 | Gateway/API unavailable | Static shell remains usable and shows one concise offline/service-unavailable state with an explicit retry. It does not spin indefinitely, auto-retry mutations, or contact a private service. | Stable `502`, `503`, or `504` mapping and correlation ID are displayed/logged safely. |
| M-AUTH-01 | Anonymous | Full-screen Login is immediately readable, keyboard reachable, scroll-safe, and has one clear submit path. Character Select, world entry, HUD, and canvas remain absent. | Fresh `GET /v1/session` reports anonymous/unauthorized through Gateway. |
| M-AUTH-02 | Login pending | Submit becomes single-flight, progress is announced, password remains masked, and layout stays stable when the keyboard opens/closes. Repeated taps create no duplicate login mutation. | One Gateway request with protocol/correlation/idempotency data as required by the final relay contract. |
| M-AUTH-03 | Login success | The client advances only after a valid authenticated session snapshot. It renders the returned alias/status/eligibility without inferring roles or eligibility locally. | Server snapshot satisfies `authenticated`, active account status, and current session lifecycle. |
| M-AUTH-04 | Login denied | Invalid credentials, pending/rejected/suspended account, rate limit, malformed response, and protocol mismatch produce safe, distinct actionable states without account discovery or authenticated client state. | Stable error category; no session/character/HUD DOM and no credential stored by client code. |
| M-CHAR-01 | Character required | Character Select fills the usable viewport. Cards/grid remain readable, scroll internally when needed, and expose text state in addition to color. World entry is disabled when no active character exists. | `resumeStage: "character"`, null active character, or `canEnterWorld: false`. |
| M-CHAR-02 | Selection pending | One tap starts one versioned selection mutation, marks the selected card busy, disables duplicate submission, and preserves a reachable cancel/back affordance only if the contract supports it. | Gateway correlation ID plus idempotency/version fields; no optimistic durable selection. |
| M-CHAR-03 | Selection success/conflict | Success renders exactly one server-confirmed active character. A conflict or ambiguous timeout reloads the authoritative character snapshot instead of assuming success. | Returned durable snapshot/version is newer or equal to the submitted base version. |
| M-WORLD-01 | Admission staging | Enter World is a dedicated full-screen step showing the confirmed character/world. One activation creates one admission request; Character Select remains recoverable on denial. | Gatekeeper rechecks account, lifecycle, character ownership, authorization revision, and world eligibility. |
| M-WORLD-02 | Admission failure | Expired/used ticket, unavailable local Game Master, timeout, revocation, or protocol failure leaves HUD/canvas unmounted and offers bounded retry or return to Character Select. | No `is-game-world` equivalent until a valid admitted-world bootstrap exists. |
| M-HUD-01 | Admitted world | HUD and canvas mount once, use the admitted character/world identity, avoid safe areas and touch controls, and expose a clear loading/error boundary for renderer startup. | Current admitted-world response precedes renderer/HUD initialization. |
| M-HUD-02 | Runtime loss | Local renderer/input failure shows a client-local recovery surface. It does not log out, mutate selection, or restart services unless a fresh session/admission response requires a stage change. | Service health remains independent; client reports sanitized correlation/error context. |

## Cookie and authentication failure criteria

1. The final Gateway relay must send and receive the session cookie according to
   the approved same-origin/CORS design. Credentialed requests use the browser's
   cookie mechanism; JavaScript never reads the cookie value.
2. Verify the session cookie's `HttpOnly`, `Secure` where HTTPS applies,
   approved `SameSite`, path, expiry, and rotation/revocation behavior from HTTP
   evidence. The cookie/CSRF policy is currently undecided, so production
   acceptance is blocked until that contract is approved.
3. With cookies disabled, rejected, cleared, expired, or omitted, relaunch must
   resolve to Anonymous after the server response. Cached alias, selected
   character, or prior HUD state must not override that result.
4. A `401`/`403` during Character Select or admission immediately removes
   protected presentation after the fresh session check. A `429` preserves the
   current safe stage and announces retry timing without automatic resubmission.
5. Invalid JSON, wrong content type/service identity, unsupported protocol
   major, missing correlation ID, or an unexpected success shape fails closed.
6. Passwords, cookies, tickets, session IDs, account IDs, and raw server errors
   never appear in DOM diagnostics, console output, analytics, screenshots, or
   persistent client storage.

## Crash, reload, and relaunch recovery

| Interruption point | Required relaunch result |
| --- | --- |
| Before/during login | Return to Login. Do not persist the password or replay an uncertain login mutation automatically. Query current session once; if login actually succeeded, use the returned session snapshot. |
| After login, before Character Select settles | Query session and authoritative character data through Gateway. Render Character Select or the confirmed next stage; never trust pre-crash React/DOM state. |
| During character selection | Treat the mutation as unknown. Re-read the authoritative snapshot using its version/correlation evidence. Do not issue a second mutation merely because the response was lost. |
| After selection, before admission | Re-read session/eligibility and selection, then request a new ticket. Do not persist or reuse a possibly issued admission ticket. |
| During admission | A ticket remains short-lived and single-use. Relaunch obtains fresh session/eligibility and requests fresh admission; it never assumes membership from a cached loading screen. |
| In HUD/local world | Recreate only local renderer/input state. Query session first, then follow `resumeStage`; request fresh admission before remounting HUD. Expired sessions return to Login. |
| Idle-exited session | Preserve authentication but show an explicit Resume action. No automatic world entry occurs until `POST /v1/session/resume` succeeds and current eligibility is returned. |
| Offline relaunch | Show one offline/retry screen. Do not show cached Character Select or HUD as authoritative, and do not loop requests while backgrounded. |

Crash tests must cover tab/process termination, refresh, Android WebView process
death or OS task removal where applicable, background/foreground during each
mutation, and renderer-context loss. After every case, verify no duplicate
session family, character selection, admission request, HUD, canvas, or event
listener is present.

## Accessibility and interaction evidence

- Login fields have persistent labels, correct input purpose/autocomplete, error
  association, and predictable focus after failure or mode change.
- Status changes use a polite live region; blocking authentication/admission
  errors move focus to a concise summary without trapping it.
- Character cards expose selected, unavailable, pending, and conflict states by
  text/semantics as well as color. The active character is not represented only
  by drag/drop.
- Keyboard, switch-access, and touch users can complete every stage. Touch
  gestures do not steal page scrolling or camera-look regions.
- HUD actions preserve `44 x 44` hit regions even when visual chrome is scaled
  down, and do not overlap safe areas, the Spirit slot, or system gestures.
- At 200% text, all critical controls remain reachable without horizontal page
  scrolling or clipped dialog content.

## Required test evidence

For each acceptance run, retain:

- viewport, orientation, user-agent/WebView version, and normal zoom/text scale;
- sanitized request timeline showing Gateway as the only HTTP authority;
- response status, stable result/error code, protocol version, and correlation
  ID without credentials or private identifiers;
- screenshots of Login, Character Select, Enter World, HUD, offline, expired,
  and crash-recovery states;
- DOM counts proving one active stage, one pending mutation, one HUD, and one
  canvas where applicable;
- document/visual-viewport dimensions, safe-area offsets, and target sizes;
- console log review and server-independent crash/relaunch observations.

## Current implementation blockers

These criteria are not yet executable end to end:

1. `client_web` currently consumes only Gateway `GET /v1/health` and contains no
   login, session, character, world-admission, HUD, or renderer integration.
2. Gateway currently exposes health/readiness/version only; no approved browser
   relay routes exist.
3. API session/accounts/worlds families deliberately return
   `503 downstream_unconfigured`.
4. Gatekeeper login/session endpoints deliberately return versioned `503`; the
   cookie/CSRF policy and complete eligibility response schema are not final.
5. A versioned character-list/select response and conflict/idempotency contract
   is not yet published at the Gateway/API boundary.
6. Local Game Master reports `readyForWorldConnections: false`; admission and
   client bootstrap/transport contracts are not implemented.

Until those seams land, Mobile may validate only the existing shell's responsive
layout and Gateway-health failure presentation. Passing those checks must not be
reported as login-to-world parity.
