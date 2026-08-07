# dev_prototype UI port

The authenticated client now uses the post-admission layout from
`R:\dev\prototypes\dev_prototype` as its visual and interaction reference.
The port covers the Designer/dashboard control, compass, Backpack, Lunchbox,
Map, Character, Spirit Box, Knowledge/Tome, agility skills, knowledge skills,
action bar, inventory grids, tooltips, drag-and-drop, and settings presentation.

The current Awareness placement ritual, Gateway login, restored-session flow,
character selection, Garden admission, and logout flow are intentionally not
copied from the prototype. They remain owned by the current client and public
Gateway contracts.

Inventory movement continues through the existing `WorldHudProjectionV2`
revision and `POST /v1/worlds/inventory/move` seam when an authoritative
projection is present. The browser does not gain API, Keymaster, database,
Railway, local-host, or world-server authority from this presentation port.

The existing character-controller runtime remains in use. It already supplies
gravity-aware movement, Space jump, Alt flight, sprint, crouch, pointer-lock
handling, controller bindings, and the settings rebinding surface. This avoids
shipping a second controller or importing the prototype's obsolete account and
profile data paths.
