#!/usr/bin/env python3
"""Reference crops for the second-weapon art (Codex): each hero's current idle /
attack / back-idle / back-attack sprites, 3x nearest-neighbour on flat #808080,
so the generator keeps the same character. Research only, never runtime art.
Writes art-clean/weapons-gpt/references/<hero>-current.png. Stdlib only."""
import importlib.util, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sn', os.path.join(HERE, 'slice-niflheim.py'))
sn = importlib.util.module_from_spec(spec); spec.loader.exec_module(sn)
ROOT = os.path.dirname(HERE)
m = json.load(open(os.path.join(ROOT, 'public/assets/manifest.json')))
img = sn.Img.from_any(os.path.join(ROOT, 'public/assets/sheet.png'))
POSES = ['idle', 'attack', 'upIdle', 'upAttack']
K, PAD = 3, 24
for cid, c in m['characters'].items():
    rs = [c['poses'][p] for p in POSES]
    cw = max(r['w'] for r in rs) * K + PAD * 2
    ch = max(r['h'] for r in rs) * K + PAD * 2
    W, H = cw * len(rs), ch
    px = bytearray([128, 128, 128, 255] * W * H)
    for k, r in enumerate(rs):
        ox, oy = k * cw + PAD, ch - PAD - r['h'] * K
        for y in range(r['h'] * K):
            for x in range(r['w'] * K):
                i = ((r['y'] + y // K) * img.w + r['x'] + x // K) * 4
                a = img.px[i + 3]
                if a < 24:
                    continue
                o = ((oy + y) * W + ox + x) * 4
                for j in range(3):  # alpha-blend onto the gray
                    px[o + j] = (img.px[i + j] * a + 128 * (255 - a)) // 255
    out = os.path.join(ROOT, 'art-clean', 'weapons-gpt', 'references', f'{cid}-current.png')
    sn.encode_rgba(out, W, H, px)
    print(cid, W, H)
