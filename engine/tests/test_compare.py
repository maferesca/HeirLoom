from datetime import date, timedelta

import pytest

from heirloom import compare, simulate, water

LOC = {"lat": 17.43, "lon": -95.02, "elevation": 100}
SOIL = {"thetaFC": 0.30, "thetaWP": 0.15}


def synth(years, rain=5.0):  # SYNTHETIC series for tests only
    s = {k: {} for k in ("T2M_MAX", "T2M_MIN", "T2MDEW", "WS2M", "PS", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR")}
    d = date(years[0], 1, 1)
    while d <= date(years[1], 12, 31):
        k = d.strftime("%Y%m%d")
        s["T2M_MAX"][k] = 32.0; s["T2M_MIN"][k] = 22.0; s["T2MDEW"][k] = 20.0
        s["WS2M"][k] = 2.0; s["PS"][k] = 100.0; s["ALLSKY_SFC_SW_DWN"][k] = 18.0; s["PRECTOTCORR"][k] = rain
        d += timedelta(days=1)
    return s


def req(**kw):
    base = dict(location=LOC, startYear=2005, endYear=2010,
                history=[{"crops": ["maize"]}, {"crops": ["bean"]}, {"crops": ["maize"]}], soil=SOIL, soilIsDemo=True)
    base.update(kw)
    return compare.CompareReq(**base)


def run(**kw):
    return compare.build_run(req(**kw), synth((2005, 2010)), [])


def test_rain_factor_applied_before_balance_10mm_to_8mm():
    s = synth((2005, 2006), rain=0.0)
    s["PRECTOTCORR"]["20050615"] = 10.0
    eto = simulate.eto_series(s, 17.43, 100)
    c = simulate.run_year_cycle(s, eto, "maize", 2005, (6, 15), SOIL, 100.0, precip_scale=0.8, trace=True)
    first = c["daily"][0]
    assert first["precipOriginalMm"] == 10.0 and first["precipAdjustedMm"] == pytest.approx(8.0)
    # balance used 8 mm: Dr_end = Dr_start - 8 + ETa (no drainage)
    assert first["drEndMm"] == pytest.approx(first["drStartMm"] - 8.0 + first["etaMm"])


def test_awc_and_root_depth_exported():
    r = run()
    cyc = r["rotations"][0]["indicators"]["A"]["blocks"][0]["cycles"][0]
    assert cyc["awcMmPerM"] == pytest.approx(150.0)
    assert cyc["rootDepthM"] == 1.0 and cyc["tawMm"] == pytest.approx(150.0)  # maize Zr 1.0 m
    bean = r["rotations"][0]["indicators"]["A"]["blocks"][0]["cycles"][1]
    assert bean["tawMm"] == pytest.approx(90.0)  # bean Zr 0.6 m
    assert r["soil"]["sources"]["demo"]["awcMmPerM"] == pytest.approx(150.0) and r["soil"]["isDemoAssumption"]
    assert r["soil"]["sources"]["farmer"] is None and r["soil"]["sources"]["regional"] is None


def test_exclude_bean_removes_alternatives_keeps_history():
    r = run(allowedCrops=["maize"])
    assert [x["id"] for x in r["rotations"]] == ["current"] or all("bean" not in (x["sequence"] or []) for x in r["rotations"][1:])
    assert r["rotations"][0]["sequence"] == ["maize", "bean", "maize"]  # real history still shown
    assert r["viableCrops"]["notes"] and r["viableCrops"]["blocked"] == {"bean": ["not_allowed"]}


def test_alternatives_default_two_with_bean():
    r = run()
    assert len(r["rotations"]) == 3 and all(len(set(x["sequence"])) >= 2 for x in r["rotations"][1:])


def test_window_changes_viable_calendars_and_flags_scenario():
    wide = run(window={"startMonth": 5, "startDay": 1, "endMonth": 7, "endDay": 31})
    narrow = run(window={"startMonth": 6, "startDay": 10, "endMonth": 6, "endDay": 20})
    v = lambda r: [c["viable"] for c in r["calendar"]["candidates"]]
    assert v(wide) != v(narrow) and all(v(wide)) and v(narrow) == [False, False, True, False, False]
    out = run(window={"startMonth": 6, "startDay": 10, "endMonth": 6, "endDay": 20}, plantShiftDays=20)
    assert out["calendar"]["scenarioOutsideWindow"] and out["warnings"]


def test_usual_date_outside_window_rejected():
    with pytest.raises(ValueError):
        run(window={"startMonth": 7, "startDay": 1, "endMonth": 7, "endDay": 31})


def test_known_irrigation_appears_in_balance_and_raises_score():
    irr = {"startMonth": 6, "startDay": 15, "endMonth": 10, "endDay": 30, "applicationMm": 25, "intervalDays": 7}
    s = synth((2005, 2010), rain=0.0)
    dry = compare.build_run(req(waterRegime="rainfed"), s, [])
    wet = compare.build_run(req(waterRegime="irrigated", irrigation=irr), s, [])
    d = dry["rotations"][0]["indicators"]["A"]; w = wet["rotations"][0]["indicators"]["A"]
    assert w["blocks"][0]["cycles"][0]["irrigationMm"] > 0 and d["blocks"][0]["cycles"][0]["irrigationMm"] == 0
    assert w["summary"]["medianA"] > d["summary"]["medianA"]
    assert wet["rotations"][0]["indicators"]["A"]["status"] == "provisional"


def test_incomplete_irrigation_is_conditional_with_missing_fields():
    r = run(waterRegime="irrigated", irrigation={"startMonth": 6, "endMonth": 9})
    A = r["rotations"][0]["indicators"]["A"]
    assert A["status"] == "conditional" and {m["item"] for m in A["missing"]} >= {"Water depth per application (mm)"}


def test_intercrop_not_converted_to_sequence():
    r = run(history=[{"crops": ["maize", "bean"]}, {"crops": ["maize"]}, {"crops": ["maize"]}])
    cur = r["rotations"][0]
    assert cur["sequence"] is None and cur["indicators"]["A"]["status"] == "pending"
    assert "sown together" in cur["indicators"]["A"]["reason"]


def test_no_soil_lists_what_engine_needs():
    r = compare.build_run(req(soil=None, soilIsDemo=False), synth((2005, 2010)), [])
    A = r["rotations"][0]["indicators"]["A"]
    assert A["status"] == "pending" and len(A["missing"]) == 2


def test_overall_stays_null_and_pending_lists_sources():
    r = run()
    for it in r["rotations"]:
        assert it["overall"]["raw"] is None
        for k in "HSEU":
            assert it["indicators"][k]["status"] == "pending" and it["indicators"][k]["missing"]


def test_priority_orders_explanations():
    assert run(management={"priority": "soil"})["explanationOrder"][0] == "S"
    assert run(management={"priority": "margin"})["explanationOrder"][0] == "U"


def test_reproducible_same_inputs_same_scores():
    a, b = run(), run()
    assert a["rotations"][0]["indicators"]["A"]["summary"] == b["rotations"][0]["indicators"]["A"]["summary"]
    assert a["inputHash"] == b["inputHash"]


def test_irrigation_window_crossing_new_year():
    from datetime import date as D
    irr = {"startMonth": 11, "startDay": 1, "endMonth": 5, "endDay": 31, "applicationMm": 30, "intervalDays": 10}
    days = simulate.irrigation_days(D(2005, 4, 1), 120, irr)
    assert days and all(d.month in (4, 5) for d in days)


def test_catalog_documented_parameters_match_values_used():
    for cid, crop in simulate.CATALOG["crops"].items():
        P = {x["name"]: x for x in crop["parameters"]}
        assert P["kc_ini"]["value"] == crop["kc"]["ini"] and P["kc_mid"]["value"] == crop["kc"]["mid"]
        assert P["kc_end"]["value"] == crop["kc"]["end"] and P["ky"]["value"] == crop["ky"]
        assert P["root_depth"]["value"] == crop["rootDepthM"] and P["depletion_fraction_p"]["value"] == crop["depletionFraction"]
        L = crop["cycleDays"]
        assert {k: P["stage_lengths"]["value"][k] for k in L} == L and P["stage_lengths"]["value"]["total"] == sum(L.values())
        assert all(x["type"] in ("bibliographic", "pilot_assumption") and x["reference"] for x in crop["parameters"])


def test_depletion_fraction_etc_adjustment():
    assert water.adjust_p(0.55, 5.0) == pytest.approx(0.55)
    assert water.adjust_p(0.55, 3.0) == pytest.approx(0.63)
    assert water.adjust_p(0.55, 10.0) == pytest.approx(0.35)
    assert water.adjust_p(0.45, 20.0) == pytest.approx(0.1)  # lower limit


def test_monoculture_label_and_explanation():
    r = run(allowedCrops=["maize"])
    alt = r["rotations"][1]
    assert alt["sequence"] == ["maize", "maize", "maize"] and alt["structure"] == "monoculture"
    assert r["rotations"][0]["structure"] == "rotation"
    assert r["viableCrops"]["notes"][0]["code"] == "single_crop_pool" and r["viableCrops"]["notes"][0]["params"]["alternative"]


def test_monoculture_current_has_no_alternative_when_only_that_crop_allowed():
    r = run(history=[{"crops": ["maize"]}] * 3, allowedCrops=["maize"])
    assert len(r["rotations"]) == 1 and r["rotations"][0]["structure"] == "monoculture"
    assert r["viableCrops"]["notes"][0]["code"] == "single_crop_pool" and not r["viableCrops"]["notes"][0]["params"]["alternative"]
