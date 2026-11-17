#!/usr/bin/env python3
"""Slice the approved Bosses V3 sheets into runtime atlases.

Deterministic, no redraw. Sources are read-only (see
art-clean/bosses-v3-gpt/bosses-v3-gpt-image.prompt.md):
  art-clean/bosses-v3-gpt/orc-hero-v1.png      (1536x1024) Orc Hero      (level 1 boss)
  art-clean/bosses-v3-gpt/dark-lord-v1.png     (1536x1024) Dark Lord     (level 2 boss)
  art-clean/bosses-v3-gpt/baphomet-v1.png      (1536x1024) Baphomet      (level 3 boss)
  art-clean/bosses-v3-gpt/doppelganger-v1.png  (1536x1024) Doppelganger  (level 2 mid-boss)

Outputs go to a new tree only (public/assets is untouched, and the original
sheets stay as the fallback):
  public/assets-v2/bosses-v3/bosses8.png + bosses8.json
    the three bosses stacked vertically (1536x3072, a byte copy, no
    resampling). Keys orcHero / darkLord / baphomet are the ones atlas.bosses
    already uses, so loading this after bosses.json overrides the art.
  public/assets-v2/bosses-v3/monsters16.png + monsters16.json
    the Doppelganger. It is an inline elite enemy (atlas.monsters), so this is
    a monsters manifest with the key 'doppelganger', loaded after monsters5.json.
  art-clean/bosses-v3-gpt/qa/contact-*.png, debug-*.png, report-bosses-v3.json

Method: the same one-figure-per-sheet boss cropping as the Thanatos forms.
This script imports tools/slice-thanatos.py, which imports the core of
tools/slice-niflheim.py, and records both files' sha256 in the report.

Usage: python tools/slice-bosses-v3.py [--src DIR] [--out DIR] [--qa-on-error]
Requires only Python 3 stdlib. Exits nonzero and writes nothing when any gate
fails.
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

# Each output sheet: its figures as (atlas key, source file, y offset in the
# stacked sheet) and the manifest kind the atlas expects.
# Pose rows measured on v1 sit inside the Thanatos section split, so
# slice_boss_forms' BOSS_SECTIONS (0-479 / 480-1023) and its gates apply
# unchanged: bosses rows 17-451 / 518-963, Doppelganger 92-432 / 589-935.
OUTPUTS = [
    {'sheet': 'bosses8', 'kind': 'bosses', 'forms': [
        ('orcHero', 'orc-hero-v1.png', 0),
        ('darkLord', 'dark-lord-v1.png', 1024),
        ('baphomet', 'baphomet-v1.png', 2048),
    ]},
    {'sheet': 'monsters16', 'kind': 'monsters', 'forms': [
        ('doppelganger', 'doppelganger-v1.png', 0),
    ]},
]
# On-screen height (px). The renderer scales bosses by r * 2.9 and enemies by
# r * 2.7 of the frame height, which suited the old near-square frames. The V3
# figures are tall and narrow, so at that height they would look smaller than
# their hitbox. The hint lives in the manifest, so the original fallback art
# keeps its old scale. Widths at these heights: ~90-130 px vs hitbox 80-100 px.
DISPLAY_H = {'orcHero': 165, 'darkLord': 175, 'baphomet': 190, 'doppelganger': 150}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='art-clean/bosses-v3-gpt')
    ap.add_argument('--out', default='public/assets-v2/bosses-v3')
    ap.add_argument('--qa-on-error', action='store_true',
                    help='on gate failure, still draw REJECTED-contact-*.png for diagnosis')
    args = ap.parse_args()
    root = os.path.dirname(HERE)
    src = args.src if os.path.isabs(args.src) else os.path.join(root, args.src)
    out = args.out if os.path.isabs(args.out) else os.path.join(root, args.out)
    qa = os.path.join(root, 'art-clean', 'bosses-v3-gpt', 'qa')
    warnings, errors = [], []
    report = {
        'slicer_core': {
            'tools/slice-thanatos.py': sn.sha256(os.path.join(HERE, 'slice-thanatos.py')),
            'tools/slice-niflheim.py': sn.sha256(os.path.join(HERE, 'slice-niflheim.py')),
        },
        'inputs': {}, 'warnings': warnings, 'decontamination': {}, 'sprites': {},
    }

    # --- crop + clean every output (nothing written until all gates pass) ---
    jobs = []
    for o in OUTPUTS:
        imgs = [st.load_keyed(os.path.join(src, f), key, errors, report) for key, f, _ in o['forms']]
        if len({i.w for i in imgs}) != 1:
            print(f"ERROR: {o['sheet']} sources must share a width to stack")
            return 1
        sheet = sn.Img(imgs[0].w, sum(i.h for i in imgs), bytearray(b''.join(bytes(i.px) for i in imgs)))
        entries, debug = st.slice_boss_forms(sheet, warnings, errors, forms=o['forms'], sheet_key=o['sheet'])
        st.gate_bosses(entries, errors)
        rects = st.boss_rects(entries)
        stats = {'frames': {}}
        sn.decontaminate(sheet, rects, o['sheet'], errors, stats)
        st.validate_clean_thanatos(stats, errors)
        fr = stats['frames']
        worst = max(fr.items(), key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
        edge = max(fr.items(), key=lambda kv: kv[1]['bn_edge_max'])
        print(f"decon {o['sheet']}: matte-removed {sum(v['removed'] for v in fr.values())} "
              f"worst-bn {worst[0]}={worst[1]['bn_after'] / max(1, worst[1]['opaque_after']):.3f} "
              f"worst-edge {edge[0]}={edge[1]['bn_edge_max']}px")
        report['decontamination'][o['sheet']] = stats
        jobs.append((o, sheet, entries, debug, rects))

    if errors:
        print('ERRORS (gates rejected these crops; nothing was written):')
        for e in errors:
            print(f'  !! {e}')
        if args.qa_on_error:
            os.makedirs(qa, exist_ok=True)
            for o, sheet, _e, _d, rects in jobs:
                sn.draw_contact(sheet, rects, os.path.join(qa, f"REJECTED-contact-{o['sheet']}.png"), cols=5)
        return 1

    # --- write ---
    os.makedirs(out, exist_ok=True)
    os.makedirs(qa, exist_ok=True)
    for o, sheet, entries, debug, rects in jobs:
        name = o['sheet']
        sn.draw_contact(sheet, rects, os.path.join(qa, f'contact-{name}.png'), cols=5)
        sn.draw_debug(sheet, debug, os.path.join(qa, f'debug-{name}.png'))
        st.strip_keep(entries)
        report['sprites'].update({k: r for k, r in st.boss_rects(entries)})
        for key, e in entries.items():
            e['displayH'] = DISPLAY_H[key]
        sn.encode_rgba(os.path.join(out, f'{name}.png'), sheet.w, sheet.h, sheet.px)
        with open(os.path.join(out, f'{name}.json'), 'w') as f:
            json.dump({'sheet': f'{name}.png', 'size': {'w': sheet.w, 'h': sheet.h}, o['kind']: entries}, f, indent=2)
        print(f"wrote {out}/{name}.png + {name}.json ({', '.join(k for k, _, _ in o['forms'])})")
    report['outputs'] = {f: sn.sha256(os.path.join(out, f)) for f in sorted(os.listdir(out))}
    with open(os.path.join(qa, 'report-bosses-v3.json'), 'w') as f:
        json.dump(report, f, indent=2, default=list)
    if warnings:
        print('WARNINGS:')
        for w in warnings:
            print(f'  ! {w}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
