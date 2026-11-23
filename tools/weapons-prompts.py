#!/usr/bin/env python3
"""Writes the Codex prompts for the weapon art (WEAPONS-PLAN.md): twelve hero
sheets (weapon-1 and weapon-2 poses), one projectile FX sheet and one skill icon
sheet, into art-clean/weapons-gpt/prompts/. Also writes the projectile style
reference (the current hero projectiles on black). Stdlib only.

Generate each with tools/codex-image.sh (gpt-6-sol, medium effort)."""
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
D = os.path.join(ROOT, 'art-clean', 'weapons-gpt', 'prompts')

# id: (name, class, current weapon, new weapon, pose notes)
HEROES = {
    'aramir': ('Aramir', 'Lord Knight', 'a short sword',
               "a long knight's lance (a polearm about one and a half times his height) with a golden "
               "leaf-shaped spearhead, a gold-and-red grip and a small red pennant below the head",
               'idle holds the lance upright at his side; the attack is a powerful two-handed forward thrust '
               'with the lance level, a short twist of golden light coiled around the spearhead'),
    'zeos': ('Zeos', 'Assassin Cross', 'a purple katar blade',
             'a pair of slim throwing daggers with poison-green glowing blades, one held in each hand in a '
             'reverse grip, and a few spare knives strapped across the chest',
             'idle holds both daggers low and ready; the attack is a sharp throwing motion with a compact fan '
             'of three green knives just leaving the hand (still touching the hand area)'),
    'eric': ('Eric.', 'High Wizard', 'empty-handed spellcasting with a blue magic circle',
             'a slim black magic rod (a short wand) with a three-colour elemental crystal at its tip '
             '(red, ice-blue and yellow facets)',
             'idle holds the rod in one hand against the chest; the attack points the rod straight forward '
             'with a small compact burst of fire at its tip'),
    'dposada': ('Dposada', 'Saint', 'a golden cross staff',
                'a one-handed holy war mace: a golden flanged mace head topped with a small cross, on a short '
                'white-and-gold handle',
                'idle rests the mace on her shoulder; the attack is an overhead smash with a compact burst of '
                'golden holy light at the mace head'),
    'chel_snip': ('Chel_Snip', 'Sniper', 'a golden bow',
                  'a heavy arbalest (a large crossbow) of dark wood and blued steel with brass fittings, held at '
                  'the shoulder',
                  'idle holds the arbalest across the body; the attack aims it forward with a small orange spark '
                  'at the front of the crossbow as the bolt leaves'),
    'viri': ('Viri', 'Monk', 'big fluffy boxing-glove knuckles',
             "a long monk's bo staff of red-lacquered wood with gold end caps, held in both hands (the big "
             'gloves are gone; her hands are wrapped in red cloth)',
             'idle holds the staff diagonally; the attack thrusts the staff forward with a glowing golden '
             'spirit sphere just leaving its tip'),
}

# Weapon 1 pose sets (added 2026-11-23): the same hero in the same crisp style
# as the approved weapon-2 sheet, now holding the ORIGINAL weapon in every pose
# (several base sprites only show it in the attack frame).
# id: (weapon, pose notes)
WEAPON1 = {
    'aramir': ('his short golden knight sword with a red-gold hilt (the sword in the reference sheet), held in one hand',
               'idle holds the sword lowered at his side; the attack is a wide sword slash with a compact golden crescent trail '
               'attached to the blade'),
    'zeos': ('a pair of purple katar blades (assassin punch-daggers) worn on both fists, the blades glowing violet',
             'idle holds both katars ready at the hips; the attack is a fast cross slash with a compact violet crescent trail '
             'attached to the blades'),
    'eric': ('a tall wizard staff of dark wood topped with a glowing blue soul orb inside a silver crescent',
             'idle holds the staff upright beside her; the attack raises the staff with a compact blue magic circle glowing '
             'at its orb'),
    'dposada': ('a tall golden holy staff topped with an ornate cross (the cross staff in the reference sheet)',
                'idle holds the staff upright beside her; the attack lifts the staff high with a compact burst of golden '
                'light around the cross'),
    'chel_snip': ('a golden longbow with an arrow quiver on the back',
                  'idle holds the bow lowered in one hand; the attack draws the bow with an arrow nocked and a small golden '
                  'glint at the arrowhead'),
    'viri': ('big fluffy white boxing-glove knuckles with red markings on both hands (the gloves in the reference sheet)',
             'idle holds both gloves up in a guard; the attack is a straight punch with a compact red fist-shaped burst at '
             'the glove'),
}

