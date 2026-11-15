"""Builds a rotation comparison run from farmer answers + a daily climate series.

Pure logic (no network): `build_run(req, series, manifests, ...)` is unit-testable with synthetic series.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

from . import ptf, scoring, screening, simulate, water

ENGINE_VERSION = "0.4.0"
INDICATORS = ("A", "H", "S", "E", "U")


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    elevation: Optional[float] = None


class ProfileReq(BaseModel):
    location: Location
    startYear: int = 2005
    endYear: int = 2024


class Soil(BaseModel):
    """Values written by the user (farmer measurement/observation or demo assumption)."""
    thetaFC: float
    thetaWP: float
    rootDepthM: Optional[float] = None


class HistoryEntry(BaseModel):
    """One planting cycle. More than one crop = sown together (association)."""
    crops: list[str]
    year: Optional[int] = None
    approxDate: Optional[str] = None


class Window(BaseModel):
    startMonth: int = Field(ge=1, le=12)
    startDay: int = Field(1, ge=1, le=31)
    endMonth: int = Field(ge=1, le=12)
    endDay: int = Field(28, ge=1, le=31)


class Irrigation(BaseModel):
    startMonth: Optional[int] = Field(None, ge=1, le=12)
    startDay: int = 1
    endMonth: Optional[int] = Field(None, ge=1, le=12)
    endDay: int = 28
    applicationMm: Optional[float] = Field(None, gt=0)
    intervalDays: Optional[int] = Field(None, gt=0)


class Management(BaseModel):
    residues: Literal["retain", "partial", "remove", "unknown"] = "unknown"
    coverCrop: Optional[bool] = None
    waterlogging: Optional[bool] = None
    runoff: Optional[bool] = None
    priority: Optional[Literal["water", "soil", "margin"]] = None
    areaHa: Optional[float] = None
    ownCostsMxnPerHa: Optional[float] = None
    ownYieldsTPerHa: Optional[dict] = None


class Constraints(BaseModel):
    """Concrete restrictions declared by the farmer; each one becomes a filter on the catalog."""
    seedUnavailable: list[str] = []
    equipmentUnsupported: list[str] = []
    noBuyer: list[str] = []


class CompareReq(ProfileReq):
    history: list[HistoryEntry] = []
    currentSequence: list[str] = []  # legacy shortcut: one crop per year
    plantMonth: int = 6
    plantDay: int = 15
    window: Optional[Window] = None
    waterRegime: Literal["rainfed", "irrigated", "both", "unknown"] = "unknown"
    irrigation: Optional[Irrigation] = None
    allowedCrops: Optional[list[str]] = None  # None = all catalog crops
    constraints: Constraints = Constraints()
    constraintNotes: dict = {}  # free text, recorded only
    management: Management = Management()
    soil: Optional[Soil] = None  # user-written values
    soilIsDemo: bool = False  # True => `soil` values are the illustrative demo assumption
    soilSource: Optional[Literal["farmer", "regional", "demo"]] = None  # which source drives the water model
    initialDepletionFraction: float = Field(0.5, ge=0, le=1)
    ksTiming: Literal["previous_day", "after_wetting"] = "previous_day"
    plantShiftDays: int = Field(0, ge=-30, le=30)
    precipScale: float = Field(1.0, ge=0.7, le=1.3)


def _missing(kind: str, item: str, note: str = "") -> dict:
    return {"kind": kind, "item": item, "note": note}


# What each pending indicator needs (checked against the master prompt). None can be computed today.
PENDING = {
    "H": [
        _missing("data", "Flowering window per crop (phenology) and pollination heat threshold", "Catalog fields are 'pending'; no sourced values"),
        _missing("model", "AquaCrop pollination heat-stress function (eq. 3.2c)", "Not verified against a pinned official release"),
    ],
    "S": [
        _missing("model", "RothC official implementation (pinned version) with spin-up", "Not integrated"),
        _missing("data", "Soil organic carbon, bulk density, coarse fragments, clay by layer", "SoilGrids profile now available for the pilot point; RothC inputs still missing"),
        _missing("data", "Crop residue biomass and retained fraction", "Only qualitative answer collected"),
    ],
    "E": [
        _missing("data", "Rainfall erosivity R (GloREDa/ESDAC)", "Requires registration and authorized download"),
        _missing("data", "Slope and slope length (INEGI DEM, flow path)", "DEM not downloaded"),
        _missing("model", "Soil erodibility K and cover factor C by crop stage", "Needs published tables, not yet loaded"),
    ],
    "U": [
        _missing("data", "Commercial yields (modeled or regional DGSIAP, same modality)", "Not loaded"),
        _missing("data", "Prices and costs in MXN of one base year (FIRA / farmer)", "Not loaded; farmer values optional"),
        _missing("source", "Normalization P10/P90 from a frozen regional reference sample", "No reference sample exists yet"),
    ],
}


def overall_from_indicators(indicators: dict) -> dict:
    """Aggregate the REAL indicator scores. An indicator without a numeric `score` is missing.

    Scores are the 1-100 values (A and H from the fraction rescale; S, E and U from the P10-P90 rescale).
    Weights are fixed in scoring.overall_score: A,H,S,E = 1/6 each, U = 1/3."""
    vals = {}
    for k in INDICATORS:
        ind = indicators.get(k) or {}
        score = ind.get("score")
        vals[k] = score if ind.get("status") in ("calculated", "provisional", "conditional") and isinstance(score, (int, float)) else None
    out = scoring.overall_score(vals["A"], vals["H"], vals["S"], vals["E"], vals["U"])
    out["components"] = {k: vals[k] for k in INDICATORS}
    out["message"] = None if out["raw"] is not None else "Missing information to compute the overall score"
    return out


def _irrigation_state(req: CompareReq):
    """Returns (irrigation dict or None, status, conditions, missing)."""
    reg = req.waterRegime
    if reg == "rainfed":
        return None, "confirmed", ["Rainfed confirmed: irrigation = 0 mm"], []
    if reg == "unknown":
        return None, "conditional", ["Water regime not given: simulated as rainfed (irrigation = 0)"], \
            [_missing("data", "Water regime (rainfed, irrigated or both)")]
    irr = req.irrigation
    need = []
    if not irr or not irr.startMonth or not irr.endMonth:
        need.append(_missing("data", "Dates when irrigation is available"))
    if not irr or not irr.applicationMm:
        need.append(_missing("data", "Water depth per application (mm)"))
    if not irr or not irr.intervalDays:
        need.append(_missing("data", "Days between applications"))
    if need:
        return None, "conditional", ["Irrigation declared but incomplete: simulated without irrigation; water result is conditional"], need
    return irr.model_dump(), "applied", [
        f"Irrigation applied: {irr.applicationMm} mm every {irr.intervalDays} d inside the window; infrastructure and cost not modeled"], []


def _soil_sources(req: CompareReq, soil_profile: Optional[dict]):
    """Keep the three soil sources apart. Returns (report, active soil dict for the engine or None)."""
    sources: dict = {"farmer": None, "regional": None, "demo": None}
    if req.soil:
        key = "demo" if req.soilIsDemo else "farmer"
        sources[key] = {"thetaFC": req.soil.thetaFC, "thetaWP": req.soil.thetaWP,
                        "awcMmPerM": 1000 * (req.soil.thetaFC - req.soil.thetaWP),
                        "rootDepthM": req.soil.rootDepthM,
                        "sourceType": "demo_assumption" if req.soilIsDemo else "farmer_declared"}
    reg_missing: list[dict] = []
    if soil_profile:
        if soil_profile.get("status") == "ok":
            hyd = soil_profile.get("hydraulics") or {}
            sources["regional"] = {
                "sourceType": "spatial_estimate+pedotransfer",
                "product": "SoilGrids 2.0", "manifest": soil_profile.get("manifest"),
                "requested": soil_profile.get("requested"), "effective": soil_profile.get("effective"),
                "distanceM": soil_profile.get("distanceM"), "qualityFlags": soil_profile.get("qualityFlags", []),
                "layers": soil_profile.get("layers"),
                "pedotransfer": {"method": "Saxton & Rawls (2006)", "inputs": "sand, clay (fractions), organic matter % = SOC x 1.724 / 10",
                                 "layers": hyd.get("layers"), "usable": hyd.get("usable"), "issues": hyd.get("issues"),
                                 "caveats": ["no coarse-fragment correction", "high-clay or Vertisol soils are poorly covered by the function",
                                             "SoilGrids Q0.05-Q0.95 intervals are not propagated into theta"]},
                "usable": bool(hyd.get("usable")),
            }
            if not hyd.get("usable"):
                reg_missing.append(_missing("data", "Complete in-domain texture and organic carbon for every layer", "; ".join(hyd.get("issues") or [])))
        else:
            reg_missing.append(_missing("source", "SoilGrids profile for this point",
                                        soil_profile.get("reason") or "service unavailable or no valid cell nearby"))
    # choose the active source
    want = req.soilSource or ("demo" if req.soilIsDemo else "farmer" if req.soil else "regional" if soil_profile else None)
    active, active_soil, why = None, None, None
    if want == "regional":
        reg = sources["regional"]
        if reg and reg["usable"]:
            layers = soil_profile["hydraulics"]["engineLayers"]
            active, active_soil = "regional", {"layers": layers}
        else:
            why = "regional estimate not usable"
    elif want in ("farmer", "demo") and sources[want]:
        active, active_soil = want, {"thetaFC": sources[want]["thetaFC"], "thetaWP": sources[want]["thetaWP"]}
        if sources[want].get("rootDepthM"):
            active_soil["rootDepthM"] = sources[want]["rootDepthM"]
    report = {"sources": sources, "active": active, "requestedSource": want, "regionalMissing": reg_missing,
              "isDemoAssumption": active == "demo", "unavailableReason": why}
    return report, active_soil


def build_run(req: CompareReq, series: dict, manifests: list, effective_elevation: Optional[float] = None,
              soil_profile: Optional[dict] = None) -> dict:
    cat = simulate.CATALOG["crops"]
    plant_md = (req.plantMonth, req.plantDay)
    window = req.window.model_dump() if req.window else None
    warnings: list[str] = []
    horizon_years = (req.startYear, req.endYear)

    # ---- history -> current practice
    history = req.history or [HistoryEntry(crops=[c]) for c in req.currentSequence]
    if not history:
        raise ValueError("history_required")
    n = min(len(history), 3)
    hist = history[-n:]
    intercrop = any(len(h.crops) > 1 for h in hist)
    unknown = sorted({c for h in hist for c in h.crops if c not in cat})
    current_seq = None if (intercrop or unknown) else [h.crops[0] for h in hist]

    # ---- calendar
    if window and not simulate.in_window(plant_md, window):
        raise ValueError("usual_planting_date_outside_window")
    scen_md = simulate.shifted_md(plant_md, req.plantShiftDays)
    outside = bool(window) and not simulate.in_window(scen_md, window)
    candidates_cal = []
    for sh in (-30, -15, 0, 15, 30):
        md = simulate.shifted_md(plant_md, sh)
        candidates_cal.append({"shiftDays": sh, "month": md[0], "day": md[1],
                               "viable": True if not window else simulate.in_window(md, window)})
    calendar = {"usual": list(plant_md), "window": window, "scenarioShiftDays": req.plantShiftDays,
                "scenarioDate": list(scen_md), "scenarioOutsideWindow": outside, "candidates": candidates_cal,
                "note": None if window else "No planting window given: every date treated as viable"}
    if outside:
        warnings.append("The simulated planting date is outside your stated planting window.")

    # ---- screening of alternatives
    allowed = req.allowedCrops if req.allowedCrops is not None else sorted(cat)
    screen = screening.screen(current_seq, n, allowed, req.constraints.model_dump(), plant_md, window)
    alts = screen["selected"]
    if current_seq is not None:
        cur_checks = screening.check_sequence(current_seq, {}, plant_md, window, len(cat))
        screen["current"] = {"sequence": current_seq, "checks": cur_checks}
    if intercrop:
        screen["notes"].append({"code": "intercrop_current", "params": {}})

    # ---- soil and water environment
    irr, irr_status, irr_conditions, irr_missing = _irrigation_state(req)
    soil_report, soil = _soil_sources(req, soil_profile)
    elev = req.location.elevation if req.location.elevation is not None else (effective_elevation or 0.0)
    eto = simulate.eto_series(series, req.location.lat, elev) if soil else None
    if req.management.runoff or req.management.waterlogging:
        warnings.append("You observe runoff/waterlogging: the model assumes RO=0 and CR=0, so water results may be optimistic.")

    soil_conditions = {"demo": ["Soil values are illustrative demo assumptions"],
                       "regional": ["Soil water parameters estimated from SoilGrids with a pedotransfer function (regional estimate, not a measurement)"],
                       "farmer": []}.get(soil_report["active"], [])

    items = []
    plan = [("current", current_seq)] + [(f"alt{i+1}", a) for i, a in enumerate(alts)]
    for rid, seq in plan:
        if seq is None:
            structure = "intercrop" if intercrop else None
        else:
            structure = "monoculture" if len(set(seq)) == 1 else "rotation"
        item = {"id": rid, "sequence": seq, "structure": structure,
                "history": [h.model_dump() for h in hist] if rid == "current" else None,
                "indicators": {k: {"status": "pending", "score": None, "missing": v,
                                   "reason": "; ".join(m["item"] for m in v)} for k, v in PENDING.items()}}
        A = {"status": "pending", "score": None, "missing": [], "conditions": []}
        if rid == "current" and intercrop:
            A["reason"] = ("Crops sown together cannot be represented: the engine simulates one crop per cycle. "
                           "Not converted into a sequential rotation.")
            A["missing"] = [_missing("model", "Intercrop (association) water model")]
        elif rid == "current" and unknown:
            A["reason"] = f"Crops outside the pilot catalog: {unknown}"
            A["missing"] = [_missing("data", f"Catalog parameters for {unknown}")]
        elif not soil:
            A["reason"] = "Soil water parameters not available"
            A["missing"] = soil_report["regionalMissing"] + [
                _missing("data", "Field capacity (m3/m3)", "Farmer measurement, regional source or a published pedotransfer function"),
                _missing("data", "Wilting point (m3/m3)", "Same; SoilGrids alone does not provide it")]
        else:
            res = simulate.run_blocks(series, eto, seq, horizon_years, plant_md, soil,
                                      trace_first=(rid == "current"), shift=req.plantShiftDays,
                                      precip_scale=req.precipScale, irrigation=irr,
                                      init_frac=req.initialDepletionFraction, ks_timing=req.ksTiming)
            A.update(res)
            ok = bool(res["summary"])
            A["status"] = ("provisional" if irr_status in ("confirmed", "applied") else "conditional") if ok else "pending"
            A["score"] = res["summary"]["medianA"] if ok else None
            A["conditions"] = irr_conditions + soil_conditions
            A["missing"] = irr_missing
            if not ok:
                A["reason"] = "No valid historical block (missing critical days)"
        item["indicators"]["A"] = A
        item["overall"] = overall_from_indicators(item["indicators"])
        items.append(item)

    order = {"water": ["A", "H", "S", "E", "U"], "soil": ["S", "E", "A", "H", "U"],
             "margin": ["U", "A", "H", "S", "E"]}.get(req.management.priority or "", ["A", "H", "S", "E", "U"])
    body = req.model_dump()
    return {
        "runId": str(uuid.uuid4()), "createdUtc": datetime.now(timezone.utc).isoformat(),
        "engineVersion": ENGINE_VERSION, "catalogVersion": simulate.CATALOG["version"], "mode": "real",
        "request": body, "inputHash": hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest(),
        "sources": manifests, "elevationUsedM": elev,
        "calendar": calendar, "waterRegime": {"declared": req.waterRegime, "irrigationStatus": irr_status,
                                              "conditions": irr_conditions, "missing": irr_missing},
        "waterBalance": {"ksTiming": req.ksTiming, "order": [
            "scenario rainfall factor applied to P",
            "Ks from the depletion at the end of the previous day (previous_day) or after same-day wetting (after_wetting)",
            "inflow Q = P - RO + I + CR enters the store; drainage DP = excess over TAW",
            "ETa = min(available water, Ks x ETm); depletion updated"]},
        "soil": soil_report,
        "screening": screen,
        "viableCrops": {"allowed": allowed, "blocked": screen["blockedCrops"], "notes": screen["notes"]},
        "explanationOrder": order, "warnings": warnings,
        "rotations": items,
        "assumptions": [
            f"initial depletion = {req.initialDepletionFraction} x TAW at the start of each block (no spin-up)",
            "RO=0, CR=0 (simplification; sensitivity not yet run)",
            "root depth constant from planting at the lower bound of the FAO-56 range (no root growth)",
            "Kc climate adjustment (FAO-56 eq. 62) and wetting-frequency refinement of Kc ini not applied",
            "one cycle per year; no soil-water simulation between cycles (state carried over)",
            "alternatives are deterministic catalog candidates ordered by difference from current practice; "
            "not filtered by dominance because H, S, E, U are pending",
            "elevation for ETo = user value or NASA grid-cell elevation",
        ],
    }
