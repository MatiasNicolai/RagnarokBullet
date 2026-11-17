#!/usr/bin/env python3
"""Slice the approved Thanatos Tower sheets into runtime atlases (deterministic, no redraw).

Sources (read-only, never modified; see art-clean/thanatos-gpt/thanatos-gpt-image.prompt.md):
  art-clean/thanatos-gpt/thanatos-mobs-lower-v1.png   (1536x1024) 4 angel ladies
  art-clean/thanatos-gpt/thanatos-mobs-upper-v1.png   (1536x1024) 4 emotion-room mobs
  art-clean/thanatos-gpt/thanatos-fragments-v1.png    (1536x1024) 4 soul fragments (midboss)
  art-clean/thanatos-gpt/thanatos-boss-form1-v1.png   (1536x1024) Thanatos, form I
  art-clean/thanatos-gpt/thanatos-boss-form2-v1.png   (1536x1024) Thanatos, form II
  art-clean/thanatos-gpt/thanatos-map-v1.png          (793x1983)

Outputs (new tree only; public/assets untouched):
  public/assets-v2/thanatos/monsters13.png + .json   angel ladies (lower sheet)
  public/assets-v2/thanatos/monsters14.png + .json   emotion-room mobs (upper sheet)
  public/assets-v2/thanatos/bosses6.png + .json      fragments as bosses (practice)
  public/assets-v2/thanatos/monsters15.json          fragments as inline elites (rects in bosses6.png)
  public/assets-v2/thanatos/bosses7.png + .json      Thanatos: form I on top (y 0..1023),
                                                     form II below (y 1024..2047), keys
                                                     'thanatos' / 'thanatosAwake'
  public/assets-v2/thanatos/maps/thanatos001..007.png (bottom = museum entrance -> top = arena)
  art-clean/thanatos-gpt/qa/contact-*.png, debug-*.png, report-thanatos.json

Method: the same keying, ownership-vote cropping, per-frame matte cleanup and
validation gates as tools/slice-niflheim.py, which this script IMPORTS (one
proven implementation instead of a fork). Only the panel geometry and the gate
ranges are Thanatos-specific. The report records slice-niflheim.py's sha256, so a
change there that alters these outputs shows up in the report diff.

The two Thanatos forms are stacked vertically into one 1536x2048 sheet before
cropping (a byte copy, no resampling) so the renderer can switch forms inside one
texture.

Usage: python tools/slice-thanatos.py [--src DIR] [--out DIR]
Requires only Python 3 stdlib. Nonzero exit and nothing written when a gate fails.
"""
import argparse
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('slice_niflheim', os.path.join(HERE, 'slice-niflheim.py'))
sn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sn)

POSES = sn.POSES

# Panel geometry, measured on the approved v1 sheets after keying (empty-column
# gutters at x737-802 / 753-787 / 745-813, so x=768 splits the columns in all
# three 2x2 sheets; the row gap between panels sits inside y440-548).
SPLIT_X = 768
PANEL_Y = [(0, 490), (491, 1023)]

MOB_SHEETS = {
    'monsters13': {
        'file': 'thanatos-mobs-lower-v1.png',
        'names': [['sentinel', 'retribution'], ['shelter', 'solace']],
    },
    'monsters14': {
        'file': 'thanatos-mobs-upper-v1.png',
        'names': [['deathbook', 'anger'], ['voidmimic', 'crowduke']],
    },
}
FRAG_SHEET = {
    'file': 'thanatos-fragments-v1.png',
    'names': [['odium', 'despero'], ['maero', 'dolor']],
}
# Boss forms: one figure per sheet, two pose rows across the full width.
# Sections measured (rows 17-438 / 491-938), padded; form II sits 1024 lower.
BOSS_FORMS = [
    ('thanatos', 'thanatos-boss-form1-v1.png', 0),
    ('thanatosAwake', 'thanatos-boss-form2-v1.png', 1024),
]
BOSS_SECTIONS = {'down': (0, 479), 'up': (480, 1023)}

