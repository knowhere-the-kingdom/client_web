# System theme visual-system provenance

Status: source-only presentation contract. The five raster references are
intended-design references, not runtime authority, shipped UI, account data,
character data, or inventory/slot authority. The sample QR and portraits must
not be copied into production.

| Reference | SHA-256 |
| --- | --- |
| `concept-art/system-theme/system-login-reference.png` | `F8DDE3A7C3EF7C2E43A3F53C7545BEB8CF7E24AED5ED04893F030BCD2ABDD2E6` |
| `concept-art/system-theme/system-panel-frame-reference.png` | `9492C2F8144D0C4FA4B954D77A1C2ADC7426403F6B85988F5B5675BA37255F35` |
| `concept-art/system-theme/awareness-key-reference.png` | `7CA8C5522488F968644A25A23C5F4161C386839D093FE7E566711C349C367A94` |
| `concept-art/system-theme/system-character-select-reference.png` | `74A9630CD229054CFF998171BB15FA26D653F5A7C555C337CD1B865D0490F750` |
| `concept-art/system-theme/cosmic-quality-key-reference.png` | `ED7A2C46BD65D96A34EF1D99A752AA58F23F132D0953BB3E16A2807BEA7437B0` |

The reusable presentation contracts are in `src/theme/system-theme.ts` and
`src/theme/system-theme.css`. They are intentionally unmounted. Theme choice,
quality, account/session state, character ownership, and Garden admission
remain server-confirmed facts delivered through the same-origin Gateway.

Accessibility requirements: quality name, numeric level, border pattern, and
label remain legible without animation or color; focus is visible; disabled
state is not conveyed by color alone; reduced motion disables reveal and
transition animation.
