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

| `mastering-v1.png` (level 1 mid-boss) | 1536×1024 | `prompts/PROMPT-mastering-v1.txt` | 1090 Mastering | `a9981aef678c8b44fd697f096ebaed707c6d032f99684e241f6bed286f04adb5` | **approved** 2026-11-17 |
| `vesper-v1.png` (level 4 boss) | 1536×1024 | `prompts/PROMPT-vesper-v1.txt` | 1685 Vesper | `36cc72be17ca8fe800c4f106f183d6b80d862d4b30e83455915b23d40fefe5fe` | **approved** 2026-11-17 |
| `seyren-v1.png` (level 5 boss) | 1536×1024 | `prompts/PROMPT-seyren-v1.txt` | 1646 Lord Knight Seyren | `db3e7206764184592505803b4bbe0f3bf854bc9874dbe8e56642794cf926fea5` | **approved** 2026-11-17 |
| `magaleta-v1.png` (level 5 boss) | 1536×1024 | `prompts/PROMPT-magaleta-v1.txt` | 1649 High Priest Margaretha | `1c24acfe0430d2607a942952ba23afeb00b61d455973f7e3af006ecd90d7e8bb` | **approved** 2026-11-17 |
| `amon-ra-v1.png` (level 6 boss) | 1536×1024 | `prompts/PROMPT-amon-ra-v1.txt` | user reference + approved Pyramid boss sheet | `0078394b000d32d409dca387063ee8d4369c4a7e2ee43479b0068ae915dbf131` | **approved** 2026-11-17 |

For the Doppelganger, the approved Dark Lord sheet was attached as a third style reference. Its old in-game frames (73×56) are compared with the RO sprite in `qa/doppelganger-current-vs-ro.png`. In the attack poses, the red sword trail is a semi-transparent arc and may leave a faint fringe after keying.

Second batch (2026-11-17): Mastering, Vesper, Seyren, Magaleta and Amon-Ra.
- For Mastering and Vesper, the user picked the official RO sprites over the old in-game designs (a crowned poring and a golden winged mech).
- Divine Pride serves the same sprite for the Biolab normal and MVP versions (1634/1646, 1637/1649), and it matches the old in-game designs, so there was no design choice to make.
- Amon-Ra keeps the user-supplied reference and the approved Pyramid design: permanently seated on his throne.
- Every sheet in this batch also had the approved Dark Lord V3 sheet attached as a second style reference.
- `qa/batch2-current-vs-ref.png` compares the old frames with the references.

Things to watch when slicing:
- Dark Lord's halo is a thin translucent ring blended with the gray background, so it may key out partly or leave a fringe.
- His shadow cloak is dark violet, close to dark grays but saturated enough to survive the neutral-gray key.
- Seyren and Magaleta have thin translucent smoke wisps, and Vesper has semi-transparent violet flames; any of these may leave a fringe.
- Mastering's poses are wide and short, the opposite proportion of the other figures.

## Reference provenance

`references/*-ro.png`: RO monster sprites downloaded on 2026-11-16 from `https://static.divine-pride.net/images/mobs/png/<id>.png`. Each ID was checked against its Divine Pride monster page title. They are identity references only, never runtime assets. `qa/current-vs-ro.png` compares the old in-game frames with these references.
