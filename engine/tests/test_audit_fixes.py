"""Tests for the audit follow-up: global score wiring, Ks timing, screening, soil sources and the PTF."""
from datetime import date, timedelta

import pytest

from heirloom import compare, ptf, screening, simulate, water
from heirloom.providers import soilgrids

LOC = {"lat": 17.43, "lon": -95.02, "elevation": 100}
SOIL = {"thetaFC": 0.30, "thetaWP": 0.15}


def synth(years, rain=5.0):  # SYNTHETIC series
    s = {k: {} for k in ("T2M_MAX", "T2M_MIN", "T2MDEW", "WS2M", "PS", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR")}
    d = date(years[0], 1, 1)
    while d <= date(years[1], 12, 31):
        k = d.strftime("%Y%m%d")
        s["T2M_MAX"][k] = 32.0; s["T2M_MIN"][k] = 22.0; s["T2MDEW"][k] = 20.0
        s["WS2M"][k] = 2.0; s["PS"][k] = 100.0; s["ALLSKY_SFC_SW_DWN"][k] = 18.0; s["PRECTOTCORR"][k] = rain
        d += timedelta(days=1)
    return s


def run(profile=None, **kw):
    base = dict(location=LOC, startYear=2005, endYear=2010,
                history=[{"crops": ["maize"]}, {"crops": ["bean"]}, {"crops": ["maize"]}], soil=SOIL, soilIsDemo=True)
    base.update(kw)
    return compare.build_run(compare.CompareReq(**base), synth((2005, 2010)), [], soil_profile=profile)


# ---------------------------------------------------------------- 1. global score
def test_overall_lists_only_the_four_pending_indicators():
    r = run()
    o = r["rotations"][0]["overall"]
    assert o["raw"] is None and o["display"] is None
    assert o["missing"] == ["H", "S", "E", "U"]          # water is calculated, not missing
    assert o["components"]["A"] is not None


def test_overall_with_all_five_available_uses_the_defined_weights():
    ind = {"A": {"status": "calculated", "score": 84.69}, "H": {"status": "calculated", "score": 87.50},
           "S": {"status": "calculated", "score": 80.20}, "E": {"status": "calculated", "score": 69.0625},
           "U": {"status": "calculated", "score": 80.20}}
    o = compare.overall_from_indicators(ind)
    assert o["missing"] == [] and o["display"] == 80
    # exact weights: A,H,S,E = 1/6 each, U = 1/3
    import math
    expect = math.exp((math.log(84.69) + math.log(87.5) + math.log(80.2) + math.log(69.0625)) / 6 + math.log(80.2) / 3)
    assert o["raw"] == pytest.approx(expect)


def test_overall_pending_indicator_with_a_score_is_still_missing():
    ind = {k: {"status": "calculated", "score": 50.0} for k in "AHSEU"}
    ind["H"] = {"status": "pending", "score": 99.0}
    assert compare.overall_from_indicators(ind)["missing"] == ["H"]


# ---------------------------------------------------------------- 4. Ks timing
def test_ks_uses_previous_day_deficit_and_rain_enters_after():
    taw, p = 100.0, 0.5            # RAW = 50 mm
    dr_start = 90.0                # dry soil: Ks(previous) = (100-90)/(100-50) = 0.2
    kw = dict(taw_mm=taw, p=p, precip=60.0, etm=5.0)
    prev = water.step(dr_start, ks_timing="previous_day", **kw)
    aft = water.step(dr_start, ks_timing="after_wetting", **kw)
    assert prev["dr_for_ks"] == 90.0 and prev["ks"] == pytest.approx(0.2) and prev["eta"] == pytest.approx(1.0)
    assert aft["dr_for_ks"] == pytest.approx(30.0) and aft["ks"] == 1.0 and aft["eta"] == pytest.approx(5.0)
    # both conserve mass: Wend = Wstart + P - DP - ETa
    for r in (prev, aft):
        w_end = taw - r["dr_end"]
        assert w_end == pytest.approx((taw - dr_start) + 60.0 - r["dp"] - r["eta"])
    # the rain of the day still reaches the store (depletion drops from 90 to ~31 with previous_day)
    assert prev["dr_end"] == pytest.approx(taw - (10 + 60 - 1.0))


def test_default_ks_timing_is_previous_day():
    assert water.step(90.0, taw_mm=100, p=0.5, precip=60, etm=5)["ks"] == pytest.approx(0.2)


# ---------------------------------------------------------------- 2. screening
def by_seq(r, seq):
    return next(c for c in r["screening"]["candidates"] if c["sequence"] == seq)


def test_every_candidate_has_a_concrete_decision_and_reasons():
    r = run()
    cands = r["screening"]["candidates"]
    assert len(cands) == 7 and {c["decision"] for c in cands} <= {"selected", "admitted_not_selected", "discarded"}
    assert sum(c["decision"] == "selected" for c in cands) == 2
    assert by_seq(r, ["maize", "maize", "maize"])["decision"] == "discarded"
    codes = [c["code"] for c in by_seq(r, ["maize", "maize", "maize"])["checks"] if c["status"] == "failed"]
    assert codes == ["monoculture_when_rotation_possible"]


def test_not_evaluated_is_distinct_from_met():
    r = run()
    checks = by_seq(r, ["bean", "maize", "bean"])["checks"]
    st = {c["check"]: c["status"] for c in checks}
    assert st["availability"] == st["window"] == st["overlap"] == st["structure"] == "met"
    assert st["water"] == "not_evaluated" and st["family_pests"] == "not_evaluated"
    assert r["screening"]["reviewed"] == ["availability", "window", "overlap", "structure"]
    assert r["screening"]["notEvaluated"] == ["water", "family_pests"]


def test_seed_equipment_and_buyer_constraints_become_filters():
    for field, code in (("seedUnavailable", "seed_unavailable"), ("equipmentUnsupported", "equipment_unsupported"), ("noBuyer", "no_buyer")):
        r = run(constraints={field: ["bean"]})
        assert r["viableCrops"]["blocked"] == {"bean": [code]}
        assert all("bean" not in x["sequence"] for x in r["rotations"][1:])
        assert by_seq(r, ["bean", "maize", "bean"])["decision"] == "discarded"
    # history keeps the real practice even when bean is now blocked
    assert run(constraints={"noBuyer": ["bean"]})["rotations"][0]["sequence"] == ["maize", "bean", "maize"]


def test_overlap_detected_from_cycle_duration(monkeypatch):
    crops = simulate.CATALOG["crops"]
    monkeypatch.setitem(crops["bean"], "cycleDays", {"ini": 100, "dev": 100, "mid": 100, "late": 100})  # 400 days
    r = run(window={"startMonth": 6, "startDay": 1, "endMonth": 6, "endDay": 30})
    c = by_seq(r, ["bean", "maize", "bean"])
    assert c["decision"] == "discarded"
    f = next(x for x in c["checks"] if x["check"] == "overlap")
    assert f["status"] == "failed" and f["params"]["crop"] == "bean" and f["params"]["overlapDays"] > 0


def test_window_failure_reason_present():
    chk = screening.check_sequence(["maize", "bean"], {}, (6, 15), {"startMonth": 7, "startDay": 1, "endMonth": 7, "endDay": 31}, 2)
    assert any(c["check"] == "window" and c["status"] == "failed" for c in chk)


def test_intercrop_is_its_own_structure_not_a_rotation():
    r = run(history=[{"crops": ["maize", "bean"]}, {"crops": ["maize"]}, {"crops": ["maize"]}])
    assert r["rotations"][0]["structure"] == "intercrop" and r["rotations"][0]["sequence"] is None
    assert any(n["code"] == "intercrop_current" for n in r["screening"]["notes"])


# ---------------------------------------------------------------- 3. soil: PTF and sources
def test_saxton_rawls_reference_values():
    # Reference: coefficients identical in USDA-ARS WEPP saxpar.for and in the R package rcropmod (checked 2026-11-14).
    # Hand evaluation for sand 0.40, clay 0.20, organic matter 2.5 %:
    #   t1500 = -0.0096 + 0.0974 + 0.015 + 0.005 - 0.0065 + 0.00544 + 0.031 = 0.13774
    #   wp    = 0.13774 + 0.14*0.13774 - 0.02 = 0.137024
    #   t33   = -0.1004 + 0.039 + 0.0275 + 0.006 - 0.0135 + 0.03616 + 0.299 = 0.29376
    #   fc    = 0.29376 + 1.283*0.29376**2 - 0.374*0.29376 - 0.015 = 0.27961
    # (a loam: field capacity near 0.28 and wilting point near 0.14 m3/m3 are typical for this texture)
    r = ptf.saxton_rawls(0.40, 0.20, 2.5)
    assert r["intermediate"]["t1500"] == pytest.approx(0.13774, abs=1e-5)
    assert r["intermediate"]["t33"] == pytest.approx(0.29376, abs=1e-5)
    assert r["wp"] == pytest.approx(0.137024, abs=1e-5) and r["fc"] == pytest.approx(0.27961, abs=1e-4)
    assert r["inDomain"]


def test_ptf_domain_flags():
    assert "clay_above_60pct" in ptf.saxton_rawls(0.2, 0.7, 2.0)["flags"]
    assert "om_above_8pct" in ptf.saxton_rawls(0.3, 0.3, 9.0)["flags"]
    assert ptf.om_from_soc(34.0) == pytest.approx(5.8616)


def test_soilgrids_parse_converts_units_and_detects_masked_cell():
    def layer(name, d_factor, mean):
        return {"name": name, "unit_measure": {"d_factor": d_factor},
                "depths": [{"label": "0-5cm", "range": {"top_depth": 0, "bottom_depth": 5},
                            "values": {"mean": mean, "Q0.05": None if mean is None else mean - 10, "Q0.95": None if mean is None else mean + 10}}]}
    ok = {"properties": {"layers": [layer("clay", 10, 293), layer("soc", 10, 340), layer("bdod", 100, 124)]}}
    L = soilgrids.parse(ok)[0]
    assert L["clay_pct"] == pytest.approx(29.3) and L["soc_g_kg"] == pytest.approx(34.0) and L["bdod_kg_dm3"] == pytest.approx(1.24)
    assert L["clay_pct_q05"] == pytest.approx(28.3) and L["clay_pct_q95"] == pytest.approx(30.3)
    masked = {"properties": {"layers": [layer("clay", 10, None)]}}
    assert soilgrids.parse(masked) is None


def test_soil_theta_weights_layers_by_thickness():
    soil = {"layers": [{"top": 0, "bottom": 0.5, "fc": 0.30, "wp": 0.20}, {"top": 0.5, "bottom": 1.0, "fc": 0.40, "wp": 0.20}]}
    fc, wp = simulate.soil_theta(soil, 1.0)
    assert fc == pytest.approx(0.35) and wp == pytest.approx(0.20)
    fc6, _ = simulate.soil_theta(soil, 0.6)  # 0.5 m at 0.30 + 0.1 m at 0.40 over 0.6 m
    assert fc6 == pytest.approx((0.30 * 0.5 + 0.40 * 0.1) / 0.6)


def regional_profile():
    layers = [{"label": "0-5cm", "top_cm": 0, "bottom_cm": 5, "clay_pct": 30.0, "sand_pct": 44.0, "silt_pct": 26.0, "soc_g_kg": 20.0},
              {"label": "5-15cm", "top_cm": 5, "bottom_cm": 15, "clay_pct": 30.0, "sand_pct": 44.0, "silt_pct": 26.0, "soc_g_kg": 12.0},
              {"label": "15-30cm", "top_cm": 15, "bottom_cm": 30, "clay_pct": 32.0, "sand_pct": 42.0, "silt_pct": 26.0, "soc_g_kg": 8.0},
              {"label": "30-60cm", "top_cm": 30, "bottom_cm": 60, "clay_pct": 35.0, "sand_pct": 40.0, "silt_pct": 25.0, "soc_g_kg": 5.0},
              {"label": "60-100cm", "top_cm": 60, "bottom_cm": 100, "clay_pct": 34.0, "sand_pct": 41.0, "silt_pct": 25.0, "soc_g_kg": 3.0}]
    return {"status": "ok", "layers": layers, "requested": {"lat": 1, "lon": 1}, "effective": {"lat": 1.001, "lon": 1},
            "distanceM": 111.0, "qualityFlags": ["nearest_valid_cell"], "manifest": {"product": "SoilGrids 2.0"},
            "hydraulics": ptf.profile_hydraulics(layers)}


def test_three_soil_sources_stay_separate_and_regional_drives_the_model():
    r = run(profile=regional_profile(), soilSource="regional")
    s = r["soil"]
    assert s["active"] == "regional" and not s["isDemoAssumption"]
    assert s["sources"]["demo"]["thetaFC"] == 0.30 and s["sources"]["regional"]["qualityFlags"] == ["nearest_valid_cell"]
    cyc = r["rotations"][0]["indicators"]["A"]["blocks"][0]["cycles"][0]
    assert cyc["tawMm"] == pytest.approx(cyc["awcMmPerM"] * cyc["rootDepthM"])
    assert "regional estimate" in " ".join(r["rotations"][0]["indicators"]["A"]["conditions"])


def test_regional_without_profile_reports_what_blocks_the_estimate():
    r = run(soilSource="regional", soil=None, soilIsDemo=False,
            profile={"status": "unavailable", "reason": "no valid SoilGrids cell nearby"})
    A = r["rotations"][0]["indicators"]["A"]
    assert A["status"] == "pending" and any("SoilGrids" in m["item"] for m in A["missing"])


def test_blocked_monoculture_is_not_called_the_only_option():
    r = run(constraints={"noBuyer": ["bean"]})
    c = by_seq(r, ["bean", "bean", "bean"])
    assert c["decision"] == "discarded"
    assert next(x for x in c["checks"] if x["check"] == "structure")["code"] == "monoculture_label"
    assert next(x for x in by_seq(r, ["maize", "maize", "maize"])["checks"] if x["check"] == "structure")["code"] == "monoculture_only_option"


# ---------------------------------------------------------------- calendar timeline and duplicate crops
def test_timeline_gap_days_from_cycle_length():
    r = run()
    tl = r["rotations"][0]["timeline"]
    assert tl["status"] == "ok" and tl["basis"] == "simulation_date"
    maize, bean, last = tl["cycles"]
    assert maize["plant"] == [6, 15] and maize["harvest"] == [10, 18] and maize["cycleDays"] == 125
    assert maize["gapDays"] == 240 and maize["gapFrom"] == [10, 18] and maize["gapTo"] == [6, 15]
    assert bean["cycleDays"] == 110 and bean["harvest"] == [10, 3] and bean["gapDays"] == 255
    assert "gapDays" not in last  # no next planting inside the horizon


def test_timeline_unavailable_for_intercrop_and_basis_with_window():
    r = run(history=[{"crops": ["maize", "bean"]}, {"crops": ["maize"]}, {"crops": ["maize"]}])
    tl = r["rotations"][0]["timeline"]
    assert tl["status"] == "unavailable" and tl["missing"]
    w = run(window={"startMonth": 5, "startDay": 1, "endMonth": 7, "endDay": 31})
    assert w["rotations"][0]["timeline"]["basis"] == "usual_date_with_window"


def test_same_crop_listed_twice_is_not_an_intercrop():
    r = run(history=[{"crops": ["maize", "maize"]}, {"crops": ["bean", "bean"]}, {"crops": ["maize"]}])
    cur = r["rotations"][0]
    assert cur["sequence"] == ["maize", "bean", "maize"] and cur["structure"] == "rotation"
    assert cur["history"][0]["crops"] == ["maize"]
    assert not any(n["code"] == "intercrop_current" for n in r["screening"]["notes"])


# ---------------------------------------------------------------- farmer observations
def test_observations_are_recorded_apart_from_soil_values():
    r = run(management={"soilFeel": "sticky", "waterlogging": True, "runoff": False})
    obs = {o["type"]: o for o in r["observations"]}
    assert obs["soil_texture_feel"]["value"] == "sticky" and obs["soil_texture_feel"]["usedInCalculation"] is False
    assert obs["waterlogging"]["triggersWarning"] and obs["runoff"]["triggersWarning"] is None
    assert any("runoff/waterlogging" in w for w in r["warnings"])
    # hydraulic values come only from the active source (demo here), never from the observation
    assert r["soil"]["active"] == "demo" and r["soil"]["sources"]["demo"]["thetaFC"] == 0.30


def test_unknown_answers_record_nothing_and_do_not_block_the_comparison():
    r = run(management={"soilFeel": "unknown"})
    assert r["observations"] == [] and r["warnings"] == []
    assert r["rotations"][0]["indicators"]["A"]["status"] == "provisional" or r["rotations"][0]["indicators"]["A"]["status"] == "conditional"
    assert r["rotations"][0]["indicators"]["A"]["summary"] is not None


def test_runoff_alone_triggers_the_water_warning_and_no_answer_keeps_it_off():
    assert run(management={"runoff": True})["warnings"]
    assert run(management={"runoff": False, "waterlogging": False})["warnings"] == []


def test_timeline_follows_the_scenario_planting_date():
    base = run()["rotations"][0]["timeline"]
    moved = run(plantShiftDays=4)["rotations"][0]["timeline"]
    assert base["shiftDays"] == 0 and moved["shiftDays"] == 4
    assert base["cycles"][0]["plant"] == [6, 15] and moved["cycles"][0]["plant"] == [6, 19]
    assert moved["cycles"][0]["harvest"] == [10, 22] and moved["cycles"][0]["gapFrom"] == [10, 22]
    assert moved["cycles"][0]["gapDays"] == base["cycles"][0]["gapDays"] == 240  # days between cycles do not change