# Gates. Ranges sit around the measured v1 sizes with margin; anything outside
# means a divider cut a figure or merged two poses.
MOB_W, MOB_H = (25, 200), (40, 210)
FRAG_W, FRAG_H = (30, 230), (40, 230)        # Dolor is the small one (~60 px)
BOSS_W, BOSS_H = (100, 330), (250, 470)      # form II up.attack measures 453 (club raised past the head)

MAP_TILES = [f'thanatos00{i}' for i in range(1, 8)]

# Ground shadows. The mob and fragment sheets bake a soft gray ellipse under the
# feet, which the prompt asked not to draw. Measured on v1: shadow pixels are
# neutral (chroma <= 10) at bg-35..bg-13 luminance in the bottom ~35 rows, while
# body ink is darker, colored, or (Anger's smoke) within a few levels of bg. The
# pass floods from transparent pixels through shadow-toned neutral pixels only,
# and only inside the foot strip, so ink blocks it and bodies above the feet are
# never reached.
SHADOW_STRIP = 44     # px from the bottom of the frame rect
SHADOW_CHROMA = 10
SHADOW_LUM = (-44, -4)  # luminance relative to the sheet gray


def remove_ground_shadow(img, r, bg):
    W, H, X, Y, IW, d = r['w'], r['h'], r['x'], r['y'], img.w, img.px
    bgl = sum(bg) / 3
    y_top = max(0, H - SHADOW_STRIP)

    def idx(x, y):
        return ((Y + y) * IW + X + x) * 4

    def shadowy(x, y):
        i = idx(x, y)
        if d[i + 3] <= 128:
            return False
        R, G, B = d[i], d[i + 1], d[i + 2]
        if max(R, G, B) - min(R, G, B) > SHADOW_CHROMA:
            return False
        dl = (R + G + B) / 3 - bgl
        return SHADOW_LUM[0] <= dl <= SHADOW_LUM[1]

    seen = bytearray(W * H)
    q = sn.deque()
    for y in range(y_top, H):
        for x in range(W):
            if not shadowy(x, y):
                continue
            # seed: touches a transparent pixel or the rect border
            edge = x == 0 or x == W - 1 or y == H - 1
            if not edge:
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if d[idx(nx, ny) + 3] <= 128:
                        edge = True
                        break
            if edge:
                seen[y * W + x] = 1
                q.append((x, y))
    removed = 0
    while q:
        x, y = q.popleft()
        d[idx(x, y) + 3] = 0
        removed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if y_top <= ny < H and 0 <= nx < W and not seen[ny * W + nx] and shadowy(nx, ny):
                seen[ny * W + nx] = 1
                q.append((nx, ny))
    return removed


