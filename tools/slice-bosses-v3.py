#!/usr/bin/env python3
"""Slice the approved Bosses V3 sheets (levels 1-3) into one runtime atlas.

Deterministic, no redraw. Sources are read-only (see
art-clean/bosses-v3-gpt/bosses-v3-gpt-image.prompt.md):
  art-clean/bosses-v3-gpt/orc-hero-v1.png    (1536x1024) Orc Hero
  art-clean/bosses-v3-gpt/dark-lord-v1.png   (1536x1024) Dark Lord
  art-clean/bosses-v3-gpt/baphomet-v1.png    (1536x1024) Baphomet

Outputs go to a new tree only (public/assets is untouched, and the original
sheets stay as the fallback):
  public/assets-v2/bosses-v3/bosses8.png + bosses8.json
    three sheets stacked vertically (1536x3072, a byte copy, no resampling).
    Keys orcHero / darkLord / baphomet are the same ones atlas.bosses already
    uses, so loading this manifest after bosses.json overrides the art and
    touches nothing else.
  art-clean/bosses-v3-gpt/qa/contact-bosses8.png, debug-bosses8.png,
  report-bosses-v3.json

Method: the same one-figure-per-sheet boss cropping as the Thanatos forms.
This script imports tools/slice-thanatos.py, which imports the core of
tools/slice-niflheim.py, and records both files' sha256 in the report.

Usage: python tools/slice-bosses-v3.py [--src DIR] [--out DIR] [--qa-on-error]
Requires only Python 3 stdlib. Exits nonzero and writes nothing when a gate fails.
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

SHEET = 'bosses8'
# (atlas key, source file, y offset in the stacked sheet)
FORMS = [
    ('orcHero', 'orc-hero-v1.png', 0),
    ('darkLord', 'dark-lord-v1.png', 1024),
    ('baphomet', 'baphomet-v1.png', 2048),
]
# On-screen height (px) for each redrawn boss. The renderer scales bosses by
# height (default r * 2.9), which suited the old near-square frames. The V3
# figures are tall and narrow, so at that height they would look smaller than
# their hitbox. The hint lives in the manifest, so the original fallback art
# keeps its old scale. Width at these heights: ~90-115 px vs hitbox 88-100 px.
DISPLAY_H = {'orcHero': 165, 'darkLord': 175, 'baphomet': 190}
# Pose rows measured on v1 (rows 17-451 / 518-963), inside the Thanatos
# section split, so slice_boss_forms' BOSS_SECTIONS (0-479 / 480-1023) and its
# gates apply unchanged.


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='art-clean/bosses-v3-gpt')
    ap.add_argument('--out', default='public/assets-v2/bosses-v3')
    ap.add_argument('--qa-on-error', action='store_true',
                    help='on gate failure, still draw REJECTED-contact-bosses8.png for diagnosis')
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
        'inputs': {}, 'warnings': warnings,
    }

    imgs = [st.load_keyed(os.path.join(src, f), key, errors, report) for key, f, _ in FORMS]
    if len({i.w for i in imgs}) != 1:
        print('ERROR: boss sheets must share a width to stack')
        return 1
    sheet = sn.Img(imgs[0].w, sum(i.h for i in imgs), bytearray(b''.join(bytes(i.px) for i in imgs)))
    entries, debug = st.slice_boss_forms(sheet, warnings, errors, forms=FORMS, sheet_key=SHEET)
    st.gate_bosses(entries, errors)

    rects = st.boss_rects(entries)
    stats = {'frames': {}}
    sn.decontaminate(sheet, rects, SHEET, errors, stats)
    st.validate_clean_thanatos(stats, errors)
    fr = stats['frames']
    worst = max(fr.items(), key=lambda kv: kv[1]['bn_after'] / max(1, kv[1]['opaque_after']))
    edge = max(fr.items(), key=lambda kv: kv[1]['bn_edge_max'])
    print(f"decon {SHEET}: matte-removed {sum(v['removed'] for v in fr.values())} "
          f"worst-bn {worst[0]}={worst[1]['bn_after'] / max(1, worst[1]['opaque_after']):.3f} "
          f"worst-edge {edge[0]}={edge[1]['bn_edge_max']}px")
    report['decontamination'] = stats

    if errors:
        print('ERRORS (gates rejected these crops; nothing was written):')
        for e in errors:
            print(f'  !! {e}')
        if args.qa_on_error:
            os.makedirs(qa, exist_ok=True)
            sn.draw_contact(sheet, rects, os.path.join(qa, f'REJECTED-contact-{SHEET}.png'), cols=5)
        return 1

    os.makedirs(out, exist_ok=True)
    os.makedirs(qa, exist_ok=True)
    sn.draw_contact(sheet, rects, os.path.join(qa, f'contact-{SHEET}.png'), cols=5)
    sn.draw_debug(sheet, debug, os.path.join(qa, f'debug-{SHEET}.png'))
    st.strip_keep(entries)
    for key, e in entries.items():
        e['displayH'] = DISPLAY_H[key]
    sn.encode_rgba(os.path.join(out, f'{SHEET}.png'), sheet.w, sheet.h, sheet.px)
    with open(os.path.join(out, f'{SHEET}.json'), 'w') as f:
        json.dump({'sheet': f'{SHEET}.png', 'size': {'w': sheet.w, 'h': sheet.h}, 'bosses': entries}, f, indent=2)
    report['sprites'] = {k: r for k, r in st.boss_rects({n: {s: e[s] for s in ('down', 'up')} for n, e in entries.items()})}
    report['outputs'] = {f: sn.sha256(os.path.join(out, f)) for f in sorted(os.listdir(out))}
    with open(os.path.join(qa, 'report-bosses-v3.json'), 'w') as f:
        json.dump(report, f, indent=2, default=list)
    if warnings:
        print('WARNINGS:')
        for w in warnings:
            print(f'  ! {w}')
    print(f'wrote {out}/{SHEET}.png + {SHEET}.json ({", ".join(k for k, _, _ in FORMS)})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
