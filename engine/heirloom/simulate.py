"""Rotation simulation over historical climate blocks (spec 8, 16). Only the water
indicator A is computable today; H,S,E,U are reported pending with reasons."""
from __future__ import annotations

import json
from datetime import date, timedelta
from itertools import product
from pathlib import Path

from . import eto as eto_mod, water, scoring

CATALOG = json.loads((Path(__file__).resolve().parents[2] / "data" / "catalog.json").read_text(encoding="utf-8"))


def kc_curve(crop: dict) -> list[float]:
    L, k = crop["cycleDays"], crop["kc"]
    out = [k["ini"]] * L["ini"]
    out += [k["ini"] + (k["mid"] - k["ini"]) * (i + 1) / L["dev"] for i in range(L["dev"])]
    out += [k["mid"]] * L["mid"]
    out += [k["mid"] + (k["end"] - k["mid"]) * (i + 1) / L["late"] for i in range(L["late"])]
    return out


def eto_series(series: dict, lat: float, elevation: float) -> dict:
    """Daily ETo by date string; None if any required input is missing (never patched)."""
    out = {}
    for d in series["T2M_MAX"]:
        try:
            vals = [series[k][d] for k in ("T2M_MAX", "T2M_MIN", "T2MDEW", "WS2M", "PS", "ALLSKY_SFC_SW_DWN")]
            if any(v is None for v in vals):
                out[d] = None
                continue
            tmax, tmin, tdew, u2, ps, rs = vals
            doy = date(int(d[:4]), int(d[4:6]), int(d[6:])).timetuple().tm_yday
            out[d] = eto_mod.eto_daily(tmax=tmax, tmin=tmin, tdew=tdew, u2=u2, rs=rs, lat_deg=lat,
                                       doy=doy, elevation_m=elevation, pressure_kpa=ps)
        except ValueError:
            out[d] = None
    return out


def irrigation_days(start: date, n: int, irr: dict | None) -> dict:
    """Map date -> applied mm. Needs window, applicationMm and intervalDays; else {}.
    Applications fall every intervalDays counted from the window opening date of that year."""
    if not irr or not irr.get("applicationMm") or not irr.get("intervalDays") \
            or not irr.get("startMonth") or not irr.get("endMonth"):
        return {}
    out = {}
    wraps = irr["startMonth"] > irr["endMonth"]  # window crossing New Year, e.g. Nov-May
    for i in range(n):
        d = start + timedelta(days=i)
        ws = date(d.year, irr["startMonth"], irr.get("startDay", 1))
        we = date(d.year, irr["endMonth"], irr.get("endDay", 28))
        if wraps:
            if d >= ws:
                we = date(d.year + 1, irr["endMonth"], irr.get("endDay", 28))
            else:
                ws = date(d.year - 1, irr["startMonth"], irr.get("startDay", 1))
        if ws <= d <= we and (d - ws).days % irr["intervalDays"] == 0:
            out[d] = float(irr["applicationMm"])
    return out


def run_year_cycle(series, eto, crop_id, year, plant_md, soil, dr0, plant_shift_days=0, precip_scale=1.0,
                   irrigation=None, trace=False):
    crop = CATALOG["crops"][crop_id]
    kc = kc_curve(crop)
    start = date(year, plant_md[0], plant_md[1]) + timedelta(days=plant_shift_days)
    zr = soil.get("rootDepthM") or crop["rootDepthM"]
    taw = water.taw(soil["thetaFC"], soil["thetaWP"], zr)
    irr = irrigation_days(start, len(kc), irrigation)
    days = []
    for i, k in enumerate(kc):
        dt = start + timedelta(days=i)
        key = dt.strftime("%Y%m%d")
        e, p = eto.get(key), series["PRECTOTCORR"].get(key)
        if e is None or p is None:
            return {"status": "incomplete", "reason": f"missing critical day {key}"}
        # the rainfall factor is applied FIRST, before any other balance operation
        days.append({"precip": p * precip_scale, "precip_original": p, "etm": k * e,
                     "irrigation": irr.get(dt, 0.0), "date": dt.isoformat()})
    res = water.run_cycle(dr0, days, taw_mm=taw, p=crop["depletionFraction"], trace=trace,
                          adjust_p_for_etc=True)
    sc = scoring.water_score_cycle(res["eta_sum"], res["etm_sum"], crop["ky"])
    out = {"status": "ok" if sc else "pending", "etaSum": res["eta_sum"], "etmSum": res["etm_sum"],
           "dpSum": res["dp_sum"], "drEnd": res["dr_end"], "water": sc, "irrigationMm": res["irrigation_sum"],
           "precipAdjustedMm": res["precip_sum"], "drStart": dr0,
           "startDate": start.isoformat(), "cropId": crop_id, "ky": crop["ky"],
           "rootDepthM": zr, "awcMmPerM": 1000 * (soil["thetaFC"] - soil["thetaWP"]), "tawMm": taw}
    if trace:
        out["daily"] = res["daily"]
    return out