def slice_panels(img, names, sheet_key, warnings, errors):
    """2x2 panels of one species each -> {name: {down/up: {pose: rect}}}.
    Same per-panel algorithm as sn.slice_enemies (pose bands by projection,
    per-row nearest-gap dividers, whole-component ownership vote), with the
    panel geometry passed in instead of read from Niflheim globals."""
    entries, debug = {}, []
    for pi, (py0, py1) in enumerate(PANEL_Y):
        for col, name in enumerate(names[pi]):
            px0, px1 = (0, SPLIT_X - 1) if col == 0 else (SPLIT_X, img.w - 1)
            rc = img.row_counts(px0, px1, py0, py1)
            bands = sn.runs(rc, 90, 3, 26, py0)
            bands = [b for b in bands if 36 <= b[1] - b[0] + 1 <= 220]
            rows = [b for b in bands if sn.big_col_count(img, b, px0, px1) >= 4]
            if len(rows) != 2:
                errors.append(f'{name}: {len(rows)} sprite rows found (want 2)')
                continue
            sides = ['down', 'up']
            cells = {}
            for band, key in zip(rows, sides):
                cc = img.col_counts(band[0], band[1], px0, px1)
                cells[key] = sn.fixed_cells(cc, px0, px1, 5, f'{name}.{key}', warnings,
                                            span=(px1 - px0 + 1) // 10, min_gap=3, nearest=True)
            celldivs = [[c[1] for c in cells[key][:-1]] for key in sides]
            sec = sn.components(img, px0, rows[0][0], px1, rows[1][1])
            owners = sn.vote_owner(sec, rows, celldivs)
            pools = {}
            for k, c in enumerate(sec):
                pools.setdefault(owners[k], []).append(c)
            entry = {'down': {}, 'up': {}}
            for bi, (band, key) in enumerate(zip(rows, sides)):
                for i, ((a, b), pose) in enumerate(zip(cells[key], POSES)):
                    tag = sn.frame_tag(name, key, pose)
                    r = sn.figure_sprite(img, a, b, band, px0, px1, tag, pools.get((bi, i), []), errors)
                    r['keep'] = set()
                    entry[key][pose] = r
                    debug.append(r)
            home = {}
            for k, c in enumerate(sec):
                bi, ci = owners[k]
                tag = sn.frame_tag(name, sides[bi], POSES[ci]) if bi is not None else None
                for m in c['members']:
                    home[m] = tag
            sn.PANEL_HOME.setdefault(sheet_key, {}).update(home)
            entries[name] = entry
    return entries, debug


def slice_boss_forms(img, warnings, errors):
    """Each stacked form -> {name: {down/up: {pose: [rect]}}} (single-frame
    arrays, like Niflheim bosses). Cells are fixed 5-way splits at the
    nearest empty gap; the box is the owned figure (whole components by pixel
    majority), so the cape and the raised club stay whole."""
    entries, debug = {}, []
    for name, _file, oy in BOSS_FORMS:
        entry = {'down': {}, 'up': {}}
        for key, (s0, s1) in BOSS_SECTIONS.items():
            sy0, sy1 = s0 + oy, s1 + oy
            cc = img.col_counts(sy0, sy1, 0, img.w - 1)
            cells = sn.fixed_cells(cc, 0, img.w - 1, 5, f'{name}.{key}', warnings,
                                   span=img.w // 10, min_gap=3, nearest=True)
            divs = [c[1] for c in cells[:-1]]
            sec = sn.components(img, 0, sy0, img.w - 1, sy1)
            owners = sn.vote_owner(sec, [(sy0, sy1)], [divs])
            pools, home = {}, {}
            for k, c in enumerate(sec):
                _bi, ci = owners[k]
                pools.setdefault(ci, []).append(c)
                tag = sn.frame_tag(name, key, POSES[ci], 0)
                for m in c['members']:
                    home[m] = tag
            sn.PANEL_HOME.setdefault('bosses7', {}).update(home)
            for i, ((a, b), pose) in enumerate(zip(cells, POSES)):
                tag = f'{name}.{key}.{pose}'
                r = sn.figure_sprite(img, a, b, (sy0, sy1), 0, img.w - 1, tag, pools.get(i, []), errors)
                r['keep'] = set()
                entry[key][pose] = [r]
                debug.append(r)
        entries[name] = entry
    return entries, debug


def gate_mobs(entries, wr, hr, errors):
    for name, e in entries.items():
        for side in ('down', 'up'):
            if sorted(e[side]) != sorted(POSES):
                errors.append(f'{name}.{side}: poses {sorted(e[side])} (want {POSES})')
            seen = []
            for pose in POSES:
                r = e[side].get(pose)
                if not r:
                    continue
                sn.gate_rect(r, f'{name}.{side}.{pose}', wr, hr, errors)
                if pose != 'hit':
                    for (pp, pr) in seen:
                        if pp != 'hit' and r['x'] < pr['x'] + pr['w'] - sn.MAX_OVERLAP:
                            errors.append(f'{name}.{side}.{pose}: overlaps {pp} by '
                                          f'{pr["x"] + pr["w"] - r["x"]}px (multi-pose crop?)')
                seen.append((pose, r))


def gate_bosses(entries, errors):
    for name, e in entries.items():
        for side in ('down', 'up'):
            for pose in POSES:
                frames = e[side][pose]
                if len(frames) != 1:
                    errors.append(f'{name}.{side}.{pose}: {len(frames)} frames (want 1)')
                for i, r in enumerate(frames):
                    sn.gate_rect(r, f'{name}.{side}.{pose}[{i}]', BOSS_W, BOSS_H, errors)


def load_keyed(path, tag, errors, report):
    img = sn.Img.from_any(path)
    bg = sn.sheet_gray_sample(img, errors, tag)
    removed = sn.key_background(img, bg)
    report['inputs'][tag] = {'file': os.path.basename(path), 'sha256': sn.sha256(path),
                             'size': [img.w, img.h], 'gray': bg, 'keyed': removed}
    print(f'source {tag} {img.w}x{img.h} gray={bg} keyed={removed}')
    return img


def stack(top, bottom):
    if top.w != bottom.w:
        raise ValueError('boss forms must share a width to stack')
    return sn.Img(top.w, top.h + bottom.h, bytearray(top.px) + bytearray(bottom.px))


def mob_rects(entries):
    return [(f'{n}.{s}.{p}', r) for n, e in entries.items() for s in ('down', 'up') for p, r in e[s].items()]


def boss_rects(entries):
    return [(f'{n}.{s}.{p}[{i}]', r) for n, e in entries.items() for s in ('down', 'up')
            for p, v in e[s].items() for i, r in enumerate(v)]


def strip_keep(entries):
    for e in entries.values():
        for s in ('down', 'up'):
            for v in e[s].values():
                for r in (v if isinstance(v, list) else [v]):
                    r.pop('keep', None)


# Frames whose edge-touching "bright-neutral" mass is legitimate art, not matte.
# Dolor's back view is a big brown hood (R>G>B by only a few levels, so the
# bg-relative census counts it) that reaches the top of the rect. Verified by a
# 4x zoom on a dark background on 2026-11-16: clean hood, no gray matte. Each entry
# is a ceiling a little above the measured value, so a real matte regression in
# these frames still fails.
EDGE_MASS_ART_OK = {
    'dolor.up.idle': 160,   # measured 123
    'dolor.up.hit': 260,    # measured 216
}


def validate_clean_thanatos(stats, errors):
    found = []
    sn.validate_clean(stats, found)
    for msg in found:
        ftag = msg.split(':', 1)[0]
        ceiling = EDGE_MASS_ART_OK.get(ftag)
        if ceiling is not None and 'edge-touching' in msg \
                and stats['frames'][ftag]['bn_edge_max'] <= ceiling:
            continue
        errors.append(msg)


def slice_map_tiles(mw, mh, mch, mpx):
    """Map rows -> 7 RGB tiles, tile 001 = bottom (museum entrance)."""
    if mch == 4:
        rgb = bytearray(mw * mh * 3)
        for i in range(mw * mh):
            rgb[i * 3:i * 3 + 3] = mpx[i * 4:i * 4 + 3]
        mpx = rgb
    bounds = [round(i * mh / 7) for i in range(8)]
    tiles = []
    for i, tile in enumerate(MAP_TILES):
        y1, y0 = mh - bounds[i], mh - bounds[i + 1]
        th = y1 - y0
        tiles.append((tile, mw, th, bytes(mpx[y0 * mw * 3:y1 * mw * 3]), (y0, y1)))
    return tiles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='art-clean/thanatos-gpt')
    ap.add_argument('--out', default='public/assets-v2/thanatos')
    ap.add_argument('--qa-on-error', action='store_true',
                    help='on gate failure, still draw REJECTED-contact-*.png for diagnosis')
    args = ap.parse_args()
    root = os.path.dirname(HERE)
    src = args.src if os.path.isabs(args.src) else os.path.join(root, args.src)
    out = args.out if os.path.isabs(args.out) else os.path.join(root, args.out)
    qa = os.path.join(root, 'art-clean', 'thanatos-gpt', 'qa')
    warnings, errors = [], []
    report = {'slicer_core': {'file': 'tools/slice-niflheim.py',
                              'sha256': sn.sha256(os.path.join(HERE, 'slice-niflheim.py'))},
              'inputs': {}, 'warnings': warnings}

    # --- crop (nothing written until every gate passes) ---
    sheets = {}
    for key, cfg in MOB_SHEETS.items():
        img = load_keyed(os.path.join(src, cfg['file']), key, errors, report)
        entries, debug = slice_panels(img, cfg['names'], key, warnings, errors)
        gate_mobs(entries, MOB_W, MOB_H, errors)
        sheets[key] = (img, entries, debug)
    frag = load_keyed(os.path.join(src, FRAG_SHEET['file']), 'bosses6', errors, report)
    frag_entries, frag_debug = slice_panels(frag, FRAG_SHEET['names'], 'bosses6', warnings, errors)
    gate_mobs(frag_entries, FRAG_W, FRAG_H, errors)
    forms = [load_keyed(os.path.join(src, f), name, errors, report) for name, f, _ in BOSS_FORMS]
    boss = stack(forms[0], forms[1])
    boss_entries, boss_debug = slice_boss_forms(boss, warnings, errors)
    gate_bosses(boss_entries, errors)

    # --- per-frame matte cleanup (rect geometry untouched) ---
    stats = {}
    jobs = [(k, sheets[k][0], mob_rects(sheets[k][1])) for k in MOB_SHEETS] + [
        ('bosses6', frag, mob_rects(frag_entries)), ('bosses7', boss, boss_rects(boss_entries))]
    shadow_px = {}
    for key, img, rects in jobs:
        if key != 'bosses7':  # the boss forms bake no ground shadow
            bg = sn.sheet_bg_sample(img, errors, key)
            shadow_px[key] = sum(remove_ground_shadow(img, r, bg) for _, r in rects)
            print(f'shadow {key}: removed {shadow_px[key]} px')
    report['ground_shadow_removed'] = shadow_px
    for key, img, rects in jobs:
        stats[key] = {'frames': {}}
        sn.decontaminate(img, rects, key, errors, stats[key])
        validate_clean_thanatos(stats[key], errors)
        fr = stats[key]['frames']
        worst = max(fr.items(), key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
        edge = max(fr.items(), key=lambda kv: kv[1]['bn_edge_max'])
        print(f"decon {key}: matte-removed {sum(v['removed'] for v in fr.values())} "
              f"foreign-erased {sum(v.get('foreign', 0) for v in fr.values())} "
              f"worst-bn {worst[0]}={worst[1]['bn_after'] / max(1, worst[1]['opaque_after']):.3f} "
              f"worst-edge {edge[0]}={edge[1]['bn_edge_max']}px")
    report['decontamination'] = {k: v for k, v in stats.items()}

    if errors:
        print('ERRORS (gates rejected these crops; nothing was written):')
        for e in errors:
            print(f'  !! {e}')
        if args.qa_on_error:
            # diagnostics only: contact sheets of the rejected crops, never runtime assets
            os.makedirs(qa, exist_ok=True)
            for key, img, rects in jobs:
                sn.draw_contact(img, rects, os.path.join(qa, f'REJECTED-contact-{key}.png'),
                                cols=5 if key == 'bosses7' else 10)
            print(f'wrote rejected-crop contact sheets to {qa}')
        return 1

    # --- write ---
    os.makedirs(os.path.join(out, 'maps'), exist_ok=True)
    os.makedirs(qa, exist_ok=True)
    for key, img, rects in jobs:
        sn.draw_contact(img, rects, os.path.join(qa, f'contact-thanatos-{key}.png'),
                        cols=5 if key == 'bosses7' else 10)
    for key in MOB_SHEETS:
        img, entries, debug = sheets[key]
        sn.draw_debug(img, debug, os.path.join(qa, f'debug-thanatos-{key}.png'))
        strip_keep(entries)
        sn.encode_rgba(os.path.join(out, f'{key}.png'), img.w, img.h, img.px)
        with open(os.path.join(out, f'{key}.json'), 'w') as f:
            json.dump({'sheet': f'{key}.png', 'size': {'w': img.w, 'h': img.h}, 'monsters': entries}, f, indent=2)
    sn.draw_debug(frag, frag_debug, os.path.join(qa, 'debug-thanatos-bosses6.png'))
    sn.draw_debug(boss, boss_debug, os.path.join(qa, 'debug-thanatos-bosses7.png'))
    strip_keep(frag_entries)
    strip_keep(boss_entries)
    sn.encode_rgba(os.path.join(out, 'bosses6.png'), frag.w, frag.h, frag.px)
    with open(os.path.join(out, 'monsters15.json'), 'w') as f:
        json.dump({'sheet': 'bosses6.png', 'size': {'w': frag.w, 'h': frag.h}, 'monsters': frag_entries}, f, indent=2)
    frag_bosses = {n: {s: {p: [r] for p, r in e[s].items()} for s in ('down', 'up')}
                   for n, e in frag_entries.items()}
    with open(os.path.join(out, 'bosses6.json'), 'w') as f:
        json.dump({'sheet': 'bosses6.png', 'size': {'w': frag.w, 'h': frag.h}, 'bosses': frag_bosses}, f, indent=2)
    sn.encode_rgba(os.path.join(out, 'bosses7.png'), boss.w, boss.h, boss.px)
    with open(os.path.join(out, 'bosses7.json'), 'w') as f:
        json.dump({'sheet': 'bosses7.png', 'size': {'w': boss.w, 'h': boss.h}, 'bosses': boss_entries}, f, indent=2)

    map_src = os.path.join(src, 'thanatos-map-v1.png')
    mw, mh, mch, mpx = sn.decode(map_src)
    report['inputs']['map'] = {'file': os.path.basename(map_src), 'sha256': sn.sha256(map_src), 'size': [mw, mh]}
    report['maps'] = {}
    for tile, tw, th, tpx, span in slice_map_tiles(mw, mh, mch, mpx):
        sn.encode_rgb(os.path.join(out, 'maps', f'{tile}.png'), tw, th, tpx)
        report['maps'][tile] = {'src_rows': list(span), 'size': [tw, th]}

    report['sprites'] = {k: r for key in MOB_SHEETS for k, r in mob_rects(sheets[key][1])}
    report['sprites'].update({k: r for k, r in mob_rects(frag_entries)})
    report['sprites'].update({k: r for k, r in boss_rects(boss_entries)})
    report['outputs'] = {f: sn.sha256(os.path.join(out, f)) for f in sorted(os.listdir(out)) if f.endswith(('.png', '.json'))}
    report['outputs'].update({f'maps/{f}': sn.sha256(os.path.join(out, 'maps', f)) for f in sorted(os.listdir(os.path.join(out, 'maps')))})
    with open(os.path.join(qa, 'report-thanatos.json'), 'w') as f:
        json.dump(report, f, indent=2, default=list)

    for key in MOB_SHEETS:
        print(f'{key}: {sorted(sheets[key][1])}')
    print(f'bosses6/monsters15: {sorted(frag_entries)}')
    print(f'bosses7: {sorted(boss_entries)}')
    if warnings:
        print('WARNINGS:')
        for w in warnings:
            print(f'  ! {w}')
    print(f'wrote {out}: monsters13/14 png+json, monsters15.json, bosses6/7 png+json, maps/thanatos001..007.png')
    return 0


if __name__ == '__main__':
    sys.exit(main())
