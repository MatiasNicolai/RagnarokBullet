#!/usr/bin/env python3
"""Prontera V3 monster atlas: approved GPT sheet -> runtime atlas (technical
extraction only; no redrawn or generated graphics).

Source: art-clean/prontera-gpt/prontera-monsters-gpt-image-2-medium-v1.png
(2 columns x 3 character rows; each mini-grid 5 pose columns x 2 pose rows
on uniform gray). Extracts exactly 6 IDs in order — poring, pupa, picky,
chonchon, orcbaby, lunatic — each with down/up poses idle, moveL, moveR,
hit, attack (60 runtime rects).

Method: detect character rows + pose bands by projection; split panels at
the fixed source-layout column half (x=561: picky|chonchon gutter spans
x549-566, so no panel can cross the species boundary); row 1 uses fixed
measured pose dividers (projection mis-split it: picky's burst bridges the
gutter in projection, aliasing picky.attack into chonchon.down.idle);
other rows split at the widest near-empty column gaps with fused-cell
re-split as backstop;
assign every section component to (band, cell) by row-then-column pixel
majority, so each frame's box is the union of its owned parts (figures plus
compact attached hit/attack effects and compact in-cell ground shadows).
Cleaning erases foreign-owned pixels per frame, then keys the gray matte
(border flood, pockets, fringe, edge strip) without touching enclosed faces
(eyes/mouths) or pale bodies. Validation gates reject wrong counts, fused
poses, slivers and residual matte (nonzero exit, nothing written).

Outputs (deterministic, stdlib only):
  public/assets-v2/prontera/monsters-v3.png + .json  (cleaned sheet + manifest)
  art-clean/prontera-gpt/qa/contact-prontera-v3.png (labeled dark/checker sheet)
  art-clean/prontera-gpt/qa/report-v3.json           (per-frame metrics)
"""
import json
import os
import struct
import sys
import zlib
from collections import deque

SRC = os.path.join('art-clean', 'prontera-gpt',
                   'prontera-monsters-gpt-image-2-medium-v1.png')
OUT_DIR = os.path.join('public', 'assets-v2', 'prontera')
QA_DIR = os.path.join('art-clean', 'prontera-gpt', 'qa')
OUT_PNG = os.path.join(OUT_DIR, 'monsters-v3.png')
OUT_JSON = os.path.join(OUT_DIR, 'monsters-v3.json')

IDS = ['poring', 'pupa', 'picky', 'chonchon', 'orcbaby', 'lunatic']
POSES = ['idle', 'moveL', 'moveR', 'hit', 'attack']
SIDES = ['down', 'up']

# Fixed source-layout geometry (approved 2-column sheet, grid half x=561).
# Row 1 (picky|chonchon) is fully fixed: measured under BG_TOL, each divider
# sits mid-gap with >=6px margins, and every body falls strictly inside its
# cell, so ownership votes are unanimous. Picky's 5th cell holds its attack
# body (x443-547) plus burst; chonchon's five cells hold idle/moveL/moveR/
# hit/attack single bodies (B|C split at the touching-wings dip x679, which
# never reads near-empty in projection). Rows 0/2 keep projection dividers
# strictly inside these same fixed halves. Width/overlap gates verify.
COL_HALF = 561
ROW1_DIVS = {'picky': [125, 225, 329, 435],
             'chonchon': [679, 774, 877, 981]}

BG_TOL = 12       # flood/pocket gray match tolerance
FRINGE_TOL = 10   # halo re-check tolerance (single pass, no chaining)
POCKET_MAX = 400  # enclosed gray regions up to this size are matte dust
SPECK_MIN = 50    # owned comps below this don't define boxes
PAD = 3
REMOVED_CAP = 0.8
BN_MAX = 0.16     # residual gray fraction gate (bright-neutral census)
EDGE_MAX = 100    # edge-touching gray mass gate
W_MIN, W_MAX = 20, 260
H_MIN, H_MAX = 20, 260
H_RATIO_MAX = 2.0
MAX_OVERLAP = 8


