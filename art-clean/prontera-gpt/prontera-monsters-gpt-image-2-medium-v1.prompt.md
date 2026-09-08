# Prontera Monsters V1 — Generation Record

- Provider: `image_gen/openai-codex`
- Model: `gpt-image-2-medium`
- Reference input: `public/assets/monsters.png`
- Output: `prontera-monsters-gpt-image-2-medium-v1.png`
- Output SHA-256: `41410cb399b248655fa6e06fdf94a74343180b6d5ea3105e9974bfb47060ee11`
- Dimensions: `1122 × 1402`, RGB

## Prompt

Create a new, higher-quality production candidate sprite sheet for the six normal monsters used in the Prontera level of a modern 16-bit-inspired top-down bullet-hell game. Use the supplied current sheet as the authoritative identity and palette reference for Poring, Pupa, Picky, Chonchon, and Orc Baby. Add Lunatic as the sixth monster: a small round pale-pink rabbit with long upright ears, compact chibi body, dark readable eyes, a tiny pink nose, and a fully opaque face. Preserve recognizable species, colors, silhouettes, cute proportions, and Ragnarok-inspired fantasy character identity, but redraw every sprite with cleaner pixel clusters, stronger silhouettes, consistent outlines, richer controlled shading, and modern high-fidelity pixel-art rendering suitable for gameplay at small scale.

LAYOUT IS CRITICAL: one portrait sprite sheet, exactly six separate character panels arranged in two columns by three rows, in this exact reading order: Poring, Pupa / Picky, Chonchon / Orc Baby, Lunatic. Inside every character panel, show exactly ten isolated full-body sprites in a consistent 5-column by 2-row mini-grid. Top mini-row: front/down-facing idle, move-left, move-right, hit, attack. Bottom mini-row: back/up-facing idle, move-left, move-right, hit, attack. Keep each pose centered on the same feet/baseline, at the same scale, with generous empty padding between poses and panels. Every pose must contain only one complete character. Attacks should be readable through body pose and one compact attached effect only; do not place loose example projectiles, extra effect strips, debris, dust clouds, labels, borders, grid lines, captions, UI, or decorative elements anywhere.

Use a single perfectly uniform flat neutral light-gray background across the entire image for deterministic technical extraction; no checkerboard, texture, gradient, paper, shadows, frame dividers, or transparency simulation. Characters must be fully opaque inside their silhouettes. CRITICAL: no transparent or hollow faces, no missing facial pixels, no see-through eyes or mouths, no background-colored holes inside heads or bodies. Lunatic's entire head and muzzle must be solid pale pink with clearly painted dark eyes and nose. Maintain clean separation around ears, wings, limbs, weapons, and silhouettes. Pixel art, crisp hard edges, no blur, no watercolor, no painterly rendering, no text, no watermark.

## Review Notes

- All six requested monsters are present in a 2 × 3 layout.
- Each monster has ten readable poses in two rows.
- Lunatic's face is opaque and readable.
- The generator added compact drop shadows and small hit/attack accents despite the stricter prompt; these remain candidates for deterministic removal or a V2 regeneration before runtime integration.