def run_rotation(series, eto, sequence, first_year, plant_md, soil, shift=0, precip_scale=1.0,
                 irrigation=None, init_frac=0.5, trace=False):
    """sequence: crop ids, one cycle per year. Initial Dr = init_frac*TAW (assumption, recorded)."""
    cycles, dr = [], None
    for j, c in enumerate(sequence):
        zr = soil.get("rootDepthM") or CATALOG["crops"][c]["rootDepthM"]
        taw = water.taw(soil["thetaFC"], soil["thetaWP"], zr)
        if dr is None:
            dr = init_frac * taw
        dr = min(dr, taw)
        cyc = run_year_cycle(series, eto, c, first_year + j, plant_md, soil, dr, shift, precip_scale,
                             irrigation, trace=trace and j == 0)
        if cyc["status"] != "ok":
            return {"status": cyc["status"], "reason": cyc.get("reason"), "cycles": cycles}
        dr = cyc["drEnd"]
        cycles.append(cyc)
    a = scoring.geometric_mean([c["water"]["score"] for c in cycles])
    a = min(100.0, a)  # remove float noise (100.00000000000004); scores live in [1, 100]
    return {"status": "ok", "A": a, "cycles": cycles}


def _slim(c: dict) -> dict:
    out = {k: v for k, v in c.items() if k != "daily"}
    if c.get("water"):
        out["waterFraction"] = c["water"]["fraction"]
        out["waterScore"] = c["water"]["score"]
        out["clipped"] = c["water"]["clipped"]
    return out


def run_blocks(series, eto, sequence, years, plant_md, soil, trace_first=False, **kw):
    n = len(sequence)
    blocks = []
    for y0 in range(years[0], years[1] - n + 2):
        r = run_rotation(series, eto, sequence, y0, plant_md, soil, trace=trace_first and not blocks, **kw)
        b = {"startYear": y0, "status": r["status"], "A": r.get("A"), "reason": r.get("reason"),
             "cycles": [_slim(c) for c in r.get("cycles", [])]}
        if trace_first and not blocks and r.get("cycles") and "daily" in r["cycles"][0]:
            b["dailyTrace"] = r["cycles"][0]["daily"]
        blocks.append(b)
    ok = sorted(b["A"] for b in blocks if b["status"] == "ok")
    summary = None
    if ok:
        summary = {"medianA": scoring.percentile_linear(ok, 0.5), "p10": scoring.percentile_linear(ok, 0.1),
                   "p90": scoring.percentile_linear(ok, 0.9), "validBlocks": len(ok), "totalBlocks": len(blocks),
                   "method": "median/P10/P90 over valid overlapping blocks, linear interpolation, unrounded"}
    return {"blocks": blocks, "summary": summary}


def in_window(md: tuple[int, int], window: dict | None) -> bool:
    if not window:
        return True
    v = md[0] * 100 + md[1]
    return window["startMonth"] * 100 + window.get("startDay", 1) <= v <= window["endMonth"] * 100 + window.get("endDay", 28)


def shifted_md(plant_md: tuple[int, int], shift: int, ref_year: int = 2001) -> tuple[int, int]:
    d = date(ref_year, plant_md[0], plant_md[1]) + timedelta(days=shift)
    return (d.month, d.day)


def propose_alternatives(current: list[str], allowed: list[str], n: int, k: int = 2):
    """Deterministic: all sequences of allowed crops, excluding current, ordered by
    difference from the current practice then lexicographically. Returns (alts, limiting notes)."""
    notes = []
    pool = [c for c in allowed if c in CATALOG["crops"]]
    if not pool:
        return [], ["no allowed crop is in the regional catalog"]
    cands = [list(s) for s in product(sorted(pool), repeat=n) if list(s) != current]
    if len(pool) >= 2:  # a rotation needs more than one crop; documented project rule, not agronomic advice
        cands = [s for s in cands if len(set(s)) >= 2]
    cands.sort(key=lambda s: (-sum(a != b for a, b in zip(s, current)), s))
    alts = cands[:k]
    if len(pool) == 1:
        notes.append(f"With only {pool[0]} allowed, no rotation (at least two crops) is possible; "
                     + ("the only candidate is a monoculture." if alts else "there is no other viable sequence."))
    elif len(alts) < k:
        excluded = sorted(set(CATALOG["crops"]) - set(pool))
        notes.append(f"Only {len(alts)} viable alternative(s) with allowed crops {sorted(pool)}"
                     + (f"; excluded by the user: {excluded}" if excluded else ""))
    return alts, notes
