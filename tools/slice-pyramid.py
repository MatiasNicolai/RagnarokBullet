#!/usr/bin/env python3
"""Slice Pyramid approved sheets into runtime atlases (deterministic, no redraw).

Sources (read-only, never modified):
  art-clean/pyramid-gpt/pyramid-enemies-gpt-image-2-medium-v1.png  (1122x1402)
  art-clean/pyramid-gpt/pyramid-bosses-gpt-image-2-medium-v2-user-references.png (1122x1402)
  art-clean/pyramid-gpt/pyramid-map-gpt-image-2-medium-v2-oasis-entrance-tomb.png (793x1983)

Outputs (new tree only; public/assets untouched):
  public/assets-v2/pyramid/monsters9.png + monsters9.json  (8 common mobs)
  public/assets-v2/pyramid/monsters10.json                 (Osiris; shares bosses4.png)
  public/assets-v2/pyramid/bosses4.png + bosses4.json      (Amon-Ra)
  public/assets-v2/pyramid/maps/pyramid001..007.png        (bottom=oasis -> top=sanctuary)
  tools/debug-pyramid-mobs.png, tools/debug-pyramid-bosses.png (rect overlays)
  art-clean/pyramid-gpt/slice-report.json (metrics + validation)

Method:
  key out baked off-white background by large connected bright-neutral
  regions; detect panel borders + sprite bands by projection; split each row
  into FIXED pose cells at the widest near-empty column gaps; assign every
  section component to (band, cell) by row-then-column pixel majority, so
  each frame's box is the union of its owned parts (dominant figure +
  large attached effects; specks dropped; scattered hit-debris kept whole;
  hit cells also keep big centered same-band vignette fragments). Cleaning
  erases foreign-owned pixels per frame (neighboring limbs, crowns, labels)
  then removes parchment (border flood, pockets, fringe, edge strip).
  Effect/example rows are skipped. Boss idle/move/attack become 3-frame
  arrays; hit is the single isolated central figure. Validation gates reject
  implausibly narrow/wide rects, cross-pose merges, wrong frame counts and
  residual matte (nonzero exit, nothing written).

Usage: python tools/slice-pyramid.py [--src DIR] [--out DIR]
Requires only Python 3 stdlib.
"""
import argparse
import hashlib
import json
import os
import struct
import sys
import zlib
from collections import deque

ALPHA_MIN = 24
POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack']

ENEMY_NAMES = [
    ['familiar', 'soldier', 'archer', 'mummy'],
    ['verit', 'matyr', 'isis', 'ancient'],
]
# measured panel bounds (verified against border-line profiles)
ENEMY_COLS = [(14, 287), (299, 555), (566, 825), (836, 1108)]
ENEMY_ROWS = [(10, 697), (713, 1385)]

BOSS_PANELS = {'osiris': (15, 549), 'amonRa': (571, 1106)}
BOSS_SECTIONS = {'down': (17, 637), 'up': (638, 1155)}
BOSS_GX = {'osiris': (150, 549), 'amonRa': (631, 1106)}
BOSS_NAMEPLATE_H = 95

# sheet-coordinate pixel ownership filled by slice_enemies/slice_bosses,
# keyed by output sheet ('monsters9' / 'bosses4'): (x, y) -> frame tag
# ('name.side.pose' / 'name.side.pose[i]') or None for band-less matter
# (labels, gaps). Drives foreign-pixel erasure.
PANEL_HOME = {}


# ---------------- PNG codec (8-bit RGB/RGBA, non-interlaced) ----------------
def decode(path):
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'not a PNG: {path}')
    pos, w, h, ctype, idat = 8, 0, 0, 0, b''
    while pos < len(d):
        (ln,) = struct.unpack('>I', d[pos:pos + 4])
        typ, data = d[pos + 4:pos + 8], d[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ctype, comp, filt, inter = struct.unpack('>IIBBBBB', data)
            if bd != 8 or inter != 0 or ctype not in (2, 6):
                raise ValueError(f'unsupported PNG format: {path}')
        elif typ == b'IDAT':
            idat += data
        pos += 12 + ln
    ch = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(w * h * ch)
    prev, p = bytearray(stride), 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
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
            raise ValueError(f'bad filter {f} in {path}')
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, ch, out


def encode_rgba(path, w, h, px):
    assert len(px) == w * h * 4
    stride = w * 4
    raw = bytearray()
    prev = bytearray(stride)
    for y in range(h):
        line = px[y * stride:(y + 1) * stride]
        enc = bytearray(stride)
        for i in range(stride):
            a = line[i - 4] if i >= 4 else 0
            b, c = prev[i], prev[i - 4] if i >= 4 else 0
            pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
            pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            enc[i] = (line[i] - pr) & 255
        raw.append(4)
        raw += enc
        prev = line
    def chunk(typ, payload):
        return (struct.pack('>I', len(payload)) + typ + payload +
                struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff))
    blob = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(bytes(raw), 6)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(blob)


def encode_rgb(path, w, h, px):
    assert len(px) == w * h * 3
    stride = w * 3
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += px[y * stride:(y + 1) * stride]
    def chunk(typ, payload):
        return (struct.pack('>I', len(payload)) + typ + payload +
                struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff))
    blob = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(bytes(raw), 6)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(blob)


# ---------------- image helpers (RGBA working buffer) ----------------
class Img:
    def __init__(self, w, h, px):
        self.w, self.h, self.px = w, h, px  # RGBA bytearray

    @classmethod
    def from_any(cls, path):
        w, h, ch, px = decode(path)
        if ch == 3:
            rgba = bytearray(w * h * 4)
            for i in range(w * h):
                rgba[i * 4:i * 4 + 3] = px[i * 3:i * 3 + 3]
                rgba[i * 4 + 3] = 255
            px = rgba
        return cls(w, h, px)

    def alpha_at(self, x, y):
        return self.px[(y * self.w + x) * 4 + 3]

    def row_counts(self, x0, x1, y0, y1):
        p = [0] * (y1 - y0 + 1)
        for y in range(y0, y1 + 1):
            n = 0
            base = y * self.w
            for x in range(x0, x1 + 1):
                if self.px[(base + x) * 4 + 3] > ALPHA_MIN:
                    n += 1
            p[y - y0] = n
        return p

    def col_counts(self, y0, y1, x0, x1):
        p = [0] * (x1 - x0 + 1)
        for x in range(x0, x1 + 1):
            n = 0
            for y in range(y0, y1 + 1):
                if self.px[(y * self.w + x) * 4 + 3] > ALPHA_MIN:
                    n += 1
            p[x - x0] = n
        return p

    def bbox(self, x0, y0, x1, y1):
        mnx, mxx, mny, mxy = x1, x0, y1, y0
        for y in range(y0, y1 + 1):
            base = y * self.w
            for x in range(x0, x1 + 1):
                if self.px[(base + x) * 4 + 3] > ALPHA_MIN:
                    if x < mnx: mnx = x
                    if x > mxx: mxx = x
                    if y < mny: mny = y
                    if y > mxy: mxy = y
        if mxx < mnx:
            return None
        return {'x': mnx, 'y': mny, 'w': mxx - mnx + 1, 'h': mxy - mny + 1}


def key_background(img):
    """Key out large connected bright-neutral regions (baked review bg)."""
    w, h, data = img.w, img.h, img.px
    def is_bright(i):
        r, g, b = data[i], data[i + 1], data[i + 2]
        return min(r, g, b) > 224 and max(r, g, b) - min(r, g, b) < 14
    seen = bytearray(w * h)
    q = deque()
    removed = 0
    for start in range(w * h):
        if seen[start] or not is_bright(start * 4):
            continue
        region = []
        q.append(start); seen[start] = 1
        while q:
            p = q.popleft()
            region.append(p)
            x, y = p % w, p // w
            if x > 0 and not seen[p - 1] and is_bright((p - 1) * 4):
                seen[p - 1] = 1; q.append(p - 1)
            if x < w - 1 and not seen[p + 1] and is_bright((p + 1) * 4):
                seen[p + 1] = 1; q.append(p + 1)
            if y > 0 and not seen[p - w] and is_bright((p - w) * 4):
                seen[p - w] = 1; q.append(p - w)
            if y < h - 1 and not seen[p + w] and is_bright((p + w) * 4):
                seen[p + w] = 1; q.append(p + w)
        if len(region) > 300:
            for p in region:
                data[p * 4 + 3] = 0
            removed += len(region)
    return removed


def runs(counts, thr, merge_gap, min_len, off=0):
    out = []
    s = -1
    for i in range(len(counts) + 1):
        on = i < len(counts) and counts[i] >= thr
        if on and s < 0:
            s = i
        if not on and s >= 0:
            out.append([s + off, i - 1 + off]); s = -1
    m = []
    for r in out:
        last = m[-1] if m else None
        if last and r[0] - last[1] - 1 <= merge_gap:
            last[1] = r[1]
        else:
            m.append(list(r))
    return [r for r in m if r[1] - r[0] + 1 >= min_len]


