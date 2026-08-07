# Knowhere Web Client

Initial source scaffold for Knowhere's browser client.

## Status

Browser-shell source only. This is intentionally not a deployment, production
configuration, or authenticated client.

## Intended scope

- Player-facing web experience.
- A typed, unauthenticated Gateway health check used only to display local
  availability state.
- Future authenticated communication with documented private services.
- No authentication logic, service credentials, database access, request relay,
  or server implementation is included in this first migration slice.

## Local source layout

- `src/main.tsx` mounts the browser shell.
- `src/App.tsx` provides an intentionally static first-run screen.
- `src/styles.css` carries only the portable visual shell tokens and responsive
  browser layout derived from the legacy Next layout.
- `src/api/gateway-client.ts` validates the public Gateway `GET /v1/health`
  response and owns the typed, fail-closed protected Gateway request seam.
- `src/api/gateway-contract.ts` records the browser projection required for
  session restore, explicit resume, character selection, and world admission.
  It matches `K:\nowhere\dev\backend\BROWSER_GATEWAY_AUTH_CONTRACT.md`; no
  fixture authentication is used while the service implementation is pending.

## Gateway endpoint configuration

The browser reads the optional, non-secret
`<meta name="knowhere-gateway-url">` value in `index.html`. When it is blank,
the health check uses the current browser origin. The request has no authority
beyond checking Gateway health; it cannot start, stop, or configure Gateway,
the Login Server (`server_gatekeeper`), or any other service.

The protected client is same-origin only. Gateway injects the contracted
readable cookie name in `<meta name="knowhere-csrf-cookie">`: development uses
`knowhere_dev_csrf` and HTTPS uses `__Host-knowhere_csrf`. The client fails
closed when that value or cookie is unavailable.

World discovery, entry, and bootstrap all come from the same-origin Gateway.
transport with no browser cookies or CSRF. The response is validated before the
client state may reach `world-ready`.

The `package.json` declares a future React/Vite browser build. Dependencies are
not installed by this scaffold and no command has been run.

## Isolated third-party asset preview

`?preview=staxel-voxel-female` opens a local-only preview of the imported
CC-BY Staxel Voxel Female source asset. It is not part of login, gameplay,
world authority, a production route, or server delivery. Attribution and source
files are retained under `public/third-party/staxel_voxel_female/`.

See `design.md` for the evolving program design.