def decode(path):
    d = open(path, 'rb').read()
    w, h = struct.unpack('>II', d[16:24])
    ctype, bdep = d[25], d[24]
    assert bdep == 8 and ctype in (2, 6), f'{path}: need 8-bit RGB/RGBA'
    ch = 3 if ctype == 2 else 4
    pos, raw = 8, b''
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos + 4])[0]
        typ = d[pos + 4:pos + 8]
        if typ == b'IDAT':
            raw += d[pos + 8:pos + 8 + ln]
        pos += 12 + ln
    px = zlib.decompress(raw)
    stride = w * ch
    out = bytearray(w * h * ch)
    prev = bytearray(stride)
    for y in range(h):
        f = px[y * (stride + 1)]
        line = bytearray(px[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
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
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, ch, out


def encode_rgba(path, w, h, px):
    assert len(px) == w * h * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += px[y * w * 4:(y + 1) * w * 4]
    comp = zlib.compress(bytes(raw), 9)
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', comp) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


class Img:
    """RGBA working image (source RGB promoted with full alpha)."""

    def __init__(self, w, h, px):
        self.w, self.h, self.px = w, h, px

    @staticmethod
    def from_source(path):
        w, h, ch, px = decode(path)
        if ch == 3:
            rgba = bytearray(w * h * 4)
            for i in range(w * h):
                rgba[i * 4:i * 4 + 3] = px[i * 3:i * 3 + 3]
                rgba[i * 4 + 3] = 255
            px = rgba
        return Img(w, h, bytearray(px))

    def rgb(self, x, y):
        i = (y * self.w + x) * 4
        return (self.px[i], self.px[i + 1], self.px[i + 2])

    def alpha(self, x, y):
        return self.px[(y * self.w + x) * 4 + 3]


def key_background(img, bg):
    """Sheet-wide border flood: connected gray matte -> transparent. Enclosed
    faces stay intact (unreachable from the border); per-frame cleaning later
    handles pockets, fringe and foreign pixels."""
    W, H, IW, data = img.w, img.h, img.w, img.px

    def alive(x, y):
        return data[(y * IW + x) * 4 + 3] > 128

    def bgm(x, y):
        i = (y * IW + x) * 4
        return abs(data[i] - bg[0]) <= BG_TOL and abs(data[i + 1] - bg[1]) <= BG_TOL \
            and abs(data[i + 2] - bg[2]) <= BG_TOL

    seen = bytearray(W * H)
    q = deque()

    def seed(x, y):
        if 0 <= x < W and 0 <= y < H and not seen[y * W + x] and alive(x, y) and bgm(x, y):
            seen[y * W + x] = 1
            q.append((x, y))

    for x in range(W):
        seed(x, 0)
        seed(x, H - 1)
    for y in range(H):
        seed(0, y)
        seed(W - 1, y)
    keyed = 0
    while q:
        x, y = q.popleft()
        data[(y * IW + x) * 4 + 3] = 0
        keyed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and alive(nx, ny) and bgm(nx, ny):
                seen[ny * W + nx] = 1
                q.append((nx, ny))
    return keyed


def row_counts(img, x0, x1, y0, y1, bg, tol):
    """Per-row count of non-background pixels (color only: detection runs on
    the raw source, where every pixel still has full alpha)."""
    out = []
    for y in range(y0, y1 + 1):
        n = 0
        for x in range(x0, x1 + 1):
            i = (y * img.w + x) * 4
            r, g, b = img.px[i], img.px[i + 1], img.px[i + 2]
            if abs(r - bg[0]) > tol or abs(g - bg[1]) > tol or abs(b - bg[2]) > tol:
                n += 1
        out.append(n)
    return out


def col_counts(img, x0, x1, y0, y1, bg, tol):
    out = [0] * (x1 - x0 + 1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            i = (y * img.w + x) * 4
            r, g, b = img.px[i], img.px[i + 1], img.px[i + 2]
            if abs(r - bg[0]) > tol or abs(g - bg[1]) > tol or abs(b - bg[2]) > tol:
                out[x - x0] += 1
    return out


def runs(counts, thr, merge_gap, min_len, off=0):
    """Runs of counts >= thr (gap-merged, short-run filtered), as [a, b] lists.
    Merging compares local indices; the offset applies once at the end."""
    out, a = [], None
    for k, c in enumerate(counts + [0]):
        if c >= thr:
            if a is None:
                a = k
        elif a is not None:
            if out and a - out[-1][1] - 1 <= merge_gap:
                out[-1][1] = k - 1
            elif k - a >= min_len:
                out.append([a, k - 1])
            a = None
    return [[x + off, y + off] for [x, y] in out]


def components(img, x0, y0, x1, y1):
    """4-connected comps of alive (alpha>128) pixels in a rect. Deterministic
    scan order; each item has pixels, bbox and members (rect-local)."""
    W = x1 - x0 + 1
    H = y1 - y0 + 1
    seen = bytearray(W * H)
    data, IW = img.px, img.w
    out = []
    for yy in range(H):
        for xx in range(W):
            if seen[yy * W + xx] or data[((y0 + yy) * IW + x0 + xx) * 4 + 3] <= 128:
                continue
            qq = deque([(xx, yy)])
            seen[yy * W + xx] = 1
            members = []
            while qq:
                cx, cy = qq.popleft()
                members.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] \
                            and data[((y0 + ny) * IW + x0 + nx) * 4 + 3] > 128:
                        seen[ny * W + nx] = 1
                        qq.append((nx, ny))
            xs = [m[0] for m in members]
            ys = [m[1] for m in members]
            out.append({'pixels': len(members),
                        'minx': min(xs) + x0, 'maxx': max(xs) + x0,
                        'miny': min(ys) + y0, 'maxy': max(ys) + y0,
                        'members': [(mx + x0, my + y0) for (mx, my) in members]})
    return out


def vote_owner(comps, bands, celldivs):
    """(band idx, cell idx) per comp by pixel majority: rows first, then
    columns within the winning band. Zero band votes -> (None, None).
    Deterministic (scan order + lowest-index ties)."""
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


def pad_clamp(r, pad, x0, y0, x1, y1):
    return {
        'x': max(x0, r['x'] - pad),
        'y': max(y0, r['y'] - pad),
        'w': min(x1, r['x'] + r['w'] - 1 + pad) - max(x0, r['x'] - pad) + 1,
        'h': min(y1, r['y'] + r['h'] - 1 + pad) - max(y0, r['y'] - pad) + 1,
    }


def gate_rect(r, tag, errors):
    if not (W_MIN <= r['w'] <= W_MAX):
        errors.append(f'{tag}: width {r["w"]} outside [{W_MIN},{W_MAX}]')
    if not (H_MIN <= r['h'] <= H_MAX):
        errors.append(f'{tag}: height {r["h"]} outside [{H_MIN},{H_MAX}]')


def find_gaps(cc):
    """All runs of near-empty (<=2 ink pixels) columns, panel-local indices."""
    gaps = []
    k = 0
    while k < len(cc):
        if cc[k] <= 2:
            a = k
            while k < len(cc) and cc[k] <= 2:
                k += 1
            gaps.append((a, k - 1))
        else:
            k += 1
    return gaps


def nearest_gaps(cc, x0, n, tag, warnings):
    """n-1 divider columns at the widest near-empty gaps of a column
    projection. Falls back to even splits (warned) when rows nearly touch."""
    gaps = find_gaps(cc)
    # edge-touching gaps are panel margins, never pose dividers
    gaps = [(a, b) for (a, b) in gaps if b - a + 1 >= 3 and a > 3 and b < len(cc) - 4]
    gaps.sort(key=lambda g: (-(g[1] - g[0]), g[0]))
    if len(gaps) >= n - 1:
        divs = sorted((a + b) // 2 for (a, b) in gaps[:n - 1])
        return [x0 + d for d in divs]
    warnings.append(f'{tag}: only {len(gaps)} gaps, even split')
    return [round(x0 + k * (len(cc)) / n) for k in range(1, n)]


def repair_dividers(cc, x0, divs, tag, warnings):
    """Split fused non-last cells at their widest interior near-empty gap.

    Top-N-widest gap selection can fuse two touching poses (their shallow dip
    loses to a wider effect gap) while stranding a detached attack effect in
    its own cell. Each repair splits the fused cell and drops the last
    divider, so the detached effect rejoins its attack pose and the cell
    count stays at 5. At most two repairs; leftovers warn for the gates."""
    divs = sorted(divs)
    for _ in range(2):
        bounds = [0] + [d - x0 + 1 for d in divs] + [len(cc)]
        widths = [bounds[i + 1] - bounds[i] for i in range(5)]
        med = sorted(widths[:4])[1] + sorted(widths[:4])[2]
        med = med / 2.0
        fused = [i for i in range(4) if widths[i] >= 1.5 * med]
        if not fused:
            return divs
        target = None
        for i in fused:
            inside = [(a, b) for (a, b) in find_gaps(cc)
                      if b - a + 1 >= 3 and a >= bounds[i] + 3 and b <= bounds[i + 1] - 4]
            if inside:
                g = max(inside, key=lambda g: (g[1] - g[0], -g[0]))
                if target is None or (g[1] - g[0]) > (target[2][1] - target[2][0]):
                    target = (i, g, True)
        if target is None:
            # touching poses with no near-empty column: split at the deepest
            # smoothed dip, guarded so a genuinely wide single body is never
            # cut (dip must be shallow absolutely and relatively; both halves
            # must each carry nearly half the median width).
            for i in fused:
                # wide margins: neighbor-gap tails plus the smoothing radius
                # must not leak into the window, or the argmin lands on the
                # cell edge and the halves guard rightly refuses it.
                lo, hi = bounds[i] + 14, bounds[i + 1] - 14
                if hi - lo < 6:
                    continue
                best, bestv = lo, None
                for k in range(lo, hi + 1):
                    v = sum(cc[k + t] for t in (-2, -1, 0, 1, 2)) / 5.0
                    if bestv is None or v < bestv:
                        best, bestv = k, v
                peak = max(cc[lo:hi + 1])
                wleft, wright = best - bounds[i], bounds[i + 1] - best
                if bestv <= 12 and bestv <= 0.35 * peak \
                        and wleft >= 0.45 * med and wright >= 0.45 * med:
                    target = (i, (best, best), False)
                    break
        if target is None:
            warnings.append(f'{tag}: fused cell stands (no splittable dip; gates decide)')
            return divs
        _i, (a, b), clean = target
        newdiv = x0 + (a + b) // 2
        dropped = divs.pop()
        divs.append(newdiv)
        divs = sorted(divs)
        how = 'gap' if clean else 'dip'
        warnings.append(f'{tag}: fused cell re-split at {newdiv} ({how}; attack divider {dropped} dropped)')
    return divs


def slice_panel(img, bg, name, px0, px1, py0, py1, warnings, errors, fixed_divs=None):
    """One character panel (5 pose cols x down/up rows) -> {down/up: {pose}}.
    Returns (entry, debug rects, home map of sheet-coord pixel ownership).
    fixed_divs (absolute columns) skips projection splitting for approved
    fixed-layout panels; the ownership vote still assigns every component."""
    rc = row_counts(img, px0, px1, py0, py1, bg, BG_TOL)
    bands = runs(rc, 8, 3, 40, py0)
    bands = [b for b in bands if 40 <= b[1] - b[0] + 1 <= 200]
    if len(bands) != 2:
        errors.append(f'{name}: found {len(bands)} pose rows (want 2)')
        return None, [], {}
    rows = bands  # [down, up]
    both = col_counts(img, px0, px1, rows[0][0], rows[1][1], bg, BG_TOL)
    if fixed_divs is not None:
        divs = sorted(fixed_divs)
    else:
        divs = nearest_gaps(both, px0, 5, name, warnings)
        divs = repair_dividers(both, px0, divs, name, warnings)
    cells = list(zip([px0] + [d + 1 for d in divs], divs + [px1]))
    sec = components(img, px0, rows[0][0], px1, rows[1][1])
    owners = vote_owner(sec, [tuple(rows[0]), tuple(rows[1])],
                        [[c[1] for c in cells[:-1]]] * 2)
    pools = {}
    for k, c in enumerate(sec):
        pools.setdefault(owners[k], []).append(c)
    entry, debug, boxes = {'down': {}, 'up': {}}, [], {}
    for bi, (band, side) in enumerate(zip(rows, SIDES)):
        for i, ((a, b), pose) in enumerate(zip(cells, POSES)):
            tag = f'{name}.{side}.{pose}'
            pool = [c for c in pools.get((bi, i), []) if c['pixels'] >= SPECK_MIN]
            if not pool:
                errors.append(f'{tag}: no sprite content in cell x={a}..{b}')
                boxes[(side, pose)] = {'x': a, 'y': band[0], 'w': 4, 'h': 4}
                continue
            # union of owned parts: figure plus compact attached hit/attack
            # effects and in-cell ground shadow stay whole; neighbor-owned
            # parts are erased at cleaning time, not boxed.
            r = {'x': min(c['minx'] for c in pool), 'y': min(c['miny'] for c in pool),
                 'w': max(c['maxx'] for c in pool) - min(c['minx'] for c in pool) + 1,
                 'h': max(c['maxy'] for c in pool) - min(c['miny'] for c in pool) + 1}
            boxes[(side, pose)] = pad_clamp(r, PAD, px0, band[0], px1, band[1])
    for (side, pose), r in boxes.items():
        entry[side][pose] = r
        debug.append(r)
    home = {}
    for k, c in enumerate(sec):
        bi, ci = owners[k]
        tag = f'{name}.{SIDES[bi]}.{POSES[ci]}' if bi is not None else None
        for (mx, my) in c['members']:
            home[(mx, my)] = tag
    return entry, debug, home


def clean_frame(img, r, bg, ftag, home):
    """Key out this rect's gray matte in place. Returns stats dict. Step 0
    erases foreign-owned pixels (neighbor art); steps 1-4 remove matte:
    border flood, enclosed pockets, single-pass halo fringe, edge strip.
    Faces/eyes stay intact: they are enclosed, so the border flood cannot
    reach them, and no global color key is ever applied."""
    W, H, X, Y = r['w'], r['h'], r['x'], r['y']
    IW, data = img.w, img.px

    def alive(x, y):
        return data[((Y + y) * IW + X + x) * 4 + 3] > 128

    def rgb(x, y):
        i = ((Y + y) * IW + X + x) * 4
        return (data[i], data[i + 1], data[i + 2])

    def bg_match(x, y, tol):
        R, G, B = rgb(x, y)
        return abs(R - bg[0]) <= tol and abs(G - bg[1]) <= tol and abs(B - bg[2]) <= tol

    def kill(x, y):
        data[((Y + y) * IW + X + x) * 4 + 3] = 0

    # 0. foreign-pixel erasure (ownership vote, not color). Untracked pixels
    # default to ours (kept). Minority-only: a majority-foreign frame keeps
    # everything (divider sits inside touching art) instead of gutting.
    foreign = foreign_kept = 0
    cand, own = [], 0
    for y in range(H):
        for x in range(W):
            if not alive(x, y):
                continue
            if home.get((X + x, Y + y), ftag) == ftag:
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

    # 1. border flood through matte gray
    flood = bytearray(W * H)
    q = deque()

    def seed(x, y):
        if 0 <= x < W and 0 <= y < H and not flood[y * W + x] and alive(x, y) and bg_match(x, y, BG_TOL):
            flood[y * W + x] = 1
            q.append((x, y))

    for x in range(W):
        seed(x, 0)
        seed(x, H - 1)
    for y in range(H):
        seed(0, y)
        seed(W - 1, y)
    while q:
        x, y = q.popleft()
        kill(x, y)
        removed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < W and 0 <= ny < H and not flood[ny * W + nx] and alive(nx, ny) and bg_match(nx, ny, BG_TOL):
                flood[ny * W + nx] = 1
                q.append((nx, ny))

    # 2. enclosed matte pockets (dust the flood cannot reach from the border)
    seen = bytearray(W * H)
    for yy in range(H):
        for xx in range(W):
            if seen[yy * W + xx] or not alive(xx, yy) or flood[yy * W + xx]:
                continue
            qq = [xx]
            seen[yy * W + xx] = 1
            pocket, touches_edge, all_bg = [], False, True
            qi = 0
            while qi < len(qq):
                cx = qq[qi]
                qi += 1
                px, py = cx % W, cx // W
                pocket.append((px, py))
                if px == 0 or py == 0 or px == W - 1 or py == H - 1:
                    touches_edge = True
                if not bg_match(px, py, BG_TOL):
                    all_bg = False
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and alive(nx, ny) \
                            and not flood[ny * W + nx]:
                        seen[ny * W + nx] = 1
                        qq.append(ny * W + nx)
            if not touches_edge and all_bg and len(pocket) <= POCKET_MAX:
                for (px, py) in pocket:
                    kill(px, py)
                    removed += 1

    # 3. halo fringe, single pass: bg-colored rim pixels touching transparency
    # go only when their surviving neighbors still cover the silhouette.
    snap = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            snap[y * W + x] = 1 if alive(x, y) else 0
    for y in range(H):
        for x in range(W):
            if not snap[y * W + x] or not bg_match(x, y, FRINGE_TOL):
                continue
            if (x > 0 and not snap[y * W + x - 1]) or (x < W - 1 and not snap[y * W + x + 1]) \
                    or (y > 0 and not snap[(y - 1) * W + x]) or (y < H - 1 and not snap[(y + 1) * W + x]):
                kill(x, y)
                removed += 1

    # 4. edge strip: matte slivers clinging to the rect border
    for y in range(H):
        for x in range(W):
            if (x < 2 or y < 2 or x >= W - 2 or y >= H - 2) and alive(x, y) and bg_match(x, y, BG_TOL):
                kill(x, y)
                removed += 1

    after = before - removed
    # residual matte census: surviving pixels still within tolerance of the
    # source gray (legit white wings, swooshes and hearts are brighter and
    # excluded; shadows are darker and excluded)
    bn = edge_max = 0
    for y in range(H):
        for x in range(W):
            if not alive(x, y):
                continue
            R, G, B = rgb(x, y)
            if abs(R - bg[0]) <= BG_TOL and abs(G - bg[1]) <= BG_TOL and abs(B - bg[2]) <= BG_TOL:
                bn += 1
                if x < 3 or y < 3 or x >= W - 3 or y >= H - 3:
                    edge_max += 1
    return {'removed': removed, 'foreign': foreign, 'foreign_kept': foreign_kept,
            'opaque_before': before, 'opaque_after': after,
            'bn_after': bn, 'w': W, 'h': H,
            'bn_max': bn, 'bn_edge_max': edge_max}


def validate(entries, errors):
    """Structural + geometric gates over the 60 rects."""
    if list(entries) != IDS:
        errors.append(f'IDs {list(entries)} (want {IDS})')
        return
    for name in IDS:
        e = entries[name]
        if sorted(e) != SIDES:
            errors.append(f'{name}: sides {sorted(e)} (want {SIDES})')
            continue
        for side in SIDES:
            poses = e[side]
            if sorted(poses) != sorted(POSES):
                errors.append(f'{name}.{side}: poses {sorted(poses)} (want {POSES})')
                continue
            seen = []
            for pose in POSES:
                r = poses[pose]
                gate_rect(r, f'{name}.{side}.{pose}', errors)
                for (ppose, pr) in seen:
                    if r['x'] < pr['x'] + pr['w'] - MAX_OVERLAP:
                        errors.append(f'{name}.{side}.{pose}: overlaps {ppose} by '
                                      f'{pr["x"] + pr["w"] - r["x"]}px (multi-pose crop?)')
                seen.append((pose, r))
            hs = [poses[p]['h'] for p in POSES]
            if max(hs) / min(hs) > H_RATIO_MAX:
                errors.append(f'{name}.{side}: heights {hs} vary (jitter/shrink risk)')
            # width consistency: a fused double-body or a mid-body cut must
            # fail loudly here, never ship. The last (attack) cell is allowed
            # wider (detached effect rejoins its pose) and narrower (burst-only
            # attack whose body overlaps its sibling pose's footprint).
            ws = [poses[p]['w'] for p in POSES]
            med = sorted(ws)[2]
            for pose, w in zip(POSES, ws):
                lo, hi = (0.2 * med, 2.5 * med) if pose == 'attack' else (0.5 * med, 1.45 * med)
                if not (lo <= w <= hi):
                    errors.append(f'{name}.{side}.{pose}: width {w} vs median {med} '
                                  f'(want [{lo:.0f},{hi:.0f}] — fused crop or sliver?)')


def validate_clean(stats, errors):
    for ftag, st in stats.items():
        if st.get('restored'):
            continue
        if st['bn_edge_max'] > EDGE_MAX:
            errors.append(f'{ftag}: edge-touching gray mass {st["bn_edge_max"]}px (matte sheet)')
        frac = st['bn_after'] / max(1, st['opaque_after'])
        if frac > BN_MAX:
            errors.append(f'{ftag}: residual gray fraction {frac:.3f} > {BN_MAX}')


def decontaminate(img, bg, rects, errors, stats):
    """Clean every (tag, rect, home) in place. Catastrophe backstop: a frame
    losing more than REMOVED_CAP of its opaque pixels to matte cleaning is
    restored + reported (foreign-pixel erasure is intentional and uncapped)."""
    for (ftag, r, home) in rects:
        if r['w'] <= 0 or r['h'] <= 0 or r['x'] < 0 or r['y'] < 0 \
                or r['x'] + r['w'] > img.w or r['y'] + r['h'] > img.h:
            errors.append(f'{ftag}: invalid crop rect (skipped, nothing written)')
            stats[ftag] = {'removed': 0, 'foreign': 0, 'foreign_kept': 0,
                           'opaque_before': 0, 'opaque_after': 0, 'bn_after': -1,
                           'w': r.get('w'), 'h': r.get('h'),
                           'bn_max': -1, 'bn_edge_max': -1, 'invalid': True}
            continue
        backup = bytes(img.px[r['y'] * img.w * 4 + r['x'] * 4:
                              (r['y'] + r['h'] - 1) * img.w * 4 + (r['x'] + r['w']) * 4])
        st = clean_frame(img, r, bg, ftag, home)
        if st['opaque_before'] > 0 and st['removed'] / st['opaque_before'] > REMOVED_CAP:
            for yy in range(r['h']):
                a = yy * r['w'] * 4
                img.px[(r['y'] + yy) * img.w * 4 + r['x'] * 4:
                       (r['y'] + yy) * img.w * 4 + (r['x'] + r['w']) * 4] = backup[a:a + r['w'] * 4]
            errors.append(f"{ftag}: flood ate {st['removed']}/{st['opaque_before']} px, restored")
            st = {'removed': 0, 'foreign': 0, 'foreign_kept': st.get('foreign_kept', 0),
                  'opaque_before': st['opaque_before'], 'opaque_after': st['opaque_before'],
                  'bn_after': -1, 'w': r['w'], 'h': r['h'],
                  'bn_max': -1, 'bn_edge_max': -1, 'restored': True}
        stats[ftag] = st


DIGITS = {
    '0': ['###', '#.#', '#.#', '#.#', '###'],
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['##.', '..#', '.#.', '#..', '###'],
    '3': ['##.', '..#', '.#.', '..#', '##.'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '5': ['###', '#..', '##.', '..#', '##.'],
    '6': ['###', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '.#.', '.#.', '.#.'],
    '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'],
}


def draw_contact(img, rects, path, cols=6):
    """Labeled contact sheet: every crop centered on a dark-brown / checker
    split background (matte and halos read instantly on both halves)."""
    brown = (43, 26, 18)
    cell = 170
    rows = (len(rects) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + 14)
    out = bytearray(W * H * 4)
    for y in range(H):
        for x in range(W):
            j = (y * W + x) * 4
            if (x % cell) < cell // 2:
                out[j:j + 4] = bytes((brown[0], brown[1], brown[2], 255))
            else:
                c = 200 if ((x // 12) + (y // 12)) % 2 == 0 else 130
                out[j:j + 4] = bytes((c, c, c, 255))

    def put(x, y, rgb):
        if 0 <= x < W and 0 <= y < H:
            j = (y * W + x) * 4
            out[j:j + 4] = bytes((rgb[0], rgb[1], rgb[2], 255))

    def border(x0, y0, w, h):
        for x in range(x0, x0 + w):
            put(x, y0, (255, 0, 0))
            put(x, y0 + h - 1, (255, 0, 0))
        for y in range(y0, y0 + h):
            put(x0, y, (255, 0, 0))
            put(x0 + w - 1, y, (255, 0, 0))

    def digit(ch, x0, y0):
        for dy, line in enumerate(DIGITS[ch]):
            for dx, cc in enumerate(line):
                if cc == '#':
                    put(x0 + dx, y0 + dy, (255, 255, 255))

    for idx, (tag, r) in enumerate(rects):
        gx, gy = (idx % cols) * cell, (idx // cols) * (cell + 14)
        sc = min(1.0, (cell - 16) / max(r['w'], r['h']))
        dw, dh = max(1, int(r['w'] * sc)), max(1, int(r['h'] * sc))
        ox, oy = gx + (cell - dw) // 2, gy + 8 + (cell - 8 - dh) // 2
        for y in range(dh):
            for x in range(dw):
                sx = min(r['w'] - 1, int(x / sc))
                sy = min(r['h'] - 1, int(y / sc))
                si = ((r['y'] + sy) * img.w + r['x'] + sx) * 4
                if img.px[si + 3] > 128:
                    put(ox + x, oy + y, (img.px[si], img.px[si + 1], img.px[si + 2]))
        border(ox - 1, oy - 1, dw + 2, dh + 2)
        for di, ch in enumerate(str(idx)):
            digit(ch, gx + 4 + di * 4, gy + cell + 2)
    encode_rgba(path, W, H, out)


# ---------------- outline fringe + ground shadow (2026-11-21) ----------------
# After keying, every V3 sprite still showed (a) a 1-2 px light gray/white rim
# OUTSIDE its dark outline (the source's antialiasing against the light matte)
# and (b) a soft gray ellipse under the feet. Both read as "white borders" on
# the dark playfield.
# (a) Fringe: an opaque pixel is removed when it touches transparency, is
#     light and nearly neutral, and has dark outline ink within 2 px. The dark
#     outline separates the rim from the body, so light bodies (Lunatic's white
#     fur) are never reached. Two passes cover a 2 px rim.
# (b) Shadow: flood from transparency through neutral, matte-toned pixels, only
#     inside the foot strip (same method as tools/slice-thanatos.py).
FRINGE_LUM_MIN = 150
FRINGE_CHROMA_MAX = 30
INK_LUM_MAX = 90
SHADOW_STRIP = 40
SHADOW_CHROMA = 12
SPECK_MAX = 40          # detached foot-strip specks up to this size are shadow rim
SPECK_CHROMA = 25
SHADOW_LUM = (-105, -40) # relative to the keyed matte (209): shadows measure 110-150, i.e. -99..-59


def clean_edges(img, r, bg):
    W, H, X, Y, IW, d = r['w'], r['h'], r['x'], r['y'], img.w, img.px

    def idx(x, y):
        return ((Y + y) * IW + X + x) * 4

    def opaque(x, y):
        return 0 <= x < W and 0 <= y < H and d[idx(x, y) + 3] > 128

    def lum_chroma(x, y):
        i = idx(x, y)
        R, G, B = d[i], d[i + 1], d[i + 2]
        return (R + G + B) / 3, max(R, G, B) - min(R, G, B)

    removed_fringe = 0
    for _ in range(2):
        kill = []
        for y in range(H):
            for x in range(W):
                if not opaque(x, y):
                    continue
                if all(opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    continue  # interior pixel
                L, C = lum_chroma(x, y)
                if L < FRINGE_LUM_MIN or C > FRINGE_CHROMA_MAX:
                    continue
                ink = False
                for dy in range(-2, 3):
                    for dx in range(-2, 3):
                        if (dx or dy) and opaque(x + dx, y + dy) and lum_chroma(x + dx, y + dy)[0] < INK_LUM_MAX:
                            ink = True
                            break
                    if ink:
                        break
                if ink:
                    kill.append((x, y))
        for (x, y) in kill:
            d[idx(x, y) + 3] = 0
        removed_fringe += len(kill)
        if not kill:
            break

    bgl = sum(bg) / 3
    y_top = max(0, H - SHADOW_STRIP)

    def shadowy(x, y):
        if not opaque(x, y):
            return False
        L, C = lum_chroma(x, y)
        return C <= SHADOW_CHROMA and SHADOW_LUM[0] <= L - bgl <= SHADOW_LUM[1]

    seen = bytearray(W * H)
    q = deque()
    for y in range(y_top, H):
        for x in range(W):
            if seen[y * W + x] or not shadowy(x, y):
                continue
            edge = x in (0, W - 1) or y == H - 1 or any(
                not opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                seen[y * W + x] = 1
                q.append((x, y))
    removed_shadow = 0
    while q:
        x, y = q.popleft()
        d[idx(x, y) + 3] = 0
        removed_shadow += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if y_top <= ny < H and 0 <= nx < W and not seen[ny * W + nx] and shadowy(nx, ny):
                seen[ny * W + nx] = 1
                q.append((nx, ny))
    # the shadow ellipse's darker rim survives as a dotted line: drop small,
    # detached, neutral specks that lie entirely in the foot strip (colored
    # crumbs like Pupa's pebbles have chroma and are kept)
    comp = [0] * (W * H)
    label = 0
    for y in range(y_top, H):
        for x in range(W):
            if comp[y * W + x] or not opaque(x, y):
                continue
            label += 1
            members, inside, neutral = [], True, True
            qq = deque([(x, y)])
            comp[y * W + x] = label
            while qq:
                cx, cy = qq.popleft()
                members.append((cx, cy))
                if cy < y_top:
                    inside = False
                if lum_chroma(cx, cy)[1] > SPECK_CHROMA:
                    neutral = False
                if len(members) > SPECK_MAX:
                    inside = False
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if opaque(nx, ny) and not comp[ny * W + nx]:
                        comp[ny * W + nx] = label
                        qq.append((nx, ny))
            if inside and neutral:
                for (mx, my) in members:
                    d[idx(mx, my) + 3] = 0
                removed_shadow += len(members)
    return removed_fringe, removed_shadow


def main():
    if not os.path.exists(SRC):
        print(f'missing source: {SRC}')
        return 1
    img = Img.from_source(SRC)
    bg = img.rgb(2, 2)
    for (cx, cy) in ((img.w - 3, 2), (2, img.h - 3), (img.w - 3, img.h - 3)):
        c = img.rgb(cx, cy)
        if abs(c[0] - bg[0]) > 12 or abs(c[1] - bg[1]) > 12 or abs(c[2] - bg[2]) > 12:
            print(f'source corners disagree ({bg} vs {c}); refusing to key')
            return 1
    print(f'source {img.w}x{img.h} bg={bg}')
    keyed = key_background(img, bg)
    print(f'global key: matte-removed {keyed}')
    warnings, errors = [], []
    # three character rows by content runs, then left/right panels at the
    # fixed source-layout column half (COL_HALF; row 1 pose cells fixed too)
    rc = row_counts(img, 0, img.w - 1, 0, img.h - 1, bg, BG_TOL)
    # merge across the down/up pose gap inside each character row (inter-row
    # gutters are far wider and stay split)
    rows = [b for b in runs(rc, 8, 80, 60, 0) if b[1] - b[0] + 1 >= 150]
    if len(rows) != 3:
        print(f'found {len(rows)} character rows (want 3): {rows}')
        return 1
    entries, debug, homes = {}, [], {}
    for ri, (py0, py1) in enumerate(rows):
        # fixed source-layout column half (row bands still detected): a panel
        # can never cross the species boundary. Row 1 additionally uses fixed
        # measured pose dividers (ROW1_DIVS).
        lend, rstart = COL_HALF - 1, COL_HALF
        print(f'row {ri} ({IDS[ri * 2]}|{IDS[ri * 2 + 1]}): panels 0..{lend} + {rstart}..{img.w - 1} (fixed)')
        for ci, (px0, px1, name) in enumerate(
                [(0, lend, IDS[ri * 2]), (rstart, img.w - 1, IDS[ri * 2 + 1])]):
            fixed = ROW1_DIVS.get(name) if ri == 1 else None
            entry, dbg, home = slice_panel(img, bg, name, px0, px1, py0, py1,
                                           warnings, errors, fixed)
            if entry is None:
                continue
            entries[name] = entry
            debug.extend(dbg)
            homes.update(home)
    validate(entries, errors)
    rects = [(f'{n}.{s}.{p}', entries[n][s][p], homes)
             for n in IDS for s in SIDES for p in POSES if n in entries]
    stats = {}
    decontaminate(img, bg, rects, errors, stats)
    fr_tot = sh_tot = 0
    for (t, r, _h) in rects:
        fr, sh = clean_edges(img, r, bg)
        fr_tot += fr
        sh_tot += sh
    print(f'edges: outline fringe removed {fr_tot} px, ground shadow removed {sh_tot} px')
    validate_clean(stats, errors)
    if errors:
        print('ERRORS (gates rejected these crops — nothing was written):')
        for em in errors:
            print(f'  !! {em}')
        return 1
    tot_rem = sum(v['removed'] for v in stats.values())
    tot_for = sum(v['foreign'] for v in stats.values())
    tot_op = sum(v['opaque_before'] for v in stats.values())
    worst = max(stats.items(), key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
    edge = max(stats.items(), key=lambda kv: kv[1]['bn_edge_max'])
    print(f'decon: matte-removed {tot_rem} foreign-erased {tot_for}/{tot_op} '
          f'worst-gray {worst[0]}={worst[1]["bn_after"] / max(1, worst[1]["opaque_after"]):.3f} '
          f'worst-edge {edge[0]}={edge[1]["bn_edge_max"]}px')
    for wmsg in warnings:
        print(f'  ! {wmsg}')
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(QA_DIR, exist_ok=True)
    encode_rgba(OUT_PNG, img.w, img.h, img.px)
    manifest = {'sheet': 'monsters-v3.png', 'size': {'w': img.w, 'h': img.h}, 'monsters': entries}
    with open(OUT_JSON, 'w') as f:
        json.dump(manifest, f, indent=1)
        f.write('\n')
    draw_contact(img, [(t, r) for (t, r, _h) in rects],
                 os.path.join(QA_DIR, 'contact-prontera-v3.png'), cols=6)
    rep = {'source': SRC, 'bg': list(bg), 'warnings': warnings,
           'rects': [{'tag': t, **{k: r[k] for k in ('x', 'y', 'w', 'h')},
                      **{k: stats[t][k] for k in ('removed', 'foreign', 'opaque_before', 'opaque_after')}}
                     for (t, r, _h) in rects]}
    with open(os.path.join(QA_DIR, 'report-v3.json'), 'w') as f:
        json.dump(rep, f, indent=1)
        f.write('\n')
    print(f'wrote {OUT_PNG}+json, qa contact sheet + report ({len(rects)} rects)')
    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
