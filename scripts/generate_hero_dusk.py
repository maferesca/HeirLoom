"""Generates web/public/hero-dusk.svg: an ILLUSTRATIVE cinematic landscape (grass hills at dusk).

Layered ridges with procedurally drawn grass blades, warm backlight, depth-of-field blur and light particles.
It is generated art (seeded, reproducible), not a photograph and not a real place.
Run:  python scripts/generate_hero_dusk.py
"""
import math
import random
from pathlib import Path

W, H = 1600, 1000
rng = random.Random(21)
OUT = Path(__file__).resolve().parents[1] / "web" / "public" / "hero-dusk.svg"


def ridge(base, amp, seed, x):
    r = random.Random(seed)
    ph = [r.uniform(0, 6.28) for _ in range(4)]
    return (base + amp * (0.55 * math.sin(x * 0.0042 + ph[0]) + 0.3 * math.sin(x * 0.0095 + ph[1])
                          + 0.15 * math.sin(x * 0.021 + ph[2]) + 0.08 * math.sin(x * 0.046 + ph[3])))


def hill(base, amp, seed, fill_top, fill_bottom, gid):
    pts = [(x, ridge(base, amp, seed, x)) for x in range(-20, W + 21, 20)]
    d = "M-20,%d " % (H + 20) + " ".join(f"L{x},{y:.1f}" for x, y in pts) + f" L{W + 20},{H + 20}Z"
    grad = (f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{fill_top}"/>'
            f'<stop offset="1" stop-color="{fill_bottom}"/></linearGradient>')
    return grad, f'<path d="{d}" fill="url(#{gid})"/>'


def blades(base, amp, seed, depth, step, count, hmin, hmax, palette, width, opacity):
    out = []
    for x in range(0, W + 1, step):
        for _ in range(count):
            bx = x + rng.uniform(-step, step)
            y0 = ridge(base, amp, seed, bx) + rng.uniform(0, depth) ** 1.0
            h = rng.uniform(hmin, hmax)
            bend = rng.uniform(-14, 14) * (h / hmax)
            col = rng.choice(palette)
            # warm light comes from the right: brighten blades whose x is near the glow
            out.append(f'<path d="M{bx:.0f},{y0:.0f} q{bend / 2:.1f},{-h / 2:.0f} {bend:.1f},{-h:.0f}" stroke="{col}" '
                       f'stroke-width="{rng.uniform(*width):.1f}" stroke-opacity="{rng.uniform(*opacity):.2f}" fill="none" stroke-linecap="round"/>')
    return "".join(out)


def main():
    defs, body = [], []
    defs.append('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06100C"/><stop offset="0.45" stop-color="#14241B"/>'
                '<stop offset="0.7" stop-color="#5A4A26"/><stop offset="0.85" stop-color="#C98B3D"/><stop offset="1" stop-color="#E7B76A"/></linearGradient>')
    defs.append('<radialGradient id="glow" cx="0.72" cy="0.5" r="0.55"><stop offset="0" stop-color="#FFD58A" stop-opacity="0.85"/>'
                '<stop offset="0.35" stop-color="#E39A4A" stop-opacity="0.35"/><stop offset="1" stop-color="#E39A4A" stop-opacity="0"/></radialGradient>')
    defs.append('<radialGradient id="vig" cx="0.55" cy="0.5" r="0.75"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.65"/></radialGradient>')
    defs.append('<filter id="b2" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter>')
    defs.append('<filter id="b6" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>')
    defs.append('<filter id="b1"><feGaussianBlur stdDeviation="1.4"/></filter>')

    body.append(f'<rect width="{W}" height="{H}" fill="url(#sky)"/><rect width="{W}" height="{H}" fill="url(#glow)"/>')

    # far ridge (soft, blurred), mid ridge and near ridge with grass
    g1, h1 = hill(470, 55, 3, "#18301F", "#0C1A12", "h1")
    g2, h2 = hill(585, 80, 8, "#26401F", "#0F2013", "h2")
    g3, h3 = hill(720, 95, 13, "#2D4A1E", "#0B170D", "h3")
    defs += [g1, g2, g3]
    body.append(f'<g filter="url(#b2)">{h1}{blades(470, 55, 3, 40, 14, 1, 8, 16, ["#4F6B2B", "#6E7F32", "#A9863A"], (0.7, 1.1), (0.35, 0.7))}</g>')
    body.append(h2 + blades(585, 80, 8, 120, 5, 5, 10, 28, ["#3E5A25", "#7A9132", "#C79A3E", "#D8B15A"], (0.8, 1.4), (0.45, 0.9)))
    body.append(h3 + blades(720, 95, 13, 190, 4, 6, 14, 44, ["#2F4A1C", "#5E7D2A", "#A9B545", "#E0B552", "#F0CB7A"], (0.9, 1.7), (0.5, 0.95)))
    # blurred foreground blades (depth of field), concentrated bottom right like the reference photo
    fg = []
    for _ in range(260):
        bx = rng.uniform(300, W + 40)
        y0 = H + 10
        h = rng.uniform(120, 360) * (0.6 + 0.6 * (bx / W))
        bend = rng.uniform(-60, 60)
        col = rng.choice(["#8DA33A", "#C8B24A", "#E9C96E", "#3F5B22"])
        fg.append(f'<path d="M{bx:.0f},{y0} q{bend / 2:.0f},{-h / 2:.0f} {bend:.0f},{-h:.0f}" stroke="{col}" stroke-width="{rng.uniform(3, 9):.1f}" stroke-opacity="{rng.uniform(0.45, 0.9):.2f}" fill="none" stroke-linecap="round"/>')
    body.append(f'<g filter="url(#b6)">{"".join(fg)}</g>')
    # light particles (bokeh)
    bokeh = []
    for _ in range(46):
        bokeh.append(f'<circle cx="{rng.uniform(0, W):.0f}" cy="{rng.uniform(80, H - 80):.0f}" r="{rng.uniform(2, 13):.1f}" fill="{rng.choice(["#FFE3A8", "#F4EEDC", "#E8B26A"])}" fill-opacity="{rng.uniform(0.12, 0.45):.2f}"/>')
    body.append(f'<g filter="url(#b1)">{"".join(bokeh)}</g>')
    body.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
           f'<defs>{"".join(defs)}</defs>{"".join(body)}</svg>')
    OUT.write_text(svg, encoding="utf-8")
    print(f"wrote {OUT.name} ({len(svg) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
