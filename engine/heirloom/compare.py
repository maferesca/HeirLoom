"""Builds a rotation comparison run from farmer answers + a daily climate series.

Pure logic (no network): `build_run(req, series, manifests)` is unit-testable with synthetic series.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

from . import scoring, simulate

ENGINE_VERSION = "0.3.0"


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    elevation: Optional[float] = None


class ProfileReq(BaseModel):
    location: Location
    startYear: int = 2005
    endYear: int = 2024


class Soil(BaseModel):
    thetaFC: float
    thetaWP: float
    rootDepthM: Optional[float] = None


class HistoryEntry(BaseModel):
    """One planting cycle. More than one crop = sown together (association)."""
    crops: list[str]
    year: Optional[int] = None
    approxDate: Optional[str] = None  # free text such as "2023-06" or "mid June"


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


class CompareReq(ProfileReq):
    history: list[HistoryEntry] = []
    currentSequence: list[str] = []  # legacy shortcut: one crop per year
    plantMonth: int = 6
    plantDay: int = 15
    window: Optional[Window] = None
    waterRegime: Literal["rainfed", "irrigated", "both", "unknown"] = "unknown"
    irrigation: Optional[Irrigation] = None
    allowedCrops: Optional[list[str]] = None  # None = all catalog crops
    constraintNotes: dict = {}  # seed / equipment / buyer, free text, recorded only
    management: Management = Management()
    soil: Optional[Soil] = None
    soilIsDemo: bool = False
    initialDepletionFraction: float = Field(0.5, ge=0, le=1)
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
        _missing("data", "Soil organic carbon, bulk density, coarse fragments, clay by layer", "SoilGrids rasters not downloaded"),
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


def build_run(req: CompareReq, series: dict, manifests: list, effective_elevation: Optional[float] = None) -> dict:
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
    candidates = []
    for sh in (-30, -15, 0, 15, 30):
        md = simulate.shifted_md(plant_md, sh)
        candidates.append({"shiftDays": sh, "month": md[0], "day": md[1],
                           "viable": True if not window else simulate.in_window(md, window)})
    calendar = {"usual": list(plant_md), "window": window, "scenarioShiftDays": req.plantShiftDays,
                "scenarioDate": list(scen_md), "scenarioOutsideWindow": outside, "candidates": candidates,
                "note": None if window else "No planting window given: every date treated as viable"}
    if outside:
        warnings.append("The simulated planting date is outside your stated planting window.")

    # ---- allowed crops and alternatives
    allowed = req.allowedCrops if req.allowedCrops is not None else sorted(cat)
    alts, limit_notes = simulate.propose_alternatives(current_seq or [], allowed, n)
    if intercrop:
        limit_notes.append("Current practice has crops sown together; alternatives are catalog candidates not tied to it.")

    # ---- environment of the water model
    irr, irr_status, irr_conditions, irr_missing = _irrigation_state(req)
    soil = req.soil.model_dump(exclude_none=True) if req.soil else None
    elev = req.location.elevation if req.location.elevation is not None else (effective_elevation or 0.0)
    eto = simulate.eto_series(series, req.location.lat, elev) if soil else None
    if req.management.runoff or req.management.waterlogging:
        warnings.append("You observe runoff/waterlogging: the model assumes RO=0 and CR=0, so water results may be optimistic.")

    items = []
    plan = [("current", current_seq)] + [(f"alt{i+1}", a) for i, a in enumerate(alts)]
    for rid, seq in plan:
        item = {"id": rid, "sequence": seq,
                "structure": None if seq is None else ("monoculture" if len(set(seq)) == 1 else "rotation"),
                "history": [h.model_dump() for h in hist] if rid == "current" else None,
                "indicators": {k: {"status": "pending", "missing": v,
                                   "reason": "; ".join(m["item"] for m in v)} for k, v in PENDING.items()}}
        A = {"status": "pending", "missing": [], "conditions": []}
        if rid == "current" and intercrop:
            A["reason"] = ("Crops sown together cannot be represented: the engine simulates one crop per cycle. "
                           "Not converted into a sequential rotation.")
            A["missing"] = [_missing("model", "Intercrop (association) water model")]
        elif rid == "current" and unknown:
            A["reason"] = f"Crops outside the pilot catalog: {unknown}"
            A["missing"] = [_missing("data", f"Catalog parameters for {unknown}")]
        elif not soil:
            A["reason"] = "Soil water parameters not available"
            A["missing"] = [_missing("data", "Field capacity (m3/m3)", "Measurement, regional source or a published pedotransfer function"),
                            _missing("data", "Wilting point (m3/m3)", "Same; SoilGrids alone does not provide it")]
        else:
            res = simulate.run_blocks(series, eto, seq, horizon_years, plant_md, soil,
                                      trace_first=(rid == "current"), shift=req.plantShiftDays,
                                      precip_scale=req.precipScale, irrigation=irr,
                                      init_frac=req.initialDepletionFraction)
            A.update(res)
            A["status"] = ("provisional" if irr_status in ("confirmed", "applied") else "conditional") if res["summary"] else "pending"
            A["conditions"] = irr_conditions + (["Soil values are illustrative demo assumptions"] if req.soilIsDemo else [])
            A["missing"] = irr_missing
            if not res["summary"]:
                A["reason"] = "No valid historical block (missing critical days)"
        item["indicators"]["A"] = A
        item["overall"] = scoring.overall_score(None, None, None, None, None)
        item["overall"]["message"] = "Missing information to compute the overall score"
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
        "soil": {"given": soil, "isDemoAssumption": req.soilIsDemo,
                 "awcMmPerM": None if not soil else 1000 * (soil["thetaFC"] - soil["thetaWP"])},
        "viableCrops": {"allowed": allowed, "alternativesLimit": limit_notes},
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
