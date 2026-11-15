"""Reproduce the Jesus Carranza verification with REAL NASA POWER data.

Run from engine/:  .venv/Scripts/python scripts/verify_carranza.py
Writes data/verification/carranza_base.json and carranza_rain80.json (regional SoilGrids soil, the verified case)
and carranza_demo_soil_*.json (illustrative 0.30/0.15 soil).
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
(OUT / "carranza_demo_soil_base.json").write_text(json.dumps(base, indent=2), encoding="utf-8")
(OUT / "carranza_demo_soil_rain80.json").write_text(json.dumps(rain80, indent=2), encoding="utf-8")

print("NASA cell:", eff, "| elevation used:", base["elevationUsedM"], "m")
c0 = base["rotations"][0]["indicators"]["A"]["blocks"][0]["cycles"][0]
print(f"[1] AWC = {base['soil']['sources']['demo']['awcMmPerM']:.1f} mm/m | maize Zr={c0['rootDepthM']} m -> TAW={c0['tawMm']:.1f} mm")
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
print("     limit:", nb["viableCrops"]["notes"])
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

# ======================= audit follow-up (engine 0.4.0) =======================
from heirloom.api import soil_profile_for  # noqa: E402

print("\n[KS ORDER] depletion used for Ks: previous day (new default) vs after same-day wetting (previous behaviour)")
for tag, sc in (("100%", 1.0), ("80%", 0.8)):
    new = go(precipScale=sc)
    old_json = json.loads((OUT / f"carranza_{'base' if sc == 1.0 else 'rain80'}_before_ks_order.json").read_text(encoding="utf-8"))
    aft = go(precipScale=sc, ksTiming="after_wetting")
    so = old_json["rotations"][0]["indicators"]["A"]["summary"]
    sa = aft["rotations"][0]["indicators"]["A"]["summary"]
    sn = new["rotations"][0]["indicators"]["A"]["summary"]
    print(f"  rain {tag}: saved 0.3.0 run median={so['medianA']:.4f} P10={so['p10']:.4f} | rerun after_wetting median={sa['medianA']:.4f} P10={sa['p10']:.4f} (reproduces old: {abs(so['p10']-sa['p10'])<1e-9})")
    bo = {b["startYear"]: b["A"] for b in old_json["rotations"][0]["indicators"]["A"]["blocks"]}
    bn = {b["startYear"]: b["A"] for b in new["rotations"][0]["indicators"]["A"]["blocks"]}
    ch = {y: (bo[y], bn[y]) for y in bo if abs(bo[y] - bn[y]) > 1e-9}
    print(f"            previous_day (new) median={sn['medianA']:.4f} P10={sn['p10']:.4f} P90={sn['p90']:.4f} | blocks changed {len(ch)}/{len(bo)}")
    for y, (a, b) in sorted(ch.items()):
        print(f"              {y}: {a:.3f} -> {b:.3f} ({b - a:+.3f})")

prof = soil_profile_for(LOC["lat"], LOC["lon"])
print("\n[SOILGRIDS]", prof["status"], "effective:", prof.get("effective"), f"distance {prof.get('distanceM', 0):.0f} m", prof.get("qualityFlags"))
if prof["status"] == "ok":
    for L, H in zip(prof["layers"], prof["hydraulics"]["layers"]):
        print(f"   {L['label']:>8}: clay {L['clay_pct']:.1f}% (Q05-Q95 {L['clay_pct_q05']:.1f}-{L['clay_pct_q95']:.1f}) sand {L['sand_pct']:.1f}% SOC {L['soc_g_kg']:.1f} g/kg"
              f" -> OM {H['omPct']:.2f}%  FC {H['fc']:.3f}  WP {H['wp']:.3f}")
    reg = {}
    for tag, sc in (("100%", 1.0), ("80%", 0.8)):
        r = compare.build_run(compare.CompareReq(**{**BASE, "soil": None, "soilIsDemo": False, "soilSource": "regional", "precipScale": sc}),
                              series, manifests, elev, soil_profile=prof)
        reg[tag] = r
        s, b = stats(r)
        c = b[0]["cycles"]
        print(f"   regional soil, rain {tag}: median={s['medianA']:.4f} P10={s['p10']:.4f} P90={s['p90']:.4f} valid={s['validBlocks']}/{s['totalBlocks']}"
              f" | maize AWC={c[0]['awcMmPerM']:.1f} mm/m TAW={c[0]['tawMm']:.1f} mm; bean AWC={c[1]['awcMmPerM']:.1f} mm/m TAW={c[1]['tawMm']:.1f} mm")
    (OUT / "carranza_regional_soil_base.json").write_text(json.dumps(reg["100%"], indent=2), encoding="utf-8")
    (OUT / "carranza_regional_soil_rain80.json").write_text(json.dumps(reg["80%"], indent=2), encoding="utf-8")
# The verified Carranza case = regional SoilGrids soil: these two files are the reference exports.
(OUT / "carranza_base.json").write_text(json.dumps(reg["100%"], indent=2), encoding="utf-8")
(OUT / "carranza_rain80.json").write_text(json.dumps(reg["80%"], indent=2), encoding="utf-8")
sb, sr = reg["100%"]["rotations"][0]["indicators"]["A"]["summary"], reg["80%"]["rotations"][0]["indicators"]["A"]["summary"]
# 96.26 in the earlier report is a double rounding (96.2546 -> 96.255 -> 96.26); the exact value rounds to 96.25, so tolerance is 0.01
ok = (abs(sb["medianA"] - 99.88) < 0.01 and abs(sr["medianA"] - 99.64) < 0.01 and abs(sb["p10"] - 96.99) < 0.01 and abs(sr["p10"] - 96.26) < 0.01)
print(f"[REFERENCE] median {sb['medianA']:.4f} -> {sr['medianA']:.4f} | P10 {sb['p10']:.4f} -> {sr['p10']:.4f} | matches 99.88 -> 99.64 and 96.99 -> 96.26: {ok}")

print("\n[SCREENING] current practice maize->bean->maize, all crops allowed")
for c in base["screening"]["candidates"]:
    fails = [x["code"] for x in c["checks"] if x["status"] == "failed"]
    print("  ", "->".join(c["sequence"]), c["decision"], fails or "")
print("   not evaluated:", base["screening"]["notEvaluated"])
nb = go(constraints={"noBuyer": ["bean"]})
print("   noBuyer=[bean] ->", [c["sequence"] for c in nb["rotations"]], nb["viableCrops"]["blocked"])
print("\n[OVERALL] ", {k: base["rotations"][0]["overall"][k] for k in ("raw", "display", "missing")})
