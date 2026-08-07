# Knowhere Character Art and Preview Style Handoff

**Status:** bounded client-local preview slice; not an admitted-player or
gameplay presentation approval.

## Inventory

| Asset/style surface | Current state | Rights/authority result |
| --- | --- | --- |
| Staxel Voxel Female source | Unmodified glTF/BIN, 128 x 128 base-color texture, and included license retained under `public/third-party/staxel_voxel_female/source/` | CC-BY-4.0 attribution is retained; derived work must identify changes and retain the source credit |
| Intake evidence | `intake-manifest.json` freezes source hashes, 21-joint `_rootJoint` rig, 14 skinned meshes, excluded backdrop plane, and `Take 001` evidence | Source drift is validation-failing; no raw source file may be overwritten |
| Attribution | `ATTRIBUTION.md`, `license.txt`, and visible preview credit identify “Staxel Voxel Female,” andruha1801, the Sketchfab source, and CC-BY-4.0 | Safe for the isolated client preview; shipped/fork-visible credit placement remains a release gate |
| Preview style | `src/characters/characterPreviewStyle.ts` owns the immutable preview lighting/framing values | Preview-only; not a gameplay camera, world-lighting, or authority contract |

## Frozen artifact identity

The following identity is the only artifact reference for this preview slice:

| Field | Frozen value |
| --- | --- |
| Asset ID | `staxel-voxel-female` |
| Rig version | `staxel-voxel-female-v1` |
| Preview route | `?preview=staxel-voxel-female` |
| Source descriptor | `public/third-party/staxel_voxel_female/source/scene.gltf` |
| Intake manifest | `public/third-party/staxel_voxel_female/intake-manifest.json` |
| Source identity | Staxel Voxel Female by andruha1801, CC-BY-4.0 |
| Source hashes | glTF `FE8DF1AEA72984152EBCF0D2BAB022A45308DA0D370ECFB5CEF026C1211CF63A`; BIN `EBFC8AEE2422A743522A7BD643E3F01FEB29EB60AE96DF782DE36374C17FB685`; texture `C75A3F64824C83770E985438C7415CEF112E6980E2FF098E5666E40F59B0C62C`; license `D07EEC5B04937FFF0D90B624879FDE2771F3B845C5EEB99862401CB0C1361D7D` |
| Preview style ID | `knowhere-character-preview-v1` |
| Preview clip | `Take 001` — preview-only, semantic classification null |
| Semantic bindings | `{}`; no gameplay animation intent is approved |
| Attribution evidence | `public/third-party/staxel_voxel_female/ATTRIBUTION.md` and `source/license.txt` |

This identity is frozen for the current handoff. Any derived conversion must
retain the source identity, record its changes, and receive a new reviewed
artifact identity; consumers must not substitute a raw glTF node, mesh name, or
unreviewed clip as a contract identifier.

## Preview style slice

`STAXEL_VOXEL_FEMALE_PREVIEW_STYLE` is the single renderer-local source for the
current intake look:

- dark `#070b12` clear color;
- cool ambient `#cfe7ff` at `1.8`;
- warm key `#ffddb4` at `2.6`, positioned at `(3, 5, 4)`;
- 40-degree perspective camera;
- bounds-relative framing scales of `1.25` distance, `0.65` height, and
  `1.75` depth;
- fixed intake turn of `Math.PI / 8`.

These values preserve the existing isolated preview. They do not establish
approved gameplay scale, floor contact, forward direction, camera policy, or
world lighting.

## Handoff boundary

Interfacer may consume this descriptor as display styling only. Puppetmaster may
consume the asset ID, rig version, and later approved semantic animation IDs
only through an explicit admitted-world projection. Neither consumer may infer
authority from the preview URL, DOM state, local storage, asset presence, or a
published content snapshot alone.

Before a first playable renderer can activate this asset, the project still
needs:

1. an approved admitted-world projection naming the permitted asset and
   presentation state;
2. a renderer-owned spawn/transform attachment and disposal lifecycle;
3. art approval for silhouette, scale, facing, floor contact, materials, and
   animation semantics; and
4. a shipped/fork-visible attribution surface with a final upstream license
   recheck.

`Take 001` remains preview-only and unclassified. No gameplay animation binding
is included in this slice.
