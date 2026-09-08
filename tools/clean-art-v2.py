#!/usr/bin/env python3
"""Clean Art V2 (pilot, NON-destructive) — Geffen sprite cleanup.

Direction: take the EXISTING sheets and produce a cleaned trial copy with
consistent transparency/edges, to evaluate before any game migration.

What it does
  Reads  public/assets/monsters3.png + monsters3.json   (8 Geffen mobs)
  and    public/assets/bosses.png + bosses.json         (Dark Lord frames only)
                                    + monsters5.json    (Doppelganger frames only)
  and writes cleaned COPIES under art-clean/geffen/ — originals are never
  modified, gameplay code is never touched.

Cleaning rule (conservative: when in doubt, KEEP the pixel)
  The sheets already have hard alpha (0/255, no semitransparency). The defect
  is a light-gray matte fringe on silhouette edges (sampled ~180-235, low
  saturation) left by the checker-keying slicers. The tool does RGB
  decontamination ("color bleed" / solidify), NOT global white removal:
    fringe = opaque AND low-saturation AND lum in [LUM_LO, WHITE_KEEP]
             AND reachable from the transparent background through
             background-or-bright pixels only (matte connectivity, BFS)
             AND within CORE_R px of a non-bright sprite pixel (halo sits
             between background and true sprite color)
    fix    = copy RGB from the nearest non-bright opaque pixel (BFS, capped
             at BLEED_R; if none found, the pixel is left untouched).
  Alpha is NEVER modified, rects are NEVER moved/resized, IDs are preserved,
  so hitboxes, anchors and manifests stay bit-compatible. Bright pixels above
  WHITE_KEEP (true whites: dresses, eyes) are always kept, as is any bright
  pixel enclosed inside the sprite (no background connectivity).

Padding/anchor normalization: deliberately NOT done. Manifest rects are used
verbatim as Pixi texture frames; shifting content inside a rect would move
the visual anchor (feet) while the manifest claims identical frames.

Outputs (all under art-clean/geffen/)
  monsters3.clean.png / .json   - full sheet copy, Geffen rects cleaned
  bosses.geffen-clean.png       - full sheet copy, ONLY DarkLord+Doppelganger
                                  rects cleaned (OrcHero/Baphomet/BaphoJr bit-identical)
  bosses.clean.json             - copy of bosses.json, sheet renamed
  monsters5.clean.json          - copy of monsters5.json, sheet renamed
  report.json                   - per-sprite metrics + params + rect lists
  contact-sheet.png             - ORIGINAL | CLEAN rows on a checkerboard

Usage
  python3 tools/clean-art-v2.py [--out art-clean/geffen] [tuning flags]
  python3 tools/clean-art-v2.py --help

Tunable parameters (defaults are the approved conservative set)
  --tol 14          max (max-min) RGB spread to count as neutral gray
  --lum-lo 160      below this luminance a neutral pixel is sprite shading: keep
  --white-keep 236  above this luminance a bright pixel may be true white: keep
  --edge-r 2        max BFS distance (through bg-or-bright only) from background
  --core-r 2        max distance to the nearest non-bright sprite pixel
  --bleed-r 6       max search radius for donor color; no donor -> keep pixel
  --scale 2         contact-sheet magnification (nearest neighbour)

Requirements: Python 3 stdlib only (zlib/struct/json/argparse/collections).
Supports 8-bit RGB/RGBA non-interlaced PNG (the format of these sheets).
"""
import argparse
import json
import os
import struct
import sys
import zlib
from collections import deque

# ---------------------------------------------------------------- PNG codec

