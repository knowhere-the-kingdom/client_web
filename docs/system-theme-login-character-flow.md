# System Theme Login and Character Flow

Status: approved design target; implementation and live-service acceptance are
tracked separately. This document supersedes visual/layout guesses, but it does
not publish inventory content, create slot authority, or authorize deployment.

## Intent

The Awareness key is a physical UI item and the Designer is its slot. Placing
the key into that slot opens the System interface. Removing it from the slot at
any System stage logs the player out, closes the interface with the tube-close
transition, and returns to the unknown-key splash.

The same component geometry and state machine must drive web and Android. The
browser remains same-origin Gateway-only: it never calls a database, Gatekeeper,
API, Game Server, Tunnel, or private origin directly.

## Theme families

All themes use the same semantic components, grid units, focus states, and data
contracts. Themes change material, typography, texture, motion, and accent
tokens without changing authority or field meaning.

| Theme | Visual language | Initial use |
| --- | --- | --- |
| System | Clean golden-metal borders and emerald/turquoise digital matrix surfaces. | Splash, Login, Register, Forgot Password, progress, Create Character, Select Character. |
| Kingdom | Roman stonework, bright greys, and cloth banners. | Garden world baseline; text decoding may use a restrained Zalgo-like reveal. |
| Revelation | Modern, clean, minimal surfaces; color only for important accents. | World/disposition override. |
| Angelic | White and gold. | Character/world disposition override. |
| Demonic | Red and black. | Character/world disposition override. |
| Hybrid | White, gold, red, and black. | Character/world disposition override. |
| Cosmic | Cyan-led space material with hot-pink, orange, and neon accents. | Character/world disposition override and quality-8 item effects. |

The active world supplies the base theme. A server-confirmed active-character
disposition may select an approved modifier. The client must not infer a theme
from a portrait, item color, local storage, or mock data.

## Protected quality scale and backdrop language

The names and colors below are the canonical `dev_prototype` and current-client
values. They are protected tokens. New backdrop layers may animate, but must not
replace or alias the identifying border color.

| Level | Name | Color | Backdrop/effect target |
| ---: | --- | --- | --- |
| 0 | Scrap | `#4b4b4b` | Charcoal plate, shallow scratches, intermittent dull edge noise. |
| 1 | Common | `#e8e8e8` | Neutral pearl/steel field, soft diagonal sheen, no particles. |
| 2 | Uncommon | `#4ea85a` | Deep green radial bloom with slow leaf-like motes. |
| 3 | Rare | `#3f7dde` | Sapphire depth gradient with a measured horizontal scan glint. |
| 4 | Epic | `#8d55cc` | Violet arcane haze, restrained orbiting sparks. |
| 5 | Relic | `#c94848` | Dark crimson material with ember flecks and a slow inner pulse. |
| 6 | Mythic | `#db7b32` | Burnished orange/gold plasma ribbons and heat shimmer. |
| 7 | Legendary | `#d2ad48` | Black-gold field, traveling gold edge sweep, sparse dust. |
| 8 | Cosmic | `#48d7df` | Cyan/blue starfield with hot-pink and orange nebula accents; reference image is the target. |
| 9 | Divine | `#f8ffff` | White-gold halo, prismatic bloom, very slow ascending motes. |

Every backdrop needs still, hover/focus, held, revealed, disabled, and
`prefers-reduced-motion` states. Quality must remain legible without animation
or color through the name, numeric level, border pattern, and accessible label.

## Staged flow

1. **Splash / unknown item**
   - Start every page load outside an already-entered game at the splash.
   - Show the Awareness key icon/model alone at screen center. No item frame,
     quality border, tooltip, Designer slot, or login panel is visible.
   - Assigned model effects may render, but must not disclose quality.
2. **First pickup and identification**
   - Pointer, touch, and keyboard pickup use the shared inventory interaction.
   - First pickup reveals the server-supplied quality frame/backdrop quickly.
   - Hover/focus anchors the tooltip to the item. Reveal name, subtext, then
     stats in order with a short decoder effect: matrix glyphs in System;
     restrained Zalgo-like substitution in Kingdom.
   - Screen readers receive the final text once, not the scrambled characters.
3. **Designer reveal**
   - While the key is held, reveal the Designer slot slightly above it.
   - Use forgiving nearest-valid-cell snapping. Only a validated Awareness-key
     item may occupy the slot.
4. **Insert key / open System panel**
   - Inserting the key anchors the login panel below the Designer slot and runs
     the session-awareness check through the Gateway.
   - A valid resumable session and server-confirmed active character may return
     directly to the last admitted Garden play state. Otherwise show Login.
