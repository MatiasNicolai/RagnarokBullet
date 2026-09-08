#!/usr/bin/env python3
"""Clean Art V2.1 (pilot, NON-destructive) — Geffen geometric residue removal.

Builds on tools/clean-art-v2.py (imported as a library, never modified) and
keeps art-clean/geffen/ as an untouched reference. New outputs go to
art-clean/geffen-v2.1/, plus a preview set under public/assets-v2/geffen/.

Stage 1 (reused from V2): conservative RGB decontamination of matte fringe.
Stage 2 (new here): removal of HIGH-CONFIDENCE geometric residues inside the
  manifest rects — vertical neighbor-cell bars, baked ground bands, top-edge
  text dashes and border keying specks. Pixels removed go to alpha 0 with
  solidified RGB (nearest kept sprite color).

Auto rules (all require: disconnected from the main component, i.e. never the
largest component of the rect):
  EDGE_BAR    touches x==0 or x==rw-1, width<=7, height>=0.75*rect_h,
              mean-color spread>=20 (colorful neighbor art, never gray matte).
  GROUND_BAND height<=4, width>=0.6*rect_w, miny>=rect_h-6 (bottom strip),
              mean luminance>=120 (light baked ground lines).
  TOP_DASH    maxy<=1 (top edge rows), area<=30, mean luminance<140
              (dark source-label text fragments).
  EDGE_SPECK  area<=6 and touches any rect border (keying noise dots).
Explicit OVERRIDES (below) force removal/retention per entity+pose when the
automatic call is uncertain. Interior disconnected components (dress parts,
wings, hit sparkles, Doppelganger twin figures, Marionette panels) are ALWAYS
kept: they cannot be distinguished from legitimate art.

Documented exceptions (kept deliberately, see report notes):
  - Marionette side panels + chunky platforms: connected to the doll (one
    component) or mixed with dark feet parts; cutting them would amputate art.
  - Munak wispy bottom chunks / wraith gray chunks / Doppelganger twin
    figures / hit-frame debris clusters: large interior disconnected parts,
    plausibly legitimate (ghost hems, wings, sparkles, mirror theme).
  - Ninetails bright top specks: above the luminance gate, possibly ear tips.

Outputs (art-clean/geffen-v2.1/)
  monsters3.clean.png / .json, bosses.geffen-clean.png, bosses.clean.json,
  monsters5.clean.json (same basenames as V2; dirs differ), report.json
  (extended: components_removed[], alpha_changed, before/after), and
  contact-sheet-3way.png (ORIGINAL | V2 | V2.1 on dark background).
Preview copies of the 5 atlas files go to public/assets-v2/geffen/.

Usage (run from repo root)
  python3 tools/clean-art-v2_1.py [--out art-clean/geffen-v2.1]
      [--preview public/assets-v2/geffen] [--v2 art-clean/geffen]
      [--assets public/assets] [--no-preview]
Tunable: --bar-w 7 --bar-h 0.75 --bar-spread 20 --band-h 4 --band-w 0.6
  --band-lum 120 --dash-h 1 --dash-area 30 --dash-lum 140 --speck-area 6
  --bleed-r 8 --scale 2. V2 RGB params pass through: --tol --lum-lo
  --white-keep --edge-r --core-r.

Stdlib only. Never writes to public/assets or src/.
"""
import argparse
import importlib.util
import json
import os
import sys
from collections import deque

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    'clean_art_v2', os.path.join(_HERE, 'clean-art-v2.py'))
v2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v2)

MOB_NAMES = ['willow', 'zombie', 'munak', 'bongun',
             'ninetails', 'deviruchi', 'marionette', 'wraith']
SHOWCASE = [(n, 'down.idle', 0) for n in MOB_NAMES] + [
    ('darkLord', 'down.idle', 0), ('doppelganger', 'down.idle', 0)]

