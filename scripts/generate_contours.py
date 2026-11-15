"""Generates the decorative contour layers used behind the map, climate and form sections.

web/public/contours-rings.svg : nested organic contour rings (like a relief map)
web/public/contours-flow.svg  : soft flowing contour lines (furrow-like curves)

Both are ILLUSTRATIVE decoration (seeded, reproducible), not terrain from any real place.
Run:  python scripts/generate_contours.py
"""
import math
import random
from pathlib import Path

W, H = 1600, 1000
OUT = Path(__file__).resolve().parents[1] / "web" / "public"
INK = "#E3B96F"  # gold lines for the dark theme


def smooth_closed(pts):
    """Catmull-Rom spline through points -> cubic bezier path (closed)."""
    n = len(pts)
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d + "Z"


def rings():
    rng = random.Random(11)
    out = []
    clusters = [  # cx, cy, base radius step, rings, squash
        (800, 520, 46, 16, 0.78), (190, 230, 34, 8, 0.9), (1430, 800, 40, 9, 0.8), (1380, 150, 28, 6, 0.9)]
    for ci, (cx, cy, step, count, sq) in enumerate(clusters):
        harm = [(rng.uniform(0.05, 0.13), k, rng.uniform(0, 6.28)) for k in (2, 3, 5)]
        tilt = rng.uniform(-0.4, 0.4)
        for k in range(1, count + 1):
            r = step * k
            pts = []
            for a in range(0, 360, 12):
                th = math.radians(a)
                wob = 1 + sum(amp * math.sin(m * th + ph + k * 0.07) for amp, m, ph in harm)
                x, y = r * wob * math.cos(th), r * wob * math.sin(th) * sq
                pts.append((cx + x * math.cos(tilt) - y * math.sin(tilt), cy + x * math.sin(tilt) + y * math.cos(tilt)))
            w = 2.0 if k % 5 == 0 else 1.1
            out.append(f'<path d="{smooth_closed(pts)}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-opacity="{0.9 if k % 5 == 0 else 0.55}"/>')
    return out


def flow():
    rng = random.Random(5)
    out = []
    n = 26
    for i in range(n):
        base = 40 + i * (H - 80) / (n - 1)
        a1, a2 = rng.uniform(18, 46), rng.uniform(6, 16)
        f1, f2 = rng.uniform(0.0035, 0.0055), rng.uniform(0.011, 0.016)
        p1, p2 = rng.uniform(0, 6.28) + i * 0.09, rng.uniform(0, 6.28)
        pts = [(x, base + a1 * math.sin(x * f1 + p1) + a2 * math.sin(x * f2 + p2)) for x in range(-40, W + 41, 40)]
        d = f"M{pts[0][0]},{pts[0][1]:.1f}" + "".join(f" L{x},{y:.1f}" for x, y in pts[1:])
        w = 1.8 if i % 5 == 0 else 1.0
        out.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-opacity="{0.85 if i % 5 == 0 else 0.5}" stroke-linejoin="round"/>')
    return out


def flow_tile():
    """Seamless vertically: evenly spaced lines (half-spacing margins), so tiles can repeat down the whole page."""
    rng = random.Random(9)
    out = []
    n = 26
    sp = H / n
    for i in range(n):
        base = (i + 0.5) * sp
        a1, a2 = rng.uniform(14, 36), rng.uniform(5, 12)
        f1, f2 = rng.uniform(0.0035, 0.0055), rng.uniform(0.011, 0.016)
        p1, p2 = rng.uniform(0, 6.28) + i * 0.09, rng.uniform(0, 6.28)
        pts = [(x, base + a1 * math.sin(x * f1 + p1) + a2 * math.sin(x * f2 + p2)) for x in range(-40, W + 41, 40)]
        d = f"M{pts[0][0]},{pts[0][1]:.1f}" + "".join(f" L{x},{y:.1f}" for x, y in pts[1:])
        w = 1.8 if i % 5 == 0 else 1.0
        out.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-opacity="{0.85 if i % 5 == 0 else 0.5}" stroke-linejoin="round"/>')
    return out


def write(name, body):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
           + "".join(body) + "</svg>")
    (OUT / name).write_text(svg, encoding="utf-8")
    print(f"wrote {name} ({len(svg) / 1024:.0f} KB)")


if __name__ == "__main__":
    write("contours-rings.svg", rings())
    write("contours-flow.svg", flow())
    write("contours-flow-tile.svg", flow_tile())
