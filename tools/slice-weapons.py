#!/usr/bin/env python3
"""Second weapons (WEAPONS-PLAN.md): slice the approved Codex sheets into runtime
atlases (deterministic, technical extraction only, no redraw).

Sources (read-only; see art-clean/weapons-gpt/weapons-gpt-image.prompt.md):
  art-clean/weapons-gpt/<hero>-weapon<1|2>-v1.png  (1536x1024) one hero holding that weapon:
      top row front idle / move-left / move-right / attack, bottom row the back view
  art-clean/weapons-gpt/weapons-fx-v1.png      (1536x1024) 14 projectiles on black, rows 5/5/4
  art-clean/weapons-gpt/weapons-icons-v1.png   (1536x1024) 12 skill icons on gray, rows 6/6

Outputs (public/assets-v2/weapons/):
  heroes.png + .json  the six weapon-2 pose sets stacked (one band per hero);
  heroes-w1.png/json  the same for weapon 1. Keys
                      idle/moveL/moveR/attack/upIdle/upMoveL/upMoveR/upAttack, the
                      same names src/render/renderer.js playerPose() reads
  fx.png + .json      projectiles by key (spearArc, spiral, ...), opaque on black:
                      the game draws them additively, so black is invisible
  icons.png + .json   [basic, focus] skill icons per hero
  art-clean/weapons-gpt/qa/contact-*.png, report-weapons.json

The hero sheets reuse the Mobs V3 cleanup (slice-mobs-v3.py -> slice-thanatos.py
-> slice-niflheim.py, none of them edited). Everything is downscaled with an
alpha-premultiplied box filter: the game draws sprites with nearest filtering,
and a 350 px figure shown at 64 px would shimmer.

Usage: python tools/slice-weapons.py [--qa-on-error]
Requires only Python 3 stdlib. Nonzero exit and nothing written when a gate fails.
"""
import argparse
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('slice_mobs_v3', os.path.join(HERE, 'slice-mobs-v3.py'))
mv3 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mv3)
st, sn = mv3.st, mv3.sn

SRC = os.path.join('art-clean', 'weapons-gpt')
OUT = os.path.join('public', 'assets-v2', 'weapons')
QA = os.path.join('art-clean', 'weapons-gpt', 'qa')

HEROES = ['aramir', 'zeos', 'eric', 'dposada', 'chel_snip', 'viri']
ROW_POSES = {'down': ['idle', 'moveL', 'moveR', 'attack'],
             'up': ['upIdle', 'upMoveL', 'upMoveR', 'upAttack']}
FX_KEYS = [['spearArc', 'spiral', 'venom', 'soulDestroyer', 'fireBolt'],
           ['coldBolt', 'lightningBolt', 'fireWall', 'mace', 'dupleLight'],
           ['arbalest', 'mine', 'finger', 'investigate']]
ICON_ORDER = [['aramir', 'aramir', 'zeos', 'zeos', 'eric', 'eric'],
              ['dposada', 'dposada', 'chel_snip', 'chel_snip', 'viri', 'viri']]

# (weapon index in the source file names, output sheet). Weapon 1 sets were
# added after weapon 2 so the active weapon shows in every pose (2026-11-23).
HERO_SETS = [('weapon2', 'heroes'), ('weapon1', 'heroes-w1')]

SCALE_HERO = 3    # ~350 px figures -> ~117 px, the size of the base hero sprites
SCALE_FX = 2
SCALE_ICON = 3
HERO_W, HERO_H = (50, 600), (150, 520)   # gates, source px

# Frames whose edge-touching "bright-neutral" pixels are art: the soft golden
# glow GPT drew around Dposada's weapon head (the mace in set 2, the cross staff
# in set 1) in the attack poses, which reaches the crop edge. Both checked on a
# dark background at 2x on 2026-11-23: a pale halo, no gray box. The frame tags
# are shared by the two sets, so each ceiling covers the larger of the two. Ceilings sit a little above the measured mass, so a real matte
# regression still fails (shared with the Mobs V3 validator).
mv3.ART_OK.update({
    'dposada.down.attack': {'edge': 750},    # measured 425 (mace) / 643 (cross staff)
    'dposada.up.upAttack': {'edge': 950},    # measured 826
})
FX_MIN = 12                              # px, smallest projectile side
FX_LUM = 14                              # 'lit' threshold on black (max channel)


