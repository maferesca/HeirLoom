"""Series validation and normalization (spec section 8). Raw data is preserved."""
from __future__ import annotations

from collections import defaultdict
from statistics import mean

KWH_TO_MJ = 3.6


def clean_series(raw: dict, fill_value: float = -999.0) -> dict:
    """Return {param: {YYYYMMDD: float|None}} with units converted; None for missing.

    PS kPa as delivered; radiation converted only if the response says kWh.
    """
    params = raw["properties"]["parameter"]
    units = {k: v.get("units", "") for k, v in raw.get("parameters", {}).items()}
    out = {}
    for name, series in params.items():
        conv = 1.0
        if name == "ALLSKY_SFC_SW_DWN" and "kW-hr" in units.get(name, "").replace("kWh", "kW-hr"):
            conv = KWH_TO_MJ
        out[name] = {d: (None if v == fill_value else v * conv) for d, v in series.items()}
    return out


def quality_stats(series: dict) -> dict:
    stats = {}
    for name, s in series.items():
        vals = [v for v in s.values() if v is not None]
        stats[name] = {"expected": len(s), "valid": len(vals), "missing": len(s) - len(vals),
                       "min": min(vals) if vals else None, "max": max(vals) if vals else None}
    return stats


def physical_alerts(series: dict) -> list[str]:
    alerts = []
    tx, tn = series.get("T2M_MAX", {}), series.get("T2M_MIN", {})
    bad = [d for d in tx if tx[d] is not None and tn.get(d) is not None and tn[d] > tx[d]]
    if bad:
        alerts.append(f"Tmin>Tmax on {len(bad)} day(s)")
    return alerts


def monthly_summary(series: dict) -> dict:
    """Precip: sum of daily per year-month, then median across years (zero rain is valid).
    Temperature: mean of valid T2M days (max/min not averaged under another label)."""
    precip = series.get("PRECTOTCORR", {})
    t2m = series.get("T2M", {})
    p_tot = defaultdict(lambda: defaultdict(float)); p_n = defaultdict(lambda: defaultdict(int))
    for d, v in precip.items():
        if v is None:
            continue
        p_tot[int(d[4:6])][d[:4]] += v; p_n[int(d[4:6])][d[:4]] += 1
    t_by = defaultdict(list)
    for d, v in t2m.items():
        if v is not None:
            t_by[int(d[4:6])].append(v)
    res = []
    for m in range(1, 13):
        totals = sorted(p_tot[m].values())
        med = totals[len(totals) // 2] if len(totals) % 2 else (totals[len(totals)//2 - 1] + totals[len(totals)//2]) / 2 if totals else None
        res.append({"month": m, "precipMedianMm": med, "yearsUsed": len(totals),
                    "tempMeanC": mean(t_by[m]) if t_by[m] else None})
    return {"months": res}
