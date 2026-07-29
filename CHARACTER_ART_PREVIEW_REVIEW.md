# Staxel Voxel Female Art-Preview Review

**Owner:** Starving Artist  
**Review status:** Source intake verified; visual approval pending  
**Scope:** Isolated client preview only. This record authorizes neither gameplay
integration nor server, database, deployment, or production changes.

## Review evidence

| Area | Current evidence | Review result |
| --- | --- | --- |
| Provenance | Unmodified glTF, BIN, 128 x 128 base-color PNG, and `license.txt` remain in `public/third-party/staxel_voxel_female/source/`. | Pass: source provenance is retained. |
| Attribution | `ATTRIBUTION.md` and the preview credit name and link `andruha1801`, the model, source page, and CC-BY-4.0. | Pass for the isolated preview; public-release credits location remains open. |
| Silhouette | The source is a 15-mesh, 21-joint skinned character. The preview frames it at a fixed 22.5-degree turn only. | Pending: inspect front, profile, back, and motion silhouettes before approval. |
| Materials | Two opaque, double-sided PBR materials are present. One uses the retained 128 x 128 indexed base-color map; `Material_26` is an untextured gray. | Pending: assess palette/readability and whether double-sided rendering is visually necessary. |
| Animation | One 60-channel, 3.33-second linear clip, `Take 001`, loops in the preview. It has no approved semantic classification. | Pending: classify its readable action and check loop seam, feet, hands, and facial/head motion. |
| Authority boundary | Descriptor and controller use `preview-only`; semantic animation bindings are empty; preview is selected only by `?preview=staxel-voxel-female`. | Pass: no gameplay or service authority is implied. |

## Art review tasklist

- [ ] Capture the isolated preview at front, 45-degree, profile, three-quarter back, and back views, all at the intended gameplay camera distance.
- [ ] Approve or reject the silhouette for the Knowhere visual language: head-to-body proportion, limb separation, readable hands/feet, and recognition against a dark environment.
- [ ] Review the 128 x 128 palette under the preview's cool ambient and warm key lights; flag any loss of face, garment, or limb separation.
- [ ] Determine whether the gray `Material_26` plane reads as intended and whether either double-sided material creates visible backface or lighting artifacts.
- [ ] Watch at least three complete `Take 001` loops; record its actual action, loop seam, planted-foot quality, extremity intersections, and whether it is acceptable only as an idle candidate or should be rejected.
- [ ] Record the source scale, floor contact, forward-facing direction, and the preferred preview camera framing; do not encode a gameplay scale or controller contract from this review.
- [ ] Confirm the upstream source page still presents compatible CC-BY-4.0 terms immediately before any public distribution.
- [ ] Choose the shipped credits surface and fork-visible attribution path before release. Retain the existing repository attribution regardless.

## Approval gate

The asset remains **preview-only** until all visual checklist items are resolved
and an art owner records an explicit approval or rejection here. A favorable
art review may permit a further client-only conversion or preview slice; it does
not authorize character selection, animation semantics, gameplay binding, or
any server-side work.