5. **Login**
   - Designer slot and key, KNOWHERE title, username, password, Login,
     Remember me, Forgot Password, divider, Login with Discord, Register, and a
     placeholder Scan to Login QR image.
   - The QR placeholder has no encoded credential or authority.
6. **Register / Register with Discord**
   - Username, password, and phone are required; email is optional.
   - Discord registration links the external identity only through the owning
     server flow and still collects any required profile fields securely.
7. **Progress and errors**
   - A shared progress bar shows `Connecting to server` and explicit
     message-received confirmation before stage advancement.
   - Relay only stable, client-safe login error codes/messages from the Gateway.
     Never render raw exceptions, SQL, private URLs, tokens, or stack traces.
8. **Character selection and creation**
   - Keep one standardized 2x2 Designer/Awareness slot at the top-left and one
     inert 2x2 account Soul item at the top-right. The Soul tooltip presents
     server-projected account statistics including total login time.
   - Render every server-confirmed account character as a 2x3 item plus exactly
     one unlabeled empty 2x3 create affordance. The fixed active-character
     receptacle is an empty 2x3 slot at bottom center.
   - Selecting or forgivingly dropping a character animates the item from its
     source into the bottom receptacle. The client never invents characters,
     ownership, account statistics, or inventory placement.
9. **Enter Garden**
   - After a character is seated, replace the character list with one 3x3
     server-projected Garden world item titled `Wake Up`. Its tooltip contains
     world details and current online player count.
   - Clicking the Garden item requests server-confirmed Garden entry.
   - After admission/bootstrap succeeds, transition from System to Kingdom and
     load the local Garden presentation. No separate Select World step.
10. **Key removal and reload**
    - Removing/dropping the key anywhere except the Designer logs out, cancels
      outstanding requests, clears client presentation state, tube-closes, and
      returns to the unknown-key splash.
    - Reloading a System page always begins at Splash. Session awareness runs
      only after the player reinserts the key; it may then resume valid play.

## State and authority invariants

- Stages: `splash -> identified -> designer-ready -> session-check -> login ->
  registering|recovering -> connecting -> character-select|character-create ->
  character-ready -> garden-entry -> garden`.
- `key-removed`, cancellation, stale response, or invalid projection returns to
  `splash`; late responses cannot reopen a closed panel.
- Account, session, Spirit inventory, character ownership, active character,
  disposition, and Garden admission are server-owned facts.
- The client owns presentation, focus, animation, held-item interaction, and
  deterministic cancellation only.
- Remember-me is a server-managed session preference. Do not store passwords,
  bearer tokens, session identities, or character authority in local storage.

## Acceptance checklist

- [ ] All five references are traceable through the concept-art inventory.
- [ ] One shared themed component set covers all System stages and viewports.
- [ ] Unknown key reveals quality only on first pickup; tooltip order is stable.
- [ ] Ten quality levels have distinct static, animated, and reduced-motion states.
- [ ] Designer appears only while the valid key is held; insertion opens below it.
- [ ] Reload starts Splash; reinsertion may resume a valid server session.
- [ ] Key removal from every System stage logs out and ignores late responses.
- [ ] Login, Discord, registration, recovery, QR placeholder, progress, and safe errors work through Gateway only.
- [ ] Character Select renders all server-projected 2x3 character items, one unlabeled empty Create item, and the fixed 2x3 active-character slot.
- [ ] Character seating animates, then exposes the 3x3 Garden `Wake Up` item; only that item enters Garden.
- [ ] Designer, Soul, character, and world items use the shared grid-unit geometry and server-owned item definitions.
- [ ] Web keyboard/pointer/touch and physical Android/WebView evidence pass.
- [ ] Server Guy records exact release candidate, rollback, deployment, and live checks before publication.

## Source references and ownership

- Current primitives: `src/inventory/InventoryPrimitives.tsx`,
  `src/inventory/inventory-primitives.css`, and `src/inventory/inventory-model.ts`.
- Prototype compatibility: `R:\dev\prototypes\dev_prototype\src\app\ui-system.css`,
  `src\app\globals.css`, `public\scripts.js`, and `src\db\seed.ts`.
- Concept art: `docs/concept-art/system-theme/`.
- Interfacer owns the shared web presentation/state machine; Mobile Minion owns
  Android parity; Clockwork owns Login Server/session contracts; Creator owns
  immutable item/quality/Spirit content proposals; Puppetmaster owns character
  handoff/lifecycle; Bug Eater owns independent negatives; Administrator owns
  account/PII/security review; Server Guy alone owns integration, push, deploy,
  database, release, and rollback.
