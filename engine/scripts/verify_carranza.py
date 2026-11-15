"""Reproduce the Jesus Carranza verification with REAL NASA POWER data.

Run from engine/:  .venv/Scripts/python scripts/verify_carranza.py
Writes data/verification/carranza_base.json and carranza_rain80.json.
Soil 0.30/0.15 are ILLUSTRATIVE DEMO ASSUMPTIONS, not measurements.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from heirloom import compare  # noqa: E402
from heirloom.api import load_series  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "data" / "verification"
OUT.mkdir(parents=True, exist_ok=True)
LOC = {"lat": 17.432993, "lon": -95.02336}
BASE = dict(location=LOC, startYear=2005, endYear=2024, plantMonth=6, plantDay=15,
            history=[{"crops": ["maize"]}, {"crops": ["bean"]}, {"crops": ["maize"]}],
            soil={"thetaFC": 0.30, "thetaWP": 0.15}, soilIsDemo=True, waterRegime="rainfed", plantShiftDays=0)

series, manifests = load_series(compare.ProfileReq(location=LOC, startYear=2005, endYear=2024))
eff = manifests[0]["effectiveLocation"]
elev = eff[2] if len(eff) > 2 else None


def go(**kw):
    return compare.build_run(compare.CompareReq(**{**BASE, **kw}), series, manifests, elev)


def stats(run, i=0):
    A = run["rotations"][i]["indicators"]["A"]
    return A["summary"], A["blocks"]


base, rain80 = go(precipScale=1.0), go(precipScale=0.8)
(OUT / "carranza_base.json").write_text(json.dumps(base, indent=2), encoding="utf-8")
(OUT / "carranza_rain80.json").write_text(json.dumps(rain80, indent=2), encoding="utf-8")

print("NASA cell:", eff, "| elevation used:", base["elevationUsedM"], "m")
c0 = base["rotations"][0]["indicators"]["A"]["blocks"][0]["cycles"][0]
print(f"[1] AWC = {base['soil']['awcMmPerM']:.1f} mm/m | maize Zr={c0['rootDepthM']} m -> TAW={c0['tawMm']:.1f} mm")
for name, r in (("base", base), ("rain 80%", rain80)):
    s, b = stats(r)
    print(f"[2] {name}: median={s['medianA']:.4f} P10={s['p10']:.4f} P90={s['p90']:.4f} valid={s['validBlocks']}/{s['totalBlocks']}")
sb, bb = stats(base); sr, br = stats(rain80)
print("    per-block A (base -> rain80):")
for x, y in zip(bb, br):
    print(f"      {x['startYear']}: {x['A']:.3f} -> {y['A']:.3f}   dA={y['A'] - x['A']:+.3f}")
print(f"    delta median (adjusted - base, unrounded) = {sr['medianA'] - sb['medianA']:+.6f}")

nb = go(allowedCrops=["maize"])
print("[3a] allowed=maize only ->", [r["sequence"] for r in nb["rotations"]], "| history kept:", nb["rotations"][0]["sequence"])
print("     limit:", nb["viableCrops"]["alternativesLimit"])
for w in ({"startMonth": 5, "startDay": 15, "endMonth": 7, "endDay": 15}, {"startMonth": 6, "startDay": 10, "endMonth": 6, "endDay": 20}):
    r = go(window=w)
    print("[3b] window", w, "viable shifts:", [c["shiftDays"] for c in r["calendar"]["candidates"] if c["viable"]])
irr = go(waterRegime="irrigated", precipScale=0.8,
         irrigation={"startMonth": 11, "startDay": 1, "endMonth": 5, "endDay": 31, "applicationMm": 30, "intervalDays": 10})
print("[3c] irrigation window Nov-May (outside crop cycle) irrigationMm per cycle:",
      [round(c["irrigationMm"], 1) for c in irr["rotations"][0]["indicators"]["A"]["blocks"][0]["cycles"]])
irr = go(waterRegime="irrigated", precipScale=0.8,
         irrigation={"startMonth": 6, "startDay": 15, "endMonth": 10, "endDay": 30, "applicationMm": 20, "intervalDays": 10})
s, b = stats(irr)
print("     irrigation Jun-Oct 20mm/10d, rain80: irrigationMm per cycle:",
      [round(c["irrigationMm"], 1) for c in b[0]["cycles"]], f"| median={s['medianA']:.3f} P10={s['p10']:.3f}")
sens = go(initialDepletionFraction=1.0, precipScale=0.8)
s, _ = stats(sens)
print(f"[sensitivity] dry start (Dr0=TAW), rain80: median={s['medianA']:.3f} P10={s['p10']:.3f}")

tr = bb[0].get("dailyTrace") or []
print("[4] daily trace example (first block, maize, base):")
for d in tr[:3]:
    print("   ", {k: (round(v, 2) if isinstance(v, float) else v) for k, v in d.items()})
wet = next((d for d in rain80["rotations"][0]["indicators"]["A"]["blocks"][0]["dailyTrace"] if d["precipOriginalMm"] >= 10), None)
if wet:
    print("    rain80 day with >=10 mm original:", {k: (round(v, 2) if isinstance(v, float) else v) for k, v in wet.items()})
    print("    factor check:", wet["precipOriginalMm"], "->", round(wet["precipAdjustedMm"], 4), "(x0.80 =", round(wet["precipOriginalMm"] * 0.8, 4), ")")

# ---- before/after the p(ETc) adjustment (engine 0.3.0), using the saved pre-change JSON ----
DATA = OUT
print("[change] daily p adjustment (FAO-56 Table 22 fn 2): before -> after")
for tag, new in (("base", base), ("rain80", rain80)):
    old = json.loads((DATA / f"carranza_{tag}_before_p_adjust.json").read_text(encoding="utf-8"))
    so, sn = old["rotations"][0]["indicators"]["A"]["summary"], new["rotations"][0]["indicators"]["A"]["summary"]
    bo = {b["startYear"]: b["A"] for b in old["rotations"][0]["indicators"]["A"]["blocks"]}
    bn = {b["startYear"]: b["A"] for b in new["rotations"][0]["indicators"]["A"]["blocks"]}
    ch = {y: (bo[y], bn[y]) for y in bo if abs(bo[y] - bn[y]) > 1e-9}
    print(f"  {tag}: median {so['medianA']:.4f}->{sn['medianA']:.4f}  P10 {so['p10']:.4f}->{sn['p10']:.4f}  blocks changed: {len(ch)}/{len(bo)}")
    for y, (a, b) in sorted(ch.items()):
        print(f"      {y}: {a:.3f} -> {b:.3f} ({b - a:+.3f})")

# ---- root-depth sensitivity (pilot assumption: lower bound of FAO-56 Table 22 range) ----
from heirloom import simulate  # noqa: E402
orig = {k: v["rootDepthM"] for k, v in simulate.CATALOG["crops"].items()}
print("[sensitivity] root depth at upper bound of FAO-56 range (maize 1.7 m, bean 0.9 m):")
for k, zr in (("maize", 1.7), ("bean", 0.9)):
    simulate.CATALOG["crops"][k]["rootDepthM"] = zr
for tag, sc in (("100%", 1.0), ("80%", 0.8)):
    s, _ = stats(go(precipScale=sc))
    print(f"  rain {tag}: median={s['medianA']:.4f} P10={s['p10']:.4f}")
for k, zr in orig.items():
    simulate.CATALOG["crops"][k]["rootDepthM"] = zr