def read_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'not a PNG: {path}'
    pos, w, h, ctype, idat = 8, None, None, None, b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ, chunk = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ctype, comp, filt, inter = struct.unpack('>IIBBBBB', chunk)
            assert (bd, inter) == (8, 0), f'need 8-bit non-interlaced: {path}'
            assert ctype in (2, 6), f'need RGB/RGBA: {path}'
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln
    ch = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride, out = w * ch, bytearray(w * h * ch)
    prev, pp = bytearray(stride), 0
    for y in range(h):
        f = raw[pp]
        pp += 1
        line = bytearray(raw[pp:pp + stride])
        pp += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b, c = prev[i], prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        elif f != 0:
            raise ValueError(f'unknown filter {f} in {path}')
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return {'w': w, 'h': h, 'ch': ch, 'px': out}


def write_png(path, w, h, px):
    ch = 4
    assert len(px) == w * h * ch
    stride = w * ch
    raw = bytearray()
    prev = bytearray(stride)
    for y in range(h):
        line = px[y * stride:(y + 1) * stride]
        # filter 4 (Paeth) generally compresses sprite art best
        enc = bytearray(stride)
        for i in range(stride):
            a = line[i - ch] if i >= ch else 0
            b, c = prev[i], prev[i - ch] if i >= ch else 0
            pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
            pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            enc[i] = (line[i] - pr) & 255
        raw.append(4)
        raw += enc
        prev = line
    def chunk(typ, payload):
        return (struct.pack('>I', len(payload)) + typ + payload +
                struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff))
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    blob = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(blob)


# ------------------------------------------------------- rect collection

def _as_list(v):
    return v if isinstance(v, list) else [v]


def collect_rects(manifest, section, names):
    """Return {entity: [(pose, idx, rect)]} for the requested entities.

    Handles both manifest shapes: single rects (monsters3) and frame arrays
    (bosses/monsters5). Rect dicts are the ORIGINAL objects (never mutated).
    """
    out = {}
    group = manifest[section]
    for name in names:
        poses = []
        for side in ('down', 'up'):
            for pose, frames in group[name].get(side, {}).items():
                for i, r in enumerate(_as_list(frames)):
                    poses.append((f'{side}.{pose}', i, dict(r)))
        out[name] = poses
    return out


# ------------------------------------------------------- cleaning core

def is_bright(r, g, b, tol, lum_lo, white_keep):
    lum = (r + g + b) / 3.0
    return (max(r, g, b) - min(r, g, b) <= tol) and lum_lo <= lum <= white_keep


