# Mobs V3 GPT image generation record

Common mobs of levels 2–5 redrawn at the Thanatos standard. Level 1 (Prontera V3) was done earlier, in `art-clean/prontera-gpt/`.

All sources are generated with `tools/codex-image.sh`. That wrapper runs the Codex CLI (`codex-cli 0.169.0`, `image_gen` tool, ChatGPT login) pinned to **gpt-6-sol, medium reasoning effort**, and aborts if Codex reports another model. Codex's Windows sandbox can't write to the workspace, so the wrapper copies each image byte-for-byte from `~/.codex/generated_images/<session>/`. Generated sources are immutable: a rejected image is replaced by a new `-v2`, never edited in place.

Prompts: `prompts/PROMPT-*.txt`. Style reference always attached: the approved Thanatos mob sheet `art-clean/thanatos-gpt/thanatos-mobs-lower-v1.png`. Design rule (user decision, same as Bosses V3): follow the official Ragnarok Online sprite when it differs from the old in-game art.

## Candidate outputs

| File | Size | Prompt | Attached references | sha256 | Status |
|---|---|---|---|---|---|
| `geffen-a-v1.png` | 1536×1024 | `PROMPT-geffen-a-v1.txt` | Thanatos mob sheet + willow, zombie, munak, bongun | `3db60e4c3ba0fae7ce5c957e5dba3951bd1672f072447a3416f9c92b2fad9508` | **approved** 2026-11-21 |
| `geffen-b-v1.png` | 1536×1024 | `PROMPT-geffen-b-v1.txt` | Thanatos mob sheet + nine-tail, deviruchi, marionette, wraith | `8a73f818c16a851f0da5dfb3266dadeb10d43985b552f738b75542e581f86382` | **approved** 2026-11-21 |
| `glastheim-a-v1.png` | 1536×1024 | `PROMPT-glastheim-a-v1.txt` | Thanatos mob sheet + evil-druid, dark-priest, raydric, khalitzburg | `ae78c2b37e08e2a295ec1727f2d8e258a8b22365dbaca1c5acee58bdc1acabfe` | **approved** 2026-11-21 |
| `glastheim-b-v1.png` | 1536×1024 | `PROMPT-glastheim-b-v1.txt` | Thanatos mob sheet + gargoyle, ghoul, whisper, baphomet-jr | `93153c0cdf180a78e1ffbee123ec5dbaa3505985e448568c0956f932e556ffaf` | **approved** 2026-11-21 |
| `juperos-a-v1.png` | 1536×1024 | `PROMPT-juperos-a-v1.txt` | Thanatos mob sheet + dimik, venatu, plasma-b + `Monsters/Juperos monsters 001.png` | `ef789b1affc2e10ceb4917c9ffeb4a03cbce1984b1104a6e9a92036859174c59` | **approved** 2026-11-21 |
| `juperos-b-v1.png` | 1536×1024 | `PROMPT-juperos-b-v1.txt` | Thanatos mob sheet + `Monsters/Juperos monsters 001.png` | `048856cdb602f6490109028f27074719a02a3b799bc5ec3b17b62e9aeaa5415b` | **approved** 2026-11-21 |
| `biolab-a-v1.png` | 1536×1024 | `PROMPT-biolab-a-v1.txt` | Thanatos mob sheet + remover + `Monsters/Biolab monsters 001.png` | `0d36a9d71611ead44bd410f27a5ddc69cd7f559bfd5ceb87dda713de3d2fc7a2` | **approved** 2026-11-21 |
| `biolab-b-v1.png` | 1536×1024 | `PROMPT-biolab-b-v1.txt` | Thanatos mob sheet + `Monsters/Biolab monsters 001.png` | `e0c09d3e2b5f672d83c0a92a736dd437a3c329ff49b7e64cdb89a9383eccfdca` | **approved** 2026-11-21 |

Design split for levels 4 and 5 (user decision, 2026-11-21): mobs that exist in RO follow the official sprite (Dimik, Venatu, Plasma, Remover). The game's own creatures keep their design from the original sheets in `Monsters/` and are only redrawn at the new quality (Guardian, Cell, Sentry, Repair Drone, Spark Beetle, Failed Experiment, Lab Drone, Test Subject, Spore Cloud, Mutant Hound, Serum Turret, Bio-Sludge).

Things to watch when slicing (all handled by `tools/slice-mobs-v3.py`):
- Ground shadows under the feet. Glast Heim's are darker (bg−56…−46) than the Thanatos pass reaches.
- Gray art in the background's tone: Wraith's cloak, Marionette's silver hair, Ghoul's skin shading, Repair Drone's metal dome. The matte gates get per-frame ceilings, and holes the core punched in that art get refilled (≤40 px everywhere, ≤400 px on the closed Repair Drone dome).
- Juperos A hit poses carry small detached "impact" tick marks; they stay inside their own frame.
- Evil Druid: Codex turned the reference's tall antler staff into a branch headdress. Accepted by the user.

## Reference provenance

`references/*-ro.png`: Ragnarok Online monster sprites from Divine Pride's static monster images (`https://static.divine-pride.net/images/mobs/png/<id>.png`), downloaded on 2026-11-21. They are for visual-identity research only and are never runtime assets.

IDs used:
- Geffen: Willow, Zombie, Munak, Bongun, Nine Tail, Deviruchi, Marionette, Wraith.
- Glast Heim: 1117 Evil Druid, 1198 Dark Priest, 1163 Raydric, 1132 Khalitzburg, 1253 Gargoyle, 1036 Ghoul, 1179 Whisper, 1101 Baphomet Jr.
- Juperos: 1670 Dimik, 1676 Venatu, 1697 Plasma (blue; `plasma-r-ro.png`, 1694, was downloaded for comparison but not attached).
- Biolab: 1682 Remover.

The original game sheets in `Monsters/` (Juperos, Biolab) are the project's own art. They are attached as design references for the game's own creatures.

Contact sheet for Geffen: `qa/geffen-ro-references.png`.
