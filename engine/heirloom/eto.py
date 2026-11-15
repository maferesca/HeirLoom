"""FAO-56 Penman-Monteith daily ETo (spec 10.1). Units: mm/day, kPa, MJ/m2/day."""
from __future__ import annotations

import math
from typing import Optional


def e0(t: float) -> float:
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def eto_daily(*, tmax: float, tmin: float, rs: float, u2: float, lat_deg: float,
              doy: int, elevation_m: float, pressure_kpa: float,
              tdew: Optional[float] = None, ea: Optional[float] = None,
              return_terms: bool = False):
    """Returns ETo (mm/day), or (ETo, terms) with intermediate values for the inspector.

    Raises ValueError for physically impossible input or Rso<=0 (no arbitrary patching).
    """
    if tmax < tmin:
        raise ValueError("Tmin must be <= Tmax")
    if ea is None:
        if tdew is None:
            raise ValueError("ea or tdew required (record humidity method)")
        ea = e0(tdew)
    tmean = (tmax + tmin) / 2
    es = (e0(tmax) + e0(tmin)) / 2
    delta = 4098 * e0(tmean) / (tmean + 237.3) ** 2
    gamma = 0.000665 * pressure_kpa
    lat = math.radians(lat_deg)
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    decl = 0.409 * math.sin(2 * math.pi * doy / 365 - 1.39)
    x = -math.tan(lat) * math.tan(decl)
    omega = math.acos(max(-1.0, min(1.0, x)))
    ra = (24 * 60 / math.pi) * 0.0820 * dr * (
        omega * math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.sin(omega))
    rso = (0.75 + 2e-5 * elevation_m) * ra
    if rso <= 0:
        raise ValueError("Rso <= 0: outside method domain")
    ratio = min(rs / rso, 1.0)  # FAO-56 limits Rs/Rso to <= 1
    tk = lambda t: t + 273.16
    rnl = 4.903e-9 * ((tk(tmax) ** 4 + tk(tmin) ** 4) / 2) * (0.34 - 0.14 * math.sqrt(ea)) * (1.35 * ratio - 0.35)
    rns = (1 - 0.23) * rs
    rn = rns - rnl
    g = 0.0
    eto = (0.408 * delta * (rn - g) + gamma * (900 / (tmean + 273)) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2))
    if return_terms:
        return eto, dict(tmean=tmean, es=es, ea=ea, delta=delta, gamma=gamma, dr=dr, decl=decl,
                         omega=omega, ra=ra, rso=rso, rns=rns, rnl=rnl, rn=rn)
    return eto


def wind10_to_2(u10: float) -> float:
    """Only for 10 m wind. POWER WS2M is already 2 m: do not apply."""
    return u10 * 4.87 / math.log(67.8 * 10 - 5.42)