def components(img, x0, y0, x1, y1):
    """4-connected components of keyed pixels in the inclusive rect.
    Deterministic (fixed scan + neighbor order). Each item: pixels + bbox."""
    SW = x1 - x0 + 1
    data, IW = img.px, img.w
    seen = bytearray(SW * (y1 - y0 + 1))
    out = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            si = (y - y0) * SW + (x - x0)
            if seen[si] or data[(y * IW + x) * 4 + 3] <= ALPHA_MIN:
                continue
            q = deque([(x, y)])
            seen[si] = 1
            mnx = mxx = x; mny = mxy = y; n = 0
            members = []
            while q:
                cx, cy = q.popleft()
                n += 1
                members.append((cx, cy))
                if cx < mnx: mnx = cx
                if cx > mxx: mxx = cx
                if cy < mny: mny = cy
                if cy > mxy: mxy = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < x0 or nx > x1 or ny < y0 or ny > y1:
                        continue
                    ni = (ny - y0) * SW + (nx - x0)
                    if not seen[ni] and data[(ny * IW + nx) * 4 + 3] > ALPHA_MIN:
                        seen[ni] = 1
                        q.append((nx, ny))
            out.append({'pixels': n, 'minx': mnx, 'maxx': mxx, 'miny': mny,
                          'maxy': mxy, 'members': members})
    return out


