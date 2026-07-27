# Knowhere Web Client Design

## First migration slice

This repository begins with a standalone browser shell extracted from the
legacy Next prototype's document layout and visual token direction. It is a
source-only boundary: no portal runtime, inventory runtime, rendering engine,
auth provider, API route, database schema, or external configuration is
copied here.

The eventual web client consumes versioned public contracts from Web,
Gatekeeper, Messenger, and Gamemaster services. It never connects directly to
PostgreSQL and never contains service secrets.

## Webmaster health contract

`src/api/webmaster-client.ts` is the typed browser-side consumer for the
Webmaster `GET /v1/health` contract. Its base URL comes from the non-secret
`<meta name="knowhere-webmaster-url">` value, or the current browser origin if
that value is blank. The client validates the response shape and accepts an
`AbortSignal` per request.

The health result is local UI state only: idle, checking, healthy, unavailable,
or aborted. A failed/aborted request never retries by itself, alters browser
credentials, touches another service directly, or starts/stops/restarts any
backend process. The optional UI refresh button creates one new request only.

## Third-party character preview intake

The Staxel Voxel Female is a CC-BY-4.0 source asset retained with its license
and attribution under `public/third-party/staxel_voxel_female/`. The initial
slice is isolated to the `?preview=staxel-voxel-female` view and has no account,
inventory, player-control, or gameplay authority.

The typed client descriptor and empty preview-only controller binding in
`src/characters/staxelVoxelFemale.ts` describe client-preview identity and
source metadata. Any later character controller must consume approved semantic
animation identifiers rather than glTF node indexes or raw mesh names.

`src/characters/CharacterControllerPreview.ts` is the current isolated binding:
it validates `_rootJoint`, one skinned mesh, and the approved preview clip
`Take 001`, then exposes local visual state only. It has no account, inventory,
network, player-command, or game-authority dependency.
