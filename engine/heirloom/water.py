"""Daily soil-water bucket. A project discretization, not full FAO/AquaCrop.

ORDER OF OPERATIONS WITHIN ONE DAY (default `ks_timing="previous_day"`, FAO-56 ch. 8 and the DOCX):
  0. Scenario rainfall factor is applied to P first (see simulate.run_year_cycle), then:
  1. Ks is computed from the depletion at the END OF THE PREVIOUS DAY, Dr(i-1) (FAO-56 eq. 84 uses Dr,i-1).
     Same-day rain therefore does NOT relieve stress on that day's ETa; it enters the store for the next day.
  2. Water enters:  Wstart = TAW - Dr(i-1);  Q = P - RO + I + CR;
     DP = max(0, Wstart + Q - TAW);  Wwet = min(TAW, Wstart + Q).
  3. ETa = min(Wwet, Ks * ETm)   (single crop coefficient; ETm = Kc * ETo).
  4. Wend = Wwet - ETa;  Dr(i) = TAW - Wend.  Mass is conserved.
Alternative `ks_timing="after_wetting"` (master prompt, section 10.2) computes Ks on TAW - Wwet, i.e. after the
same-day rain. It is kept only for comparison; see METHODS.md for the before/after comparison.
"""
from __future__ import annotations

KS_TIMINGS = ("previous_day", "after_wetting")


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
         runoff: float = 0.0, irrigation: float = 0.0, capillary: float = 0.0,
         ks_timing: str = "previous_day") -> dict:
    if ks_timing not in KS_TIMINGS:
        raise ValueError(f"ks_timing must be one of {KS_TIMINGS}")
    w_start = taw_mm - dr_start
    q = precip - runoff + irrigation + capillary
    dp = max(0.0, w_start + q - taw_mm)
    w_wet = min(taw_mm, w_start + q)
    dr_for_ks = dr_start if ks_timing == "previous_day" else taw_mm - w_wet
    k = ks(dr_for_ks, taw_mm, p)
    eta = min(w_wet, k * etm)
    w_end = w_wet - eta
    return {"dr_end": taw_mm - w_end, "eta": eta, "dp": dp, "ks": k, "dr_for_ks": dr_for_ks}


def adjust_p(p: float, etc_mm_day: float) -> float:
    """FAO-56 Table 22 footnote 2: p = p_T22 + 0.04 (5 - ETc), limited to 0.1-0.8."""
    return min(0.8, max(0.1, p + 0.04 * (5.0 - etc_mm_day)))


def run_cycle(dr0: float, days: list[dict], *, taw_mm: float, p: float, trace: bool = False,
              adjust_p_for_etc: bool = False, ks_timing: str = "previous_day") -> dict:
    """days: [{precip, etm, runoff?, irrigation?, capillary?, precip_original?, date?}].
    Returns sums, end state and (optionally) a daily trace for auditing."""
    dr, eta_sum, etm_sum, dp_sum, irr_sum, p_sum = dr0, 0.0, 0.0, 0.0, 0.0, 0.0
    rows = []
    for d in days:
        dr_in = dr
        p_day = adjust_p(p, d["etm"]) if adjust_p_for_etc else p
        r = step(dr, taw_mm=taw_mm, p=p_day, precip=d["precip"], etm=d["etm"],
                 runoff=d.get("runoff", 0.0), irrigation=d.get("irrigation", 0.0),
                 capillary=d.get("capillary", 0.0), ks_timing=ks_timing)
        dr = r["dr_end"]
        eta_sum += r["eta"]; etm_sum += d["etm"]; dp_sum += r["dp"]
        irr_sum += d.get("irrigation", 0.0); p_sum += d["precip"]
        if trace:
            rows.append({"date": d.get("date"), "precipOriginalMm": d.get("precip_original", d["precip"]),
                         "precipAdjustedMm": d["precip"], "irrigationMm": d.get("irrigation", 0.0),
                         "etmMm": d["etm"], "pUsed": p_day, "drForKsMm": r["dr_for_ks"], "ks": r["ks"],
                         "etaMm": r["eta"], "dpMm": r["dp"], "drStartMm": dr_in, "drEndMm": r["dr_end"]})
    out = {"dr_end": dr, "eta_sum": eta_sum, "etm_sum": etm_sum, "dp_sum": dp_sum,
           "irrigation_sum": irr_sum, "precip_sum": p_sum}
    if trace:
        out["daily"] = rows
    return out
