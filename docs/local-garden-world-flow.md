# Local Garden world flow

The web client now treats the player's Garden as the only automatic alpha entry target. There is no world-selection screen in the normal login flow.

1. Placing Awareness in the Designer slot sends an anonymous, idempotent `POST /v1/worlds/prewarm` to the configured public Gateway with exact body `{ "worldId": "garden" }`.
2. The client accepts only `{ "worldId": "garden", "status": "ready", "sceneRevision": 1 }`. Prewarming creates no player authority and exposes no host, ticket, session, account, or private transport data.
3. After authentication and character selection, the client automatically sends credentialed `POST /v1/worlds/entry` for `garden`, followed by `GET /v1/worlds/bootstrap`. Both remain Gateway-mediated.
4. Babylon rendering starts only after a valid bootstrap for the selected character and Garden. The strict scene projection supplies the voxel palette/grid contract, solid-color skybox, and orbiting sun cycle.

The existing `/v1/worlds` discovery seam is retained for future transitions to official or hosted worlds, but it is not part of automatic Garden entry. Browser code never calls `server_world`, Railway private networking, a local host, API, Keymaster, or a database directly.
