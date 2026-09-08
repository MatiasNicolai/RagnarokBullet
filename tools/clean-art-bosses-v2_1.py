#!/usr/bin/env python3
"""Clean Art V2.1 — ALL bosses & midbosses (pilot, NON-destructive).

Applies the approved V2.1 standard (see tools/clean-art-v2_1.py, imported as
a library and never modified) to every boss/midboss encounter, based on the
component survey of all target frames:

  bosses.png    orcHero, darkLord, baphomet (bosses.json)
                + doppelganger, bapho_jr_giant (monsters5.json, same sheet)
  monsters2.png mastering (monsters2.json; lunatic pixels preserved untouched)
  bosses2.png   vesper (bosses2.json) + archdam (monsters7.json, same sheet)
  monsters8.png failedexp (monsters8.json; regular mobs preserved untouched)
  bosses3.png   seyren, magaleta (bosses3.json)

Stage 1: V2 RGB matte decontamination (alpha untouched).
Stage 2: v2.1 geometry rules (EDGE_BAR w<=9 here for mastering's 9px bars,
  GROUND_BAND, TOP_DASH, EDGE_SPECK) + TOP_STRIP (new in this tool: y0==0,
  h<=4, w>=15, lum<110 — source label strips on bapho frames) + OVERRIDES.
Removed pixels -> alpha 0 with solidified RGB. Ambiguous components
(twin figures, hair/helmet masses, weapons, sparkles, hit debris, dress
hems, bright ear tips) are ALWAYS kept and listed in report notes.

Outputs: art-clean/bosses-v2.1/ (auditable) + runtime copies in
public/assets-v2/bosses/. Originals in public/assets are only read.
IDs, sheet dims, rects, poses, anchors, hitboxes unchanged.

Usage (repo root)
  python3 tools/clean-art-bosses-v2_1.py [--out art-clean/bosses-v2.1]
      [--preview public/assets-v2/bosses] [--assets public/assets]
      [--no-preview]
Tunables: --bar-w 9 --bar-h 0.75 --bar-spread 20 --band-h 4 --band-w 0.6
  --band-lum 120 --dash-h 1 --dash-area 30 --dash-lum 140 --speck-area 6
  --strip-h 4 --strip-w 15 --strip-lum 110 --bleed-r 8 --scale 2
  (+ V2 RGB: --tol --lum-lo --white-keep --edge-r --core-r).
Stdlib only. Never writes to public/assets or src/.
"""
import argparse
import importlib.util
import json
import os
import sys
from collections import deque

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name):
    spec = importlib.util.spec_from_file_location(
        name, os.path.join(_HERE, 'clean-art-v2.py'
                           if name == 'clean_art_v2'
                           else 'clean-art-v2_1.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


v2 = _load('clean_art_v2')
v21 = _load('clean_art_v2_1')

# v2.1 OVERRIDES plus boss-phase additions (runtime list only; the reference
# module file is never modified).
OVERRIDES = list(v21.OVERRIDES) + [
    # failedexp idle left-edge gray-tan bars (spread ~17-18, below the color
    # gate, but geometrically unambiguous full-height neighbor bars).
    {'entity': 'failedexp', 'pose': 'down.idle', 'edge': 'left', 'max_w': 7,
     'reason': 'override: neighbor-cell bar, gray-tan'},
    {'entity': 'failedexp', 'pose': 'up.idle', 'edge': 'left', 'max_w': 7,
     'reason': 'override: neighbor-cell bar, gray-tan'},
]

# (sheet png, [(manifest json, section, entities, out json)], out png).
# A sheet's whole manifest file is copied (identical rects); only the listed
# entities' rects are cleaned, so roommates (lunatic, regular mobs) stay
# bit-identical while their manifest entries remain valid.
JOBS = [
    ('monsters2.png',
     [('monsters2.json', 'monsters', ['mastering'], 'monsters2.clean.json')],
     'monsters2.clean.png'),
    ('bosses.png',
     [('bosses.json', 'bosses', ['orcHero', 'darkLord', 'baphomet'],
       'bosses.clean.json'),
      ('monsters5.json', 'monsters',
       ['doppelganger', 'bapho_jr_giant'], 'monsters5.clean.json')],
     'bosses.clean.png'),
    ('bosses2.png',
     [('bosses2.json', 'bosses', ['vesper'], 'bosses2.clean.json'),
      ('monsters7.json', 'monsters', ['archdam'], 'monsters7.clean.json')],
     'bosses2.clean.png'),
    ('monsters8.png',
     [('monsters8.json', 'monsters', ['failedexp'], 'monsters8.clean.json')],
     'monsters8.clean.png'),
    ('bosses3.png',
     [('bosses3.json', 'bosses', ['seyren', 'magaleta'],
       'bosses3.clean.json')],
     'bosses3.clean.png'),
]

# showcase: representative + attack + hit per entity (req: pose + atk/hit)
def _poses(manifest, section, entity, wants):
    out = []
    group = manifest[section][entity]
    for side, pose in wants:
        frames = group.get(side, {}).get(pose)
        if not frames:
            continue
        v = frames if isinstance(frames, list) else [frames]
        out.append((f'{side}.{pose}', 0))
    return out


def parse_args(argv=None):
    ap = argparse.ArgumentParser(
        description='Clean Art V2.1 for all bosses/midbosses.')
    ap.add_argument('--assets', default='public/assets')
    ap.add_argument('--out', default='art-clean/bosses-v2.1')
    ap.add_argument('--preview', default='public/assets-v2/bosses')
    ap.add_argument('--no-preview', action='store_true')
    ap.add_argument('--bar-w', type=int, default=9)
    ap.add_argument('--bar-h', type=float, default=0.75)
    ap.add_argument('--bar-spread', type=int, default=20)
    ap.add_argument('--band-h', type=int, default=4)
    ap.add_argument('--band-w', type=float, default=0.6)
    ap.add_argument('--band-lum', type=int, default=120)
    ap.add_argument('--dash-h', type=int, default=1)
    ap.add_argument('--dash-area', type=int, default=30)
    ap.add_argument('--dash-lum', type=int, default=140)
    ap.add_argument('--speck-area', type=int, default=6)
    ap.add_argument('--strip-h', type=int, default=4)
    ap.add_argument('--strip-w', type=int, default=15)
    ap.add_argument('--strip-lum', type=int, default=110)
    ap.add_argument('--bleed-r', type=int, default=8)
    ap.add_argument('--scale', type=int, default=2)
    ap.add_argument('--tol', type=int, default=14)
    ap.add_argument('--lum-lo', type=int, default=160)
    ap.add_argument('--white-keep', type=int, default=236)
    ap.add_argument('--edge-r', type=int, default=2)
    ap.add_argument('--core-r', type=int, default=2)
    return ap.parse_args(argv)


# ------------------------------------------------------- TOP_STRIP rule
# Source label strips baked along the top edge (bapho frames): y0==0, h<=4,
# w>=15, dark. Kept out of v2.1 core (Geffen reference untouched by design).

def topstrip_remove(img, rect, P):
    """Remove top-edge label strips in one rect (in place).

    Returns (removed, alpha_changed) in the v2.1 geometry_remove format.
    Solidify reuses the same nearest-kept-opaque donor strategy.
    """
    from collections import deque as _dq
    w, px = img['w'], img['px']
    x0, y0, rw, rh = rect['x'], rect['y'], rect['w'], rect['h']
    comps, _, _ = v21.label_opaque(img, rect)
    if len(comps) <= 1:
        return [], 0
    removed = []
    for c in comps[1:]:
        wpx, hpx = c['x1'] - c['x0'] + 1, c['y1'] - c['y0'] + 1
        lum = (c['mean'][0] + c['mean'][1] + c['mean'][2]) / 3.0
        if c['y0'] == 0 and hpx <= P.strip_h and wpx >= P.strip_w \
                and lum < P.strip_lum:
            removed.append({'bbox': [c['x0'], c['y0'], c['x1'], c['y1']],
                            'area': c['area'], 'mean': list(c['mean']),
                            'reason': f'auto TOP_STRIP {wpx}x{hpx} '
                                      f'lum={lum:.0f}',
                            '_cells': c['cells']})
    if not removed:
        return [], 0
    N = rw * rh
    kept = bytearray(N)
    for j in range(N):
        yy, xx = j // rw, j % rw
        if px[((y0 + yy) * w + (x0 + xx)) * 4 + 3] == 255:
            kept[j] = 1
    doomed = set()
    for r in removed:
        doomed |= r['_cells']
    for j in doomed:
        kept[j] = 0

    def neighbors(j):
        x, y = j % rw, j // rw
        if x > 0:
            yield j - 1
        if x < rw - 1:
            yield j + 1
        if y > 0:
            yield j - rw
        if y < rh - 1:
            yield j + rw

    alpha_changed = 0
    for r in removed:
        for j in sorted(r['_cells']):
            yy, xx = j // rw, j % rw
            i = ((y0 + yy) * w + (x0 + xx)) * 4
            seen = {j}
            dq = _dq([(j, 0)])
            donor = -1
            while dq:
                cur, d = dq.popleft()
                if kept[cur]:
                    donor = cur
                    break
                if d == P.bleed_r:
                    continue
                for k in neighbors(cur):
                    if k not in seen and k not in doomed:
                        seen.add(k)
                        dq.append((k, d + 1))
            if donor < 0:
                best, bd = -1, None
                for k in range(N):
                    if not kept[k]:
                        continue
                    d = abs(k // rw - yy) + abs(k % rw - xx)
                    if bd is None or d < bd:
                        best, bd = k, d
                        if d <= 1:
                            break
                donor = best
            if donor >= 0:
                di = ((y0 + donor // rw) * w + (x0 + donor % rw)) * 4
                px[i], px[i + 1], px[i + 2] = px[di], px[di + 1], px[di + 2]
            px[i + 3] = 0
            alpha_changed += 1
        del r['_cells']
    return removed, alpha_changed


# ------------------------------------------------------- 2-col sheet

EXTRA_GLYPHS = {
    'V': ('101', '101', '101', '101', '010'),
    '.': ('000', '000', '000', '000', '010'),
    '|': ('010', '010', '010', '010', '010'),
}


def _draw_text(canvas, cw, x, y, s, color):
    font = dict(v2.FONT)
    font.update(EXTRA_GLYPHS)
    assert len(bytes(color)) == 4
    for ci, ch in enumerate(s):
        g = font.get(ch)
        if not g:
            continue
        for r in range(5):
            for cc in range(3):
                if g[r][cc] == '1':
                    i = ((y + r) * cw + (x + ci * 4 + cc)) * 4
                    if 0 <= i <= len(canvas) - 4:
                        canvas[i:i + 4] = bytes(color)


def contact_sheet_2col(rows, scale, path):
    """rows: [(idx, tag, orig, clean)]. Dark bg, ORIGINAL | V2.1."""
    cw_max = max(r[2][0] for r in rows) * scale
    ch_max = max(r[2][1] for r in rows) * scale
    label_w, gap, pad = 44, 10, 8
    W = pad + label_w + gap + (cw_max + gap) * 2 - gap + pad
    H = pad + 12 + gap + len(rows) * (ch_max + gap)
    canvas = bytearray(W * H * 4)
    for yy in range(H):
        for xx in range(W):
            i = (yy * W + xx) * 4
            canvas[i:i + 4] = b'\x0b\x0e\x1a\xff'
    for col, htxt in enumerate(['O', 'V2.1']):
        hx = (pad + label_w + gap + col * (cw_max + gap) + cw_max // 2
              - len(htxt) * 2)
        _draw_text(canvas, W, hx, pad, htxt, (242, 193, 78, 255))
    y = pad + 12 + gap
    for idx, tag, orig, clean in rows:
        _draw_text(canvas, W, pad + 2, y + ch_max // 2 - 3, str(idx),
                   (242, 193, 78, 255))
        for col, (cw0, ch0, buf) in enumerate((orig, clean)):
            ox = pad + label_w + gap + col * (cw_max + gap)
            for yy in range(ch0):
                for xx in range(cw0):
                    si = (yy * cw0 + xx) * 4
                    r, g, b, a = buf[si], buf[si + 1], buf[si + 2], buf[si + 3]
                    if a == 0:
                        continue
                    for dy in range(scale):
                        for dx in range(scale):
                            di = ((y + yy * scale + dy) * W +
                                  (ox + xx * scale + dx)) * 4
                            if 0 <= di <= len(canvas) - 4:
                                canvas[di:di + 4] = bytes((r, g, b, 255))
        y += ch_max + gap
    v2.write_png(path, W, H, canvas)


# ------------------------------------------------------- driver

PREVIEW_FILES = ['monsters2.clean.png', 'monsters2.clean.json',
                 'bosses.clean.png', 'bosses.clean.json',
                 'monsters5.clean.json', 'bosses2.clean.png',
                 'bosses2.clean.json', 'monsters7.clean.json',
                 'monsters8.clean.png', 'monsters8.clean.json',
                 'bosses3.clean.png', 'bosses3.clean.json']

SHOWCASE_WANTS = {
    'orcHero': [('down', 'idle'), ('down', 'attack'), ('up', 'hit')],
    'mastering': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'doppelganger': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'darkLord': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'bapho_jr_giant': [('down', 'idle'), ('up', 'attack'), ('down', 'hit')],
    'baphomet': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'archdam': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'vesper': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'failedexp': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'seyren': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
    'magaleta': [('down', 'idle'), ('down', 'attack'), ('down', 'hit')],
}


def _params(P):
    class Q:
        pass
    q = Q()
    for k in ('tol', 'lum_lo', 'white_keep', 'edge_r', 'core_r',
              'bar_w', 'bar_h', 'bar_spread', 'band_h', 'band_w',
              'band_lum', 'dash_h', 'dash_area', 'dash_lum', 'speck_area',
              'strip_h', 'strip_w', 'strip_lum', 'bleed_r'):
        setattr(q, k, getattr(P, k))
    return q


def main(argv=None):
    P = parse_args(argv)
    Q = _params(P)
    # extended overrides for this phase (runtime only; reference file kept)
    v21.OVERRIDES = OVERRIDES
    assets, out = P.assets, P.out
    os.makedirs(out, exist_ok=True)
    sprites = []
    jobs = []
    sheet_imgs = {}  # out_png -> (img, orig_px, rects)

    for sheet, manifests, out_png in JOBS:
        print(f'stage 1+2+strip {sheet}...')
        img = v2.read_png(os.path.join(assets, sheet))
        orig_px = bytes(img['px'])
        rects = {}
        for mname, section, entities, _ in manifests:
            with open(os.path.join(assets, mname)) as f:
                man = json.load(f)
            rects.update(v2.collect_rects(man, section, entities))
        target = set()
        for poses in rects.values():
            for _, _, rect in poses:
                for yy in range(rect['y'], rect['y'] + rect['h']):
                    for xx in range(rect['x'], rect['x'] + rect['w']):
                        target.add(yy * img['w'] + xx)
        Q.bleed_r = 6  # V2 stage-1 donor radius (v2.1 --bleed-r is stage 2)
        for entity, poses in rects.items():
            for pose, idx, rect in poses:
                before = v2.frame_stats(*v2.crop(
                    {'w': img['w'], 'px': bytearray(orig_px)}, rect), Q)
                vm, _ = v2.clean_rect(img, rect, Q)
                r1, a1 = topstrip_remove(img, rect, Q)
                r2, a2 = v21.geometry_remove(img, rect, entity, pose, Q)
                after = v2.frame_stats(*v2.crop(img, rect), Q)
                sprites.append({
                    'sheet': out_png, 'entity': entity,
                    'pose': pose, 'frame': idx, 'rect': dict(rect),
                    'before': before, 'after': after,
                    'v2_cleaned_rgb': vm['cleaned_rgb'],
                    'components_removed': r1 + r2,
                    'alpha_changed': a1 + a2,
                })
        v2.write_png(os.path.join(out, out_png), img['w'], img['h'], img['px'])
        pairs = []
        for mname, _, _, out_json in manifests:
            with open(os.path.join(assets, mname)) as f:
                m = json.load(f)
            m = json.loads(json.dumps(m))
            # same-sheet manifests (bosses5/monsters7 JSONs share their
            # sheet) keep pointing at the cleaned output sheet:
            if m['sheet'] == sheet:
                m['sheet'] = out_png
            with open(os.path.join(out, out_json), 'w') as f:
                json.dump(m, f, indent=2)
                f.write('\n')
            pairs.append((os.path.join(assets, mname),
                          os.path.join(out, out_json)))
        removed = {j for j in target
                   if orig_px[j * 4 + 3] != img['px'][j * 4 + 3]}
        jobs.append({'sheet_png': os.path.join(assets, sheet),
                     'out_png': os.path.join(out, out_png),
                     'target': target, 'removed_cells': [removed],
                     'alpha_total': sum(
                         s['alpha_changed'] for s in sprites
                         if s['sheet'] == out_png),
                     'json_pairs': pairs})
        sheet_imgs[out_png] = (img, orig_px, rects)

    print('2-col contact sheet (ORIGINAL | V2.1, dark)...')
    rows, legend = [], []
    order = ['orcHero', 'mastering', 'doppelganger', 'darkLord',
             'bapho_jr_giant', 'baphomet', 'archdam', 'vesper', 'failedexp',
             'seyren', 'magaleta']
    # entity -> (out_png, manifest lookup for poses)
    ent_sheet = {}
    for sheet, manifests, out_png in JOBS:
        for _, section, entities, _ in manifests:
            for e in entities:
                ent_sheet[e] = out_png
    idx = 0
    for entity in order:
        out_png = ent_sheet[entity]
        img, opx, rc = sheet_imgs[out_png]
        for side, pose in SHOWCASE_WANTS[entity]:
            key = f'{side}.{pose}'
            pose_name, _, rect = next(
                (p, k, r) for (p, k, r) in rc[entity] if p == key)
            o = v2.crop({'w': img['w'], 'px': bytearray(opx)}, rect)
            n = v2.crop(img, rect)
            rows.append((idx, entity, o, n))
            legend.append({'row': idx, 'entity': entity, 'pose': pose_name,
                           'frame': 0, 'rect': rect})
            idx += 1
    contact_sheet_2col(rows, P.scale,
                       os.path.join(out, 'contact-sheet-2col.png'))

    report = {
        'tool': 'tools/clean-art-bosses-v2_1.py (pilot bosses V2.1)',
        'base': 'V2 RGB + v2.1 geometry + TOP_STRIP (Geffen refs untouched)',
        'params': {k: getattr(P, k) for k in
                   ('tol', 'lum_lo', 'white_keep', 'edge_r', 'core_r',
                    'bar_w', 'bar_h', 'bar_spread', 'band_h', 'band_w',
                    'band_lum', 'dash_h', 'dash_area', 'dash_lum',
                    'speck_area', 'strip_h', 'strip_w', 'strip_lum',
                    'bleed_r', 'scale')},
        'overrides': [o for o in OVERRIDES if 'reason' in o],
        'inputs': ['public/assets/{monsters2,bosses,monsters5,bosses2,'
                   'monsters7,monsters8,bosses3}.png+json'],
        'notes': [
            'Stage 1 = V2 RGB (alpha untouched); stage 2 = geometry on '
            'disconnected non-main components only; removed -> alpha 0.',
            'Rects/IDs/sheet dims/poses unchanged; manifests differ only '
            'in sheet filename. No padding/anchor normalization.',
            'Kept deliberately: orcHero/baphomet floating dark top bars '
            '(visually confirmed overhead weapons: axe/scythe), '
            'seyren/magaleta hair + full-width top bands, vesper halo '
            'bands + ion-glow chunks, archdam plating flecks, failedexp '
            'body segments, hit debris, bright ear tips, Doppelganger '
            'twin figures, bapho white foot platforms (tall, ambiguous).',
        ],
        'sprites': sprites,
        'totals': {
            'frames': len(sprites),
            'v2_cleaned_rgb': sum(s['v2_cleaned_rgb'] for s in sprites),
            'components_removed': sum(len(s['components_removed'])
                                      for s in sprites),
            'alpha_changed': sum(s['alpha_changed'] for s in sprites),
            'border_bright_before': sum(s['before']['border_bright']
                                        for s in sprites),
            'border_bright_after': sum(s['after']['border_bright']
                                       for s in sprites),
        },
        'contact_sheet_legend': legend,
    }
    with open(os.path.join(out, 'report.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')

    if not P.no_preview:
        os.makedirs(P.preview, exist_ok=True)
        import shutil
        for fn in PREVIEW_FILES:
            shutil.copyfile(os.path.join(out, fn),
                            os.path.join(P.preview, fn))
        print(f'preview copies -> {P.preview}/ ({len(PREVIEW_FILES)} files)')

    print('validate...')
    # Local job validation (mirrors v2.1's checks; that helper hardcodes the
    # Geffen 3-way sheet name, so it cannot be reused verbatim here).
    for job in jobs:
        orig = v2.read_png(job['sheet_png'])
        clean = v2.read_png(job['out_png'])
        assert (orig['w'], orig['h']) == (clean['w'], clean['h'])
        for j in range(orig['w'] * orig['h']):
            if j in job['target']:
                continue
            i = j * 4
            assert orig['px'][i:i + 4] == clean['px'][i:i + 4], \
                f"non-target pixel changed in {job['out_png']} cell {j}"
        allowed = set()
        for cells in job['removed_cells']:
            allowed |= cells
        n_alpha = 0
        for j in range(orig['w'] * orig['h']):
            if orig['px'][j * 4 + 3] != clean['px'][j * 4 + 3]:
                assert j in allowed, \
                    f"unlogged alpha change in {job['out_png']} cell {j}"
                n_alpha += 1
        assert n_alpha == job['alpha_total']
        for src_json, dst_json in job['json_pairs']:
            with open(src_json) as f:
                a = json.load(f)
            with open(dst_json) as f:
                b = json.load(f)
            assert list(a.keys()) == list(b.keys())
            for k in a:
                if k != 'sheet':
                    assert a[k] == b[k], f'manifest drift {dst_json}:{k}'
        print(f"  valid {os.path.basename(job['out_png'])}: "
              f"{n_alpha} px -> alpha 0 (all logged), "
              f"0 unlogged changes outside target rects")
    cs = v2.read_png(os.path.join(out, 'contact-sheet-2col.png'))
    print(f"  valid contact-sheet-2col.png ({cs['w']}x{cs['h']})")
    with open(os.path.join(out, 'report.json')) as f:
        rep = json.load(f)
    print(f"  valid report.json ({len(rep['sprites'])} frames, "
          f"{sum(len(s['components_removed']) for s in rep['sprites'])} "
          f"components removed)")
    t = report['totals']
    print(f"DONE bosses V2.1: {t['frames']} frames, "
          f"{t['components_removed']} components removed, "
          f"{t['alpha_changed']} px -> alpha 0, "
          f"border-bright {t['border_bright_before']} -> "
          f"{t['border_bright_after']}. Rects/IDs unchanged.")


if __name__ == '__main__':
    sys.exit(main())
