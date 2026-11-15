from datetime import date, timedelta
from heirloom import simulate as sim

def synth(years, rain, tmax=32.0):  # SYNTHETIC series for tests only
    s = {k: {} for k in ("T2M_MAX", "T2M_MIN", "T2MDEW", "WS2M", "PS", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR")}
    d = date(years[0], 1, 1)
    while d <= date(years[1], 12, 31):
        k = d.strftime("%Y%m%d")
        s["T2M_MAX"][k] = tmax; s["T2M_MIN"][k] = 22.0; s["T2MDEW"][k] = 20.0
        s["WS2M"][k] = 2.0; s["PS"][k] = 100.0; s["ALLSKY_SFC_SW_DWN"][k] = 18.0; s["PRECTOTCORR"][k] = rain
        d += timedelta(days=1)
    return s

SOIL = {"thetaFC": 0.30, "thetaWP": 0.15}

def test_wet_better_than_dry():
    s = synth((2005, 2008), 0.0); wet = synth((2005, 2008), 15.0)
    e1, e2 = sim.eto_series(s, 18, 60), sim.eto_series(wet, 18, 60)
    dry = sim.run_rotation(s, e1, ["maize"], 2005, (6, 15), SOIL)
    w = sim.run_rotation(wet, e2, ["maize"], 2005, (6, 15), SOIL)
    assert w["A"] > dry["A"]

def test_missing_day_makes_incomplete_not_zero():
    s = synth((2005, 2007), 5.0); e = sim.eto_series(s, 18, 60)
    s["PRECTOTCORR"]["20050701"] = None
    r = sim.run_rotation(s, e, ["maize"], 2005, (6, 15), SOIL)
    assert r["status"] == "incomplete"

def test_blocks_are_overlapping_windows():
    s = synth((2005, 2010), 8.0); e = sim.eto_series(s, 18, 60)
    r = sim.run_blocks(s, e, ["maize", "bean", "maize"], (2005, 2010), (6, 15), SOIL)
    assert len(r["blocks"]) == 4 and r["summary"]["validBlocks"] == 4