# Explicit per-entity overrides, reviewed against the component survey.
# Each entry forces removal of components matching the geometric selector.
# (Kept parts need no entries: the auto rules already keep them.)
OVERRIDES = [
    # munak down.attack right-edge gray-cyan bar (spread ~24, below the
    # default color gate but geometrically an unambiguous neighbor bar).
    {'entity': 'munak', 'pose': 'down.attack', 'edge': 'right', 'max_w': 7,
     'reason': 'override: neighbor-cell bar, gray-cyan'},
]


def parse_args(argv=None):
    ap = argparse.ArgumentParser(
        description='Clean Art V2.1: geometric residue removal (Geffen).')
    ap.add_argument('--assets', default='public/assets')
    ap.add_argument('--v2', default='art-clean/geffen',
                    help='V2 reference dir (read-only: V2 crops for compare)')
    ap.add_argument('--out', default='art-clean/geffen-v2.1')
    ap.add_argument('--preview', default='public/assets-v2/geffen')
    ap.add_argument('--no-preview', action='store_true')
    ap.add_argument('--bar-w', type=int, default=7)
    ap.add_argument('--bar-h', type=float, default=0.75)
    ap.add_argument('--bar-spread', type=int, default=20)
    ap.add_argument('--band-h', type=int, default=4)
    ap.add_argument('--band-w', type=float, default=0.6)
    ap.add_argument('--band-lum', type=int, default=120)
    ap.add_argument('--dash-h', type=int, default=1)
    ap.add_argument('--dash-area', type=int, default=30)
    ap.add_argument('--dash-lum', type=int, default=140)
    ap.add_argument('--speck-area', type=int, default=6)
    ap.add_argument('--bleed-r', type=int, default=8)
    ap.add_argument('--scale', type=int, default=2)
    ap.add_argument('--tol', type=int, default=14)
    ap.add_argument('--lum-lo', type=int, default=160)
    ap.add_argument('--white-keep', type=int, default=236)
    ap.add_argument('--edge-r', type=int, default=2)
    ap.add_argument('--core-r', type=int, default=2)
    return ap.parse_args(argv)


# ------------------------------------------------------- components