HERO_TAIL = """SHEET LAYOUT RULES: exactly eight isolated poses of the SAME hero in two rows of four, evenly spaced. Top row = FRONT view facing down toward the camera. Bottom row = BACK view facing up/away from the camera. Left to right in both rows: idle, move-left, move-right, attack. Exactly one complete figure per pose, never overlapping, never cropped, generous empty gutters between poses. The weapon must be clearly visible and readable in every pose, including the back view. Effects only compact and attached to the weapon (no loose particles, no projectiles flying away, no motion lines). No ground shadow. Uniform flat medium-gray background (#808080) everywhere: no gradient, no texture, no vignette. No text, no labels, no numbers, no frame lines, no grid, no UI, no watermark, no other characters.

STYLE CONTRACT: match the attached reference sheet of this hero EXACTLY: the same chibi Ragnarok Online-style sprite proportions (big head, small body), the same face, hair, outfit, colours and accessories, the same soft painterly shading with a thin dark outline. Only the weapon and the poses change. Crisp, readable at small game scale, no blur, no photorealism, no 3D render look."""

FX = """Generate ONE image, 1536x1024 pixels, landscape, and save it as art-clean/weapons-gpt/weapons-fx-v1.png.

A sheet of FOURTEEN game projectile sprites for a fantasy bullet-hell shooter in the style of the attached projectile examples (glowing, saturated, painterly effects). Arrange them in a grid of three rows: five in the first row, five in the second, four in the third, evenly spaced, each one isolated with generous empty gutters, never touching, never cropped.

IMPORTANT ORIENTATION: every elongated projectile points to the RIGHT (its tip or head on the right side, any trail on the left), because the game rotates each sprite in its direction of travel.

Row 1, left to right:
1. Brandish Spear sweep: a wide golden crescent wave of light with a small spear-tip shape at its leading edge.
2. Spiral Pierce: a long golden lance with a twisting spiral of white-gold light coiled along it.
3. Venom Knife: a small throwing knife with a glowing poison-green blade.
4. Soul Destroyer: a violet-magenta dagger with a long dark-pink energy trail.
5. Fire Bolt: a small dense fireball bolt with a short flame tail.
Row 2, left to right:
6. Cold Bolt: a sharp ice-blue crystal shard with a frosty trail.
7. Lightning Bolt: a short crackling yellow-white lightning bolt.
8. Fire Wall flame: one tall flame tongue lying sideways, its tip pointing right.
9. Holy Smite: a burst of golden holy light shaped like a flanged mace head impact, flaring to the right.
10. Duple Light: two small white-gold light orbs side by side, linked by a thin glow.
Row 3, left to right:
11. Arbalest Bolt: a heavy crossbow bolt with a steel head and brass fletching, with a short orange spark trail.
12. Blast Mine: a round dark-metal spiked mine with a glowing red core (no orientation needed).
13. Finger Offensive: a glowing golden spirit sphere with a short trail.
14. Investigate: an orange-white open-palm shockwave, the palm facing right.

BACKGROUND: pure black (#000000) everywhere, perfectly flat. The game draws these with additive blending, so black means invisible: keep glows soft but let them fade to black, never to gray. No text, no labels, no numbers, no frames, no grid lines, no UI, no watermark."""

ICONS = """Generate ONE image, 1536x1024 pixels, landscape, and save it as art-clean/weapons-gpt/weapons-icons-v1.png.

A sheet of TWELVE square skill icons in EXACTLY the style of the attached skill icon sheet: the same square format, the same ornate dark-gold beveled frame with a small gem at the top, the same rich glowing painterly illustration inside, the same colour language per character. Arrange them in two rows of six, evenly spaced, each icon isolated with generous gutters, all the same size.

Row 1, left to right:
1. Brandish Spear: a golden lance sweeping a wide crescent of light (red-gold palette, like Aramir's icons).
2. Spiral Pierce: a lance thrusting forward wrapped in a spiral of golden light (red-gold).
3. Venom Knife: throwing knives with poison-green blades flying in a fan (purple-green palette, like Zeos's icons).
4. Soul Destroyer: a single violet dagger tearing forward with a magenta energy trail (purple).
5. Bolts: three elemental bolts together, one of fire, one of ice, one of lightning (blue palette, like Eric's icons).
6. Fire Wall: a row of tall flames forming a wall (blue frame palette, orange flames).
Row 2, left to right:
7. Holy Smite: a golden holy mace striking with a burst of light (gold-white palette, like Dposada's icons).
8. Duple Light: two bright holy light orbs (gold-white).
9. Arbalest Bolt: a heavy crossbow firing a steel bolt (green-gold palette, like Chel_Snip's icons).
10. Blast Mine: a spiked mine bursting into an orange explosion (green-gold).
11. Finger Offensive: a monk's staff launching golden spirit spheres (red-orange palette, like Viri's icons).
12. Investigate: an open palm striking with an orange shockwave (red-orange).

No text, no labels, no numbers, no captions under the icons (unlike the reference). Flat medium-gray background (#808080) between and around the icons. No watermark."""


