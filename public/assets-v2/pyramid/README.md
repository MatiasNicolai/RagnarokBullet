# Pyramid of the Sun — runtime assets (level 6)

Derived, reproducible output. No artwork was created or edited here: every
file below is sliced from the approved sources in `art-clean/pyramid-gpt/`
(see `IMPLEMENTATION-BRIEF.md`). The originals in `public/assets` are untouched.

## Provenance (approved visual sources, read-only)

- `pyramid-enemies-gpt-image-2-medium-v1.png` (1122x1402) — 8 common mobs
- `pyramid-bosses-gpt-image-2-medium-v2-user-references.png` (1122x1402) — Osiris + Amon-Ra
- `pyramid-map-gpt-image-2-medium-v2-oasis-entrance-tomb.png` (793x1983) — backdrop

## Regeneration (deterministic, Python 3 stdlib only)

```sh
python tools/slice-pyramid.py
```

(`python3` is equivalent on systems where that executable name is available.)

Two consecutive runs are sha256-identical over all 12 output files
(2 atlas PNGs + 7 map tiles + 3 manifests).

Method: key out the baked background; find panel/sprite bands by projection;
split each row into FIXED pose cells at the widest near-empty column gaps;
per cell keep the complete main sprite via connected-component selection
(figure cells: whole-band components by pixel majority, so sprawling figures
stay whole past dividers; hit cells: in-cell union minus edge-hugging
fragments of neighbors' figures). Boss idle/move/attack become 3-frame
arrays; hit is the single isolated central figure. Effect/example rows are
skipped.

Validation gates run BEFORE anything is written (nonzero exit, nothing
written on violation): every mob rect 20–120px wide / 50–150px tall with no
>8px neighbor overlap; every boss idle/move/attack exactly 3 frames
(90–230px, attack to 290px); every boss hit a single rect ≤300px wide. The
static suite (`server/test-static.mjs`) re-checks the structural half of
these gates (attack frame counts, hit widths, mob width ranges).

Outputs (verified counts/ranges):

- `monsters9.png` + `monsters9.json` — familiar, soldier, archer, mummy,
  verit, matyr, isis, ancient: 80 rects, widths 36–67px, heights 81–129px
- `bosses4.png` + `bosses4.json` — Amon-Ra: 26 rects (attack 3×162–164px,
  hit single 247/286px figure+throne), heights 104–107px
- `monsters10.json` — Osiris (rects live in `bosses4.png`): 26 rects
  (attack 3×136–140px, hit single 110/122px), heights 83–107px
- `maps/pyramid001..007.png` — 793px-wide tiles, bottom (oasis) to top
  (sanctuary)
- Debug overlays: `tools/debug-pyramid-mobs.png`, `tools/debug-pyramid-bosses.png`
- Metrics: `art-clean/pyramid-gpt/slice-report.json`

## Play / test

- Campaign: Nivel 6 "Pirámide del Sol" (seed `0x9a7d51`) — oasis, entrance,
  descent, Osiris midboss, tomb, Amon-Ra (`Corona Solar`, `Eclipse`,
  `Ira del Santuario`). `sim.biome` eases 0 → ~1 across the run (drives the
  living background, same idiom as levels 1–5).
- Practice scene offers Amon-Ra directly.
- Checks: `node server/test-static.mjs` (12 checks incl. pyramid full run
  Osiris warning -> Amon-Ra warning -> levelClear, plus biome advance/finite
  and manifest shape gates), `node server/test-netplay.mjs`, plus the
  production build.

## Known limitations

- Boss sprite rows nearly touch, so row splitting and per-figure dividers
  fall back to even splits (see the slicer's WARNINGS). Figures are evenly
  spaced, so the thirds land correctly — verified on the debug overlay.
- The sheets have genuinely overlapping art (verit's wolf sprawls across two
  columns; attack swooshes cross into hit columns). Shared pixels go to one
  sprite: figures keep their whole owned components (may extend past
  dividers); hit boxes yield intrusions over 8px. Each crop was visually
  audited on the debug overlays.
- Amon-Ra's hit boxes (247/286px) include the throne plus attached hit
  smoke; Osiris hits are the lone figure. No box spans multiple figures.