def label_opaque(img, rect):
    """4-connected components of the opaque mask inside rect.

    Returns (comps, rw, rh) where each comp is dict(area, cells set,
    x0,y0,x1,y1, mean(r,g,b)), sorted largest first.
    """
    w, px = img['w'], img['px']
    x0, y0, rw, rh = rect['x'], rect['y'], rect['w'], rect['h']
    N = rw * rh
    op = bytearray(N)
    for yy in range(rh):
        base = ((y0 + yy) * w + x0) * 4
        for xx in range(rw):
            if px[base + xx * 4 + 3] == 255:
                op[yy * rw + xx] = 1
    seen = bytearray(N)
    comps = []
    for j in range(N):
        if not op[j] or seen[j]:
            continue
        dq = deque([j])
        seen[j] = 1
        cells = []
        while dq:
            c = dq.popleft()
            cells.append(c)
            x, y = c % rw, c // rw
            for k in ((c - 1 if x > 0 else -1), (c + 1 if x < rw - 1 else -1),
                      (c - rw if y > 0 else -1), (c + rw if y < rh - 1 else -1)):
                if k >= 0 and op[k] and not seen[k]:
                    seen[k] = 1
                    dq.append(k)
        xs = [c % rw for c in cells]
        ys = [c // rw for c in cells]
        sR = sG = sB = 0
        for c in cells:
            i = ((y0 + c // rw) * w + (x0 + c % rw)) * 4
            sR += px[i]
            sG += px[i + 1]
            sB += px[i + 2]
        n = len(cells)
        comps.append({'area': n, 'cells': set(cells),
                      'x0': min(xs), 'y0': min(ys),
                      'x1': max(xs), 'y1': max(ys),
                      'mean': (sR // n, sG // n, sB // n)})
    comps.sort(key=lambda d: -d['area'])
    return comps, rw, rh


def _spread(mean):
    return max(mean) - min(mean)


def _lum(mean):
    return (mean[0] + mean[1] + mean[2]) / 3.0


def _override_hit(entity, pose, comp, rw, rh):
    for o in OVERRIDES:
        if o['entity'] != entity or o['pose'] != pose:
            continue
        wpx, hpx = comp['x1'] - comp['x0'] + 1, comp['y1'] - comp['y0'] + 1
        if o.get('edge') == 'right' and comp['x1'] == rw - 1 \
                and wpx <= o.get('max_w', 7):
            return o['reason']
        if o.get('edge') == 'left' and comp['x0'] == 0 \
                and wpx <= o.get('max_w', 7):
            return o['reason']
    return None


def geometry_remove(img, rect, entity, pose, P):
    """Remove high-confidence geometric residues in one rect (in place).

    Returns (removed, alpha_changed) where removed is a list of
    {bbox, area, mean, reason}. Removed pixels get alpha 0 + solidified RGB
    from the nearest kept opaque pixel. Only alpha+RGB of removed cells
    change; everything else is untouched.
    """
    w, px = img['w'], img['px']
    x0, y0, rw, rh = rect['x'], rect['y'], rect['w'], rect['h']
    comps, _, _ = label_opaque(img, rect)
    if len(comps) <= 1:
        return [], 0
    main = comps[0]
    main_cells = main['cells']
    removed = []

    def touches_lr(c):
        return c['x0'] == 0 or c['x1'] == rw - 1

    for c in comps[1:]:
        wpx, hpx = c['x1'] - c['x0'] + 1, c['y1'] - c['y0'] + 1
        reason = None
        ov = _override_hit(entity, pose, c, rw, rh)
        if ov:
            reason = ov
        elif touches_lr(c) and wpx <= P.bar_w and hpx >= P.bar_h * rh \
                and _spread(c['mean']) >= P.bar_spread:
            reason = (f'auto EDGE_BAR {wpx}x{hpx} '
                      f'spread={_spread(c["mean"])}')
        elif hpx <= P.band_h and wpx >= P.band_w * rw \
                and c['y0'] >= rh - 6 and _lum(c['mean']) >= P.band_lum:
            reason = (f'auto GROUND_BAND {wpx}x{hpx} '
                      f'lum={_lum(c["mean"]):.0f}')
        elif c['y1'] <= P.dash_h and c['area'] <= P.dash_area \
                and _lum(c['mean']) < P.dash_lum:
            reason = (f'auto TOP_DASH area={c["area"]} '
                      f'lum={_lum(c["mean"]):.0f}')
        elif c['area'] <= P.speck_area and (
                c['x0'] == 0 or c['x1'] == rw - 1 or
                c['y0'] == 0 or c['y1'] == rh - 1):
            reason = f'auto EDGE_SPECK area={c["area"]}'
        if reason is None:
            continue  # ambiguous -> keep, per conservative rule
        removed.append({'bbox': [c['x0'], c['y0'], c['x1'], c['y1']],
                        'area': c['area'], 'mean': list(c['mean']),
                        'reason': reason,
                        '_cells': c['cells']})

    if not removed:
        return [], 0
    # solidify: donor = nearest kept opaque pixel (bounded BFS, then fallback
    # to the nearest kept pixel anywhere in the rect — main always exists).
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
            # bounded donor search first
            seen = {j}
            dq = deque([(j, 0)])
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
                # fallback: nearest kept pixel anywhere (main guarantees one)
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


# ------------------------------------------------------- driver

def _v2params(P):
    class Q:
        pass
    q = Q()
    for k in ('tol', 'lum_lo', 'white_keep', 'edge_r', 'core_r'):
        setattr(q, k, getattr(P, k))
    q.bleed_r = 6  # V2 stage-1 default (v2.1 --bleed-r applies to stage 2)
    return q


EXTRA_GLYPHS = {
    'V': ('101', '101', '101', '101', '010'),
    '.': ('000', '000', '000', '000', '010'),
}


def _draw_text(canvas, cw, x, y, s, color):
    font = dict(v2.FONT)
    font.update(EXTRA_GLYPHS)
    assert len(bytes(color)) == 4, 'label colors must be RGBA'
    for ci, ch in enumerate(s):
        g = font.get(ch)
        if not g:
            continue
        for r in range(5):
            for c in range(3):
                if g[r][c] == '1':
                    i = ((y + r) * cw + (x + ci * 4 + c)) * 4
                    if 0 <= i <= len(canvas) - 4:
                        canvas[i:i + 4] = bytes(color)


def contact_sheet_3way(rows, scale, path):
    """rows: [(idx, name, orig, v2, v21)]. Dark background, O|V2|V2.1."""
    cw_max = max(r[2][0] for r in rows) * scale
    ch_max = max(r[2][1] for r in rows) * scale
    label_w, gap, pad = 24, 10, 8
    W = pad + label_w + gap + (cw_max + gap) * 3 - gap + pad
    H = pad + 12 + gap + len(rows) * (ch_max + gap)
    canvas = bytearray(W * H * 4)
    for yy in range(H):
        for xx in range(W):
            i = (yy * W + xx) * 4
            canvas[i:i + 4] = b'\x0b\x0e\x1a\xff'  # dark review bg
    heads = ['O', 'V2', 'V2.1']
    for col, htxt in enumerate(heads):
        hx = (pad + label_w + gap + col * (cw_max + gap) + cw_max // 2
              - len(htxt) * 2)
        _draw_text(canvas, W, hx, pad, htxt, (242, 193, 78, 255))
    y = pad + 12 + gap
    for idx, name, orig, v2c, v21 in rows:
        _draw_text(canvas, W, pad + 2, y + ch_max // 2 - 3, str(idx),
                   (242, 193, 78, 255))
        for col, (cw0, ch0, buf) in enumerate((orig, v2c, v21)):
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


def process_sheet_v21(sheet_png, manifest, section, names, out_png, out_json,
                      P, Q, sprites):
    img = v2.read_png(sheet_png)
    orig_px = bytes(img['px'])
    target = set()
    rects = v2.collect_rects(manifest, section, names)
    for poses in rects.values():
        for _, _, rect in poses:
            for yy in range(rect['y'], rect['y'] + rect['h']):
                for xx in range(rect['x'], rect['x'] + rect['w']):
                    target.add(yy * img['w'] + xx)
    for entity, poses in rects.items():
        for pose, idx, rect in poses:
            before = v2.frame_stats(*v2.crop(
                {'w': img['w'], 'px': bytearray(orig_px)}, rect), Q)
            v2metrics, _ = v2.clean_rect(img, rect, Q)  # stage 1: V2 RGB
            removed, alpha_changed = geometry_remove(
                img, rect, entity, pose, P)             # stage 2: geometry
            after = v2.frame_stats(*v2.crop(img, rect), Q)
            sprites.append({
                'sheet': os.path.basename(out_png),
                'entity': entity, 'pose': pose, 'frame': idx,
                'rect': dict(rect), 'before': before, 'after': after,
                'v2_cleaned_rgb': v2metrics['cleaned_rgb'],
                'components_removed': removed,
                'alpha_changed': alpha_changed,
            })
    v2.write_png(out_png, img['w'], img['h'], img['px'])
    mout = json.loads(json.dumps(manifest))
    mout['sheet'] = os.path.basename(out_png)
    with open(out_json, 'w') as f:
        json.dump(mout, f, indent=2)
        f.write('\n')
    return img, orig_px, target, rects


def validate_v21(out, jobs):
    for job in jobs:
        orig = v2.read_png(job['sheet_png'])
        clean = v2.read_png(job['out_png'])
        assert (orig['w'], orig['h']) == (clean['w'], clean['h'])
        # RGB+alpha outside target rects bit-identical
        for j in range(orig['w'] * orig['h']):
            if j in job['target']:
                continue
            i = j * 4
            assert orig['px'][i:i + 4] == clean['px'][i:i + 4], \
                f"non-target pixel changed in {job['out_png']} cell {j}"
        # alpha may differ ONLY at logged removed cells
        allowed = set()
        for cells in job['removed_cells']:
            allowed |= cells
        n_alpha = 0
        for j in range(orig['w'] * orig['h']):
            if orig['px'][j * 4 + 3] != clean['px'][j * 4 + 3]:
                assert j in allowed, \
                    f"unlogged alpha change in {job['out_png']} cell {j}"
                n_alpha += 1
        assert n_alpha == job['alpha_total'], \
            f"alpha count mismatch in {job['out_png']}"
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
    cs = v2.read_png(os.path.join(out, 'contact-sheet-3way.png'))
    print(f"  valid contact-sheet-3way.png ({cs['w']}x{cs['h']})")
    with open(os.path.join(out, 'report.json')) as f:
        rep = json.load(f)
    print(f"  valid report.json ({len(rep['sprites'])} frames, "
          f"{sum(len(s['components_removed']) for s in rep['sprites'])} "
          f"components removed)")


PREVIEW_FILES = ['monsters3.clean.png', 'monsters3.clean.json',
                 'bosses.geffen-clean.png', 'bosses.clean.json',
                 'monsters5.clean.json']


def main(argv=None):
    P = parse_args(argv)
    Q = _v2params(P)
    assets, out = P.assets, P.out
    os.makedirs(out, exist_ok=True)
    sprites = []

    m3 = json.load(open(os.path.join(assets, 'monsters3.json')))
    bosses = json.load(open(os.path.join(assets, 'bosses.json')))
    m5 = json.load(open(os.path.join(assets, 'monsters5.json')))

    print('stage 1+2 monsters3 (8 mobs)...')
    img3, orig3, cells3, rects3 = process_sheet_v21(
        os.path.join(assets, 'monsters3.png'), m3, 'monsters', MOB_NAMES,
        os.path.join(out, 'monsters3.clean.png'),
        os.path.join(out, 'monsters3.clean.json'), P, Q, sprites)
    removed3, alpha3 = set(), 0
    for s in sprites:
        if s['sheet'] == 'monsters3.clean.png':
            alpha3 += s['alpha_changed']
    # removed cells = alpha flips between pristine input and working image
    for j in cells3:
        if orig3[j * 4 + 3] != img3['px'][j * 4 + 3]:
            removed3.add(j)
    assert len(removed3) == alpha3, 'removed-cell set must match logged total'

    print('stage 1+2 bosses.png (Dark Lord + Doppelganger)...')
    bimg = v2.read_png(os.path.join(assets, 'bosses.png'))
    borig = bytes(bimg['px'])
    brects = {}
    brects.update(v2.collect_rects(bosses, 'bosses', ['darkLord']))
    brects.update(v2.collect_rects(m5, 'monsters', ['doppelganger']))
    bcells = set()
    for poses in brects.values():
        for _, _, rect in poses:
            for yy in range(rect['y'], rect['y'] + rect['h']):
                for xx in range(rect['x'], rect['x'] + rect['w']):
                    bcells.add(yy * bimg['w'] + xx)
    n0 = len(sprites)
    for entity, poses in brects.items():
        for pose, idx, rect in poses:
            before = v2.frame_stats(*v2.crop(
                {'w': bimg['w'], 'px': bytearray(borig)}, rect), Q)
            vm, _ = v2.clean_rect(bimg, rect, Q)
            removed, ac = geometry_remove(bimg, rect, entity, pose, P)
            after = v2.frame_stats(*v2.crop(bimg, rect), Q)
            sprites.append({
                'sheet': 'bosses.geffen-clean.png',
                'entity': entity, 'pose': pose, 'frame': idx,
                'rect': dict(rect), 'before': before, 'after': after,
                'v2_cleaned_rgb': vm['cleaned_rgb'],
                'components_removed': removed,
                'alpha_changed': ac,
            })
    bout = os.path.join(out, 'bosses.geffen-clean.png')
    v2.write_png(bout, bimg['w'], bimg['h'], bimg['px'])
    for src_name, dst_name in (('bosses.json', 'bosses.clean.json'),
                               ('monsters5.json', 'monsters5.clean.json')):
        with open(os.path.join(assets, src_name)) as f:
            m = json.load(f)
        m = json.loads(json.dumps(m))
        m['sheet'] = 'bosses.geffen-clean.png'
        with open(os.path.join(out, dst_name), 'w') as f:
            json.dump(m, f, indent=2)
            f.write('\n')
    removedB = {j for j in bcells
                  if borig[j * 4 + 3] != bimg['px'][j * 4 + 3]}
    assert len(removedB) == sum(s['alpha_changed'] for s in sprites[n0:]), \
        'removed-cell set must match logged total'

    print('3-way contact sheet (needs V2 reference, read-only)...')
    v2m3 = v2.read_png(os.path.join(P.v2, 'monsters3.clean.png'))
    v2b = v2.read_png(os.path.join(P.v2, 'bosses.geffen-clean.png'))
    rows, legend = [], []
    for idx, (entity, pose_dot, frame_i) in enumerate(SHOWCASE):
        if entity in MOB_NAMES:
            img, opx, rc, v2img = img3, orig3, rects3, v2m3
        else:
            img, opx, rc, v2img = bimg, borig, brects, v2b
        pose, _, rect = next(
            (p, k, r) for (p, k, r) in rc[entity]
            if p == pose_dot and k == frame_i)
        o = v2.crop({'w': img['w'], 'px': bytearray(opx)}, rect)
        v = v2.crop(v2img, rect)
        n = v2.crop(img, rect)
        rows.append((idx, entity, o, v, n))
        legend.append({'row': idx, 'entity': entity, 'pose': pose,
                       'frame': frame_i, 'rect': rect})
    contact_sheet_3way(rows, P.scale,
                       os.path.join(out, 'contact-sheet-3way.png'))

    report = {
        'tool': 'tools/clean-art-v2_1.py (pilot V2.1)',
        'base': 'V2 RGB (tools/clean-art-v2.py, art-clean/geffen reference)',
        'params': {k: getattr(P, k) for k in
                   ('tol', 'lum_lo', 'white_keep', 'edge_r', 'core_r',
                    'bar_w', 'bar_h', 'bar_spread', 'band_h', 'band_w',
                    'band_lum', 'dash_h', 'dash_area', 'dash_lum',
                    'speck_area', 'bleed_r', 'scale')},
        'overrides': OVERRIDES,
        'inputs': ['public/assets/monsters3.png+json',
                   'public/assets/bosses.png + bosses.json + monsters5.json'],
        'notes': [
            'Stage 1 = V2 RGB decontamination (alpha untouched).',
            'Stage 2 removes only auto EDGE_BAR/GROUND_BAND/TOP_DASH/'
            'EDGE_SPECK components + OVERRIDES; all disconnected non-main.',
            'Removed pixels -> alpha 0 with solidified RGB (nearest kept).',
            'Rects/IDs/sheet dims unchanged; manifests differ only in sheet.',
            'No padding/anchor normalization (would move visual anchors).',
            'Kept deliberately: Marionette panels+platforms (connected or '
            'mixed with feet), munak hem chunks, wraith gray chunks, '
            'Doppelganger twin figures, hit-frame debris, bright ear tips.',
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
    validate_v21(out, [
        {'sheet_png': os.path.join(assets, 'monsters3.png'),
         'out_png': os.path.join(out, 'monsters3.clean.png'),
         'target': cells3, 'removed_cells': [removed3],
         'alpha_total': alpha3,
         'json_pairs': [(os.path.join(assets, 'monsters3.json'),
                         os.path.join(out, 'monsters3.clean.json'))]},
        {'sheet_png': os.path.join(assets, 'bosses.png'),
         'out_png': bout, 'target': bcells, 'removed_cells': [removedB],
         'alpha_total': sum(s['alpha_changed'] for s in sprites[n0:]),
         'json_pairs': [
             (os.path.join(assets, 'bosses.json'),
              os.path.join(out, 'bosses.clean.json')),
             (os.path.join(assets, 'monsters5.json'),
              os.path.join(out, 'monsters5.clean.json'))]},
    ])
    t = report['totals']
    print(f"DONE V2.1: {t['frames']} frames, "
          f"{t['components_removed']} components removed, "
          f"{t['alpha_changed']} px -> alpha 0, "
          f"border-bright {t['border_bright_before']} -> "
          f"{t['border_bright_after']}. Rects/IDs unchanged.")


if __name__ == '__main__':
    import sys
    sys.exit(main())
