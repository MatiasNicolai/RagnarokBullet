# Bosses V3 (levels 1-3) GPT image generation record

These sheets redo the art of the first three campaign bosses, which used ~65 px source frames from the original `Bosses.png` (Thanatos uses 345 px). On 2026-11-16 the user chose to follow the **official RO sprites**, not the old in-game designs. The old designs differ:
- Orc Hero had a horned helm, a round shield and an axe;
- Dark Lord was a dark armored knight;
- Baphomet was a front-facing beast with no visible scythe.

Generated with the Codex CLI (`codex-cli 0.169.0`, `image_gen.imagegen`, ChatGPT login; the tool does not expose the model name). Each image is copied byte-for-byte from `~/.codex/generated_images/<session>/`. Approved sources are immutable: a correction is a new `-v2`.

Every generation attaches two images: the approved `art-clean/thanatos-gpt/thanatos-boss-form1-v1.png` as the style, quality and layout reference, and the boss's RO sprite as the identity reference.

| File | Size | Prompt | RO reference | sha256 | Status |
|---|---|---|---|---|---|
| `orc-hero-v1.png` | 1536×1024 | `prompts/PROMPT-orc-hero-v1.txt` | 1087 Orc Hero | `af578a2312bf62c34aa9dd2c5333ea1a8122259066c56bb591470ccfd2041d89` | **approved** 2026-11-16 |
| `dark-lord-v1.png` | 1536×1024 | `prompts/PROMPT-dark-lord-v1.txt` | 1272 Dark Lord | `0ca60646b37e78f9d90c976a0156cc691fe397c844d145e8125e7e31012e5db9` | **approved** 2026-11-16 |
| `baphomet-v1.png` | 1536×1024 | `prompts/PROMPT-baphomet-v1.txt` | 1039 Baphomet | `f0ff40af7059a5c10fe35263f9112d743753660b06ad8f115cdfe28d34152d23` | **approved** 2026-11-16 |
| `doppelganger-v1.png` (level 2 mid-boss) | 1536×1024 | `prompts/PROMPT-doppelganger-v1.txt` | 1046 Doppelganger | `acba8889f3b06385a6e9b9b738290588cd31ea4f3bc18487dfea624dd1d9a88b` | **approved** 2026-11-17 |

For the Doppelganger, the approved Dark Lord sheet was attached as a third style reference. Its old in-game frames (73×56) are compared with the RO sprite in `qa/doppelganger-current-vs-ro.png`. In the attack poses, the red sword trail is a semi-transparent arc and may leave a faint fringe after keying.

Things to watch when slicing:
- Dark Lord's halo is a thin translucent ring blended with the gray background, so it may key out partly or leave a fringe.
- His shadow cloak is dark violet, close to dark grays but saturated enough to survive the neutral-gray key.

## Reference provenance

`references/*-ro.png`: RO monster sprites downloaded on 2026-11-16 from `https://static.divine-pride.net/images/mobs/png/<id>.png`. Each ID was checked against its Divine Pride monster page title. They are identity references only, never runtime assets. `qa/current-vs-ro.png` compares the old in-game frames with these references.
