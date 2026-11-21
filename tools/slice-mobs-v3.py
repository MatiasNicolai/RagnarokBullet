#!/usr/bin/env python3
"""Mobs V3: slice the approved GPT mob sheets of levels 2-5 into runtime atlases
(deterministic, technical extraction only, no redraw).

Sources (read-only, never modified; see art-clean/mobs-v3-gpt/mobs-v3-gpt-image.prompt.md):
  art-clean/mobs-v3-gpt/geffen-a-v1.png  (1536x1024) Willow, Zombie, Munak, Bongun
  art-clean/mobs-v3-gpt/geffen-b-v1.png  (1536x1024) Nine Tail, Deviruchi, Marionette, Wraith
  art-clean/mobs-v3-gpt/glastheim-a-v1.png (1536x1024) Evil Druid, Dark Priest, Raydric, Khalitzburg
  art-clean/mobs-v3-gpt/glastheim-b-v1.png (1536x1024) Gargoyle, Ghoul, Whisper, Baphomet Jr.
  art-clean/mobs-v3-gpt/juperos-a-v1.png  (1536x1024) Dimik, Venatu, Plasma, Guardian
  art-clean/mobs-v3-gpt/juperos-b-v1.png  (1536x1024) Cell, Sentry, Repair Drone, Spark Beetle
  art-clean/mobs-v3-gpt/biolab-a-v1.png   (1536x1024) Failed Experiment, Remover, Lab Drone, Test Subject
  art-clean/mobs-v3-gpt/biolab-b-v1.png   (1536x1024) Spore Cloud, Mutant Hound, Serum Turret, Bio-Sludge

Outputs (new tree only; the original sheets stay as the fallback):
  public/assets-v2/mobs-v3/monsters19.png + .json   Geffen A
  public/assets-v2/mobs-v3/monsters20.png + .json   Geffen B
  public/assets-v2/mobs-v3/monsters21.png + .json   Glast Heim A
  public/assets-v2/mobs-v3/monsters22.png + .json   Glast Heim B
  public/assets-v2/mobs-v3/monsters23.png + .json   Juperos A
  public/assets-v2/mobs-v3/monsters24.png + .json   Juperos B
  public/assets-v2/mobs-v3/monsters25.png + .json   Biolab A
  public/assets-v2/mobs-v3/monsters26.png + .json   Biolab B
  art-clean/mobs-v3-gpt/qa/contact-*.png, debug-*.png, report-mobs-v3.json

Every sheet has the Thanatos mob layout (2x2 panels, one species each, 5 poses x
front/back rows on flat gray), so this script IMPORTS tools/slice-thanatos.py
(which itself imports slice-niflheim.py) and reuses its panel slicer, ground-shadow
pass, decontamination and gates. The cores are never edited (the Niflheim, Thanatos
and Bosses V3 reports pin their sha256); the report here records both too.
On top of them, three Mobs V3 passes (each documented where it is defined):
  - remove_flat_shadow + drop_shadow_specks: ground ellipses darker than the
    Thanatos shadow pass reaches (Glast Heim);
  - refill_small_holes: gives back skin shading the core keyed as matte pockets
    because it sits in the background's gray band (Ghoul, Marionette, Wraith,
    Repair Drone).

The atlas keys are the original ones (willow, zombie, ...), merged after the
original sheets in src/engine/atlas.js, so V3 overrides them by default and a
missing V3 file falls back to the original art.

Usage: python tools/slice-mobs-v3.py [--only KEY ...] [--qa-on-error]
--only is for diagnosis: it rewrites the report with only those inputs, so always
finish with a full run before committing.
Requires only Python 3 stdlib. Nonzero exit and nothing written when a gate fails.
"""
import argparse
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('slice_thanatos', os.path.join(HERE, 'slice-thanatos.py'))
st = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(st)
sn = st.sn

SRC = os.path.join('art-clean', 'mobs-v3-gpt')
OUT = os.path.join('public', 'assets-v2', 'mobs-v3')
QA = os.path.join('art-clean', 'mobs-v3-gpt', 'qa')

