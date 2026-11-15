"""Pedotransfer function: Saxton & Rawls (2006) for field capacity (33 kPa) and wilting point (1500 kPa).

Reference: Saxton, K.E. and Rawls, W.J. (2006). Soil water characteristic estimates by texture and organic
matter for hydrologic solutions. Soil Sci. Soc. Am. J. 70:1569-1578.
Coefficients checked on 2026-11-14 against two independent published code implementations that agree:
USDA-ARS WEPP `saxpar.for` and the R package `rcropmod` (`pedotransfer.R`).

Inputs: sand and clay as FRACTIONS (0-1), organic matter in PERCENT by weight. Output: volumetric water
content (m3/m3). Domain stated by the R implementation's documentation: OM <= 8 %, clay <= 60 %.
No coarse-fragment correction is applied (flagged by callers).
"""
from __future__ import annotations

OM_PER_SOC = 1.724  # van Bemmelen factor: organic matter = 1.724 x organic carbon (assumption, recorded)
MAX_OM_PCT = 8.0
MAX_CLAY = 0.60


def saxton_rawls(sand: float, clay: float, om_pct: float) -> dict:
    s, c, om = sand, clay, om_pct
    t1500 = -0.024 * s + 0.487 * c + 0.006 * om + 0.005 * s * om - 0.013 * c * om + 0.068 * s * c + 0.031
    wp = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * s + 0.195 * c + 0.011 * om + 0.006 * s * om - 0.027 * c * om + 0.452 * s * c + 0.299
    fc = t33 + (1.283 * t33 ** 2 - 0.374 * t33 - 0.015)
    flags = []
    if om > MAX_OM_PCT:
        flags.append("om_above_8pct")
    if c > MAX_CLAY:
        flags.append("clay_above_60pct")
    if not (0 < wp < fc < 1):
        flags.append("implausible_result")
    return {"fc": fc, "wp": wp, "thetaFCm3m3": fc, "thetaWPm3m3": wp, "flags": flags,
            "inDomain": not flags, "intermediate": {"t1500": t1500, "t33": t33}}


def om_from_soc(soc_g_per_kg: float) -> float:
    """Organic matter (% by weight) from organic carbon in g/kg."""
    return soc_g_per_kg * OM_PER_SOC / 10.0


def profile_hydraulics(layers: list[dict]) -> dict:
    """layers from providers.soilgrids (clay_pct, sand_pct, soc_g_kg, top_cm, bottom_cm).
    Returns per-layer fc/wp plus the layer list ready for simulate.soil_theta (meters)."""
    out, eng, issues = [], [], []
    for L in layers:
        if None in (L.get("clay_pct"), L.get("sand_pct"), L.get("soc_g_kg")):
            issues.append(f"{L['label']}: missing texture or organic carbon")
            continue
        r = saxton_rawls(L["sand_pct"] / 100.0, L["clay_pct"] / 100.0, om_from_soc(L["soc_g_kg"]))
        out.append({"label": L["label"], "omPct": om_from_soc(L["soc_g_kg"]), **r})
        if not r["inDomain"]:
            issues.append(f"{L['label']}: {', '.join(r['flags'])}")
        eng.append({"top": L["top_cm"] / 100.0, "bottom": L["bottom_cm"] / 100.0, "fc": r["fc"], "wp": r["wp"]})
    usable = len(eng) == len(layers) and not any(not x["inDomain"] for x in out)
    return {"layers": out, "engineLayers": eng, "usable": usable, "issues": issues}
