# Knowhere Web Client

Initial source scaffold for Knowhere's browser client.

## Status

Browser-shell source only. This is intentionally not a deployment, production
configuration, or authenticated client.

## Intended scope

- Player-facing web experience.
- Future authenticated communication with documented private services.
- No API client, authentication logic, service credentials, database access, or
  server implementation is included in this first migration slice.

## Local source layout

- `src/main.tsx` mounts the browser shell.
- `src/App.tsx` provides an intentionally static first-run screen.
- `src/styles.css` carries only the portable visual shell tokens and responsive
  browser layout derived from the legacy Next layout.

The `package.json` declares a future React/Vite browser build. Dependencies are
not installed by this scaffold and no command has been run.

## Isolated third-party asset preview

`?preview=staxel-voxel-female` opens a local-only preview of the imported
CC-BY Staxel Voxel Female source asset. It is not part of login, gameplay,
world authority, a production route, or server delivery. Attribution and source
files are retained under `public/third-party/staxel_voxel_female/`.

See `design.md` for the evolving program design.
