# System Theme Acceptance and Negative Matrix

Status: test plan only. The five files under `docs/concept-art/system-theme`
are visual design references; they are not runtime authority, content
publication, slot authority, or permission to infer server state.

All browser cases must use the same-origin Gateway surface. Tests must prove
that the browser never calls Gatekeeper, API, database, Game Server, Tunnel, or
private origins, and never exposes session references, tokens, tickets, SQL,
URLs, stack traces, or raw upstream errors. Every asynchronous case must use a
fake clock and controllable deferred response.

| Stage/behavior | Positive acceptance | Required negative cases |
| --- | --- | --- |
| First pickup and identification | Pointer, touch/pen, and keyboard pickup of Awareness transitions `splash -> identified`; quality is revealed only after pickup. | Hover/focus alone, unknown item, duplicate pickup, malformed item, and private/unvalidated projection do not reveal quality or open System. |
| Tooltip order | Final accessible text is announced once in name, subtext, then stats order; visual decoder effects do not alter assistive text. | Scrambled text is never exposed to the accessibility tree; re-hover does not duplicate announcements; missing fields fail closed. |
| Quality scale | Levels 0–9 render the protected name, number, border color, and static/reduced-motion state. | Unknown, fractional, negative, >9, or color-only quality values are rejected; disabling animation does not remove identity. |
| Designer visibility and placement | A validated held Awareness key reveals Designer and forgiving nearest-valid-cell placement accepts the key. | Designer is absent before valid hold; wrong item, stale catalog, unverified slot, far release, duplicate placement, and client-invented slot are rejected. |
| Insert and session awareness | Valid insertion opens the System panel below Designer and performs Gateway session awareness. | Direct panel opening, same-origin fallback, private route, ticket, session reference in URL/storage, or unconfigured Gateway must remain unavailable. |
| Reload to splash | Reloading any System page returns to `splash`; no session check runs before reinsertion. | Reload must not restore login, character, Garden, quality, or authority from local storage/history. |
| Resume after reinsertion | A fresh Gateway-confirmed resumable session and active character may resume the last admitted Garden state after reinsertion. | Expired, revoked, mismatched, stale, missing, or client-invented session/character projections return to Login or splash; late resume cannot reopen a closed panel. |
| Registration | Username, password, and phone are required; email is optional; Discord remains an owning-server flow. | Missing/blank/oversized fields, password persistence, raw provider errors, browser-to-provider private calls, and client-created identity are rejected. |
| Progress and safe errors | Progress shows connection and message-received states; stable client-safe Gateway errors render without changing ownership. | SQL, stack, token, private URL, raw body, exception, account oracle, or retryable-state leakage never reaches UI; unknown errors map to a generic safe state. |
| Stale-response cancellation | Deferred responses are ignored after key removal, cancel, route change, reload, or a newer request. | A late success must not reopen System, select a character, set a cookie, or enter Garden after cancellation; duplicate completion is ignored. |
| Key removal | Removing the key from every System stage logs out, cancels requests, clears presentation, tube-closes, and returns to splash. | Removal from splash, identified, designer-ready, session-check, login, register, recovery, connecting, select, and create must not retain credentials, session state, character data, or timers. |
| Character selection | Render exactly four 2x2 positions from the server-confirmed Spirit projection. | More/fewer positions, client-created characters, fixture authority, arbitrary slot IDs, unverified ownership, or private fields are rejected. |
| Empty Create action | Selecting an empty server-projected position opens Create Character without inventing a character or ownership. | Populated slot cannot be treated as empty; empty state cannot enter Garden; create without Gateway confirmation is unavailable. |
| Direct Garden entry | Selecting/creating a character requests server-confirmed Garden entry, then transitions System -> Kingdom only after admission/bootstrap. | No Select World step, direct renderer activation, local authority, ticket/tunnel fallback, or Kingdom transition before admission. |

## Independent executable status

`scripts/system-flow.test.mjs` covers the current pure state reducer: splash
initialization, generation-based late-response rejection, correlated monotonic
progress, and finite error mapping. The separate
`scripts/system-theme-boundary.test.mjs` verifies that Clockwork's v1
preparation remains disabled, records the invited-registration schema conflict,
preserves D9F5 `slots: []`, and keeps Discord, recovery, exact-four Spirit
production, and server-selected Garden private mappings unresolved.

These green tests are source/contract evidence, not end-to-end acceptance. The
current System experience correctly leaves character positions unavailable
rather than padding a variable-length list, and shows registration/recovery as
unavailable pending approved contracts. It still submits `"garden"` in the
browser. The entire experience remains unmounted while the exact-four producer,
server-selected body-less Garden command, superseding registration schema, and
private Discord/recovery mappings are unresolved. Named TODO gates in the
boundary suite keep each dependency visible without granting authority from a
fixture, concept image, proposal, or presentation helper.

The Administrator negatives remain mandatory for any later mounted candidate:
finite versioned safe errors, CSRF/correlation/idempotency, bounded timeouts,
abort-before-revoke key removal, stale/out-of-order rejection, registration
normalization/verification/PII/rate limits/non-enumeration, Discord state/PKCE
and token isolation, recovery replay/session invalidation, remember-me
TTL/device/revocation rules, inert QR, versioned profile/Spirit/disposition/
Garden projections, and monotonic correlated progress.

## Cross-stage evidence

- Run keyboard, pointer, touch, and pen cases at 360x800, 384x832, 844x390,
  768x1024, and 1024x768. Include safe-area and IME/resize cancellation.
- Verify all ten quality states in still, hover/focus, held, revealed,
  disabled, and reduced-motion modes; the name, numeric level, border pattern,
  and accessible label must remain sufficient without color or motion.
- Record exact candidate base, ordered files, patch hash, clean status, test,
  typecheck, build, and strict forward/reverse apply evidence. Server Guy owns
  any later integration, deployment, rollback, or live observation.
- Treat concept-art pixels as comparison evidence only. Runtime content,
  identity, slots, character ownership, disposition, and Garden admission must
  come from approved server projections.
