# Login-to-World Parity Acceptance Matrix

**Status:** Planning and source-backed legacy parity record. This document does
not authorize implementation, deployment, a Railway change, or a production
route change.

## Boundary

The legacy reference is `R:\dev\prototypes\dev_prototype`. The Web Client owns
only browser presentation, local request state, accessibility, and input
dispatch. It never decides eligibility, creates a session, selects a durable
character, or admits a player to a world.

| Milestone | Portable client presentation | Required authority | Acceptance evidence |
| --- | --- | --- | --- |
| 1. Guest/login | Splash, login form, progress/error messages, dark portal scene | Gatekeeper validates credentials and issues/updates the session; Gateway/API forward only approved requests | Valid credentials establish one session; invalid, suspended, and rejected accounts display a safe error and create no authenticated client state. |
| 2. Session restore | Reload-safe loading screen and session-aware portal affordance | Gatekeeper returns current session/lifecycle; account profile service returns account, roles, eligibility, Spirit of Life, and last-world metadata | Refresh restores the same account state without inventing a character, eligibility, or world membership. Expired session returns to login. |
| 3. Character Select | Spirit of Life panel, inactive-character cards, selection pending/conflict/error UI, Character slot | Durable Spirit/character service applies versioned select/deselect transaction and returns authoritative snapshot | No active character: Character Select remains visible and world entry is unavailable. One successful select creates one active projection; conflict reloads authoritative state. |
| 4. Session resume | Explicit resume control and connecting animation | Lifecycle service applies revisioned idle-exit/manual-resume transition; profile is rechecked after resume | Idle-exited session remains authenticated but cannot auto-enter. One deliberate resume succeeds only with current revision and returns current eligibility. |
| 5. World staging | Garden/world card and entering animation | World admission validates active account, `world.connect`, active owned character, Spirit ownership, lifecycle, and world availability; then upserts membership | Client cannot reach the world stage by changing local state. Denial stays at portal/Character Select with a reason; success returns an admitted world/character identity. |
| 6. HUD and local 3D load | Babylon canvas, camera/input attachment, HUD shell, fullscreen/orientation controls, cosmetic world environment | Gamemaster provides admitted-world bootstrap/connection data and authoritative player/world state. Puppetmaster consumes only authorized input actions. | HUD mounts only after admission. Canvas reports ready, receives the admitted character identity, and has no ability to change account, session, inventory, or membership. |

## Legacy stage mapping

The legacy document state maps to the target presentation state as follows:

| Legacy state | Target meaning | Authority gate |
| --- | --- | --- |
| `portal-stage-splash` / `portal-stage-login` | Guest or credentials entry | None beyond unauthenticated browser state. |
| `portal-stage-connecting` | Login/session/profile request in flight | Request state only; no world assumption. |
| `portal-stage-character` | Authenticated, Spirit loaded, character required or chosen | Current server profile and Spirit snapshot. |
| `portal-stage-world` | Character is selected; user may request entry | World admission has not yet succeeded. |
| `portal-stage-entering` | Admission request has succeeded; renderer boot may begin | Returned admitted world/character bootstrap. |
| `is-game-world` | HUD and world canvas are visible | Remains conditional on valid admitted session/world state. |

## Non-negotiable deployment invariants

- Browser requests go to Gateway only. The browser never calls Gatekeeper,
  API, Postgres, Messenger, or Gamemaster directly.
- The session credential is HTTP-only or equivalently protected; the client
  treats it as opaque. Gateway/API preserve only approved session semantics.
- `resumeStage: character` or a null active character can never trigger world
  entry. Presentation may invite a selection but cannot synthesize one.
- The HUD/canvas start only from an admitted-world response. A renderer boot,
  cached profile, or local body class is not proof of admission.
- Login, lifecycle, character selection, and world admission must each expose
  correlation IDs and stable failure categories suitable for the portal UI.

## Minimum test sequence

1. Fresh guest opens the portal and submits valid credentials.
2. Refresh restores the authenticated account and the latest Spirit snapshot.
3. With no active character, verify Character Select remains and the world
   request is rejected server-side.
4. Select one character; verify the returned snapshot, then request world
   entry and receive one admitted world/character identity.
5. Verify canvas plus HUD mount after that response only.
6. Trigger idle exit; verify the authenticated portal requires explicit resume,
   then repeat the current-profile/world-admission checks.
7. Expire the long portal session; verify the client clears its session-aware
   presentation and requires credentials again.
