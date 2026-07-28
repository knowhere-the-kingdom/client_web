# Client recovery ownership

This isolated recovery task owns the non-login, non-dashboard client slices:
public Gateway bootstrap validation, renderer/HUD presentation gates,
inventory layout rules, messaging presentation, and final integration planning.

Creator owns login, key-drag, and character-selection UX. Administrator owns
`Dashboard`, `AdminDashboard`, and `dashboard/**`. Code Monkey owns service-domain
browser redirects. Those lanes are reviewed for interface compatibility only;
their implementation files are not edited here.

## Slice order

1. Inventory layout/state rules and focused tests.
2. Ticket-free admitted-world/HUD bootstrap validation and focused tests.
3. Renderer lifecycle gate driven by validated public projections.
4. HUD, inventory, map, action-bar, and messaging presentation.
5. Shared `App.tsx`/stylesheet/package integration after Creator and Administrator
   confirm their shell boundaries.

No browser code may carry private tickets, Tunnel/local-host endpoints,
`sessionRef`, private identity headers, or downstream response bodies.
