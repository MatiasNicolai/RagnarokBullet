#!/usr/bin/env python3
"""Slice Niflheim approved sheets into runtime atlases (deterministic, no redraw).

Sources (read-only, never modified):
  art-clean/niflheim-gpt/niflheim-monsters-gpt-image-2-medium-v1.png  (1536x1024)
  art-clean/niflheim-gpt/niflheim-bosses-gpt-image-2-medium-v1.png    (1774x887)
  art-clean/niflheim-gpt/niflheim-map-gpt-image-2-medium-v1.png       (793x1983)

Outputs (new tree only; public/assets untouched):
  public/assets-v2/niflheim/monsters11.png + monsters11.json  (6 common mobs)
  public/assets-v2/niflheim/monsters12.json                   (Loli Ruri; shares bosses5.png)
  public/assets-v2/niflheim/bosses5.png + bosses5.json        (Loli Ruri + Lord of Death)
  public/assets-v2/niflheim/maps/niflheim001..007.png         (bottom=valley -> top=fortress)
  art-clean/niflheim-gpt/qa/contact-niflheim-mobs.png, contact-niflheim-bosses.png
  art-clean/niflheim-gpt/qa/report-niflheim.json (metrics + validation)

Method:
  key out neutral gray matte by border flood through sheet-sampled gray
  (enclosed faces/eyes/armor survive: the flood cannot reach them); fixed
  semantic panels (2 columns x 3 mob panels; 2 boss halves) so no crop can
  cross the species boundary; per-panel pose bands by projection; split rows
  into fixed pose cells at near-empty column gaps; assign every section
  component to (band, cell) by row-then-column pixel majority, so each
  frame's box is the union of its owned parts (figure plus compact attached
  effects; specks dropped). Legitimate multi-part figures (Dullahan's
  flaming head, Heirozoist's orbiting pieces, Gibbet's hanging figures,
  boss hair/wings, the horse, weapons, capes) stay whole by construction:
  only neutral-gray matte and foreign-owned pixels are ever removed.
  Mob poses are single rects; boss poses are single-frame arrays (the
  renderer cycles arrays, so one frame reads as static). Validation gates
  reject implausibly narrow/wide rects, cross-pose merges, wrong frame
  counts and residual matte (nonzero exit, nothing written).

Usage: python tools/slice-niflheim.py [--src DIR] [--out DIR]
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

# Fixed semantic panels (measured against border-line profiles; the sheet is
# 2 columns x 3 panels, column split inside the x746-823 gutter at x=768):
# top Dullahan | Heirozoist, middle Gibbet | Quve, bottom Lude | Bloody Murderer.
# Each panel holds exactly two rows of five poses (front/down, back/up).
ENEMY_PANELS = [
    {'y': (25, 312), 'names': ['dullahan', 'heirozoist']},
    {'y': (350, 664), 'names': ['gibbet', 'quve']},
    {'y': (690, 993), 'names': ['lude', 'murderer']},
]
ENEMY_SPLIT = 768  # left panels 0..767, right panels 768..1535

# Boss halves (inter-boss gutter x813-838; Loli Ruri left, Lord of Death
# right) and pose-row sections (measured row runs, padded).
BOSS_PANELS = {'loliRuri': (0, 823), 'lordOfDeath': (824, 1773)}
BOSS_SECTIONS = {'down': (110, 425), 'up': (455, 815)}

# sheet-coordinate pixel ownership filled by slice_enemies/slice_bosses,
# keyed by output sheet ('monsters11' / 'bosses5'): (x, y) -> frame tag
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


def sheet_gray_sample(img, errors, tag):
    """Median RGB of the four sheet corners (the neutral gray matte)."""
    w, h, data = img.w, img.h, img.px
    rs, gs, bs = [], [], []
    for (x, y) in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3),
                   (10, 10), (w - 11, 10), (10, h - 11), (w - 11, h - 11)):
        i = (y * w + x) * 4
        rs.append(data[i]); gs.append(data[i + 1]); bs.append(data[i + 2])
    rs.sort(); gs.sort(); bs.sort()
    n = len(rs)
    bg = (rs[n // 2], gs[n // 2], bs[n // 2])
    spread = max(rs[-1] - rs[0], gs[-1] - gs[0], bs[-1] - bs[0])
    if spread > 24:
        errors.append(f'{tag}: corner gray samples disagree ({bg} spread {spread})')
    return bg


def key_background(img, bg):
    """Key out border-connected neutral gray matte. Enclosed figure grays
    (faces, armor, horse) survive: the flood cannot reach them."""
    w, h, data = img.w, img.h, img.px
    def is_gray(i):
        return abs(data[i] - bg[0]) <= BG_TOL and abs(data[i + 1] - bg[1]) <= BG_TOL \
            and abs(data[i + 2] - bg[2]) <= BG_TOL
    seen = bytearray(w * h)
    q = deque()
    removed = 0
    for sx in range(w):
        for sy in (0, h - 1):
            p = sy * w + sx
            if not seen[p] and is_gray(p * 4):
                seen[p] = 1; q.append(p)
    for sy in range(h):
        for sx in (0, w - 1):
            p = sy * w + sx
            if not seen[p] and is_gray(p * 4):
                seen[p] = 1; q.append(p)
    while q:
        p = q.popleft()
        data[p * 4 + 3] = 0
        removed += 1
        x, y = p % w, p // w
        for np_ in ((p - 1) if x > 0 else -1, (p + 1) if x < w - 1 else -1,
                    (p - w) if y > 0 else -1, (p + w) if y < h - 1 else -1):
            if np_ >= 0 and not seen[np_] and is_gray(np_ * 4):
                seen[np_] = 1; q.append(np_)
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
    a wide intra-figure gap (legs, wings) must not beat the true narrow
    inter-pose gap.
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
    """6 mobs -> {name: {down/up: {pose: rect}}}. Returns (entries, debug).

    Fixed semantic panels (ENEMY_PANELS, split at ENEMY_SPLIT): no crop can
    cross the species boundary. Each panel holds DOWN / UP sprite rows of 5
    pose cells; dividers sit in near-empty column gaps per band, then each
    cell keeps its complete main sprite via dominant-component selection —
    never a projection slice, so no slivers and no cross-pose merges.
    Multi-part figures (severed flaming head, orbiting pieces, hanging
    figures) vote as whole components and stay whole."""
    entries, debug = {}, []
    for panel in ENEMY_PANELS:
        py0, py1 = panel['y']
        for col, name in enumerate(panel['names']):
            px0, px1 = (0, ENEMY_SPLIT - 1) if col == 0 else (ENEMY_SPLIT, img.w - 1)
            rc = img.row_counts(px0, px1, py0, py1)
            bands = runs(rc, 90, 3, 26, py0)
            bands = [b for b in bands if 36 <= b[1] - b[0] + 1 <= 200]
            rows = [b for b in bands if big_col_count(img, b, px0, px1) >= 4]
            if len(rows) < 2:
                errors.append(f'{name}: only {len(rows)} sprite rows found')
                continue
            bands2 = (rows[0], rows[1])
            # per-row cells: the two rows sprawl differently, so a divider
            # clean in one row may cut a figure in the other.
            cells = {}
            for (band, key) in [(bands2[0], 'down'), (bands2[1], 'up')]:
                cc = img.col_counts(band[0], band[1], px0, px1)
                cells[key] = fixed_cells(cc, px0, px1, 5, f'{name}.{key}', warnings,
                                         span=(px1 - px0 + 1) // 10, min_gap=3, nearest=True)
            # unified ownership over the whole 2-band panel: every comp is
            # assigned to (band, cell) by row-then-column pixel majority, so
            # a figure sprawling past a divider crops whole, while a
            # neighbor's part inside another frame is foreign by construction
            # and erased at cleaning time.
            sides = ['down', 'up']
            bands = [bands2[0], bands2[1]]
            celldivs = [[c[1] for c in cells[key][:-1]] for key in sides]
            sec = components(img, px0, bands[0][0], px1, bands[1][1])
            owners = vote_owner(sec, bands, celldivs)
            pools = {}
            for k, c in enumerate(sec):
                pools.setdefault(owners[k], []).append(c)
            entry = {'down': {}, 'up': {}}
            boxes = {}
            for bi, (band, key) in enumerate(zip(bands, sides)):
                for i, ((a, b), pose) in enumerate(zip(cells[key], POSES)):
                    tag = frame_tag(name, key, pose)
                    r = figure_sprite(img, a, b, band, px0, px1, tag,
                                      pools.get((bi, i), []), errors)
                    boxes[(key, pose)] = (r, set())
            # sheet-coordinate ownership for foreign-pixel erasure: every
            # section pixel maps to its frame tag (or None for band-less
            # labels/gaps).
            home = {}
            for k, c in enumerate(sec):
                bi, ci = owners[k]
                tag = (frame_tag(name, sides[bi], POSES[ci])
                       if bi is not None else None)
                for (mx, my) in c['members']:
                    home[(mx, my)] = tag
            for (key, pose), (r, keep) in boxes.items():
                tag = frame_tag(name, key, pose)
                Entry = dict(r)
                Entry['keep'] = set(keep)
                entry[key][pose] = Entry
                debug.append(Entry)
            entries[name] = entry
            PANEL_HOME.setdefault('monsters11', {}).update(home)
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
    """Loli Ruri + Lord of Death -> ({name: {down, up}}, debug). Every pose
    is a single-frame array (atlas.addBosses maps over arrays unconditionally;
    the renderer cycles one frame as static). Each pose row holds exactly one
    figure per pose cell (verified by probe: one large comp per cell); hit
    holds the single isolated central figure. Hair, wings, horse, weapon and
    cape vote whole and stay whole."""
    entries, debug = {}, []
    for name, (px0, px1) in BOSS_PANELS.items():
        entry = {'down': {}, 'up': {}}
        for key, (sy0, sy1) in BOSS_SECTIONS.items():
            rc = img.row_counts(px0, px1, sy0, sy1)
            cc = img.col_counts(sy0, sy1, px0, px1)
            cells = fixed_cells(cc, px0, px1, 5, f'{name}.{key}', warnings,
                                span=(px1 - px0 + 1) // 10, min_gap=3, nearest=True)
            # Ownership vote over the section (pose cell by pixel majority)
            # drives foreign-pixel erasure only: a neighbor's limb inside a
            # frame sorts to the frame it mostly belongs to and is erased
            # everywhere else. Boxes stay geometric (fixed cells).
            sec = components(img, px0, sy0, px1, sy1)
            divs = [c[1] for c in cells[:-1]]
            home = {}
            for c in sec:
                cv = [0] * 5
                for (mx, my) in c['members']:
                    if not (sy0 <= my <= sy1):
                        continue
                    j = 0
                    while j < len(divs) and mx > divs[j]:
                        j += 1
                    cv[j] += 1
                ci = max(range(5), key=lambda i: (cv[i], -i))
                tag = frame_tag(name, key, POSES[ci], 0)
                for (mx, my) in c['members']:
                    home[(mx, my)] = tag
            PANEL_HOME.setdefault('bosses5', {}).update(home)
            for i, ((a, b), pose) in enumerate(zip(cells, POSES)):
                tag = f'{name}.{key}.{pose}'
                if pose == 'hit':
                    # the isolated hit figure inside the hit cell (not the
                    # section center: this row holds all five poses).
                    hc = [c for c in components(img, a, sy0, b, sy1) if c['pixels'] >= 200]
                    if not hc:
                        errors.append(f'{tag}: no hit figure in cell x={a}..{b}')
                        r = {'x': a, 'y': sy0, 'w': 4, 'h': 4}
                    else:
                        main = max(hc, key=lambda c: (c['pixels'], -c['miny'], -c['minx']))
                        r = {'x': main['minx'], 'y': main['miny'],
                             'w': main['maxx'] - main['minx'] + 1,
                             'h': main['maxy'] - main['miny'] + 1}
                        r = pad_clamp(r, 3, px0, sy0, px1, sy1)
                else:
                    r = img.bbox(a, sy0, b, sy1)
                    if not r or r['h'] < 30:
                        errors.append(f'{tag}: no figure in cell x={a}..{b}')
                        r = {'x': a, 'y': sy0, 'w': 4, 'h': 4}
                    else:
                        r = pad_clamp(r, 3, px0, sy0, px1, sy1)
                entry[key][pose] = [dict(r, keep=set())]
                debug.append(entry[key][pose][0])
        entries[name] = entry
    return entries, debug


# ---------------- validation gates (reject broken crops) ----------------
# A rect that is implausibly narrow is a sliver (sliced through content or a
# lone particle); an implausibly wide one spans multiple figures; overlapping
# neighbors mean a divider cut through a sprite. Any violation fails the run.
MOB_W = (20, 185)   # murderer.down.attack measures 172 (slow tank + cleaver)
MOB_H = (40, 200)
BOSS_FRAME_W = (80, 300)
BOSS_HIT_W = (80, 300)
BOSS_H = (60, 380)    # mounted Lord of Death measures to 361 (horse + rider + cape)
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
            for pose in POSES:
                frames = e[side][pose]
                if len(frames) != 1:
                    errors.append(f'{name}.{side}.{pose}: {len(frames)} frames (want 1 isolated figure)')
                for i, r in enumerate(frames):
                    wr = BOSS_HIT_W if pose == 'hit' else BOSS_FRAME_W
                    gate_rect(r, f'{name}.{side}.{pose}[{i}]', wr, BOSS_H, errors)


# ---------------- matte decontamination ----------------
# The sheets bake a neutral gray matte background; the global keying only
# removes border-connected matte, so every crop rect still carries matte:
# border-connected gray, enclosed pockets (interiors, between limbs), crumbs
# and pale halos. This pass removes them PER FRAME so the sprites composite
# cleanly on dark gameplay backgrounds:
#   1. border flood through sheet-sampled gray (tight tolerance — the gray
#      span is ~5 levels, so figure colors never match it by accident;
#      figure ink blocks the flood physically);
#   2. enclosed gray-matching pockets (flat crumbs go; textured interiors
#      like faces survive the variance test unless huge);
#   3. chained tight-tolerance fringe erosion (halo gradients erode back to
#      the art edge and stop);
#   4. edge-strip cleanup for grayish border blends (single pass, figure ink
#      is far darker than its tolerance);
# Red/orange pixels are NEVER touched (attack effects, eyes, flames are
# legitimate art). Rect geometry is untouched, so manifests stay byte-identical.
BG_TOL = 12
POCKET_MIN = 3
POCKET_VAR_KEEP = 4.0
POCKET_BIG = 300
EDGE_STRIP = 2    # px from the rect border covered by edge cleanup
EDGE_TOL = 40     # grayish halo blends live here; figure ink is far darker
REMOVED_CAP = 0.80
# contamination gates (calibrated below from the measured post-clean maxima;
# any matte regression trips these with wide margin)
CLEAN_BN_MAX = 0.16
CLEAN_EDGE_MASS_MAX = 100


def sheet_bg_sample(img, errors, tag):
    """Median RGB of the keyed-out (transparent) pixels: the gray matte."""
    rs, gs, bs = [], [], []
    for i in range(0, img.w * img.h * 4, 4 * 37):
        if img.px[i + 3] == 0:
            rs.append(img.px[i]); gs.append(img.px[i + 1]); bs.append(img.px[i + 2])
    if not rs:
        errors.append(f'{tag}: no keyed background to sample')
        return (140, 140, 140)
    rs.sort(); gs.sort(); bs.sort()
    n = len(rs)
    bg = (rs[n // 2], gs[n // 2], bs[n // 2])
    if max(bg) - min(bg) > 40:
        errors.append(f'{tag}: insane bg sample {bg} (flood would eat art)')
    return bg


# ---------------- matte decontamination (per frame) ----------------
def clean_frame(img, r, bg, ftag=None, home=None):
    """Key out this rect's matte in place. Returns stats dict. Step 0 erases
    foreign pixels (owned by another frame per the section ownership vote)
    so neighboring limbs and labels cannot survive inside the rect; steps
    1-4 then remove gray matte (border flood, pockets, fringe, edge)."""
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
    # art inside this rect goes. Untracked pixels (outside the section scan)
    # default to ours (kept).
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
    # stats on the cleaned frame: residual-matte census + largest masses
    # (through residual pixels). Leftover matte is one huge mass touching the
    # frame edge; legit pale art (bones, wraps, steel) forms small masses.
    # The matte here is mid-gray, so the census is bg-relative (not bright).
    bn = border_bn = 0
    isbn = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if not alive(x, y):
                continue
            R, G, B = rgb(x, y)
            if abs(R - bg[0]) <= 24 and abs(G - bg[1]) <= 24 and abs(B - bg[2]) <= 24:
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
    after = before - removed
    return {'removed': removed, 'foreign': foreign, 'foreign_kept': foreign_kept,
            'opaque_before': before, 'opaque_after': after,
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
        backup = [bytes(img.px[(r['y'] + yy) * img.w * 4 + r['x'] * 4:
                             (r['y'] + yy) * img.w * 4 + (r['x'] + r['w']) * 4])
                  for yy in range(r['h'])]
        st = clean_frame(img, r, bg, ftag, home)
        if st['opaque_before'] > 0 and st['removed'] / st['opaque_before'] > REMOVED_CAP:
            # restore row by row (rect may span strides: each row is backed
            # up and restored as its own packed run, never as one flat
            # strided span).
            for yy in range(r['h']):
                img.px[(r['y'] + yy) * img.w * 4 + r['x'] * 4:
                       (r['y'] + yy) * img.w * 4 + (r['x'] + r['w']) * 4] = backup[yy]
            errors.append(f"{ftag}: flood ate {st['removed']}/{st['opaque_before']} px, restored")
            st = {'removed': 0, 'foreign': 0, 'foreign_kept': st.get('foreign_kept', 0),
                  'amon_removed': st.get('amon_removed', 0),
                  'opaque_before': st['opaque_before'], 'opaque_after': st['opaque_before'],
                  'bn_after': -1, 'border_bn': -1, 'w': r['w'], 'h': r['h'],
                  'bn_max': -1, 'bn_edge_max': -1, 'restored': True}
        stats['frames'][ftag] = st
    return stats


def validate_clean(stats, errors):
    """Contamination gates on cleaned frames. Leftover matte is one huge
    bg-relative mass touching the frame edge; legit pale art (bones, wraps,
    steel) forms small masses. Thresholds sit between the measured
    post-clean maxima and any matte failure (see run output)."""
    for ftag, st in stats['frames'].items():
        if st.get('restored'):
            continue  # already an error above
        if st['bn_edge_max'] > CLEAN_EDGE_MASS_MAX:
            errors.append(f'{ftag}: edge-touching bright-neutral mass {st["bn_edge_max"]}px (matte sheet)')
        frac = st['bn_after'] / max(1, st['opaque_after'])
        if frac > CLEAN_BN_MAX:
            errors.append(f'{ftag}: bright-neutral fraction {frac:.3f} > {CLEAN_BN_MAX} (residual matte)')


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

BROWN = (18, 12, 30)         # dark Niflheim-like indigo night
CHECK_A = (70, 70, 82)
CHECK_B = (112, 112, 124)
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


# (pyramid-only before/after diagnostic removed: Niflheim QA is the
# contact sheets on checkerboard + dark backgrounds plus report metrics.)


MAP_TILES = ['niflheim001', 'niflheim002', 'niflheim003', 'niflheim004',
             'niflheim005', 'niflheim006', 'niflheim007']


def slice_map_tiles(mw, mh, mch, mpx):
    """Decoded map rows -> 7 RGB tiles, bottom (valley) -> top (fortress).

    Explicitly converts decoded rows to RGB semantics first, so RGBA input
    drops alpha per pixel instead of mis-slicing 3-byte windows out of
    4-byte rows. Returns [(name, w, h, tile_px)] with RGB tile_px."""
    if mch == 4:
        rgb = bytearray(mw * mh * 3)
        for i in range(mw * mh):
            rgb[i * 3:i * 3 + 3] = mpx[i * 4:i * 4 + 3]
        mpx = rgb
        mch = 3
    bounds = [round(i * mh / 7) for i in range(8)]
    tiles = []
    for i, tile in enumerate(MAP_TILES):
        # tile i+1 takes source rows [H-(i+1)*H/7, H-i*H/7): tile001 = bottom (valley)
        y1, y0 = mh - bounds[i], mh - bounds[i + 1]
        th = y1 - y0
        tile_px = bytearray(mw * th * 3)
        for y in range(th):
            tile_px[y * mw * 3:(y + 1) * mw * 3] = mpx[(y0 + y) * mw * 3:(y0 + y) * mw * 3 + mw * 3]
        tiles.append((tile, mw, th, tile_px))
    return tiles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='art-clean/niflheim-gpt')
    ap.add_argument('--out', default='public/assets-v2/niflheim')
    args = ap.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(root, args.src) if not os.path.isabs(args.src) else args.src
    out = os.path.join(root, args.out) if not os.path.isabs(args.out) else args.out
    os.makedirs(os.path.join(out, 'maps'), exist_ok=True)
    qa = os.path.join(root, 'art-clean', 'niflheim-gpt', 'qa')
    os.makedirs(qa, exist_ok=True)
    warnings = []
    errors = []
    report = {'inputs': {}, 'sprites': {}, 'warnings': warnings}

    # --- enemy sheet ---
    enemies_src = os.path.join(src, 'niflheim-monsters-gpt-image-2-medium-v1.png')
    report['inputs']['enemies'] = {'file': os.path.basename(enemies_src), 'sha256': sha256(enemies_src)}
    mobs = Img.from_any(enemies_src)
    mob_bg = sheet_gray_sample(mobs, errors, 'enemies')
    bg_removed = key_background(mobs, mob_bg)
    print(f'source monsters {mobs.w}x{mobs.h} gray={mob_bg} keyed={bg_removed}')
    report['keying'] = {'enemies_gray': mob_bg, 'bg_pixels_removed_enemies': bg_removed}
    mob_entries, mob_debug = slice_enemies(mobs, warnings, errors)

    # --- boss sheet ---
    boss_src = os.path.join(src, 'niflheim-bosses-gpt-image-2-medium-v1.png')
    report['inputs']['bosses'] = {'file': os.path.basename(boss_src), 'sha256': sha256(boss_src)}
    bosses = Img.from_any(boss_src)
    boss_bg = sheet_gray_sample(bosses, errors, 'bosses')
    report['keying']['bosses_gray'] = boss_bg
    report['keying']['bg_pixels_removed_bosses'] = key_background(bosses, boss_bg)
    print(f'source bosses {bosses.w}x{bosses.h} gray={boss_bg}')
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
    decontaminate(mobs, mob_rects, 'monsters11', errors, clean_stats['mobs'])
    decontaminate(bosses, boss_rects, 'bosses5', errors, clean_stats['bosses'])
    for sec in ('mobs', 'bosses'):
        fr = clean_stats[sec]['frames']
        worst = max(fr.items(), key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
        edge = max(fr.items(), key=lambda kv: kv[1]['bn_edge_max'])
        tot_rem = sum(v['removed'] for v in fr.values())
        tot_for = sum(v.get('foreign', 0) for v in fr.values())
        tot_kept = sum(v.get('foreign_kept', 0) for v in fr.values())
        tot_op = sum(v['opaque_before'] for v in fr.values())
        print(f"decon {sec}: matte-removed {tot_rem} foreign-erased {tot_for} foreign-kept {tot_kept}/{tot_op} "
              f"worst-bn {worst[0]}={worst[1]['bn_after'] / max(1, worst[1]['opaque_after']):.3f} "
              f"worst-edge {edge[0]}={edge[1]['bn_edge_max']}px")
    validate_clean(clean_stats['mobs'], errors)
    validate_clean(clean_stats['bosses'], errors)
    # keep-sets served their purpose in erasure; manifests must stay plain
    # rects (JSON-serializable, byte-stable schema).
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
        'bg_samples': {'monsters11': clean_stats['mobs']['bg_sample'],
                       'bosses5': clean_stats['bosses']['bg_sample']},
        'frames': {k: v for sec in ('mobs', 'bosses') for k, v in clean_stats[sec]['frames'].items()},
    }
    if errors:
        print('ERRORS (gates rejected these crops — nothing was written):')
        for emsg in errors:
            print(f'  !! {emsg}')
        return 1
    draw_contact(mobs, mob_rects, os.path.join(qa, 'contact-niflheim-mobs.png'), cols=6)
    draw_contact(bosses, boss_rects, os.path.join(qa, 'contact-niflheim-bosses.png'), cols=4)
    draw_debug(mobs, mob_debug, os.path.join(qa, 'debug-niflheim-mobs.png'))
    draw_debug(bosses, boss_debug, os.path.join(qa, 'debug-niflheim-bosses.png'))
    encode_rgba(os.path.join(out, 'monsters11.png'), mobs.w, mobs.h, mobs.px)
    with open(os.path.join(out, 'monsters11.json'), 'w') as f:
        json.dump({'sheet': 'monsters11.png', 'size': {'w': mobs.w, 'h': mobs.h},
                   'monsters': mob_entries}, f, indent=2)
    encode_rgba(os.path.join(out, 'bosses5.png'), bosses.w, bosses.h, bosses.px)
    with open(os.path.join(out, 'bosses5.json'), 'w') as f:
        json.dump({'sheet': 'bosses5.png', 'size': {'w': bosses.w, 'h': bosses.h},
                   'bosses': {n: boss_entries[n] for n in ('loliRuri', 'lordOfDeath')}}, f, indent=2)
    with open(os.path.join(out, 'monsters12.json'), 'w') as f:
        json.dump({'sheet': 'bosses5.png', 'size': {'w': bosses.w, 'h': bosses.h},
                   'monsters': {'loliruri': boss_entries['loliRuri']}}, f, indent=2)

    # --- map: 7 horizontal tiles, bottom (valley) -> top (fortress) ---
    map_src = os.path.join(src, 'niflheim-map-gpt-image-2-medium-v1.png')
    report['inputs']['map'] = {'file': os.path.basename(map_src), 'sha256': sha256(map_src)}
    mw, mh, mch, mpx = decode(map_src)
    print(f'source map {mw}x{mh}')
    bounds = [round(i * mh / 7) for i in range(8)]
    for (tile, tw, th, tile_px) in slice_map_tiles(mw, mh, mch, mpx):
        encode_rgb(os.path.join(out, 'maps', f'{tile}.png'), tw, th, tile_px)
    report['maps'] = {'tiles': MAP_TILES, 'src_size': [mw, mh],
                      'tile_bounds_y': [[mh - bounds[i + 1], mh - bounds[i]] for i in range(7)]}

    # --- metrics ---
    sprites = {}
    for name, e in mob_entries.items():
        for side in ('down', 'up'):
            for pose, r in e[side].items():
                sprites[f'{name}.{side}.{pose}'] = r
    for name in ('loliRuri', 'lordOfDeath'):
        e = boss_entries[name]
        for side in ('down', 'up'):
            for pose, v in e[side].items():
                for i, r in enumerate(v if isinstance(v, list) else [v]):
                    sprites[f'{name}.{side}.{pose}[{i}]'] = r
    report['sprites'] = sprites
    wb = max(clean_stats['bosses']['frames'].items(),
             key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
    eb = max(clean_stats['bosses']['frames'].items(), key=lambda kv: kv[1]['bn_edge_max'])
    wm = max(clean_stats['mobs']['frames'].items(),
             key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
    em = max(clean_stats['mobs']['frames'].items(), key=lambda kv: kv[1]['bn_edge_max'])
    report['counts'] = {
        'mobs': len(mob_entries),
        'mob_poses': sum(len(e['down']) + len(e['up']) for e in mob_entries.values()),
        'boss_poses': sum(len(e['down']) + len(e['up']) for e in boss_entries.values()),
        'map_tiles': 7,
    }
    report['worst_bn'] = round(max(wb[1]['bn_after'] / max(1, wb[1]['opaque_after']),
                                   wm[1]['bn_after'] / max(1, wm[1]['opaque_after'])), 4)
    report['worst_edge'] = max(eb[1]['bn_edge_max'], em[1]['bn_edge_max'])
    with open(os.path.join(qa, 'report-niflheim.json'), 'w') as f:
        json.dump(report, f, indent=2)

    print(f"mobs: {sorted(mob_entries)}")
    for n, e in mob_entries.items():
        print(f'  {n}: down {sorted(e["down"])} up {sorted(e["up"])}')
    for n in ('loliRuri', 'lordOfDeath'):
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
    print(f'wrote {out}/monsters11.png+json, monsters12.json, bosses5.png+json, maps/niflheim001..007.png')


if __name__ == '__main__':
    sys.exit(main() or 0)
