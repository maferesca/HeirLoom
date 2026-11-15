"""Normalization and aggregation (spec sections 9, 10.3, 11, 15).

Internal precision is full; rounding happens only for display.
Missing inputs yield None, never 0/50/100.
"""
from __future__ import annotations

import math
from typing import Optional, Sequence

W_CLIMATE_EACH = 1 / 6
W_SOIL_EACH = 1 / 6
W_ECON = 1 / 3


def clip01(x: float) -> float:
    return min(1.0, max(0.0, x))


def score_fraction(x: float) -> float:
    """scoreFraction(x) = 1 + 99*clip(x,0,1)."""
    return 1.0 + 99.0 * clip01(x)


def round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def geometric_mean(values: Sequence[float]) -> Optional[float]:
    if not values or any(v is None or v <= 0 for v in values):
        return None
    return math.exp(sum(math.log(v) for v in values) / len(values))


def water_fraction(eta_sum: float, etm_sum: float, ky: float) -> Optional[float]:
    """rWater = 1 - Ky*(1 - sum(ETa)/sum(ETm)). None if sum(ETm) <= 0."""
    if etm_sum is None or etm_sum <= 0 or eta_sum is None:
        return None
    return 1.0 - ky * (1.0 - eta_sum / etm_sum)


def water_score_cycle(eta_sum: float, etm_sum: float, ky: float) -> Optional[dict]:
    r = water_fraction(eta_sum, etm_sum, ky)
    if r is None:
        return None
    return {"fraction": r, "clipped": r < 0 or r > 1, "score": score_fraction(r)}


def heat_fraction(f: Sequence[float], kh: Sequence[float]) -> Optional[float]:
    """h = sum(f*Kh)/sum(f). None when sum(f)==0 (never 100)."""
    sf = sum(f)
    if sf <= 0:
        return None
    return sum(a * b for a, b in zip(f, kh)) / sf


def percentile_linear(values: Sequence[float], q: float) -> float:
    """Linear interpolation between order statistics (numpy 'linear')."""
    s = sorted(values)
    if not s:
        raise ValueError("empty sample")
    pos = (len(s) - 1) * q
    lo, hi = int(math.floor(pos)), int(math.ceil(pos))
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def normalize_p10_p90(x: float, p10: float, p90: float, lower_is_better: bool = False) -> Optional[float]:
    if p90 <= p10:
        return None  # calibration not defensible -> pending
    t = (p90 - x) / (p90 - p10) if lower_is_better else (x - p10) / (p90 - p10)
    return score_fraction(t)


def overall_score(A, H, S, E, U) -> dict:
    """Geometric aggregation with exact weights. Any missing component -> None."""
    comps = {"A": A, "H": H, "S": S, "E": E, "U": U}
    missing = [k for k, v in comps.items() if v is None]
    if missing:
        return {"raw": None, "display": None, "missing": missing}
    raw = math.exp((math.log(A) + math.log(H) + math.log(S) + math.log(E)) / 6 + math.log(U) / 3)
    return {"raw": raw, "display": round_half_up(raw), "missing": []}
