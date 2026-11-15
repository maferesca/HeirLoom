"""Daily soil-water bucket (spec 10.2). A project discretization, not full FAO/AquaCrop.

Order: Wstart=TAW-Dr; Q=P-RO+I+CR; DP=max(0,Wstart+Q-TAW); Wwet=min(TAW,Wstart+Q);
Ks on TAW-Wwet; ETa=min(Wwet,Ks*ETm); Wend=Wwet-ETa; Dr_end=TAW-Wend.
Scenario rainfall factors are applied to P BEFORE this step (see simulate.run_year_cycle).
"""
from __future__ import annotations


def taw(theta_fc: float, theta_wp: float, zr_m: float) -> float:
    if not (theta_fc > theta_wp) or zr_m <= 0:
        raise ValueError("require thetaFC>thetaWP and Zr>0")
    return 1000 * (theta_fc - theta_wp) * zr_m


def ks(dr: float, taw_mm: float, p: float) -> float:
    if not (0 < p < 1):
        raise ValueError("0<p<1")
    raw = p * taw_mm
    if dr <= raw:
        return 1.0
    return min(1.0, max(0.0, (taw_mm - dr) / (taw_mm - raw)))


def step(dr_start: float, *, taw_mm: float, p: float, precip: float, etm: float,
         runoff: float = 0.0, irrigation: float = 0.0, capillary: float = 0.0) -> dict:
    w_start = taw_mm - dr_start
    q = precip - runoff + irrigation + capillary
    dp = max(0.0, w_start + q - taw_mm)
    w_wet = min(taw_mm, w_start + q)
    k = ks(taw_mm - w_wet, taw_mm, p)
    eta = min(w_wet, k * etm)
    w_end = w_wet - eta
    return {"dr_end": taw_mm - w_end, "eta": eta, "dp": dp, "ks": k}


def adjust_p(p: float, etc_mm_day: float) -> float:
    """FAO-56 Table 22 footnote 2: p = p_T22 + 0.04 (5 - ETc), limited to 0.1-0.8."""
    return min(0.8, max(0.1, p + 0.04 * (5.0 - etc_mm_day)))


def run_cycle(dr0: float, days: list[dict], *, taw_mm: float, p: float, trace: bool = False,
              adjust_p_for_etc: bool = False) -> dict:
    """days: [{precip, etm, runoff?, irrigation?, capillary?, precip_original?, date?}].
    Returns sums, end state and (optionally) a daily trace for auditing."""
    dr, eta_sum, etm_sum, dp_sum, irr_sum, p_sum = dr0, 0.0, 0.0, 0.0, 0.0, 0.0
    rows = []
    for d in days:
        dr_in = dr
        p_day = adjust_p(p, d["etm"]) if adjust_p_for_etc else p
        r = step(dr, taw_mm=taw_mm, p=p_day, precip=d["precip"], etm=d["etm"],
                 runoff=d.get("runoff", 0.0), irrigation=d.get("irrigation", 0.0),
                 capillary=d.get("capillary", 0.0))
        dr = r["dr_end"]
        eta_sum += r["eta"]; etm_sum += d["etm"]; dp_sum += r["dp"]
        irr_sum += d.get("irrigation", 0.0); p_sum += d["precip"]
        if trace:
            rows.append({"date": d.get("date"), "precipOriginalMm": d.get("precip_original", d["precip"]),
                         "precipAdjustedMm": d["precip"], "irrigationMm": d.get("irrigation", 0.0),
                         "etmMm": d["etm"], "pUsed": p_day, "etaMm": r["eta"], "dpMm": r["dp"], "ks": r["ks"],
                         "drStartMm": dr_in, "drEndMm": r["dr_end"]})
    out = {"dr_end": dr, "eta_sum": eta_sum, "etm_sum": etm_sum, "dp_sum": dp_sum,
           "irrigation_sum": irr_sum, "precip_sum": p_sum}
    if trace:
        out["daily"] = rows
    return out
