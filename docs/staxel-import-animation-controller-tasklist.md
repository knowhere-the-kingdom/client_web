# Staxel Import and Animation Controller Tasklist

## Scope and guardrails

This is the bounded intake/controller slice after the isolated
`?preview=staxel-voxel-female` preview. It remains browser-local visual work.
It must not add an account binding, player command, network request, inventory
dependency, server contract, or gameplay authority.

The source asset remains **Staxel Voxel Female** by andruha1801, licensed
CC-BY-4.0. Keep `public/third-party/staxel_voxel_female/source/license.txt`
and `ATTRIBUTION.md` with every derived import, and retain the visible preview
credit and source link.

## Ordered work

1. **Freeze intake evidence (complete).** Record the approved source path, source URL,
   license, `_rootJoint`, 21-joint skin, and existing `Take 001` clip in an
   import manifest. Do not use glTF node indices or mesh names as controller
   identifiers.
2. **Validate the retained source (complete).** The checked-in manifest records
   source hashes and rig/clip invariants; `npm run asset:validate:staxel` fails
   on drift. No derived asset is generated or approved yet, and the retained
   source files are never overwritten.
3. **Define semantic animation evidence.** Inventory each imported clip with
   its source/provenance and approve only semantic identifiers such as `idle`,
   `locomotion`, and `interact`. The current `Take 001` is preview evidence,
   not an implied gameplay animation or locomotion mapping.
4. **Implement a visual-only controller adapter (foundation complete).** The
   preview validates the full skinned-mesh/rig shape and owns mixer cleanup.
   A live Staxel presentation additionally fails closed until server-confirmed
   session, active-character, and matching world-admission readiness. After
   animation approval, let a local caller select
   approved semantic animation identifiers and perform clip cross-fades on an
   `AnimationMixer`. Unknown, unavailable, or unsupported identifiers must
   leave the current visual action unchanged and report a local result; they
   must never synthesize movement or send a command.
5. **Add focused validation (complete for current foundation).** Test the import manifest, attribution
   retention, rig invariants, semantic-to-clip mapping, fallback behavior, and
   mixer cleanup. Run `npm run typecheck` and `npm test`. Local builds may be
   run only in the development target; Server Guy owns all production builds.
6. **Perform an isolated browser smoke test (pending art review).** Verify the preview URL loads,
   credit remains visible, the approved clip plays, and no requests are made
   beyond loading the same-origin static asset. Record the browser and result
   with the change.

## Completion gate

The approved player-presentation readiness contract permits only a local visual
factory to consume its derived ready/inactive snapshot; it does not authorize
the controller to create or alter session, character, admission, input, world,
inventory, networking, or server state. HUD and world consumers must treat the
snapshot as display data and dispose presentation on an inactive update. This
tasklist authorizes no deployment or service changes.
