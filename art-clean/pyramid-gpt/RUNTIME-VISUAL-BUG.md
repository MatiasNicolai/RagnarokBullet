# Runtime visual bug — opaque sheet background in sprites

User screenshot: `C:\Users\arami\AppData\Roaming\Hermes\composer-images\image_485ca7.png`.

Observed in Amon-Ra practice: large white/parchment rectangle, red/orange grid/effect artifacts, and residual source-sheet decoration around the throne. This is not an art-generation defect; it is incomplete background removal in `tools/slice-pyramid.py`.

Measured on current `public/assets-v2/pyramid/bosses4.png` + `bosses4.json`:
- Amon-Ra frames retain roughly 13–35% bright-neutral opaque pixels.
- Example `down.idle[0]`: 12,165 opaque pixels, 4,102 bright-neutral (33.7%), 3,854 near-white.
- Every measured Amon-Ra frame retains substantial near-white matte.

Required correction:
1. Do not merely widen the global bright-neutral threshold; legitimate pale bones, wrappings, highlights and staff details must survive.
2. Remove sheet background per pose cell/selected figure using border-connected matte removal and component ownership. Eliminate parchment variations, red grid lines, labels, neighboring effects and decorative panel fragments that are not part of the selected figure.
3. Preserve all connected or deliberately detached identity components: Amon-Ra throne, seated corpse, staff and attached attack effect; Osiris hands/bandages; monster weapons/wings.
4. Decontaminate remaining pale fringe conservatively and validate on dark/brown gameplay-like backgrounds.
5. Emit a runtime contact sheet showing every extracted crop on dark brown and checkerboard backgrounds, not only red boxes over the original sheet.
6. Add automated per-frame gates for residual border-connected opaque pixels and bright-neutral edge contamination. The Amon-Ra idle frame must not render as an opaque rectangular patch.
7. Apply the correction to Pyramid bosses and common enemies, regenerate deterministicallylessly/deterministically, and rerun the full test suite.
8. Keep approved source artwork untouched and do not generate/redraw graphics.
