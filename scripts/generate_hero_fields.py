"""Generates web/public/hero-fields.svg: an ILLUSTRATIVE aerial patchwork of agricultural fields.

It is a procedurally generated illustration (seeded, reproducible), not a photograph and not a real place.
Run:  python scripts/generate_hero_fields.py
"""
import math
import random
from pathlib import Path

W, H = 1600, 1000
rng = random.Random(7)
OUT = Path(__file__).resolve().parents[1] / "web" / "public" / "hero-fields.svg"

CROPS = [  # (base fill, row colour, row spacing)
    ("#5E7F4A", "#4C6B3C", 6), ("#7A9A58", "#668549", 7), ("#4A6B45", "#3B5A39", 5),
    ("#9BAF6A", "#86A055", 8), ("#C9A85C", "#B8964B", 7), ("#D8C58E", "#C7B47B", 9),
    ("#A9644B", "#94533C", 8), ("#7B533F", "#68442F", 7), ("#2F4F3F", "#264234", 5),
    ("#8FA86B", "#7B945A", 6), ("#B98A52", "#A67A45", 8), ("#E1D6B0", "#D2C69E", 10),
]


def patterns() -> str:
    out = []
    for i, (base, row, gap) in enumerate(CROPS):
        for j, ang in enumerate((0, 20, 42, 68, 95, 118, 140, 160)):
            out.append(
                f'<pattern id="p{i}_{j}" width="{gap}" height="{gap}" patternUnits="userSpaceOnUse" patternTransform="rotate({ang})">'
                f'<rect width="{gap}" height="{gap}" fill="{base}"/><rect width="{gap}" height="{gap * 0.38:.1f}" fill="{row}"/></pattern>')
    return "".join(out)


def split(x, y, w, h, depth, rects):
    if depth == 0 or (w < 150 and h < 150) or (depth < 3 and rng.random() < 0.18):
        rects.append((x, y, w, h))
        return
    if w > h * rng.uniform(0.8, 1.3):
        a = rng.uniform(0.34, 0.66)
        split(x, y, w * a, h, depth - 1, rects)
        split(x + w * a, y, w * (1 - a), h, depth - 1, rects)
    else:
        a = rng.uniform(0.34, 0.66)
        split(x, y, w, h * a, depth - 1, rects)
        split(x, y + h * a, w, h * (1 - a), depth - 1, rects)


def jitter(pts, amt=5):
    return [(px + rng.uniform(-amt, amt), py + rng.uniform(-amt, amt)) for px, py in pts]


def main():
    rects = []
    split(-40, -40, W + 80, H + 80, 6, rects)
    # blocks share an orientation so neighbouring parcels read as farm units
    block_angle = {}
    shapes, edges = [], []
    for (x, y, w, h) in rects:
        key = (int(x // 400), int(y // 330))
        block_angle.setdefault(key, rng.choice(range(8)))
        j = block_angle[key] if rng.random() < 0.6 else rng.choice(range(8))
        c = rng.choice(range(len(CROPS)))
        pts = jitter([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
        d = "M" + " L".join(f"{px:.1f},{py:.1f}" for px, py in pts) + "Z"
        shapes.append(f'<path d="{d}" fill="url(#p{c}_{j})"/>')
        edges.append(f'<path d="{d}" fill="none" stroke="#EFE7CF" stroke-opacity="0.55" stroke-width="{rng.choice((1.4, 2.2, 3))}"/>')
        if rng.random() < 0.22:  # hedge row along one edge
            (ax, ay), (bx, by) = pts[0], pts[1]
            edges.append(f'<path d="M{ax:.1f},{ay:.1f} L{bx:.1f},{by:.1f}" stroke="#1F3B2D" stroke-opacity="0.7" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 7"/>')
    # centre-pivot circles
    pivots = []
    for _ in range(4):
        cx, cy, r = rng.uniform(150, W - 150), rng.uniform(120, H - 120), rng.uniform(70, 120)
        c = rng.choice((0, 1, 3, 9))
        pivots.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="url(#p{c}_{rng.choice(range(8))})" stroke="#EFE7CF" stroke-opacity="0.6" stroke-width="2.5"/>'
                      f'<path d="M{cx:.0f},{cy:.0f} L{cx + r * math.cos(0.9):.0f},{cy - r * math.sin(0.9):.0f}" stroke="#F1EBD9" stroke-opacity="0.8" stroke-width="2"/>')
    # river
    pts = [(1180, -20), (1090, 140), (1180, 300), (1010, 450), (1060, 620), (880, 760), (930, 900), (820, 1040)]
    river = "M" + " L".join(f"{a},{b}" for a, b in pts)
    water = (f'<path d="{river}" fill="none" stroke="#3E6B3F" stroke-opacity="0.65" stroke-width="40" stroke-linejoin="round" stroke-linecap="round"/>'
             f'<path d="{river}" fill="none" stroke="#7E9C98" stroke-width="17" stroke-linejoin="round" stroke-linecap="round"/>'
             f'<path d="{river}" fill="none" stroke="#A9C0BA" stroke-opacity="0.6" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>')
    # a dirt road
    road = ('<path d="M-20,640 C300,600 520,700 820,610 S1300,560 1640,640" fill="none" stroke="#E9DFC3" stroke-width="9"/>'
            '<path d="M-20,640 C300,600 520,700 820,610 S1300,560 1640,640" fill="none" stroke="#CDBE98" stroke-width="2" stroke-dasharray="14 10"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" role="img" '
           f'aria-label="Illustration of agricultural fields seen from above">'
           f'<defs>{patterns()}<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>'
           f'<feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0.10 0"/></filter></defs>'
           f'<rect width="{W}" height="{H}" fill="#6E8B52"/>{"".join(shapes)}{"".join(pivots)}{"".join(edges)}{road}{water}'
           f'<rect width="{W}" height="{H}" filter="url(#grain)"/></svg>')
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT} ({len(svg) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
