# Second weapons GPT image generation record

Art for the heroes' two weapons (see `WEAPONS-PLAN.md`): one pose sheet per hero for each weapon (12 in total), plus a projectile sheet and a skill-icon sheet.

**Generation:** `tools/codex-image.sh`, which runs the Codex CLI (`codex-cli 0.169.0`, `image_gen` tool) pinned to **gpt-6-sol at medium reasoning effort**. Each image is copied byte-for-byte from its own Codex session folder. Sources are immutable: a correction is generated as `-v2`.

**Prompts:** `prompts/PROMPT-*.txt`, written by `tools/weapons-prompts.py`. That script also builds the references:
- `references/<hero>-current.png`: the hero's current idle, attack, back idle and back attack, 3× nearest-neighbor on #808080, made by `tools/weapons-refs.py`. Each hero sheet attaches its own, so the character stays the same and only the weapon changes.
- `references/projectiles-style.png`: the current hero projectiles on black.
- `references/skills-style.png`: a copy of `Characters/Character Skills.png`.

All of these are the project's own art, used for research only.

## Candidate outputs

| File | Size | Attached reference | sha256 | Status |
|---|---|---|---|---|
| `aramir-weapon2-v1.png` | 1536×1024 | `aramir-current.png` | `5ef1e77170be562908616908dcfa6eeacfda3f8b45753bc7cd55386d35d8838d` | **approved** 2026-11-23 |
| `zeos-weapon2-v1.png` | 1536×1024 | `zeos-current.png` | `3356347a57d3b0813bb55de236f577c028aaf7a240e6547e5e2db2dff0fe933b` | **approved** 2026-11-23 |
| `eric-weapon2-v1.png` | 1536×1024 | `eric-current.png` | `5b5f2bc9249d606962d4af6455535491932dbe554616134f701630a9af7fd673` | **approved** 2026-11-23 |
| `dposada-weapon2-v1.png` | 1536×1024 | `dposada-current.png` | `a386b5797b07b993a30c87e4d1117cd913d0805aae8d1b625809d5aa41893738` | **approved** 2026-11-23 |
| `chel_snip-weapon2-v1.png` | 1536×1024 | `chel_snip-current.png` | `8d3236363f025e97da9098943076c6d565d964f33829bcf875209b31746c7968` | **approved** 2026-11-23 |
| `viri-weapon2-v1.png` | 1536×1024 | `viri-current.png` | `4e374f479dd3bfaf280fcadd146560c4d196e4bdb91abef8e21b8219ddea8cf1` | **approved** 2026-11-23 |
| `aramir-weapon1-v1.png` | 1536×1024 | `aramir-current.png` + `aramir-weapon2-v1.png` | `be075d0a7a3fbf55d6c301a20d285f72866e726bcbf081418302ae731253ed03` | **approved** 2026-11-23 |
| `zeos-weapon1-v1.png` | 1536×1024 | `zeos-current.png` + `zeos-weapon2-v1.png` | `251856c9a715c7dc2d0d7496e39262b9852dcfe67a9807f23f05552742290fef` | **approved** 2026-11-23 |
| `eric-weapon1-v1.png` | 1536×1024 | `eric-current.png` + `eric-weapon2-v1.png` | `b4a09df444e9923a69044cec655bc250fe66720b3bfdf7175d3118ebf61ae5d7` | **approved** 2026-11-23 |
| `dposada-weapon1-v1.png` | 1536×1024 | `dposada-current.png` + `dposada-weapon2-v1.png` | `52ec8efa129b06fbf9312cc8b5efe82a3e0eff8ef6f5b8077b88147df0878173` | **approved** 2026-11-23 |
| `chel_snip-weapon1-v1.png` | 1536×1024 | `chel_snip-current.png` + `chel_snip-weapon2-v1.png` | `2cc53c50630c5961c820cccdd9590c6feb27774f1547da022bd2a9afd3e50a77` | **approved** 2026-11-23 |
| `viri-weapon1-v1.png` | 1536×1024 | `viri-current.png` + `viri-weapon2-v1.png` | `73a368e39d7f40e50793709799e70d88887bbb7638056d57ddf83fca9ea1a204` | **approved** 2026-11-23 |
| `weapons-fx-v1.png` | 1536×1024 | `projectiles-style.png` | `d9050868d0ddc64f865f78f32efd51bcfffd38b8edfdb12ca8baffe63e569722` | **approved** 2026-11-23 |
| `weapons-icons-v1.png` | 1536×1024 | `skills-style.png` | `4eed0b1c5f404d1412146d84b370e1b96bbe75ae501b3605de107c3e412041e1` | **approved** 2026-11-23 |

## Notes

- **Weapon-1 sets:** added after weapon 2, at the user's request, so the active weapon is visible in every pose. In several base sprites the weapon only appeared in the attack frame (Eric cast empty-handed). Each one is generated from the hero's approved weapon-2 sheet, so both sets share one style. The base sprites stay for the portrait and the select screen. Zeos's weapon-1 sheet kept the strap of green knives on the chest from the weapon-2 reference; it was accepted as is.

- **Style:** the hero sheets keep each character's identity but come out with crisper pixel art than the original painterly sprites. Accepted by the user.
- **Projectiles:** drawn on pure black because the game draws player shots with additive blending, so black is invisible and no keying is needed. Elongated shots point right, since the renderer rotates each one in its direction of travel.
- **Slicing:** `tools/slice-weapons.py` (2 rows × 4 poses per hero, cleaned with the Mobs V3 passes, then an alpha-premultiplied box downscale ×3 so nearest filtering doesn't shimmer). Projectiles are downscaled ×2 and icons ×3. Dposada's mace glow reaches the crop edge in both attack poses and has per-frame ceilings in the matte gate.