# names[row][col]: top-left, top-right / bottom-left, bottom-right.
# split_x / panel_y: measured on the keyed v1 sheet (empty gutters between panels).
SHEETS = {
    'monsters19': {
        'file': 'geffen-a-v1.png',
        'names': [['willow', 'zombie'], ['munak', 'bongun']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters20': {
        'file': 'geffen-b-v1.png',
        'names': [['ninetails', 'deviruchi'], ['marionette', 'wraith']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters21': {
        'file': 'glastheim-a-v1.png',
        'names': [['evildruid', 'darkpriest'], ['raydric', 'khalitzburg']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters22': {
        'file': 'glastheim-b-v1.png',
        'names': [['gargoyle', 'ghoul'], ['whisper', 'bapho_jr']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters23': {
        'file': 'juperos-a-v1.png',
        'names': [['dimik', 'venatu'], ['plasma', 'guardian']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters24': {
        'file': 'juperos-b-v1.png',
        'names': [['cell', 'sentry'], ['repairdrone', 'sparkbeetle']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters25': {
        'file': 'biolab-a-v1.png',
        'names': [['failedexp', 'remover'], ['labdrone', 'testsubject']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
    'monsters26': {
        'file': 'biolab-b-v1.png',
        'names': [['sporecloud', 'mutanthound'], ['serumturret', 'biosludge']],
        'split_x': 768, 'panel_y': [(0, 490), (491, 1023)],
    },
}

# Gates: ranges around the measured v1 sizes with margin; anything outside means a
# divider cut a figure or merged two poses.
MOB_W, MOB_H = (25, 220), (40, 230)

# Frames whose "bright-neutral" pixels are legitimate art, not leftover gray matte:
# Wraith's cloak is a lavender-gray close to the sheet gray, and Marionette's
# silver hair and strings are near-neutral. Verified on a dark/checker contact
# sheet on 2026-11-21: clean silhouettes, no gray box. Each value is a ceiling a
# little above the measured one (frac = bright-neutral fraction, edge = edge-touching
# mass in px), so a real matte regression in these frames still fails.
ART_OK = {
    'marionette.down.moveR': {'frac': 0.19},   # measured 0.169
    'wraith.down.attack': {'edge': 130},       # measured 105
    'wraith.up.idle': {'frac': 0.21, 'edge': 210},    # measured 0.192 / 179
    'wraith.up.moveL': {'frac': 0.19},         # measured 0.171
    'wraith.up.moveR': {'frac': 0.21},         # measured 0.193
    'wraith.up.hit': {'frac': 0.20},           # measured 0.181
    'wraith.up.attack': {'frac': 0.20, 'edge': 240},  # measured 0.176 / 210
}


# Dark flat shadows. Some v1 sheets (Glast Heim most of all) bake the ground ellipse
# darker than the Thanatos pass reaches: measured at bg-56..-46 under Ghoul,
# Gargoyle, Raydric and Khalitzburg. Feet and boots reach the same tones, so this
# pass also requires the tone to be FLAT: every opaque 8-neighbor within
# FLAT_TOL levels. A painted foot has shading and ink and blocks the flood; the
# shadow ellipse is one uniform tone. Seeds touch transparency, the flood stays in
# the foot strip, as in slice-thanatos.py.
DARK_SHADOW_LUM = (-62, -40)
FLAT_TOL = 6
FLAT_CHROMA = 12


def remove_flat_shadow(img, r, bg):
    W, H, X, Y, IW, d = r['w'], r['h'], r['x'], r['y'], img.w, img.px
    bgl = sum(bg) / 3
    y_top = max(0, H - st.SHADOW_STRIP)

    def idx(x, y):
        return ((Y + y) * IW + X + x) * 4

    def lum(x, y):
        i = idx(x, y)
        return (d[i] + d[i + 1] + d[i + 2]) / 3

    def flat(x, y):
        i = idx(x, y)
        if d[i + 3] <= 128:
            return False
        R, G, B = d[i], d[i + 1], d[i + 2]
        if max(R, G, B) - min(R, G, B) > FLAT_CHROMA:
            return False
        l = (R + G + B) / 3
        if not DARK_SHADOW_LUM[0] <= l - bgl <= DARK_SHADOW_LUM[1]:
            return False
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if (dx or dy) and 0 <= nx < W and 0 <= ny < H and d[idx(nx, ny) + 3] > 128 \
                        and abs(lum(nx, ny) - l) > FLAT_TOL:
                    return False
        return True

    seen = bytearray(W * H)
    q = sn.deque()
    for y in range(y_top, H):
        for x in range(W):
            if not flat(x, y):
                continue
            edge = x == 0 or x == W - 1 or y == H - 1 or any(
                d[idx(nx, ny) + 3] <= 128 for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
            if edge:
                seen[y * W + x] = 1
                q.append((x, y))
    hits = []
    while q:
        x, y = q.popleft()
        hits.append((x, y))
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if y_top <= ny < H and 0 <= nx < W and not seen[ny * W + nx] and flat(nx, ny):
                seen[ny * W + nx] = 1
                q.append((nx, ny))
    for x, y in hits:  # clear after the flood so flatness is judged on the original tones
        d[idx(x, y) + 3] = 0
    return len(hits)


# Gray skin. The core cleaner (slice-niflheim.clean_frame, step 2) removes every
# enclosed group of >=3 pixels within BG_TOL (12) of the sheet gray, and step 3
# erodes outward from the new holes. That is right for matte trapped between limbs,
# but Ghoul's gray-green skin shading (and some of Marionette's hair, Wraith's
# cloak, Dark Priest's coat) sits in the same band and came out speckled with
# holes. Color can't tell them apart: GPT's trapped matte carries the same +-4
# noise, chroma and border darkness as that skin (measured 2026-11-21). Size can:
# real gaps between limbs measure 57-625 px, the skin specks are mostly 1-30 px.
# So the core runs unchanged (its sha256 is pinned by the Niflheim, Thanatos and
# Bosses V3 reports) and afterwards every fully enclosed hole of at most
# HOLE_FILL_MAX px that was opaque before the core ran gets its alpha back. The
# RGB was never touched (the core only clears alpha), so the art returns as drawn.
HOLE_FILL_MAX = 40
# Closed shapes with no real interior gap get a higher ceiling. Repair Drone is a
# solid dome whose gray metal highlights sit in the matte band: its idle frames have
# zero enclosed holes, yet the core punched 41-298 px holes into the dome in the
# other poses (measured 2026-11-21).
HOLE_FILL_MAX_BY_MOB = {'repairdrone': 400}


def refill_small_holes(img, r, alpha_before, limit=HOLE_FILL_MAX):
    W, H, X, Y, IW, d = r['w'], r['h'], r['x'], r['y'], img.w, img.px

    def ai(x, y):
        return ((Y + y) * IW + X + x) * 4 + 3

    def hole(x, y):
        return d[ai(x, y)] <= 128

    seen = bytearray(W * H)
    refilled = 0
    for sy in range(H):
        for sx in range(W):
            if seen[sy * W + sx] or not hole(sx, sy):
                continue
            comp, q, border = [], sn.deque([(sx, sy)]), False
            seen[sy * W + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                if x in (0, W - 1) or y in (0, H - 1):
                    border = True
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and hole(nx, ny):
                        seen[ny * W + nx] = 1
                        q.append((nx, ny))
            if border or len(comp) > limit:
                continue
            if all(alpha_before[ai(x, y) // 4] > 128 for x, y in comp):
                for x, y in comp:
                    d[ai(x, y)] = alpha_before[ai(x, y) // 4]
                refilled += len(comp)
    return refilled


SPECK_MAX = 300   # px; a body part is far larger and carries colored pixels


def drop_shadow_specks(img, r, bg):
    """After the shadow floods: remove detached opaque components that lie entirely
    in the foot strip and are made only of neutral, shadow-toned pixels (the soft
    rim of the ellipse). Anything with a colored pixel, any pixel above the strip
    or more than SPECK_MAX px is kept."""
    W, H, X, Y, IW, d = r['w'], r['h'], r['x'], r['y'], img.w, img.px
    bgl = sum(bg) / 3
    y_top = max(0, H - st.SHADOW_STRIP)

    def idx(x, y):
        return ((Y + y) * IW + X + x) * 4

    seen = bytearray(W * H)
    removed = 0
    for sy in range(H):
        for sx in range(W):
            if seen[sy * W + sx] or d[idx(sx, sy) + 3] <= 128:
                continue
            comp, ok, q = [], True, sn.deque([(sx, sy)])
            seen[sy * W + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                i = idx(x, y)
                R, G, B = d[i], d[i + 1], d[i + 2]
                if y < y_top or max(R, G, B) - min(R, G, B) > FLAT_CHROMA \
                        or not DARK_SHADOW_LUM[0] <= (R + G + B) / 3 - bgl <= -4:
                    ok = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and d[idx(nx, ny) + 3] > 128:
                        seen[ny * W + nx] = 1
                        q.append((nx, ny))
            if ok and len(comp) <= SPECK_MAX:
                for x, y in comp:
                    d[idx(x, y) + 3] = 0
                removed += len(comp)
    return removed


def validate_clean(stats, errors):
    found = []
    sn.validate_clean(stats, found)
    for msg in found:
        ftag = msg.split(':', 1)[0]
        ok, fr = ART_OK.get(ftag, {}), stats['frames'].get(ftag, {})
        if 'edge' in ok and 'edge-touching' in msg and fr.get('bn_edge_max', 1e9) <= ok['edge']:
            continue
        if 'frac' in ok and 'fraction' in msg and \
                fr.get('bn_after', 1e9) / max(1, fr.get('opaque_after', 1)) <= ok['frac']:
            continue
        errors.append(msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*', help='sheet keys to slice (default: all)')
    ap.add_argument('--qa-on-error', action='store_true',
                    help='on gate failure, still draw REJECTED-contact-*.png for diagnosis')
    args = ap.parse_args()
    root = os.path.dirname(HERE)
    src, out, qa = (os.path.join(root, p) for p in (SRC, OUT, QA))
    keys = args.only or list(SHEETS)
    unknown = [k for k in keys if k not in SHEETS]
    if unknown:
        print(f'unknown sheet keys: {unknown}')
        return 2

    warnings, errors = [], []
    report = {'slicer_core': {
        'tools/slice-thanatos.py': sn.sha256(os.path.join(HERE, 'slice-thanatos.py')),
        'tools/slice-niflheim.py': sn.sha256(os.path.join(HERE, 'slice-niflheim.py'))},
        'inputs': {}, 'warnings': warnings}

    # --- crop (nothing written until every gate passes) ---
    sheets = {}
    for key in keys:
        cfg = SHEETS[key]
        st.SPLIT_X, st.PANEL_Y = cfg['split_x'], cfg['panel_y']
        img = st.load_keyed(os.path.join(src, cfg['file']), key, errors, report)
        entries, debug = st.slice_panels(img, cfg['names'], key, warnings, errors)
        st.gate_mobs(entries, MOB_W, MOB_H, errors)
        sheets[key] = (img, entries, debug)

    # --- per-frame cleanup: ground shadows, then matte (rect geometry untouched) ---
    stats, shadow_px = {}, {}
    for key, (img, entries, _d) in sheets.items():
        rects = st.mob_rects(entries)
        bg = sn.sheet_bg_sample(img, errors, key)
        light = sum(st.remove_ground_shadow(img, r, bg) for _, r in rects)
        # a second sweep picks up rim pixels whose only non-flat neighbors were
        # shadow cleared by the first one (judged on the updated alpha)
        dark = sum(remove_flat_shadow(img, r, bg) + remove_flat_shadow(img, r, bg) for _, r in rects)
        specks = sum(drop_shadow_specks(img, r, bg) for _, r in rects)
        shadow_px[key] = {'light': light, 'dark_flat': dark, 'specks': specks}
        stats[key] = {'frames': {}}
        alpha_before = bytes(img.px[3::4])
        sn.decontaminate(img, rects, key, errors, stats[key])
        stats[key]['small_holes_refilled'] = sum(
            refill_small_holes(img, r, alpha_before, HOLE_FILL_MAX_BY_MOB.get(t.split('.')[0], HOLE_FILL_MAX))
            for t, r in rects)
        validate_clean(stats[key], errors)
        fr = stats[key]['frames']
        edge = max(fr.items(), key=lambda kv: kv[1]['bn_edge_max'])
        print(f"{key}: shadow-removed {shadow_px[key]} holes-refilled {stats[key]['small_holes_refilled']} matte-removed "
              f"{sum(v['removed'] for v in fr.values())} worst-edge {edge[0]}={edge[1]['bn_edge_max']}px")
    report['ground_shadow_removed'] = shadow_px
    report['decontamination'] = stats

    if errors:
        print('ERRORS (gates rejected these crops; nothing was written):')
        for e in errors:
            print(f'  !! {e}')
        if args.qa_on_error:
            os.makedirs(qa, exist_ok=True)
            for key, (img, entries, _d) in sheets.items():
                sn.draw_contact(img, st.mob_rects(entries), os.path.join(qa, f'REJECTED-contact-{key}.png'), cols=10)
            print(f'wrote rejected-crop contact sheets to {qa}')
        return 1

    # --- write ---
    os.makedirs(out, exist_ok=True)
    os.makedirs(qa, exist_ok=True)
    report['sprites'] = {}
    for key, (img, entries, debug) in sheets.items():
        sn.draw_contact(img, st.mob_rects(entries), os.path.join(qa, f'contact-mobs-v3-{key}.png'), cols=10)
        sn.draw_debug(img, debug, os.path.join(qa, f'debug-mobs-v3-{key}.png'))
        st.strip_keep(entries)
        report['sprites'].update(dict((f'{key}:{t}', r) for t, r in st.mob_rects(entries)))
        sn.encode_rgba(os.path.join(out, f'{key}.png'), img.w, img.h, img.px)
        with open(os.path.join(out, f'{key}.json'), 'w') as f:
            json.dump({'sheet': f'{key}.png', 'size': {'w': img.w, 'h': img.h}, 'monsters': entries}, f, indent=2)
        print(f'{key}: {sorted(entries)}')
    report['outputs'] = {f: sn.sha256(os.path.join(out, f))
                         for f in sorted(os.listdir(out)) if f.endswith(('.png', '.json'))}
    with open(os.path.join(qa, 'report-mobs-v3.json'), 'w') as f:
        json.dump(report, f, indent=2, default=list)
    if warnings:
        print('WARNINGS:')
        for w in warnings:
            print(f'  ! {w}')
    print(f'wrote {out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