def clean_rect(img, rect, P):
    """Clean ONE rect in place. Returns (metrics, cleaned_count).

    Writes stay strictly inside the rect. Only RGB is modified, alpha never.
    Steps per pixel-class, all 4-connected, rect border counts as background:
      1. bg mask: alpha == 0.
      2. matte BFS from bg through (bg OR bright-opaque) -> matte_dist.
      3. core BFS from non-bright opaque over opaque cells -> core_dist.
      4. fringe = bright-opaque & matte_dist<=EDGE_R & core_dist<=CORE_R.
      5. donor = nearest non-bright opaque within BLEED_R (BFS over opaque);
         none -> keep original RGB (conservative).
      6. semi-transparent pixels (alpha 1..254): RGB-bleed toward nearest
         opaque (alpha preserved). Absent in current sheets; harmless general.
    """
    w, px = img['w'], img['px']
    x0, y0, rw, rh = rect['x'], rect['y'], rect['w'], rect['h']
    N = rw * rh
    alpha = bytearray(N)
    R = bytearray(N)
    G = bytearray(N)
    B = bytearray(N)
    for yy in range(rh):
        base = ((y0 + yy) * w + x0) * 4
        for xx in range(rw):
            i = base + xx * 4
            j = yy * rw + xx
            R[j], G[j], B[j], alpha[j] = px[i], px[i + 1], px[i + 2], px[i + 3]

    opaque = bytearray(N)
    bright = bytearray(N)
    for j in range(N):
        if alpha[j] == 255:
            opaque[j] = 1
            if is_bright(R[j], G[j], B[j], P.tol, P.lum_lo, P.white_keep):
                bright[j] = 1

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

    INF = 10 ** 9
    # 2. matte distance: seeds are bg pixels AND the rect border (outside
    #    the rect is background for halo purposes).
    matte = [INF] * N
    dq = deque()
    for j in range(N):
        x, y = j % rw, j // rw
        if alpha[j] == 0 or x == 0 or y == 0 or x == rw - 1 or y == rh - 1:
            # border seeds only count as distance-0 if they are bg or bright;
            # a sprite pixel touching the rect edge is NOT background.
            if alpha[j] == 0 or bright[j]:
                matte[j] = 0
                dq.append(j)
    while dq:
        j = dq.popleft()
        for k in neighbors(j):
            if matte[k] != INF:
                continue
            if alpha[k] == 0 or bright[k]:
                matte[k] = matte[j] + 1
                dq.append(k)
    # 3. core distance: multi-source BFS from non-bright opaque over opaque.
    core = [INF] * N
    dq = deque()
    for j in range(N):
        if opaque[j] and not bright[j]:
            core[j] = 0
            dq.append(j)
    while dq:
        j = dq.popleft()
        for k in neighbors(j):
            if core[k] == INF and opaque[k]:
                core[k] = core[j] + 1
                dq.append(k)
    # 4-5. fringe + donor search.
    cleaned = 0
    for j in range(N):
        if not bright[j]:
            continue
        if matte[j] > P.edge_r or core[j] > P.core_r:
            continue
        # donor: nearest non-bright opaque within BLEED_R over opaque cells.
        seen = {j}
        dq = deque([(j, 0)])
        donor = -1
        while dq:
            cur, d = dq.popleft()
            if opaque[cur] and not bright[cur]:
                donor = cur
                break
            if d == P.bleed_r:
                continue
            for k in neighbors(cur):
                if k not in seen and opaque[k]:
                    seen.add(k)
                    dq.append((k, d + 1))
        if donor < 0:
            continue  # uncertain -> keep
        R[j], G[j], B[j] = R[donor], G[donor], B[donor]
        cleaned += 1
    # 6. semi-transparent RGB bleed (alpha preserved). No-op on these sheets.
    semi_fixed = 0
    for j in range(N):
        if alpha[j] == 0 or alpha[j] == 255:
            continue
        seen = {j}
        dq = deque([(j, 0)])
        donor = -1
        while dq:
            cur, d = dq.popleft()
            if alpha[cur] == 255:
                donor = cur
                break
            if d == P.bleed_r:
                continue
            for k in neighbors(cur):
                if k not in seen and alpha[k] != 0:
                    seen.add(k)
                    dq.append((k, d + 1))
        if donor < 0:
            continue
        R[j], G[j], B[j] = R[donor], G[donor], B[donor]
        semi_fixed += 1
    # write back RGB only
    for yy in range(rh):
        base = ((y0 + yy) * w + x0) * 4
        for xx in range(rw):
            j = yy * rw + xx
            i = base + xx * 4
            px[i], px[i + 1], px[i + 2] = R[j], G[j], B[j]
    metrics = {
        'rect': dict(rect),
        'opaque': sum(opaque),
        'transparent': sum(1 for j in range(N) if alpha[j] == 0),
        'semi': sum(1 for j in range(N) if 0 < alpha[j] < 255),
        'cleaned_rgb': cleaned,
        'semi_rgb_bleed': semi_fixed,
    }
    return metrics, cleaned


# ------------------------------------------------------- metrics helpers

def crop(img, rect):
    w, px = img['w'], img['px']
    x0, y0, rw, rh = rect['x'], rect['y'], rect['w'], rect['h']
    out = bytearray(rw * rh * 4)
    for yy in range(rh):
        s = ((y0 + yy) * w + x0) * 4
        out[yy * rw * 4:(yy + 1) * rw * 4] = px[s:s + rw * 4]
    return rw, rh, out


