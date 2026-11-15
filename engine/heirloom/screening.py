"""Screening of candidate crop sequences: why each option is admitted or discarded.

Checks (each yields met | failed | not_evaluated with a machine code and parameters; the UI renders the text):
  availability  crop allowed by the farmer and not blocked by a declared seed, equipment or buyer constraint
  window        usual planting date inside the stated planting window
  overlap       harvest of cycle j (worst case: planting at the window end) before the earliest planting of j+1
  structure     monoculture is only admitted when no rotation (>= 2 crops) is possible
  water / family_pests  compatibility between successive crops: NOT evaluated, because no locally backed
                        rule exists (the master prompt forbids universal bonuses or penalties without a local source)
Admitted = no failed check. 'not_evaluated' never discards an option, and it is shown as such,
distinct from 'met' ("meets the reviewed restrictions").
Selection among admitted options is deterministic: largest difference from the current practice, then
alphabetical order. Dominance on indicators is NOT used (H, S, E, U are pending).
"""
from __future__ import annotations

from datetime import date, timedelta
from itertools import product

from . import simulate

REF_YEAR = 2001  # non-leap reference year for month/day arithmetic


def _cycle_days(crop_id: str) -> int:
    return sum(simulate.CATALOG["crops"][crop_id]["cycleDays"].values())


def _md(year: int, md: tuple[int, int]) -> date:
    return date(year, md[0], md[1])


def blocked_crops(allowed: list[str], constraints: dict) -> dict[str, list[str]]:
    """crop -> list of reason codes for every catalog crop that cannot be used."""
    out: dict[str, list[str]] = {}
    for c in simulate.CATALOG["crops"]:
        reasons = []
        if c not in allowed:
            reasons.append("not_allowed")
        if c in constraints.get("seedUnavailable", []):
            reasons.append("seed_unavailable")
        if c in constraints.get("equipmentUnsupported", []):
            reasons.append("equipment_unsupported")
        if c in constraints.get("noBuyer", []):
            reasons.append("no_buyer")
        if reasons:
            out[c] = reasons
    return out


def check_sequence(seq: list[str], blocked: dict, plant_md, window, pool_size: int) -> list[dict]:
    checks = []
    bad = {c: blocked[c] for c in dict.fromkeys(seq) if c in blocked}
    if bad:
        for c, reasons in bad.items():
            for r in reasons:
                checks.append({"check": "availability", "status": "failed", "code": r, "params": {"crop": c}})
    else:
        checks.append({"check": "availability", "status": "met", "code": "all_crops_available", "params": {"crops": sorted(set(seq))}})

    # calendar: usual date in window
    if window and not simulate.in_window(plant_md, window):
        checks.append({"check": "window", "status": "failed", "code": "date_outside_window", "params": {}})
    else:
        checks.append({"check": "window", "status": "met",
                       "code": "date_in_window" if window else "no_window_all_viable", "params": {}})

    # overlap: worst-case harvest of each cycle vs earliest planting of the next
    wmd_start = (window["startMonth"], window.get("startDay", 1)) if window else plant_md
    wmd_end = (window["endMonth"], window.get("endDay", 28)) if window else plant_md
    worst_gap = None
    failed = None
    for j in range(len(seq) - 1):
        harvest = _md(REF_YEAR, wmd_end) + timedelta(days=_cycle_days(seq[j]))
        next_plant = _md(REF_YEAR + 1, wmd_start)
        gap = (next_plant - harvest).days
        if worst_gap is None or gap < worst_gap:
            worst_gap = gap
        if gap < 0 and failed is None:
            failed = {"crop": seq[j], "days": _cycle_days(seq[j]), "overlapDays": -gap, "cycle": j + 1}
    if len(seq) > 1:
        if failed:
            checks.append({"check": "overlap", "status": "failed", "code": "cycles_overlap", "params": failed})
        else:
            checks.append({"check": "overlap", "status": "met", "code": "no_overlap", "params": {"minGapDays": worst_gap}})

    n_distinct = len(set(seq))
    if n_distinct == 1 and pool_size >= 2:
        checks.append({"check": "structure", "status": "failed", "code": "monoculture_when_rotation_possible", "params": {}})
    else:
        if n_distinct > 1:
            code = "rotation"
        elif bad:
            code = "monoculture_label"  # blocked crop: the structure label is informative only
        else:
            code = "monoculture_only_option"
        checks.append({"check": "structure", "status": "met", "code": code, "params": {}})

    checks.append({"check": "water", "status": "not_evaluated", "code": "water_rule_missing", "params": {}})
    fam = [simulate.CATALOG["crops"][c]["family"] for c in seq]
    checks.append({"check": "family_pests", "status": "not_evaluated", "code": "family_pest_rule_missing",
                   "params": {"families": fam}})
    return checks


def screen(current: list[str] | None, n: int, allowed: list[str], constraints: dict, plant_md, window, k: int = 2) -> dict:
    blocked = blocked_crops(allowed, constraints)
    pool = [c for c in simulate.CATALOG["crops"] if c not in blocked]
    all_crops = sorted(simulate.CATALOG["crops"])
    cands = []
    for s in product(all_crops, repeat=n):
        s = list(s)
        if current is not None and s == current:
            continue
        checks = check_sequence(s, blocked, plant_md, window, len(pool))
        admitted = not any(c["status"] == "failed" for c in checks)
        cands.append({"sequence": s, "structure": "monoculture" if len(set(s)) == 1 else "rotation",
                      "checks": checks, "admitted": admitted})
    adm = [c for c in cands if c["admitted"]]
    ref = current or []
    adm.sort(key=lambda c: (-sum(a != b for a, b in zip(c["sequence"], ref)), c["sequence"]))
    chosen = {tuple(c["sequence"]) for c in adm[:k]}
    for i, c in enumerate(adm):
        c["rank"] = i + 1
    for c in cands:
        c["decision"] = ("selected" if tuple(c["sequence"]) in chosen
                         else "admitted_not_selected" if c["admitted"] else "discarded")
    cands.sort(key=lambda c: ({"selected": 0, "admitted_not_selected": 1, "discarded": 2}[c["decision"]], c.get("rank", 99), c["sequence"]))
    notes = []
    if len(pool) == 1:
        notes.append({"code": "single_crop_pool", "params": {"crop": pool[0], "alternative": bool(adm)}})
    elif len(adm) < k:
        notes.append({"code": "few_alternatives", "params": {"count": len(adm), "blocked": blocked}})
    return {"candidates": cands, "selected": [c["sequence"] for c in cands if c["decision"] == "selected"][:k],
            "blockedCrops": blocked, "notes": notes,
            "reviewed": ["availability", "window", "overlap", "structure"],
            "notEvaluated": ["water", "family_pests"]}
