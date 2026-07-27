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