def frame_stats(rw, rh, buf, P):
    N = rw * rh
    opaque = transparent = semi = 0
    border_bright = 0
    minx, miny, maxx, maxy = rw, rh, -1, -1
    bright = bytearray(N)
    for j in range(N):
        i = j * 4
        r, g, b, a = buf[i], buf[i + 1], buf[i + 2], buf[i + 3]
        if a == 0:
            transparent += 1
        elif a < 255:
            semi += 1
        else:
            opaque += 1
            x, y = j % rw, j // rw
            if x < minx:
                minx = x
            if x > maxx:
                maxx = x
            if y < miny:
                miny = y
            if y > maxy:
                maxy = y
            if is_bright(r, g, b, P.tol, P.lum_lo, P.white_keep):
                bright[j] = 1
    for j in range(N):
        if not bright[j]:
            continue
        x, y = j % rw, j // rw
        if x == 0 or y == 0 or x == rw - 1 or y == rh - 1:
            border_bright += 1
            continue
        for k in (j - 1, j + 1, j - rw, j + rw):
            if buf[k * 4 + 3] == 0:
                border_bright += 1
                break
    return {
        'opaque': opaque,
        'transparent': transparent,
        'semi': semi,
        'border_bright': border_bright,
        'bbox': [minx, miny, maxx, maxy] if maxx >= 0 else None,
    }


# ------------------------------------------------------- contact sheet
# Tiny 3x5 bitmap font (digits + O/C) for row/column labels — no dependency.

FONT = {
    '0': ('111', '101', '101', '101', '111'),
    '1': ('010', '110', '010', '010', '111'),
    '2': ('111', '001', '111', '100', '111'),
    '3': ('111', '001', '111', '001', '111'),
    '4': ('101', '101', '111', '001', '001'),
    '5': ('111', '100', '111', '001', '111'),
    '6': ('111', '100', '111', '101', '111'),
    '7': ('111', '001', '001', '010', '010'),
    '8': ('111', '101', '111', '101', '111'),
    '9': ('111', '101', '111', '001', '111'),
    'O': ('111', '101', '101', '101', '111'),
    'C': ('111', '100', '100', '100', '111'),
}


def draw_text(canvas, cw, x, y, s, color):
    assert len(bytes(color)) == 4, 'label colors must be RGBA'
    for ci, ch in enumerate(s):
        g = FONT.get(ch)
        if not g:
            continue
        for r in range(5):
            for c in range(3):
                if g[r][c] == '1':
                    i = ((y + r) * cw + (x + ci * 4 + c)) * 4
                    if 0 <= i <= len(canvas) - 4:
                        canvas[i:i + 4] = bytes(color)