def fixed_cells(counts, x0, x1, n, tag, warnings, span=None, min_gap=1, nearest=False):
    """Split [x0..x1] into n fixed cells: each divider sits at the center of
    a near-empty column gap near the ideal boundary. Deterministic; warns
    when no clean gap exists (even-split fallback). With nearest=True the
    closest qualifying gap wins instead of the widest: mob poses sprawl, so
    a wide intra-figure gap (legs) must not beat the true narrow inter-pose
    gap (verit's wolf needs the divider behind its rear paw, not mid-torso).
    span defaults to a narrow window (boss rows are evenly spaced)."""
    W = x1 - x0 + 1
    if span is None:
        span = max(10, W // (n * 4))
    divs, fell = [], []
    for k in range(1, n):
        ideal = x0 + k * W / n
        lo = max(x0, round(ideal) - span)
        hi = min(x1, round(ideal) + span)
        gaps = []
        s = -1
        for x in range(lo, hi + 2):  # hi+1 is the closing sentinel (non-empty)
            empty = x <= hi and counts[x - x0] <= 2
            if empty and s < 0:
                s = x
            if not empty and s >= 0:
                if x - s >= min_gap:
                    gaps.append(((s + x - 1) // 2, x - s))
                s = -1
        best = -1
        if gaps:
            if nearest:
                best = min(gaps, key=lambda g: (abs(g[0] - ideal), -g[1]))[0]
            else:
                best = min(gaps, key=lambda g: (-g[1], g[0]))[0]
        if best < 0:
            best = round(ideal)
            fell.append(round(ideal))
        divs.append(best)
    if fell:
        warnings.append(f'{tag}: even split at {fell} (no clean divider gaps nearby)')
    bounds = [x0] + divs + [x1 + 1]
    return list(zip(bounds[:-1], [b - 1 for b in bounds[1:]]))


def figure_sprite(img, cx0, cx1, band, px0, px1, tag, owned, errors):
    """A figure pose cell (idle/move/attack) -> rect of the complete figure.
    Uses whole-band components owned by this cell (pixel majority), so the
    box follows a sprawling figure past the dividers (clamped to the panel,
    not the cell); the overlap gate caps any sharing. Same dominant-part +
    large-effect selection as cells, minus divider clipping."""
    comps = [c for c in owned if c['pixels'] >= 50]
    if not comps:
        errors.append(f'{tag}: no sprite content in cell x={cx0}..{cx1}')
        return {'x': cx0, 'y': band[0], 'w': 4, 'h': 4}
    comps.sort(key=lambda c: (-c['pixels'], c['miny'], c['minx']))
    main = comps[0]
    total = sum(c['pixels'] for c in comps)
    if main['pixels'] < total * 0.70:
        sel = comps
    else:
        sel = [main] + [c for c in comps[1:] if c['pixels'] >= main['pixels'] * 0.35]
    r = {'x': min(c['minx'] for c in sel), 'y': min(c['miny'] for c in sel),
         'w': max(c['maxx'] for c in sel) - min(c['minx'] for c in sel) + 1,
         'h': max(c['maxy'] for c in sel) - min(c['miny'] for c in sel) + 1}
    return pad_clamp(r, 3, px0, band[0], px1, band[1])


def hit_box(img, cx0, cx1, band, tag, errors, owned, vignettes):
    """A mob hit cell (bursts + standalone vignettes) -> (rect, keep).
    Union of owned components (specks dropped) plus kept vignette fragments
    (same-band figures arcing into the cell); both define the box and the
    erasure keep-set. Boxes stay inside the cell: no cross-pose merges."""
    comps = [c for c in owned if c['pixels'] >= 50]
    fragboxes = []
    keep = set()
    for (_c, fp) in vignettes:
        xs = [p[0] for p in fp]
        ys = [p[1] for p in fp]
        fragboxes.append((min(xs), min(ys), max(xs), max(ys)))
        keep.update(fp)
    if not comps and not fragboxes:
        errors.append(f'{tag}: no sprite content in cell x={cx0}..{cx1}')
        return {'x': cx0, 'y': band[0], 'w': 4, 'h': 4}, set()
    xs0 = [c['minx'] for c in comps] + [f[0] for f in fragboxes]
    ys0 = [c['miny'] for c in comps] + [f[1] for f in fragboxes]
    xs1 = [c['maxx'] for c in comps] + [f[2] for f in fragboxes]
    ys1 = [c['maxy'] for c in comps] + [f[3] for f in fragboxes]
    r = {'x': min(xs0), 'y': min(ys0),
         'w': max(xs1) - min(xs0) + 1, 'h': max(ys1) - min(ys0) + 1}
    return pad_clamp(r, 3, cx0, band[0], cx1, band[1]), keep


def slice_boss_frames(img, gx0, gx1, band, tag, warnings, errors):
    """A 3-figure pose row (idle / moveL / moveR / attack) -> 3 individual
    frame rects via fixed per-figure cells. Rejects fused rows. Geometric
    boxes (proven gate-passing); neighbor art inside them is removed at
    cleaning time by ownership erasure, not by shrinking the box."""
    cc = img.col_counts(band[0], band[1], gx0, gx1)
    cells = fixed_cells(cc, gx0, gx1, 3, tag, warnings)
    out = []
    for (a, b) in cells:
        r = img.bbox(a, band[0], b, band[1])
        if r and r['h'] >= 30:
            r = dict(pad_clamp(r, 3, gx0, band[0], gx1, band[1]), keep=set())
            out.append(r)
    if len(out) != 3:
        errors.append(f'{tag}: got {len(out)} frames (want 3)')
        while len(out) < 3:
            out.append({'x': gx0, 'y': band[0], 'w': 4, 'h': 4, 'keep': set()})
    return out[:3]


def band_hit_single(img, gx0, gx1, band, tag, errors):
    """A hit row holds one central figure: take the largest component whose
    center lies in the middle 60% of the row (isolates the figure from
    flanking burst effects). Geometric box; ownership erasure cleans it."""
    comps = [c for c in components(img, gx0, band[0], gx1, band[1]) if c['pixels'] >= 200]
    if not comps:
        errors.append(f'{tag}: no hit figure in row y={band[0]}..{band[1]}')
        return {'x': gx0, 'y': band[0], 'w': 4, 'h': 4}
    mid = (gx0 + gx1) / 2
    half = (gx1 - gx0 + 1) * 0.3
    central = [c for c in comps
               if abs((c['minx'] + c['maxx']) / 2 - mid) <= half]
    pool = central or comps
    main = max(pool, key=lambda c: (c['pixels'], -c['miny'], -c['minx']))
    r = {'x': main['minx'], 'y': main['miny'],
         'w': main['maxx'] - main['minx'] + 1, 'h': main['maxy'] - main['miny'] + 1}
    return pad_clamp(r, 3, gx0, band[0], gx1, band[1])


def pad_clamp(r, pad, x0, y0, x1, y1):
    return {
        'x': max(x0, r['x'] - pad),
        'y': max(y0, r['y'] - pad),
        'w': min(x1, r['x'] + r['w'] - 1 + pad) - max(x0, r['x'] - pad) + 1,
        'h': min(y1, r['y'] + r['h'] - 1 + pad) - max(y0, r['y'] - pad) + 1,
    }


def big_col_count(img, band, x0, x1):
    cc = img.col_counts(band[0], band[1], x0, x1)
    rs = runs(cc, 10, 2, 6, x0)
    min_w = min(45, (x1 - x0) / 8)
    return sum(1 for (a, b) in rs if min_w <= b - a + 1 <= 210)


def slice_enemies(img, warnings, errors):
    """8 mobs -> {name: {down/up: {pose: rect}}}. Returns (entries, debug).

    Regular grid: each panel holds DOWN / UP sprite rows of 5 pose cells.
    Columns are FIXED per panel (dividers in the widest near-empty gaps of
    the combined down+up projection), then each cell keeps its complete main
    sprite via center-component selection — never a projection slice, so no
    slivers and no cross-pose merges."""
    entries, debug = {}, []
    for row, (py0, py1) in enumerate(ENEMY_ROWS):
        for col, (px0, px1) in enumerate(ENEMY_COLS):
            name = ENEMY_NAMES[row][col]
            rc = img.row_counts(px0, px1, py0, py1)
            bands = runs(rc, 90, 3, 26, py0)
            bands = [b for b in bands if 36 <= b[1] - b[0] + 1 <= 160]
            rows = [b for b in bands if big_col_count(img, b, px0, px1) >= 4]
            if len(rows) < 2:
                errors.append(f'{name}: only {len(rows)} sprite rows found')
                continue
            bands2 = (rows[0], rows[1])
            # per-row fixed cells: the two rows sprawl differently, so a
            # divider clean in one row may cut a figure in the other
            # (verit's up-row wolf needs its divider behind the rear paw).
            cells = {}
            for (band, key) in [(bands2[0], 'down'), (bands2[1], 'up')]:
                cc = img.col_counts(band[0], band[1], px0, px1)
                cells[key] = fixed_cells(cc, px0, px1, 5, f'{name}.{key}', warnings,
                                         span=(px1 - px0 + 1) // 10, min_gap=3, nearest=True)
            # unified ownership over the whole 2-band panel: every comp is
            # assigned to (band, cell) by row-then-column pixel majority, so
            # a figure sprawling past a divider crops whole, while a
            # neighbor's part inside another frame is foreign by construction
            # and erased at cleaning time. Hit frames additionally keep
            # attack-owned vignette fragments arcing into the hit cell
            # (staff, coil: big and centered); moveR-owned push-ins (paw,
            # snout, heads) and cross-band parts (crowns, suns, other rows)
            # are never kept.
            sides = ['down', 'up']
            bands = [bands2[0], bands2[1]]
            celldivs = [[c[1] for c in cells[key][:-1]] for key in sides]
            sec = components(img, px0, bands[0][0], px1, bands[1][1])
            owners = vote_owner(sec, bands, celldivs)
            pools, frags = {}, {}
            for k, c in enumerate(sec):
                pools.setdefault(owners[k], []).append(c)
            for bi, (band, key) in enumerate(zip(bands, sides)):
                (a, b) = cells[key][3]
                mid0, mid1 = a + (b - a) * 0.2, a + (b - a) * 0.8
                for k, c in enumerate(sec):
                    if owners[k] == (bi, 3):
                        continue
                    fp = [(mx, my) for (mx, my) in c['members']
                          if band[0] <= my <= band[1] and a <= mx <= b]
                    if len(fp) < 50:
                        continue
                    own = owners[k]
                    if own[0] is None or own[0] != bi or own[1] != 4:
                        continue  # moveR-owned or cross-band: never a vignette
                    xs = [p[0] for p in fp]
                    cx = (min(xs) + max(xs)) / 2
                    share = len(fp) / c['pixels']
                    if (len(fp) >= 800 or share >= 0.30) and mid0 <= cx <= mid1:
                        frags.setdefault((bi, 3), []).append((c, fp))
            entry = {'down': {}, 'up': {}}
            boxes = {}
            for bi, (band, key) in enumerate(zip(bands, sides)):
                for i, ((a, b), pose) in enumerate(zip(cells[key], POSES)):
                    tag = frame_tag(name, key, pose)
                    if pose == 'hit':
                        r, keep = hit_box(img, a, b, band, tag, errors,
                                          pools.get((bi, 3), []),
                                          frags.get((bi, 3), []))
                        boxes[(key, pose)] = (r, keep)
                    else:
                        r = figure_sprite(img, a, b, band, px0, px1, tag,
                                          pools.get((bi, i), []), errors)
                        boxes[(key, pose)] = (r, set())
            # figure and hit boxes may overlap (a sprawling figure shares a
            # zone with hit debris); that is harmless now, because erasure
            # sorts every shared pixel to its owning frame. Clipping either
            # box would truncate art or punch holes, so both stay whole.
            # sheet-coordinate ownership for foreign-pixel erasure: every
            # section pixel maps to its frame tag (or None for band-less
            # labels/gaps). Hit vignette fragments map to the hit frame.
            home = {}
            for k, c in enumerate(sec):
                bi, ci = owners[k]
                tag = (frame_tag(name, sides[bi], POSES[ci])
                       if bi is not None else None)
                for (mx, my) in c['members']:
                    home[(mx, my)] = tag
            for (key, pose), (r, keep) in boxes.items():
                tag = frame_tag(name, key, pose)
                if pose == 'hit':
                    for (_c, fp) in frags.get((sides.index(key), 3), []):
                        for (mx, my) in fp:
                            home[(mx, my)] = tag
                Entry = dict(r)
                Entry['keep'] = set(keep)
                entry[key][pose] = Entry
                debug.append(Entry)
            entries[name] = entry
            PANEL_HOME.setdefault('monsters9', {}).update(home)
    return entries, debug


def vote_owner(comps, bands, celldivs):
    """Assign every component to (band idx, cell idx) by pixel majority:
    rows first, then columns within the winning band (using that band's own
    dividers). Zero band votes -> (None, None). Deterministic (scan order +
    lowest-index ties)."""
    out = []
    for c in comps:
        bv = [0] * len(bands)
        for (mx, my) in c['members']:
            for bi, (y0, y1) in enumerate(bands):
                if y0 <= my <= y1:
                    bv[bi] += 1
                    break
        bi = max(range(len(bands)), key=lambda i: (bv[i], -i))
        if bv[bi] == 0:
            out.append((None, None))
            continue
        divs = celldivs[bi]
        y0, y1 = bands[bi]
        cv = [0] * (len(divs) + 1)
        for (mx, my) in c['members']:
            if not (y0 <= my <= y1):
                continue
            j = 0
            while j < len(divs) and mx > divs[j]:
                j += 1
            cv[j] += 1
        ci = max(range(len(cv)), key=lambda i: (cv[i], -i))
        out.append((bi, ci))
    return out


def frame_tag(name, side, pose, idx=None):
    return f'{name}.{side}.{pose}' + ('' if idx is None else f'[{idx}]')


def slice_bosses(img, warnings, errors):
    """Osiris + Amon-Ra -> ({name: {down, up}}, debug). Caller splits bosses
    (Amon-Ra) from mid-boss (Osiris) into their manifests. Every pose is an
    array: idle/move/attack hold 3 individual frames, hit holds the single
    isolated central figure (atlas.addBosses maps over them unconditionally;
    the renderer cycles the attack frames during transitions)."""
    entries, debug = {}, []
    for name, (px0, px1) in BOSS_PANELS.items():
        entry = {'down': {}, 'up': {}}
        for key, (sy0, sy1) in BOSS_SECTIONS.items():
            # skip the nameplate zone at the top of DOWN
            scan0 = sy0 + (BOSS_NAMEPLATE_H if key == 'down' else 0)
            rc = img.row_counts(px0, px1, scan0, sy1)
            # rows nearly touch: split at the 4 largest near-empty gaps
            gaps = runs([1 if v < 12 else 0 for v in rc], 1, 0, 1, scan0)
            gaps.sort(key=lambda g: g[1] - g[0], reverse=True)
            if len(gaps) >= 4:
                divs = sorted(g[0] + (g[1] - g[0]) // 2 for g in gaps[:4])
            else:  # fallback: even split (warns below via height check)
                divs = [round(scan0 + k * (sy1 - scan0 + 1) / 5) for k in range(1, 5)]
                warnings.append(f'{name}.{key}: only {len(gaps)} gaps, even split')
            bounds = [scan0] + divs + [sy1]
            bands = []
            for i in range(5):
                a, b = bounds[i], bounds[i + 1]
                while a <= b and rc[a - scan0] < 8:
                    a += 1
                while b >= a and rc[b - scan0] < 8:
                    b -= 1
                bands.append([a, b])
            if len(bands) != 5 or any(b[1] - b[0] + 1 < 40 for b in bands):
                warnings.append(f'{name}.{key}: suspicious pose rows {bands}')
            gx0, gx1 = BOSS_GX[name]
            # Ownership vote over the section (band, figure cell by pixel
            # majority) drives foreign-pixel erasure only: crowns, suns and
            # neighboring limbs sort to the frame they mostly belong to and
            # are erased everywhere else. Boxes stay geometric (fixed cells),
            # because boss rows nearly touch and figures span bands, so
            # union-of-owned boxes merge figures or strand cells.
            bandcells = []
            for band in bands:
                cc = img.col_counts(band[0], band[1], gx0, gx1)
                bandcells.append(fixed_cells(cc, gx0, gx1, 3,
                                             f'{name}.{key}', warnings))
            celldivs = [[c[1] for c in bc[:-1]] for bc in bandcells]
            # Per-band scans: boss rows nearly touch and sections hold comps
            # spanning several rows (connected figures, effects, grid), so a
            # whole-section vote would assign entire multi-row masses to one
            # band. Scanning each band separately cuts spanning comps at the
            # band edges (matching the geometric box clamps); each part then
            # votes only its cell, and cross-cell limbs sort correctly.
            home = {}
            for bi, band in enumerate(bands):
                if band[1] < band[0]:
                    continue  # degenerate (warned above, boxed geometrically)
                sec_b = components(img, px0, band[0], px1, band[1])
                own_b = vote_owner(sec_b, [band], [celldivs[bi]])
                for c, (_b0, ci) in zip(sec_b, own_b):
                    if POSES[bi] == 'hit':
                        tag = frame_tag(name, key, 'hit', 0)  # single hit frame
                    else:
                        tag = frame_tag(name, key, POSES[bi], ci)
                    for (mx, my) in c['members']:
                        home[(mx, my)] = tag
            PANEL_HOME.setdefault('bosses4', {}).update(home)
            for (band, pose) in zip(bands, POSES):
                tag = f'{name}.{key}.{pose}'
                if pose == 'hit':
                    r = dict(band_hit_single(img, gx0, gx1, band, tag, errors),
                             keep=set())
                    entry[key][pose] = [r]
                    debug.append(r)
                else:
                    entry[key][pose] = slice_boss_frames(img, gx0, gx1, band, tag,
                                                         warnings, errors)
                    debug.extend(entry[key][pose])
        entries[name] = entry
    return entries, debug


# ---------------- validation gates (reject broken crops) ----------------
# A rect that is implausibly narrow is a sliver (sliced through content or a
# lone particle); an implausibly wide one spans multiple figures; overlapping
# neighbors mean a divider cut through a sprite. Any violation fails the run.
MOB_W = (20, 120)
MOB_H = (50, 150)
BOSS_FRAME_W = (90, 230)
BOSS_ATTACK_W = (90, 290)
BOSS_HIT_W = (80, 300)
BOSS_H = (60, 160)
MAX_OVERLAP = 8


def gate_rect(r, tag, wrange, hrange, errors):
    if not (wrange[0] <= r['w'] <= wrange[1]):
        errors.append(f'{tag}: implausible width w={r["w"]} (want {wrange[0]}..{wrange[1]})')
    if not (hrange[0] <= r['h'] <= hrange[1]):
        errors.append(f'{tag}: implausible height h={r["h"]} (want {hrange[0]}..{hrange[1]})')


def validate(mob_entries, boss_entries, errors):
    for name, e in mob_entries.items():
        for side in ('down', 'up'):
            poses = e.get(side, {})
            if sorted(poses) != sorted(POSES):
                errors.append(f'{name}.{side}: poses {sorted(poses)} (want {POSES})')
            seen_poses = []
            for pose in POSES:
                r = poses.get(pose)
                if not r:
                    continue
                gate_rect(r, f'{name}.{side}.{pose}', MOB_W, MOB_H, errors)
                # overlap gate skips hit pairs: figure sprawl and hit debris
                # legitimately share a zone, and erasure sorts every shared
                # pixel to its owning frame. Between figures, overlap still
                # means fused art (width gates catch divider disasters).
                if pose != 'hit':
                    for (ppose, pr) in seen_poses:
                        if ppose != 'hit' and r['x'] < pr['x'] + pr['w'] - MAX_OVERLAP:
                            errors.append(f'{name}.{side}.{pose}: overlaps {pr} by '
                                          f'{pr["x"] + pr["w"] - r["x"]}px (multi-pose crop?)')
                seen_poses.append((pose, r))
    for name, e in boss_entries.items():
        for side in ('down', 'up'):
            for pose in ('idle', 'moveL', 'moveR'):
                frames = e[side][pose]
                if len(frames) != 3:
                    errors.append(f'{name}.{side}.{pose}: {len(frames)} frames (want 3)')
                for i, r in enumerate(frames):
                    gate_rect(r, f'{name}.{side}.{pose}[{i}]', BOSS_FRAME_W, BOSS_H, errors)
            atk = e[side]['attack']
            if len(atk) != 3:
                errors.append(f'{name}.{side}.attack: {len(atk)} frames (want 3 individual frames)')
            for i, r in enumerate(atk):
                gate_rect(r, f'{name}.{side}.attack[{i}]', BOSS_ATTACK_W, BOSS_H, errors)
            hit = e[side]['hit']
            if len(hit) != 1:
                errors.append(f'{name}.{side}.hit: {len(hit)} rects (want 1 isolated figure)')
            for i, r in enumerate(hit):
                gate_rect(r, f'{name}.{side}.hit[{i}]', BOSS_HIT_W, BOSS_H, errors)


# ---------------- matte decontamination ----------------
# The sheets bake an off-white parchment background; the global keying only
# removes large connected regions, so every crop rect still carries matte:
# border-connected parchment, enclosed windows (throne interiors, between
# limbs), crumbs and pale halos. This pass removes them PER FRAME so the
# sprites composite cleanly on dark gameplay backgrounds:
#   1. border flood through sheet-sampled parchment color (tight tolerance —
#      the parchment span is ~5 levels, so figure colors never match it by
#      accident; figure ink blocks the flood physically);
#   2. enclosed parchment-matching pockets (flat crumbs and windows go;
#      gradient pockets like painted glints survive unless huge);
#   3. chained tight-tolerance fringe erosion (halo gradients erode back to
#      the art edge and stop);
#   4. edge-strip cleanup for grayish border blends (single pass, figure ink
#      is far darker than its tolerance);
# Red/orange pixels are NEVER touched (attack effects, eyes, swooshes are
# legitimate art; measured: no straight red grid lines inside any frame).
# Rect geometry is untouched, so manifests stay byte-identical.
BG_TOL = 12
POCKET_MIN = 3
POCKET_VAR_KEEP = 4.0
POCKET_BIG = 300
EDGE_STRIP = 2    # px from the rect border covered by edge cleanup
EDGE_TOL = 40     # grayish halo blends live here; figure ink is far darker
REMOVED_CAP = 0.80
# contamination gates (calibrated below from the measured post-clean maxima;
# the pre-clean Amon-Ra idle frames sat at ~34% bright-neutral in masses of
# thousands of px, so any matte regression trips these with wide margin)
CLEAN_BN_MAX = 0.16
CLEAN_EDGE_MASS_MAX = 100


def sheet_bg_sample(img, errors, tag):
    """Median RGB of the keyed-out (transparent) pixels: still parchment."""
    rs, gs, bs = [], [], []
    for i in range(0, img.w * img.h * 4, 4 * 37):
        if img.px[i + 3] == 0:
            rs.append(img.px[i]); gs.append(img.px[i + 1]); bs.append(img.px[i + 2])
    if not rs:
        errors.append(f'{tag}: no keyed background to sample')
        return (249, 245, 240)
    rs.sort(); gs.sort(); bs.sort()
    n = len(rs)
    bg = (rs[n // 2], gs[n // 2], bs[n // 2])
    if min(bg) < 225 or max(bg) - min(bg) > 25:
        errors.append(f'{tag}: insane bg sample {bg} (flood would eat art)')
    return bg


# ---------------- Amon-Ra detached-component cleanup ----------------
# Amon's geometric boxes include detached neighbor-row matter below the
# throne (next row's stones/crowns) plus grid/baseline slivers that the
# ownership vote cannot reassign (they sit inside the band, so they vote
# here). Per frame the throne+corpse+staff is one large connected comp, so
# anything disconnected from it and lying below its base is foreign; so is
# any 1px grid line, and (normal frames only) any low-saturation slab
# touching the rect top (previous row's base overhang). Hit frames keep the
# main boss comp only. Attack solar/eclipse effects sit beside/above the
# throne, so they survive position-based rules without color tests. Boxes
# are untouched (fixed dimensions/anchors); only pixels are keyed out.
AMON_BELOW_TOL = 10   # disconnected comp with min_y > main_bottom - TOL goes
AMON_BELOW_MIN = 10   # ...if it holds at least this many pixels
AMON_LINE_LEN = 40    # 1px-thick comps this long are grid/baseline lines
AMON_TOP_EDGE = 2     # normal frames: lowsat slab touching the rect top goes
AMON_TOP_MIN = 25
AMON_SAT_RANGE = 40   # mean-RGB range below this counts as stone/gray
AMON_GATE_MIN = 25    # gate fails on detached-below comps this big or bigger
AMON_MAIN_MIN = 4000  # main comp smaller than this means a gutted frame
AMON_SIDE_MIN = 300   # normal frames: detached side comps this big are
AMON_SIDE_GAP = 8     # neighbor furniture when fully clear of the main span


def amon_pose(ftag):
    """'amonRa.down.idle[0]' -> 'idle' ('' when unparseable)."""
    try:
        return ftag.split('.')[2].split('[')[0]
    except Exception:
        return ''


def rect_comps(img, r, thr=128):
    """4-connected comps of surviving art in a rect. Deterministic; each item
    holds pixel count, local bbox and mean RGB. Local coords (rect-relative)."""
    W, H, X, Y = r['w'], r['h'], r['x'], r['y']
    data, IW = img.px, img.w
    def alive(x, y):
        return data[((Y + y) * IW + X + x) * 4 + 3] > thr
    seen = bytearray(W * H)
    out = []
    for yy in range(H):
        for xx in range(W):
            if seen[yy * W + xx] or not alive(xx, yy):
                continue
            qq = deque([(xx, yy)])
            seen[yy * W + xx] = 1
            members = []
            rs = gs = bs = 0
            while qq:
                cx, cy = qq.popleft()
                members.append((cx, cy))
                i = ((Y + cy) * IW + X + cx) * 4
                rs += data[i]; gs += data[i + 1]; bs += data[i + 2]
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and alive(nx, ny):
                        seen[ny * W + nx] = 1
                        qq.append((nx, ny))
            n = len(members)
            xs = [m[0] for m in members]
            ys = [m[1] for m in members]
            out.append({'n': n, 'x0': min(xs), 'x1': max(xs),
                        'y0': min(ys), 'y1': max(ys), 'members': members,
                        'rgb': (rs // n, gs // n, bs // n)})
    out.sort(key=lambda c: -c['n'])
    return out


def clean_amon(img, r, pose):
    """Erase detached foreign matter in an Amon-Ra frame. Keeps the largest
    (main throne) comp; erases disconnected comps below its base, 1px grid
    lines, top-edge slabs and large side chunks (normal frames), and — in
    hit frames — every other disconnected comp (main boss only). Returns
    erased px count."""
    comps = rect_comps(img, r)
    if len(comps) < 2:
        return 0
    main = comps[0]
    data, IW, X, Y = img.px, img.w, r['x'], r['y']
    erased = 0
    for c in comps[1:]:
        w = c['x1'] - c['x0'] + 1
        h = c['y1'] - c['y0'] + 1
        if pose == 'hit':
            if c['n'] >= AMON_BELOW_MIN:
                for (cx, cy) in c['members']:
                    data[((Y + cy) * IW + X + cx) * 4 + 3] = 0
                erased += c['n']
            continue
        if (w == 1 or h == 1) and max(w, h) >= AMON_LINE_LEN:
            for (cx, cy) in c['members']:
                data[((Y + cy) * IW + X + cx) * 4 + 3] = 0
            erased += c['n']
            continue
        if c['n'] >= AMON_BELOW_MIN and c['y0'] > main['y1'] - AMON_BELOW_TOL:
            for (cx, cy) in c['members']:
                data[((Y + cy) * IW + X + cx) * 4 + 3] = 0
            erased += c['n']
            continue
        if pose in ('idle', 'moveL', 'moveR') and c['n'] >= AMON_SIDE_MIN \
                and (c['x1'] < main['x0'] - AMON_SIDE_GAP or c['x0'] > main['x1'] + AMON_SIDE_GAP):
            for (cx, cy) in c['members']:
                data[((Y + cy) * IW + X + cx) * 4 + 3] = 0
            erased += c['n']
            continue
        if pose in ('idle', 'moveL', 'moveR') and c['n'] >= AMON_TOP_MIN \
                and c['y0'] <= AMON_TOP_EDGE \
                and max(c['rgb']) - min(c['rgb']) < AMON_SAT_RANGE:
            for (cx, cy) in c['members']:
                data[((Y + cy) * IW + X + cx) * 4 + 3] = 0
            erased += c['n']
    return erased


def clean_frame(img, r, bg, ftag=None, home=None):
    """Key out this rect's matte in place. Returns stats dict. Step 0 erases
    foreign pixels (owned by another frame per the section ownership vote,
    minus the frame's vignette keep-set) so neighboring limbs, crowns and
    labels cannot survive inside the rect; steps 1-4 then remove parchment."""
    W, H, X, Y = r['w'], r['h'], r['x'], r['y']
    IW, data = img.w, img.px
    def alive(x, y):
        return data[((Y + y) * IW + X + x) * 4 + 3] > 128
    def rgb(x, y):
        i = ((Y + y) * IW + X + x) * 4
        return data[i], data[i + 1], data[i + 2]
    def bg_match(x, y, tol):
        R, G, B = rgb(x, y)
        return abs(R - bg[0]) <= tol and abs(G - bg[1]) <= tol and abs(B - bg[2]) <= tol
    def kill(x, y):
        data[((Y + y) * IW + X + x) * 4 + 3] = 0
    # 0. foreign-pixel erasure (ownership vote, not color): another frame's
    # art inside this rect goes, except vignette fragments this frame keeps.
    # Untracked pixels (outside the section scan) default to ours (kept).
    # Minority-only: when foreign pixels are the majority, the divider sits
    # inside the art (touching figures), so removing them would gut the
    # frame — keep everything (previous behavior) instead.
    foreign = foreign_kept = 0
    if home is not None and ftag is not None:
        keep = r.get('keep') or set()
        cand, own = [], 0
        for y in range(H):
            for x in range(W):
                if not alive(x, y):
                    continue
                sx, sy = X + x, Y + y
                if (sx, sy) in keep or home.get((sx, sy), ftag) == ftag:
                    own += 1
                else:
                    cand.append((x, y))
        if len(cand) > (len(cand) + own) * 0.5:
            foreign_kept = len(cand)
        else:
            for (x, y) in cand:
                kill(x, y)
            foreign = len(cand)
    before = sum(1 for y in range(H) for x in range(W) if alive(x, y))
    removed = 0
    # 1. border flood through parchment
    flood = bytearray(W * H)
    q = deque()
    def seed(x, y):
        if 0 <= x < W and 0 <= y < H and not flood[y * W + x] and alive(x, y) and bg_match(x, y, BG_TOL):
            flood[y * W + x] = 1
            q.append((x, y))
    for x in range(W):
        seed(x, 0); seed(x, H - 1)
    for y in range(H):
        seed(0, y); seed(W - 1, y)
    while q:
        x, y = q.popleft()
        kill(x, y)
        removed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < W and 0 <= ny < H and not flood[ny * W + nx] and alive(nx, ny) and bg_match(nx, ny, BG_TOL):
                flood[ny * W + nx] = 1
                q.append((nx, ny))
    # 2. enclosed parchment pockets (flat crumbs + windows; gradient glints survive)
    seen = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if not alive(x, y) or flood[y * W + x] or seen[y * W + x] or not bg_match(x, y, BG_TOL):
                continue
            qq = deque([(x, y)])
            seen[y * W + x] = 1
            mem = []
            while qq:
                cx, cy = qq.popleft()
                mem.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < W and 0 <= ny < H and alive(nx, ny) and not flood[ny * W + nx] \
                            and not seen[ny * W + nx] and bg_match(nx, ny, BG_TOL):
                        seen[ny * W + nx] = 1
                        qq.append((nx, ny))
            if len(mem) >= POCKET_MIN:
                keep = False
                if len(mem) >= 8 and len(mem) < POCKET_BIG:
                    sx = s2 = 0
                    for (mx, my) in mem:
                        R, G, B = rgb(mx, my)
                        lum = (R + G + B) / 3
                        sx += lum
                        s2 += lum * lum
                    keep = s2 / len(mem) - (sx / len(mem)) ** 2 >= POCKET_VAR_KEEP * POCKET_VAR_KEEP
                if not keep:
                    for (mx, my) in mem:
                        kill(mx, my)
                    removed += len(mem)
    # 3. fringe erosion: chained tight-tolerance passes over halo pixels.
    # Each pass only eats parchment-close pixels newly exposed by the last,
    # so gradients erode back exactly to the art edge and stop (figure ink
    # never matches). Bounded: halo blends are a few px wide.
    for _ in range(10):
        snap = bytearray(W * H)
        for y in range(H):
            for x in range(W):
                if not alive(x, y):
                    snap[y * W + x] = 1
        ate = 0
        for y in range(H):
            for x in range(W):
                if not alive(x, y) or not bg_match(x, y, BG_TOL):
                    continue
                if (x > 0 and snap[y * W + x - 1]) or (x < W - 1 and snap[y * W + x + 1]) \
                        or (y > 0 and snap[(y - 1) * W + x]) or (y < H - 1 and snap[(y + 1) * W + x]):
                    kill(x, y)
                    ate += 1
        removed += ate
        if not ate:
            break
    # 4. edge strip: grayish halo blends hugging the rect border (too dark for
    # BG_TOL, far lighter than any figure ink). Single pass, no chaining.
    snap = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if not alive(x, y):
                snap[y * W + x] = 1
    for y in range(H):
        for x in range(W):
            if not alive(x, y):
                continue
            if x >= EDGE_STRIP and y >= EDGE_STRIP and x < W - EDGE_STRIP and y < H - EDGE_STRIP:
                continue
            R, G, B = rgb(x, y)
            if abs(R - bg[0]) > EDGE_TOL or abs(G - bg[1]) > EDGE_TOL or abs(B - bg[2]) > EDGE_TOL:
                continue
            if (x > 0 and snap[y * W + x - 1]) or (x < W - 1 and snap[y * W + x + 1]) \
                    or (y > 0 and snap[(y - 1) * W + x]) or (y < H - 1 and snap[(y + 1) * W + x]):
                kill(x, y)
                removed += 1
    # 5. Amon-Ra detached components (throne frames only): neighbor-row
    # stones/crowns below the base, grid lines, top-edge slabs. Intentional
    # and uncapped like foreign erasure; boxes untouched.
    amon_removed = 0
    if ftag is not None and ftag.startswith('amonRa.'):
        amon_removed = clean_amon(img, r, amon_pose(ftag))
    # stats on the cleaned frame: bright-neutral census + largest bn masses
    # (through bn pixels). A matte sheet is one huge bn mass touching the
    # frame edge; legit pale art (bones, wraps, gold) forms small masses.
    bn = border_bn = 0
    isbn = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if not alive(x, y):
                continue
            R, G, B = rgb(x, y)
            if min(R, G, B) > 200 and max(R, G, B) - min(R, G, B) < 25:
                isbn[y * W + x] = 1
                bn += 1
                if x == 0 or y == 0 or x == W - 1 or y == H - 1:
                    border_bn += 1
    seen = bytearray(W * H)
    bn_max = edge_max = 0
    for y in range(H):
        for x in range(W):
            if not isbn[y * W + x] or seen[y * W + x]:
                continue
            qq = deque([(x, y)])
            seen[y * W + x] = 1
            n = 0
            edge = False
            while qq:
                cx, cy = qq.popleft()
                n += 1
                if cx == 0 or cy == 0 or cx == W - 1 or cy == H - 1:
                    edge = True
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < W and 0 <= ny < H and isbn[ny * W + nx] and not seen[ny * W + nx]:
                        seen[ny * W + nx] = 1
                        qq.append((nx, ny))
            if n > bn_max:
                bn_max = n
            if edge and n > edge_max:
                edge_max = n
    after = before - removed - amon_removed
    return {'removed': removed, 'foreign': foreign, 'foreign_kept': foreign_kept,
            'amon_removed': amon_removed, 'opaque_before': before, 'opaque_after': after,
            'bn_after': bn, 'border_bn': border_bn, 'w': W, 'h': H,
            'bn_max': bn_max, 'bn_edge_max': edge_max}


def decontaminate(img, rects, tag, errors, stats):
    """Clean every (tag, rect) in place. Catastrophe backstop: a frame losing
    more than REMOVED_CAP of its opaque pixels to matte cleaning is restored
    + reported (foreign-pixel erasure is intentional and uncapped)."""
    bg = sheet_bg_sample(img, errors, tag)
    stats['bg_sample'] = bg
    home = PANEL_HOME.get(tag, {})
    for (ftag, r) in rects:
        if r['w'] <= 0 or r['h'] <= 0 or r['x'] < 0 or r['y'] < 0 \
                or r['x'] + r['w'] > img.w or r['y'] + r['h'] > img.h:
            errors.append(f"{ftag}: invalid crop rect {r} (skipped, nothing written)")
            stats['frames'][ftag] = {'removed': 0, 'foreign': 0, 'foreign_kept': 0,
                                     'amon_removed': 0, 'opaque_before': 0,
                                     'opaque_after': 0, 'bn_after': -1, 'border_bn': -1,
                                     'w': r.get('w'), 'h': r.get('h'),
                                     'bn_max': -1, 'bn_edge_max': -1, 'invalid': True}
            continue
        backup = bytes(img.px[r['y'] * img.w * 4 + r['x'] * 4:(r['y'] + r['h'] - 1) * img.w * 4 + (r['x'] + r['w']) * 4])
        st = clean_frame(img, r, bg, ftag, home)
        if st['opaque_before'] > 0 and st['removed'] / st['opaque_before'] > REMOVED_CAP:
            # restore row by row (rect may span strides)
            for yy in range(r['h']):
                a = yy * r['w'] * 4
                img.px[(r['y'] + yy) * img.w * 4 + r['x'] * 4:(r['y'] + yy) * img.w * 4 + (r['x'] + r['w']) * 4] = backup[a:a + r['w'] * 4]
            errors.append(f"{ftag}: flood ate {st['removed']}/{st['opaque_before']} px, restored")
            st = {'removed': 0, 'foreign': 0, 'foreign_kept': st.get('foreign_kept', 0),
                  'amon_removed': st.get('amon_removed', 0),
                  'opaque_before': st['opaque_before'], 'opaque_after': st['opaque_before'],
                  'bn_after': -1, 'border_bn': -1, 'w': r['w'], 'h': r['h'],
                  'bn_max': -1, 'bn_edge_max': -1, 'restored': True}
        stats['frames'][ftag] = st
    return stats


def validate_clean(stats, errors):
    """Contamination gates on cleaned frames. A matte sheet is one huge
    bright-neutral mass touching the frame edge (pre-clean Amon-Ra idle
    frames sat at ~34% bright-neutral in multi-thousand-px masses); legit
    pale art (bones, wraps, gold) forms small masses. Thresholds sit between
    the measured post-clean maxima and any matte failure (see run output)."""
    for ftag, st in stats['frames'].items():
        if st.get('restored'):
            continue  # already an error above
        if st['bn_edge_max'] > CLEAN_EDGE_MASS_MAX:
            errors.append(f'{ftag}: edge-touching bright-neutral mass {st["bn_edge_max"]}px (matte sheet)')
        frac = st['bn_after'] / max(1, st['opaque_after'])
        if frac > CLEAN_BN_MAX:
            errors.append(f'{ftag}: bright-neutral fraction {frac:.3f} > {CLEAN_BN_MAX} (residual matte)')


def gate_amon(img, boss_rects, stats, errors):
    """Amon-Ra detached-component gate: after cleaning, no frame may retain a
    detached comp below the main throne base, a 1px grid/baseline line, or
    (normal frames) a top-edge slab; the main comp must stay large. Any
    violation fails the run instead of shipping a contaminated frame."""
    done = stats.get('frames', {})
    for (ftag, r) in boss_rects:
        if not ftag.startswith('amonRa.'):
            continue
        st = done.get(ftag, {})
        if st.get('restored') or st.get('invalid'):
            continue  # already an error above
        pose = amon_pose(ftag)
        comps = rect_comps(img, r)
        if not comps:
            errors.append(f'{ftag}: empty frame (main throne missing)')
            continue
        main = comps[0]
        if main['n'] < AMON_MAIN_MIN:
            errors.append(f'{ftag}: main component only {main["n"]}px (gutted frame?)')
        for c in comps[1:]:
            w = c['x1'] - c['x0'] + 1
            h = c['y1'] - c['y0'] + 1
            if (w == 1 or h == 1) and max(w, h) >= AMON_LINE_LEN:
                errors.append(f'{ftag}: residual grid/baseline line {max(w, h)}px')
            elif c['n'] >= AMON_GATE_MIN and c['y0'] > main['y1'] - AMON_BELOW_TOL:
                errors.append(f'{ftag}: detached {c["n"]}px component below the main throne')
            elif pose in ('idle', 'moveL', 'moveR') and c['n'] >= AMON_SIDE_MIN \
                    and (c['x1'] < main['x0'] - AMON_SIDE_GAP or c['x0'] > main['x1'] + AMON_SIDE_GAP):
                errors.append(f'{ftag}: detached {c["n"]}px neighbor component beside the main throne')
            elif pose in ('idle', 'moveL', 'moveR') and c['n'] >= AMON_GATE_MIN \
                    and c['y0'] <= AMON_TOP_EDGE \
                    and max(c['rgb']) - min(c['rgb']) < AMON_SAT_RANGE:
                errors.append(f'{ftag}: residual top-edge slab {c["n"]}px')


# 3x5 pixel digits for contact-sheet labels (no font assets needed).
DIGITS = {
    '0': ['###', '#.#', '#.#', '#.#', '###'],
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '###', '..#', '###'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '..#', '.#.', '.#.'],
    '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'],
}

BROWN = (62, 36, 20)      # gameplay-like dark brown
CHECK_A = (120, 120, 120)
CHECK_B = (180, 180, 180)
LABEL_H = 12


def draw_contact(img, rects, path, cols=8):
    """Runtime contact sheet: every extracted crop on a split background —
    dark brown left, checkerboard right — with a red frame and index label.
    Shows what the sprite really composites to (matte glows on both)."""
    if not rects:
        return
    cw = max(r['w'] for _, r in rects) + 12
    chh = max(r['h'] for _, r in rects) + LABEL_H + 4
    rows = (len(rects) + cols - 1) // cols
    W, H = cols * cw + 1, rows * chh + 1
    out = bytearray(W * H * 4)
    for y in range(H):
        for x in range(W):
            j = (y * W + x) * 4
            out[j:j + 4] = bytes((20, 12, 8, 255))
    def put(x, y, rgb):
        if 0 <= x < W and 0 <= y < H:
            j = (y * W + x) * 4
            out[j:j + 4] = bytes((rgb[0], rgb[1], rgb[2], 255))
    def digit(ch, x0, y0):
        for dy, row in enumerate(DIGITS[ch]):
            for dx, c in enumerate(row):
                if c == '#':
                    put(x0 + dx, y0 + dy, (255, 255, 255))
    for idx, ((tag, r)) in enumerate(rects):
        cx, cy = (idx % cols) * cw, (idx // cols) * chh
        num = str(idx)
        for di, ch in enumerate(num):
            digit(ch, cx + 4 + di * 4, cy + 1)
        ox, oy = cx + 6, cy + LABEL_H + 2
        for y in range(r['h']):
            for x in range(r['w']):
                i = ((r['y'] + y) * img.w + r['x'] + x) * 4
                if img.px[i + 3] > 128:
                    rgb = (img.px[i], img.px[i + 1], img.px[i + 2])
                elif x < r['w'] // 2:
                    rgb = BROWN
                else:
                    rgb = CHECK_A if ((x // 8) + (y // 8)) % 2 == 0 else CHECK_B
                put(ox + x, oy + y, rgb)
        for x in range(r['w'] + 2):
            put(ox - 1 + x, oy - 1, (255, 0, 0))
            put(ox - 1 + x, oy + r['h'], (255, 0, 0))
        for y in range(r['h'] + 2):
            put(ox - 1, oy - 1 + y, (255, 0, 0))
            put(ox + r['w'], oy - 1 + y, (255, 0, 0))
    encode_rgba(path, W, H, out)


def draw_debug(img, rects, path):
    w, h = img.w, img.h
    out = bytearray(img.px)  # RGBA working copy
    def put(x, y):
        if 0 <= x < w and 0 <= y < h:
            i = (y * w + x) * 4
            out[i:i + 4] = b'\xff\x00\x00\xff'
    for r in rects:
        for x in range(r['x'], r['x'] + r['w']):
            put(x, r['y']); put(x, r['y'] + r['h'] - 1)
        for y in range(r['y'], r['y'] + r['h']):
            put(r['x'], y); put(r['x'] + r['w'] - 1, y)
    encode_rgba(path, w, h, out)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


QA_LETTERS = {
    'B': ['##.', '#.#', '##.', '#.#', '##.'],
    'A': ['.#.', '#.#', '###', '#.#', '#.#'],
}


def draw_amon_qa(bosses, boss_entries, root, warnings):
    """Focused enlarged before/after QA for Amon-Ra down frames: cells from
    the user-supplied diagnostic (before) vs cleaned rects (after), scaled to
    matched heights with red=before / green=after borders. Reads only; never
    modifies sources. Crops existing pixels (no generated graphics)."""
    diag_path = os.path.join(root, 'art-clean', 'pyramid-gpt', 'qa',
                             'amon-ra-down-frames-diagnostic.png')
    if not os.path.exists(diag_path):
        warnings.append('amon QA: diagnostic before-image missing, sheet skipped')
        return None
    dw, dh, dch, dpx = decode(diag_path)
    i0 = (2 * dw + 2) * dch
    bg = (dpx[i0], dpx[i0 + 1], dpx[i0 + 2])
    for (cx, cy) in ((dw - 3, 2), (2, dh - 3), (dw - 3, dh - 3)):
        i = (cy * dw + cx) * dch
        if abs(dpx[i] - bg[0]) > 30 or abs(dpx[i + 1] - bg[1]) > 30 or abs(dpx[i + 2] - bg[2]) > 30:
            warnings.append('amon QA: diagnostic corners disagree, sheet skipped')
            return None
    def isbg(x, y):
        i = (y * dw + x) * dch
        return abs(dpx[i] - bg[0]) <= 30 and abs(dpx[i + 1] - bg[1]) <= 30 and abs(dpx[i + 2] - bg[2]) <= 30
    X0, Y0 = 60, 30
    def splits(vertical, want):
        # gutter midpoints splitting content into want+1 bands (deterministic)
        tot = dw if vertical else dh
        lo = X0 if vertical else Y0
        prof = []
        rng = range(lo, tot)
        sub = range(Y0, dh, 3) if vertical else range(X0, dw, 3)
        for a in rng:
            n = 0
            for b in sub:
                x, y = (a, b) if vertical else (b, a)
                if not isbg(x, y):
                    n += 1
            prof.append(n / max(1, len(sub)))
        runs = []
        s = -1
        for k, f in enumerate(prof):
            if f < 0.03:
                if s < 0:
                    s = k
            elif s >= 0:
                if k - s >= 8:
                    runs.append((lo + s, lo + k, k - s))
                s = -1
        runs.sort(key=lambda r: -r[2])
        picks = sorted(r[0] + (r[1] - r[0]) // 2 for r in runs[:want])
        return picks
    ysplits = splits(False, 4)
    if len(ysplits) != 4:
        warnings.append(f'amon QA: row grid not found ({len(ysplits)}), sheet skipped')
        return None
    ys = [0] + ysplits + [dh]
    def isblack(x, y):
        # padding boxes (hit row) read as content against brown; exclude them
        i = (y * dw + x) * dch
        return dpx[i] < 25 and dpx[i + 1] < 25 and dpx[i + 2] < 25
    def content(x, y):
        return not isbg(x, y) and not isblack(x, y)
    def colsplit(y0, y1, lo, hi):
        # frames touch horizontally (no clean gutter): cut where each row is
        # emptiest. Deterministic (first minimum wins).
        best, bestv = lo, None
        for x in range(lo, hi):
            n = 0
            for y in range(max(y0, Y0), y1, 3):
                if content(x, y):
                    n += 1
            if bestv is None or n < bestv:
                bestv, best = n, x
        return best
    cells = []
    for ri in range(5):
        y0, y1 = ys[ri], ys[ri + 1]
        c1 = colsplit(y0, y1, 150, 420)
        c2 = colsplit(y0, y1, 430, 720)
        if not c1 < c2:
            warnings.append('amon QA: column split failed, sheet skipped')
            return None
        row = []
        for (x0, x1) in ((X0, c1), (c1, c2), (c2, dw)):
            mnx, mxx, mny, mxy = x1, x0, y1, y0
            n = 0
            for y in range(y0, y1, 2):
                for x in range(x0, x1, 2):
                    if content(x, y):
                        n += 1
                        if x < mnx:
                            mnx = x
                        if x > mxx:
                            mxx = x
                        if y < mny:
                            mny = y
                        if y > mxy:
                            mxy = y
            if n < 200 or mxx <= mnx or mxy <= mny:
                row.append(None)
                continue
            row.append((mnx, mny, mxx, mxy))
        cells.append(row)
    # flatten black cells: recompute mean brightness per bbox, drop near-black
    before = []
    poses = ['idle', 'moveL', 'moveR', 'hit', 'attack']
    for ri, pose in enumerate(poses):
        for ci in range(3 if pose != 'hit' else 1):
            bb = cells[ri][ci]
            if bb is None:
                before.append(None)
                continue
            mnx, mny, mxx, mxy = bb
            rs = gs = bs = cnt = 0
            for y in range(mny, mxy + 1, 2):
                for x in range(mnx, mxx + 1, 2):
                    i = (y * dw + x) * dch
                    rs += dpx[i]; gs += dpx[i + 1]; bs += dpx[i + 2]; cnt += 1
            if cnt and (rs + gs + bs) / cnt / 3 < 20:
                before.append(None)  # padding box, not a frame
            else:
                before.append((mnx, mny, mxx, mxy))
    after_rects = []
    for pose in poses:
        frames = boss_entries['amonRa']['down'][pose]
        for i, r in enumerate(frames if isinstance(frames, list) else [frames]):
            if pose == 'hit' and i > 0:
                break
            after_rects.append((pose, i, r))
    if sum(1 for b in before if b) != len(after_rects):
        warnings.append(f'amon QA: cell count {sum(1 for b in before if b)} != frames {len(after_rects)}, sheet skipped')
        return None
    # render pairs at matched heights
    rows = []
    ai = 0
    for bb in before:
        if bb is None:
            continue
        pose, idx, r = after_rects[ai]
        ai += 1
        mnx, mny, mxx, mxy = bb
        bw, bh = mxx - mnx + 1, mxy - mny + 1
        bpix = bytearray(bw * bh * 4)
        for oy in range(bh):
            for ox in range(bw):
                i = ((mny + oy) * dw + mnx + ox) * dch
                j = (oy * bw + ox) * 4
                bpix[j:j + 4] = bytes((dpx[i], dpx[i + 1], dpx[i + 2], 255))
        aw = max(1, r['w'] * bh // r['h'])
        apix = bytearray(aw * bh * 4)
        for oy in range(bh):
            sy = min(r['h'] - 1, oy * r['h'] // bh)
            for ox in range(aw):
                sx = min(r['w'] - 1, ox * r['w'] // aw)
                si = ((r['y'] + sy) * bosses.w + r['x'] + sx) * 4
                a = bosses.px[si + 3]
                j = (oy * aw + ox) * 4
                if a > 128:
                    apix[j:j + 4] = bytes((bosses.px[si], bosses.px[si + 1], bosses.px[si + 2], 255))
                else:
                    apix[j:j + 4] = bytes((bg[0], bg[1], bg[2], 255))
        rows.append((f'{pose}[{idx}]', bw, bh, bpix, aw, apix))
    GHC = 7  # cell gap + label gutter
    numw = 4 * len(rows)  # index digits column
    W = max(2 * GHC + 3 + bw + GHC + 3 + aw + GHC + numw for (_, bw, _, _, aw, _) in rows)
    H = sum(bh + 2 * GHC + 8 for (_, _, bh, _, _, _) in rows) + GHC
    out = bytearray(W * H * 4)
    for k in range(0, W * H * 4, 4):
        out[k:k + 4] = bytes((bg[0], bg[1], bg[2], 255))
    def put(x, y, rgb):
        if 0 <= x < W and 0 <= y < H:
            j = (y * W + x) * 4
            out[j:j + 4] = bytes((rgb[0], rgb[1], rgb[2], 255))
    def digit(ch, x0, y0):
        for dy, line in enumerate(DIGITS[ch]):
            for dx, c in enumerate(line):
                if c == '#':
                    put(x0 + dx, y0 + dy, (255, 255, 255))
    def glyph(ch, x0, y0, rgb):
        pat = QA_LETTERS.get(ch)
        if not pat:
            return
        for dy, line in enumerate(pat):
            for dx, c in enumerate(line):
                if c == '#':
                    put(x0 + dx, y0 + dy, rgb)
    def border(x0, y0, w, h, rgb):
        for x in range(x0, x0 + w):
            put(x, y0, rgb); put(x, y0 + h - 1, rgb)
        for y in range(y0, y0 + h):
            put(x0, y, rgb); put(x0 + w - 1, y, rgb)
    cy = GHC
    for ni, (tag, bw, bh, bpix, aw, apix) in enumerate(rows):
        y0 = cy
        glyph('B', GHC, y0, (255, 80, 80))
        bx = GHC + 5
        for oy in range(bh):
            for ox in range(bw):
                j = (oy * bw + ox) * 4
                put(bx + ox, y0 + 6 + oy, (bpix[j], bpix[j + 1], bpix[j + 2]))
        border(bx - 1, y0 + 5, bw + 2, bh + 2, (255, 0, 0))
        ax = bx + bw + GHC + 5
        glyph('A', bx + bw + 2, y0, (80, 255, 80))
        for oy in range(bh):
            for ox in range(aw):
                j = (oy * aw + ox) * 4
                put(ax + ox, y0 + 6 + oy, (apix[j], apix[j + 1], apix[j + 2]))
        border(ax - 1, y0 + 5, aw + 2, bh + 2, (0, 200, 0))
        for di, ch in enumerate(str(ni)):
            digit(ch, ax + aw + 3 + di * 4, y0)
        cy = y0 + 6 + bh + 2 + GHC
    out_path = os.path.join(root, 'art-clean', 'pyramid-gpt', 'qa', 'amon-ra-before-after.png')
    encode_rgba(out_path, W, H, out)
    return out_path


MAP_TILES = ['pyramid001', 'pyramid002', 'pyramid003', 'pyramid004',
             'pyramid005', 'pyramid006', 'pyramid007']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='art-clean/pyramid-gpt')
    ap.add_argument('--out', default='public/assets-v2/pyramid')
    args = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(root, args.src) if not os.path.isabs(args.src) else args.src
    out = os.path.join(root, args.out) if not os.path.isabs(args.out) else args.out
    os.makedirs(os.path.join(out, 'maps'), exist_ok=True)
    warnings = []
    errors = []
    report = {'inputs': {}, 'sprites': {}, 'warnings': warnings}

    # --- enemy sheet ---
    enemies_src = os.path.join(src, 'pyramid-enemies-gpt-image-2-medium-v1.png')
    report['inputs']['enemies'] = {'file': os.path.basename(enemies_src), 'sha256': sha256(enemies_src)}
    mobs = Img.from_any(enemies_src)
    bg_removed = key_background(mobs)
    report['keying'] = {'bg_pixels_removed_enemies': bg_removed}
    mob_entries, mob_debug = slice_enemies(mobs, warnings, errors)

    # --- boss sheet ---
    boss_src = os.path.join(src, 'pyramid-bosses-gpt-image-2-medium-v2-user-references.png')
    report['inputs']['bosses'] = {'file': os.path.basename(boss_src), 'sha256': sha256(boss_src)}
    bosses = Img.from_any(boss_src)
    report['keying']['bg_pixels_removed_bosses'] = key_background(bosses)
    boss_entries, boss_debug = slice_bosses(bosses, warnings, errors)
    # gates run BEFORE anything is written: a broken crop fails the run
    # instead of shipping a bad manifest.
    validate(mob_entries, boss_entries, errors)
    # matte decontamination (per-frame, in place; rect geometry untouched).
    mob_rects = [(f'{n}.{s}.{p}', r) for n, e in mob_entries.items()
                 for s in ('down', 'up') for p, r in e[s].items()]
    boss_rects = [(f'{n}.{s}.{p}[{i}]', r) for n, e in boss_entries.items()
                  for s in ('down', 'up') for p, v in e[s].items()
                  for i, r in enumerate(v if isinstance(v, list) else [v])]
    clean_stats = {'mobs': {'frames': {}}, 'bosses': {'frames': {}}}
    decontaminate(mobs, mob_rects, 'monsters9', errors, clean_stats['mobs'])
    decontaminate(bosses, boss_rects, 'bosses4', errors, clean_stats['bosses'])
    for sec in ('mobs', 'bosses'):
        fr = clean_stats[sec]['frames']
        worst = max(fr.items(), key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
        edge = max(fr.items(), key=lambda kv: kv[1]['bn_edge_max'])
        tot_rem = sum(v['removed'] for v in fr.values())
        tot_for = sum(v.get('foreign', 0) for v in fr.values())
        tot_kept = sum(v.get('foreign_kept', 0) for v in fr.values())
        tot_amon = sum(v.get('amon_removed', 0) for v in fr.values())
        tot_op = sum(v['opaque_before'] for v in fr.values())
        print(f"decon {sec}: matte-removed {tot_rem} foreign-erased {tot_for} foreign-kept {tot_kept} amon-detached {tot_amon}/{tot_op} "
              f"worst-bn {worst[0]}={worst[1]['bn_after'] / max(1, worst[1]['opaque_after']):.3f} "
              f"worst-edge {edge[0]}={edge[1]['bn_edge_max']}px")
    validate_clean(clean_stats['mobs'], errors)
    validate_clean(clean_stats['bosses'], errors)
    gate_amon(bosses, boss_rects, clean_stats['bosses'], errors)
    # vignette keep-sets served their purpose in erasure; manifests must stay
    # plain rects (JSON-serializable, byte-stable schema).
    for _e in list(mob_entries.values()):
        for _s in ('down', 'up'):
            for _r in _e[_s].values():
                _r.pop('keep', None)
    for _e in list(boss_entries.values()):
        for _s in ('down', 'up'):
            for _v in _e[_s].values():
                for _r in (_v if isinstance(_v, list) else [_v]):
                    _r.pop('keep', None)
    report['decontamination'] = {
        'bg_samples': {'monsters9': clean_stats['mobs']['bg_sample'],
                       'bosses4': clean_stats['bosses']['bg_sample']},
        'frames': {k: v for sec in ('mobs', 'bosses') for k, v in clean_stats[sec]['frames'].items()},
    }
    if errors:
        print('ERRORS (gates rejected these crops — nothing was written):')
        for emsg in errors:
            print(f'  !! {emsg}')
        return 1
    draw_contact(mobs, mob_rects, os.path.join(root, 'tools', 'contact-pyramid-mobs.png'), cols=8)
    draw_contact(bosses, boss_rects, os.path.join(root, 'tools', 'contact-pyramid-bosses.png'), cols=4)
    qa_path = draw_amon_qa(bosses, boss_entries, root, warnings)
    if qa_path:
        print(f'amon QA sheet: {os.path.relpath(qa_path, root)}')
    encode_rgba(os.path.join(out, 'monsters9.png'), mobs.w, mobs.h, mobs.px)
    with open(os.path.join(out, 'monsters9.json'), 'w') as f:
        json.dump({'sheet': 'monsters9.png', 'size': {'w': mobs.w, 'h': mobs.h},
                   'monsters': mob_entries}, f, indent=2)
    draw_debug(mobs, mob_debug, os.path.join(root, 'tools', 'debug-pyramid-mobs.png'))
    encode_rgba(os.path.join(out, 'bosses4.png'), bosses.w, bosses.h, bosses.px)
    with open(os.path.join(out, 'bosses4.json'), 'w') as f:
        json.dump({'sheet': 'bosses4.png', 'size': {'w': bosses.w, 'h': bosses.h},
                   'bosses': {'amonRa': boss_entries['amonRa']}}, f, indent=2)
    with open(os.path.join(out, 'monsters10.json'), 'w') as f:
        json.dump({'sheet': 'bosses4.png', 'size': {'w': bosses.w, 'h': bosses.h},
                   'monsters': {'osiris': boss_entries['osiris']}}, f, indent=2)
    draw_debug(bosses, boss_debug, os.path.join(root, 'tools', 'debug-pyramid-bosses.png'))

    # --- map: 7 horizontal tiles, bottom (oasis) -> top (sanctuary) ---
    map_src = os.path.join(src, 'pyramid-map-gpt-image-2-medium-v2-oasis-entrance-tomb.png')
    report['inputs']['map'] = {'file': os.path.basename(map_src), 'sha256': sha256(map_src)}
    mw, mh, mch, mpx = decode(map_src)
    bounds = [round(i * mh / 7) for i in range(8)]
    for i, tile in enumerate(MAP_TILES):
        # tile i+1 takes source rows [H-(i+1)*H/7, H-i*H/7): tile001 = bottom (oasis)
        y1, y0 = mh - bounds[i], mh - bounds[i + 1]
        th = y1 - y0
        tile_px = bytearray(mw * th * 3)
        for y in range(th):
            tile_px[y * mw * 3:(y + 1) * mw * 3] = mpx[(y0 + y) * mw * mch:(y0 + y) * mw * mch + mw * 3]
        encode_rgb(os.path.join(out, 'maps', f'{tile}.png'), mw, th, tile_px)
    report['maps'] = {'tiles': MAP_TILES, 'src_size': [mw, mh],
                      'tile_bounds_y': [[mh - bounds[i + 1], mh - bounds[i]] for i in range(7)]}

    # --- metrics ---
    sprites = {}
    for name, e in mob_entries.items():
        for side in ('down', 'up'):
            for pose, r in e[side].items():
                sprites[f'{name}.{side}.{pose}'] = r
    for name in ('osiris',):
        e = boss_entries[name]
        for side in ('down', 'up'):
            for pose, v in e[side].items():
                for i, r in enumerate(v if isinstance(v, list) else [v]):
                    sprites[f'{name}.{side}.{pose}[{i}]'] = r
    e = boss_entries['amonRa']
    for side in ('down', 'up'):
        for pose, v in e[side].items():
            for i, r in enumerate(v if isinstance(v, list) else [v]):
                sprites[f'amonRa.{side}.{pose}[{i}]'] = r
    report['sprites'] = sprites
    report['counts'] = {
        'mobs': len(mob_entries),
        'mob_poses': sum(len(e['down']) + len(e['up']) for e in mob_entries.values()),
        'boss_frames': sum(1 for k in sprites if k.startswith('amonRa')),
        'osiris_frames': sum(1 for k in sprites if k.startswith('osiris')),
        'map_tiles': 7,
    }
    with open(os.path.join(src, 'slice-report.json'), 'w') as f:
        json.dump(report, f, indent=2)

    print(f"mobs: {sorted(mob_entries)}")
    for n, e in mob_entries.items():
        print(f'  {n}: down {sorted(e["down"])} up {sorted(e["up"])}')
    for n in ('osiris', 'amonRa'):
        e = boss_entries[n]
        summ = {}
        for side in ('down', 'up'):
            for pose, v in e[side].items():
                summ[f'{side}.{pose}'] = len(v) if isinstance(v, list) else 1
        print(f'  {n}: {summ}')
    if warnings:
        print('WARNINGS:')
        for wmsg in warnings:
            print(f'  ! {wmsg}')
    print(f'wrote {out}/monsters9.png+json, monsters10.json, bosses4.png+json, maps/pyramid001..007.png')


if __name__ == '__main__':
    sys.exit(main() or 0)