# ------------------------------------------------------------------ helpers
def downscale(img, k):
    """Alpha-premultiplied k x k box filter (floor size)."""
    W, H = img.w // k, img.h // k
    out = bytearray(W * H * 4)
    s, IW, kk = img.px, img.w, k * k
    for y in range(H):
        for x in range(W):
            r = g = b = a = 0
            for yy in range(y * k, y * k + k):
                i = (yy * IW + x * k) * 4
                for _ in range(k):
                    al = s[i + 3]
                    r += s[i] * al; g += s[i + 1] * al; b += s[i + 2] * al; a += al
                    i += 4
            o = (y * W + x) * 4
            if a:
                out[o] = r // a; out[o + 1] = g // a; out[o + 2] = b // a
                out[o + 3] = a // kk
    return sn.Img(W, H, out)


def scale_rect(r, k, W, H):
    x0, y0 = r['x'] // k, r['y'] // k
    x1 = min(W, -(-(r['x'] + r['w']) // k))
    y1 = min(H, -(-(r['y'] + r['h']) // k))
    return {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}


def stack(imgs):
    W = max(i.w for i in imgs)
    px = bytearray()
    for i in imgs:
        if i.w != W:
            raise ValueError('stacked sheets must share a width')
        px += i.px
    return sn.Img(W, sum(i.h for i in imgs), px)


# ------------------------------------------------------------------ heroes
def slice_hero(img, hid, warnings, errors, key=None):
    key = key or hid   # sheet key (the hero has one sheet per weapon)
    W = img.w
    rc = img.row_counts(0, W - 1, 0, img.h - 1)
    bands = [b for b in sn.runs(rc, 20, 6, 60) if 120 <= b[1] - b[0] + 1 <= 520]
    if len(bands) != 2:
        errors.append(f'{hid}: {len(bands)} pose rows found (want 2): {bands}')
        return None
    cells = {}
    for band, side in zip(bands, ('down', 'up')):
        cc = img.col_counts(band[0], band[1], 0, W - 1)
        cells[side] = sn.fixed_cells(cc, 0, W - 1, 4, f'{hid}.{side}', warnings,
                                     span=W // 8, min_gap=3, nearest=True)
    celldivs = [[c[1] for c in cells[s][:-1]] for s in ('down', 'up')]
    sec = sn.components(img, 0, bands[0][0], W - 1, bands[1][1])
    owners = sn.vote_owner(sec, bands, celldivs)
    pools, home = {}, {}
    for k, c in enumerate(sec):
        pools.setdefault(owners[k], []).append(c)
        bi, ci = owners[k]
        tag = None
        if bi is not None:
            side = ('down', 'up')[bi]
            tag = sn.frame_tag(hid, side, ROW_POSES[side][ci])
        for m in c['members']:
            home[m] = tag
    sn.PANEL_HOME.setdefault(key, {}).update(home)
    poses = {}
    for bi, (band, side) in enumerate(zip(bands, ('down', 'up'))):
        for ci, ((a, b), pose) in enumerate(zip(cells[side], ROW_POSES[side])):
            tag = sn.frame_tag(hid, side, pose)
            r = sn.figure_sprite(img, a, b, band, 0, W - 1, tag, pools.get((bi, ci), []), errors)
            r['keep'] = set()
            sn.gate_rect(r, tag, HERO_W, HERO_H, errors)
            poses[pose] = (tag, r)
    return poses


def clean_hero(img, hid, poses, errors, stats, key=None):
    key = key or hid
    rects = list(poses.values())
    bg = sn.sheet_bg_sample(img, errors, key)
    shadow = sum(st.remove_ground_shadow(img, r, bg) + mv3.remove_flat_shadow(img, r, bg)
                 for _, r in rects)
    alpha_before = bytes(img.px[3::4])
    stats[key] = {'frames': {}}
    sn.decontaminate(img, rects, key, errors, stats[key])
    refilled = sum(mv3.refill_small_holes(img, r, alpha_before) for _, r in rects)
    stats[key]['shadow_removed'] = shadow
    stats[key]['holes_refilled'] = refilled
    mv3.validate_clean(stats[key], errors)
    for _, r in rects:
        r.pop('keep', None)


# ------------------------------------------------------------------ fx (black)
def lit_counts(img, axis, a0, a1, b0, b1):
    """Count lit pixels per row (axis='y') or column (axis='x')."""
    d, W = img.px, img.w
    out = []
    if axis == 'y':
        for y in range(a0, a1 + 1):
            n = 0
            for x in range(b0, b1 + 1):
                i = (y * W + x) * 4
                if max(d[i], d[i + 1], d[i + 2]) > FX_LUM:
                    n += 1
            out.append(n)
    else:
        for x in range(a0, a1 + 1):
            n = 0
            for y in range(b0, b1 + 1):
                i = (y * W + x) * 4
                if max(d[i], d[i + 1], d[i + 2]) > FX_LUM:
                    n += 1
            out.append(n)
    return out


def merge_to(runs_, n):
    """Merge the closest neighbouring runs until exactly n remain (a split glow)."""
    runs_ = [list(r) for r in runs_]
    while len(runs_) > n:
        gaps = [(runs_[i + 1][0] - runs_[i][1], i) for i in range(len(runs_) - 1)]
        _, i = min(gaps)
        runs_[i][1] = runs_[i + 1][1]
        del runs_[i + 1]
    return runs_


def slice_fx(img, warnings, errors):
    for i in range(0, len(img.px), 4):   # opaque: drawn additively on black
        img.px[i + 3] = 255
    rows = sn.runs(lit_counts(img, 'y', 0, img.h - 1, 0, img.w - 1), 2, 24, 12)
    if len(rows) < 3:
        errors.append(f'fx: {len(rows)} rows found (want 3)')
        return {}
    rows = merge_to(rows, 3)
    out = {}
    for (y0, y1), keys in zip(rows, FX_KEYS):
        cols = sn.runs(lit_counts(img, 'x', 0, img.w - 1, y0, y1), 1, 10, 6)
        if len(cols) < len(keys):
            errors.append(f'fx row {keys[0]}..: {len(cols)} items (want {len(keys)})')
            continue
        if len(cols) > len(keys):
            warnings.append(f'fx row {keys[0]}..: merged {len(cols)} runs into {len(keys)}')
            cols = merge_to(cols, len(keys))
        for (x0, x1), key in zip(cols, keys):
            ys = [y for y, n in zip(range(y0, y1 + 1), lit_counts(img, 'y', y0, y1, x0, x1)) if n]
            r = sn.pad_clamp({'x': x0, 'y': ys[0], 'w': x1 - x0 + 1, 'h': ys[-1] - ys[0] + 1},
                             4, 0, 0, img.w - 1, img.h - 1)
            if min(r['w'], r['h']) < FX_MIN:
                errors.append(f'fx.{key}: {r["w"]}x{r["h"]} is a sliver')
            out[key] = r
    return out


# ------------------------------------------------------------------ icons (gray)
def slice_icons(img, warnings, errors):
    rows = [b for b in sn.runs(img.row_counts(0, img.w - 1, 0, img.h - 1), 60, 6, 80)]
    if len(rows) != 2:
        errors.append(f'icons: {len(rows)} rows found (want 2)')
        return {}
    out = {h: [None, None] for h in HEROES}
    for (y0, y1), heroes in zip(rows, ICON_ORDER):
        cols = sn.runs(img.col_counts(y0, y1, 0, img.w - 1), 20, 6, 80)
        if len(cols) != 6:
            errors.append(f'icons row: {len(cols)} icons found (want 6)')
            continue
        for k, ((x0, x1), hid) in enumerate(zip(cols, heroes)):
            ys = [y for y, n in zip(range(y0, y1 + 1), img.row_counts(x0, x1, y0, y1)) if n > 3]
            r = {'x': x0, 'y': ys[0], 'w': x1 - x0 + 1, 'h': ys[-1] - ys[0] + 1}
            if not 0.8 <= r['w'] / r['h'] <= 1.25:
                errors.append(f'icons.{hid}[{k % 2}]: {r["w"]}x{r["h"]} is not square')
            out[hid][k % 2] = r
    return out


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--qa-on-error', action='store_true')
    args = ap.parse_args()
    root = os.path.dirname(HERE)
    src, out, qa = (os.path.join(root, p) for p in (SRC, OUT, QA))
    warnings, errors, stats = [], [], {}
    report = {'slicer_core': {f'tools/{f}': sn.sha256(os.path.join(HERE, f)) for f in
                              ('slice-mobs-v3.py', 'slice-thanatos.py', 'slice-niflheim.py')},
              'inputs': {}, 'warnings': warnings}

    # heroes: one pose set per weapon. Slice + clean at full size, then
    # downscale and stack the six heroes of each set into one sheet.
    sets = {}
    for weapon, sheet in HERO_SETS:
        hero_imgs, hero_rects = [], {}
        for hid in HEROES:
            key = f'{hid}-{weapon}'
            img = st.load_keyed(os.path.join(src, f'{key}-v1.png'), key, errors, report)
            poses = slice_hero(img, hid, warnings, errors, key)
            if poses is None:
                continue
            clean_hero(img, hid, poses, errors, stats, key)
            small = downscale(img, SCALE_HERO)
            oy = sum(i.h for i in hero_imgs)
            rects = {}
            for pose, (_, r) in poses.items():
                sr = scale_rect(r, SCALE_HERO, small.w, small.h)
                sr['y'] += oy
                rects[pose] = sr
            hero_imgs.append(small)
            hero_rects[hid] = {'poses': rects}
        sets[sheet] = (hero_imgs, hero_rects)

    fx_img = sn.Img.from_any(os.path.join(src, 'weapons-fx-v1.png'))
    report['inputs']['fx'] = {'file': 'weapons-fx-v1.png', 'sha256': sn.sha256(os.path.join(src, 'weapons-fx-v1.png')),
                              'size': [fx_img.w, fx_img.h]}
    fx = slice_fx(fx_img, warnings, errors)
    icon_img = st.load_keyed(os.path.join(src, 'weapons-icons-v1.png'), 'icons', errors, report)
    icons = slice_icons(icon_img, warnings, errors)

    if errors:
        print('ERRORS (gates rejected these crops; nothing was written):')
        for e in errors:
            print(f'  !! {e}')
        if args.qa_on_error:
            os.makedirs(qa, exist_ok=True)
            for sheet, (hero_imgs, hero_rects) in sets.items():
                if not hero_imgs:
                    continue
                big = stack(hero_imgs)   # rects are already in downscaled, stacked space
                sn.draw_contact(big, [(f'{h}.{p}', r) for h, v in hero_rects.items() for p, r in v['poses'].items()],
                                os.path.join(qa, f'REJECTED-contact-weapons-{sheet}.png'), cols=8)
        return 1

    os.makedirs(out, exist_ok=True)
    os.makedirs(qa, exist_ok=True)
    for sheet, (hero_imgs, hero_rects) in sets.items():
        heroes = stack(hero_imgs)
        manifest = {'sheet': f'{sheet}.png', 'size': {'w': heroes.w, 'h': heroes.h},
                    'characters': {h: {'poses': v['poses']} for h, v in hero_rects.items()}}
        sn.encode_rgba(os.path.join(out, f'{sheet}.png'), heroes.w, heroes.h, heroes.px)
        with open(os.path.join(out, f'{sheet}.json'), 'w') as f:
            json.dump(manifest, f, indent=2)
        sn.draw_contact(heroes, [(f'{h}.{p}', r) for h, v in manifest['characters'].items() for p, r in v['poses'].items()],
                        os.path.join(qa, f'contact-weapons-{sheet}.png'), cols=8)

    fx_small = downscale(fx_img, SCALE_FX)
    fx_rects = {k: scale_rect(r, SCALE_FX, fx_small.w, fx_small.h) for k, r in fx.items()}
    sn.encode_rgba(os.path.join(out, 'fx.png'), fx_small.w, fx_small.h, fx_small.px)
    with open(os.path.join(out, 'fx.json'), 'w') as f:
        json.dump({'sheet': 'fx.png', 'size': {'w': fx_small.w, 'h': fx_small.h}, 'fx': fx_rects}, f, indent=2)
    sn.draw_contact(fx_small, list(fx_rects.items()), os.path.join(qa, 'contact-weapons-fx.png'), cols=7)

    ic_small = downscale(icon_img, SCALE_ICON)
    ic_rects = {h: [scale_rect(r, SCALE_ICON, ic_small.w, ic_small.h) for r in v] for h, v in icons.items()}
    sn.encode_rgba(os.path.join(out, 'icons.png'), ic_small.w, ic_small.h, ic_small.px)
    with open(os.path.join(out, 'icons.json'), 'w') as f:
        json.dump({'sheet': 'icons.png', 'size': {'w': ic_small.w, 'h': ic_small.h}, 'icons': ic_rects}, f, indent=2)
    sn.draw_contact(ic_small, [(f'{h}[{i}]', r) for h, v in ic_rects.items() for i, r in enumerate(v)],
                    os.path.join(qa, 'contact-weapons-icons.png'), cols=6)

    report['decontamination'] = stats
    report['outputs'] = {f: sn.sha256(os.path.join(out, f)) for f in sorted(os.listdir(out))
                         if f.endswith(('.png', '.json'))}
    with open(os.path.join(qa, 'report-weapons.json'), 'w') as f:
        json.dump(report, f, indent=2, default=list)
    if warnings:
        print('WARNINGS:')
        for w in warnings:
            print(f'  ! {w}')
    print(f'wrote {out}: {", ".join(sets)} ({heroes.w}x{heroes.h} each), fx {len(fx_rects)}, '
          f'icons {sum(len(v) for v in ic_rects.values())}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