def contact_sheet(rows, scale, path):
    """rows: [(label_idx, name, orig_crop, clean_crop)]. Checkerboard bg."""
    cell_w = max(r[2][0] for r in rows) * scale
    cell_h = max(r[2][1] for r in rows) * scale
    label_w, gap, pad = 24, 10, 8
    W = pad + label_w + gap + cell_w + gap + cell_w + pad
    H = pad + 12 + gap + len(rows) * (cell_h + gap)
    canvas = bytearray(W * H * 4)
    D1, D2 = (16, 20, 36, 255), (34, 40, 62, 255)
    for yy in range(H):
        for xx in range(W):
            i = (yy * W + xx) * 4
            canvas[i:i + 4] = bytes(D1 if ((xx // 8) + (yy // 8)) % 2 == 0 else D2)
    draw_text(canvas, W, pad + label_w + gap + cell_w // 2 - 2, pad, 'O', (255, 255, 255, 255))
    draw_text(canvas, W, pad + label_w + gap + cell_w + gap + cell_w // 2 - 2, pad, 'C', (255, 255, 255, 255))
    y = pad + 12 + gap
    for idx, name, orig, clean in rows:
        draw_text(canvas, W, pad + 2, y + cell_h // 2 - 3, str(idx), (242, 193, 78, 255))
        for col, (cw0, ch0, buf) in enumerate((orig, clean)):
            ox = pad + label_w + gap + col * (cell_w + gap)
            for yy in range(ch0):
                for xx in range(cw0):
                    si = (yy * cw0 + xx) * 4
                    r, g, b, a = buf[si], buf[si + 1], buf[si + 2], buf[si + 3]
                    if a == 0:
                        continue  # checkerboard shows through = transparency proof
                    for dy in range(scale):
                        for dx in range(scale):
                            di = ((y + yy * scale + dy) * W + (ox + xx * scale + dx)) * 4
                            canvas[di:di + 4] = bytes((r, g, b, 255))
        y += cell_h + gap
    write_png(path, W, H, canvas)


# ------------------------------------------------------- driver + validation

MOB_NAMES = ['willow', 'zombie', 'munak', 'bongun',
             'ninetails', 'deviruchi', 'marionette', 'wraith']
SHOWCASE = [(n, 'down.idle', 0) for n in MOB_NAMES] + [
    ('darkLord', 'down.idle', 0), ('doppelganger', 'down.idle', 0)]


def parse_args(argv=None):
    ap = argparse.ArgumentParser(
        description='Clean Art V2 pilot: non-destructive Geffen cleanup.')
    ap.add_argument('--assets', default='public/assets',
                    help='input atlas dir (default: public/assets)')
    ap.add_argument('--out', default='art-clean/geffen',
                    help='output dir (default: art-clean/geffen)')
    ap.add_argument('--tol', type=int, default=14)
    ap.add_argument('--lum-lo', type=int, default=160)
    ap.add_argument('--white-keep', type=int, default=236)
    ap.add_argument('--edge-r', type=int, default=2)
    ap.add_argument('--core-r', type=int, default=2)
    ap.add_argument('--bleed-r', type=int, default=6)
    ap.add_argument('--scale', type=int, default=2)
    return ap.parse_args(argv)


def load_json(p):
    with open(p) as f:
        return json.load(f)


def process_sheet(sheet_png, manifest, section, names, out_png, out_json,
                  out, P, report_sprites):
    img = read_png(sheet_png)
    orig_px = bytes(img['px'])  # pristine copy for metrics + contact sheet
    target_cells = set()
    rects = collect_rects(manifest, section, names)
    for entity, poses in rects.items():
        for pose, idx, rect in poses:
            for yy in range(rect['y'], rect['y'] + rect['h']):
                for xx in range(rect['x'], rect['x'] + rect['w']):
                    target_cells.add(yy * img['w'] + xx)
    # before-stats from pristine, then clean in place
    for entity, poses in rects.items():
        for pose, idx, rect in poses:
            before = frame_stats(*crop(
                {'w': img['w'], 'px': bytearray(orig_px)}, rect), P)
            metrics, _ = clean_rect(img, rect, P)
            after = frame_stats(*crop(img, rect), P)
            report_sprites.append({
                'sheet': os.path.basename(out_png),
                'entity': entity, 'pose': pose, 'frame': idx,
                'rect': dict(rect), 'before': before, 'after': after,
                'cleaned_rgb': metrics['cleaned_rgb'],
                'semi_rgb_bleed': metrics['semi_rgb_bleed'],
            })
    write_png(out_png, img['w'], img['h'], img['px'])
    manifest_out = json.loads(json.dumps(manifest))  # deep copy
    manifest_out['sheet'] = os.path.basename(out_png)
    with open(out_json, 'w') as f:
        json.dump(manifest_out, f, indent=2)
        f.write('\n')
    return img, orig_px, target_cells, rects


def validate(out, P, jobs, report):
    """Re-decode outputs; assert integrity. Raises on failure."""
    for job in jobs:
        orig = read_png(job['sheet_png'])
        clean = read_png(job['out_png'])
        assert (orig['w'], orig['h']) == (clean['w'], clean['h']), 'size drift'
        assert len(clean['px']) == len(orig['px'])
        # alpha plane must be bit-identical (we never touch alpha)
        assert (orig['px'][3::4] == clean['px'][3::4]), \
            f"alpha changed in {job['out_png']}"
        # pixels outside target rects must be bit-identical (RGB too)
        w = orig['w']
        diff_out = 0
        for j in job['target_cells']:
            i = j * 4
            if orig['px'][i:i + 4] != clean['px'][i:i + 4]:
                diff_out += 1
        for j in range(w * orig['h']):
            if j in job['target_cells']:
                continue
            i = j * 4
            assert orig['px'][i:i + 4] == clean['px'][i:i + 4], \
                f"non-target pixel changed in {job['out_png']} at cell {j}"
        # manifests: rects identical, only 'sheet' renamed
        for src_json, dst_json in job['json_pairs']:
            a, b = load_json(src_json), load_json(dst_json)
            assert a.keys() == b.keys()
            for k in a:
                if k == 'sheet':
                    continue
                assert a[k] == b[k], f'manifest drift in {dst_json}: {k}'
        print(f"  valid {os.path.basename(job['out_png'])}: "
              f"{diff_out} px RGB-cleaned inside target rects, "
              f"0 outside, alpha identical")
    cs = read_png(os.path.join(out, 'contact-sheet.png'))
    assert cs['w'] > 0 and cs['h'] > 0
    print(f"  valid contact-sheet.png ({cs['w']}x{cs['h']})")
    rep = load_json(os.path.join(out, 'report.json'))
    assert len(rep['sprites']) == len(report['sprites'])
    print(f"  valid report.json ({len(rep['sprites'])} sprite frames)")


def main(argv=None):
    P = parse_args(argv)
    assets = P.assets
    out = P.out
    os.makedirs(out, exist_ok=True)
    report_sprites = []

    m3 = load_json(os.path.join(assets, 'monsters3.json'))
    bosses = load_json(os.path.join(assets, 'bosses.json'))
    m5 = load_json(os.path.join(assets, 'monsters5.json'))

    jobs = []
    print('clean monsters3 (8 Geffen mobs, all poses)...')
    img3, orig3, cells3, rects3 = process_sheet(
        os.path.join(assets, 'monsters3.png'), m3, 'monsters', MOB_NAMES,
        os.path.join(out, 'monsters3.clean.png'),
        os.path.join(out, 'monsters3.clean.json'), out, P, report_sprites)
    jobs.append({
        'sheet_png': os.path.join(assets, 'monsters3.png'),
        'out_png': os.path.join(out, 'monsters3.clean.png'),
        'target_cells': cells3,
        'json_pairs': [(os.path.join(assets, 'monsters3.json'),
                        os.path.join(out, 'monsters3.clean.json'))],
    })

    print('clean bosses.png (Dark Lord + Doppelganger rects only)...')
    bimg = read_png(os.path.join(assets, 'bosses.png'))
    borig = bytes(bimg['px'])
    bcells = set()
    brects = {}
    brects.update(collect_rects(bosses, 'bosses', ['darkLord']))
    brects.update(collect_rects(m5, 'monsters', ['doppelganger']))
    for entity, poses in brects.items():
        for pose, idx, rect in poses:
            for yy in range(rect['y'], rect['y'] + rect['h']):
                for xx in range(rect['x'], rect['x'] + rect['w']):
                    bcells.add(yy * bimg['w'] + xx)
    for entity, poses in brects.items():
        for pose, idx, rect in poses:
            before = frame_stats(*crop(
                {'w': bimg['w'], 'px': bytearray(borig)}, rect), P)
            metrics, _ = clean_rect(bimg, rect, P)
            after = frame_stats(*crop(bimg, rect), P)
            report_sprites.append({
                'sheet': 'bosses.geffen-clean.png',
                'entity': entity, 'pose': pose, 'frame': idx,
                'rect': dict(rect), 'before': before, 'after': after,
                'cleaned_rgb': metrics['cleaned_rgb'],
                'semi_rgb_bleed': metrics['semi_rgb_bleed'],
            })
    bout = os.path.join(out, 'bosses.geffen-clean.png')
    write_png(bout, bimg['w'], bimg['h'], bimg['px'])
    for src_name, dst_name in (('bosses.json', 'bosses.clean.json'),
                               ('monsters5.json', 'monsters5.clean.json')):
        m = load_json(os.path.join(assets, src_name))
        m = json.loads(json.dumps(m))
        m['sheet'] = 'bosses.geffen-clean.png'
        with open(os.path.join(out, dst_name), 'w') as f:
            json.dump(m, f, indent=2)
            f.write('\n')
    jobs.append({
        'sheet_png': os.path.join(assets, 'bosses.png'),
        'out_png': bout,
        'target_cells': bcells,
        'json_pairs': [
            (os.path.join(assets, 'bosses.json'),
             os.path.join(out, 'bosses.clean.json')),
            (os.path.join(assets, 'monsters5.json'),
             os.path.join(out, 'monsters5.clean.json')),
        ],
    })

    print('contact sheet...')
    sheet_imgs = {'monsters3.clean.png': (img3, orig3, rects3),
                  'bosses.geffen-clean.png': (bimg, borig, brects)}
    rows, legend = [], []
    for idx, (entity, pose_dot, frame_i) in enumerate(SHOWCASE):
        src = sheet_imgs['monsters3.clean.png' if entity in MOB_NAMES
                         else 'bosses.geffen-clean.png']
        img, opx, rc = src
        pose, i, rect = next(
            (p, k, r) for (p, k, r) in rc[entity]
            if p == pose_dot and k == frame_i)
        orig_crop = crop({'w': img['w'], 'px': bytearray(opx)}, rect)
        clean_crop = crop(img, rect)
        rows.append((idx, entity, orig_crop, clean_crop))
        legend.append({'row': idx, 'entity': entity, 'pose': pose,
                       'frame': frame_i, 'rect': rect})
    contact_sheet(rows, P.scale, os.path.join(out, 'contact-sheet.png'))

    report = {
        'tool': 'tools/clean-art-v2.py (pilot)',
        'params': {k: getattr(P, k) for k in
                   ('tol', 'lum_lo', 'white_keep', 'edge_r', 'core_r',
                    'bleed_r', 'scale')},
        'inputs': ['public/assets/monsters3.png+json',
                   'public/assets/bosses.png + bosses.json + monsters5.json'],
        'notes': [
            'RGB-only cleanup; alpha plane bit-identical to originals.',
            'Rects/IDs unchanged; output manifests differ only in "sheet".',
            'No padding/anchor normalization (would move visual anchors).',
            'Bright pixels above white_keep or enclosed in sprite are kept.',
        ],
        'sprites': report_sprites,
        'totals': {
            'frames': len(report_sprites),
            'cleaned_rgb': sum(s['cleaned_rgb'] for s in report_sprites),
            'border_bright_before': sum(s['before']['border_bright']
                                        for s in report_sprites),
            'border_bright_after': sum(s['after']['border_bright']
                                       for s in report_sprites),
        },
        'contact_sheet_legend': legend,
    }
    with open(os.path.join(out, 'report.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')

    print('validate...')
    validate(out, P, jobs, report)
    tb, ta = report['totals']['border_bright_before'], \
        report['totals']['border_bright_after']
    print(f'DONE: {report["totals"]["frames"]} frames, '
          f'{report["totals"]["cleaned_rgb"]} px recolored, '
          f'border-bright {tb} -> {ta} '
          f'({(100.0 * (tb - ta) / tb if tb else 0):.1f}% removed). '
          f'Alpha identical, rects identical.')


if __name__ == '__main__':
    sys.exit(main())
