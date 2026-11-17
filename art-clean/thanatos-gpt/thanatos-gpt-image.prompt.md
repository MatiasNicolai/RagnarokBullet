# Thanatos Tower GPT image generation record

All sources are generated through the Codex CLI (`codex-cli 0.169.0`, `image_gen.imagegen` tool, ChatGPT login; the tool does not expose the model name). Codex's Windows sandbox can't write to the workspace, so each image is copied byte-for-byte from `~/.codex/generated_images/<session>/` into this folder. Generated sources are immutable: a rejected image is replaced by a new `-v2`, never edited in place.

Prompts: `prompts/PROMPT-*.txt`. Style reference always attached: the approved Niflheim sheet of the same kind.

## Candidate outputs

| File | Size | Prompt | Attached references | sha256 | Status |
|---|---|---|---|---|---|
| `thanatos-map-v1.png` | 793×1983 | `PROMPT-map-v1.txt` | `niflheim-gpt/niflheim-map-gpt-image-2-medium-v1.png` | `55db4ff682f4310dfa8c9666553ed19738f6580573bb628668cc13d76d4ce9c0` | **approved** 2026-11-16 |
| `thanatos-mobs-lower-v1.png` | 1536×1024 | `PROMPT-mobs-lower-v1.txt` | Niflheim mob sheet + refs 1700, 1702, 1701, 1703 | `5680b1859b631c1b22574b371702e46205e5a1868d1b334375f00b836dcd942b` | **approved** 2026-11-16 |
| `thanatos-mobs-upper-v1.png` | 1536×1024 | `PROMPT-mobs-upper-v1.txt` | Niflheim mob sheet + refs 20780, 20775, 20779, 20782 | `c0640dfa0bc76ac44062e1e08afef91962b11a587fd8abe31d65baf3c4d18314` | **approved** 2026-11-16 |
| `thanatos-fragments-v1.png` | 1536×1024 | `PROMPT-fragments-v1.txt` | Niflheim boss sheet + refs 1704–1707 | `e20edde53b13bb4158a6de718a44f6af8397c9b8eba0ad539faa0b24185ee987` | **approved** 2026-11-16 |
| `thanatos-boss-form1-v1.png` | 1536×1024 | `PROMPT-boss-form1-v1.txt` | Niflheim boss sheet + ref 1708 | `2166124b4c7c000b4970c7b2824dfa940ebc1046e481863366d2c26c66ce5f9b` | **approved** 2026-11-16 |
| `thanatos-boss-form2-v1.png` | 1536×1024 | `PROMPT-boss-form2-v1.txt` | form-I v1 + Niflheim boss sheet + ref 1708 | `e672ab2b21a0b8565a15bf5c19366441b5d8be4460eb06ccc72c6286179829d0` | **approved** 2026-11-16 |

Things to watch when slicing:
- Faint ground shadows under the feet in the mob and fragment sheets.
- Dolor is small, about 60 px tall.
- Form II has a soft violet glow blended into the gray background, which the neutral-gray key may leave as a violet fringe.

## Reference provenance

`references/*-ro.png`: 13 Ragnarok Online monster sprites downloaded on 2026-11-16 from Divine Pride's static monster images (`https://static.divine-pride.net/images/mobs/png/<id>.png`). They are for visual-identity research only and are never runtime assets.

IDs:
- 1700 Dame of Sentinel
- 1701 Mistress of Shelter
- 1702 Baroness of Retribution
- 1703 Lady Solace
- 1704 Odium of Thanatos
- 1705 Despero of Thanatos
- 1706 Maero of Thanatos
- 1707 Dolor of Thanatos
- 1708 Thanatos Phantom (Memory of Thanatos)
- 20775 Anger of Thanatos
- 20779 Void Mimic
- 20780 Book of Death
- 20782 Crow Duke

The roster was verified against the Divine Pride map database (`tha_t01`–`tha_t12`). Contact sheet: `qa/contact-references.png`.