def projectile_style_ref():
    spec = importlib.util.spec_from_file_location('sn', os.path.join(HERE, 'slice-niflheim.py'))
    sn = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sn)
    m = json.load(open(os.path.join(ROOT, 'public/assets/manifest.json')))
    img = sn.Img.from_any(os.path.join(ROOT, 'public/assets/sheet.png'))
    # index 0 of each strip is the sheet's label crop: skip it
    items = [(c, i) for c in m['characters'] for i in range(1, len(m['characters'][c]['projectiles']))]
    k, cw, ch, cols = 2, 340, 180, 5
    rows = (len(items) + cols - 1) // cols
    W, H = cw * cols, ch * rows
    px = bytearray([0, 0, 0, 255] * W * H)
    for n, (c, i) in enumerate(items):
        r = m['characters'][c]['projectiles'][i]
        ox, oy = (n % cols) * cw + 10, (n // cols) * ch + 10
        for y in range(min(r['h'] * k, ch - 20)):
            for x in range(min(r['w'] * k, cw - 20)):
                j = ((r['y'] + y // k) * img.w + r['x'] + x // k) * 4
                a = img.px[j + 3]
                o = ((oy + y) * W + ox + x) * 4
                for t in range(3):
                    px[o + t] = img.px[j + t] * a // 255
    sn.encode_rgba(os.path.join(ROOT, 'art-clean', 'weapons-gpt', 'references', 'projectiles-style.png'), W, H, px)


def main():
    os.makedirs(D, exist_ok=True)
    for hid, (name, cls, w1, w2, act) in HEROES.items():
        txt = (f"Generate ONE image, 1536x1024 pixels, landscape, and save it as "
               f"art-clean/weapons-gpt/{hid}-weapon2-v1.png.\n\n"
               f"A character sprite sheet of ONE playable hero: {name}, the {cls}, exactly the character shown "
               f"in the attached reference sheet (it shows, left to right: front idle, front attack, back idle, "
               f"back attack, with the hero's current weapon, {w1}).\n\n"
               f"Redraw this same hero wielding a different weapon instead: {w2}. Pose notes: {act}.\n\n"
               f"{HERO_TAIL}\n")
        with open(os.path.join(D, f'PROMPT-{hid}-weapon2-v1.txt'), 'w', encoding='utf-8') as f:
            f.write(txt)
    for hid, (w1, act) in WEAPON1.items():
        name, cls = HEROES[hid][0], HEROES[hid][1]
        txt = (f"Generate ONE image, 1536x1024 pixels, landscape, and save it as "
               f"art-clean/weapons-gpt/{hid}-weapon1-v1.png.\n\n"
               f"A character sprite sheet of ONE playable hero: {name}, the {cls}. Two references are attached: "
               f"the hero's original sprites ({hid}-current.png) and an approved sprite sheet of the same hero holding "
               f"another weapon ({hid}-weapon2-v1.png).\n\n"
               f"Redraw the approved sheet EXACTLY (same character design, same crisp rendering style, same scale, "
               f"same layout and the same eight poses), but with the hero wielding this weapon instead: {w1}. "
               f"Pose notes: {act}.\n\n"
               f"{HERO_TAIL.replace('match the attached reference sheet of this hero EXACTLY', 'match the attached approved sheet of this hero EXACTLY')}\n")
        with open(os.path.join(D, f'PROMPT-{hid}-weapon1-v1.txt'), 'w', encoding='utf-8') as f:
            f.write(txt)
    with open(os.path.join(D, 'PROMPT-weapons-fx-v1.txt'), 'w', encoding='utf-8') as f:
        f.write(FX + '\n')
    with open(os.path.join(D, 'PROMPT-weapons-icons-v1.txt'), 'w', encoding='utf-8') as f:
        f.write(ICONS + '\n')
    projectile_style_ref()
    print(sorted(os.listdir(D)))


if __name__ == '__main__':
    main()
