import pytest
from heirloom import eto, water

def test_eto_fao56_example18_uccle():
    # FAO-56 Example 18 (Uccle, 6 July): ETo ~ 3.9 mm/day. Rs=22.07 from sunshine hours, ea=1.409.
    v, t = eto.eto_daily(tmax=21.5, tmin=12.3, rs=22.07, u2=2.078, lat_deg=50.8, doy=187,
                         elevation_m=100, pressure_kpa=100.1, ea=1.409, return_terms=True)
    assert t["ra"] == pytest.approx(41.09, abs=0.1)
    assert v == pytest.approx(3.9, abs=0.1)

def test_eto_rejects_bad_input():
    with pytest.raises(ValueError):
        eto.eto_daily(tmax=10, tmin=20, rs=10, u2=1, lat_deg=18, doy=100, elevation_m=10, pressure_kpa=101, ea=1)

def test_water_conservation():
    taw = water.taw(0.30, 0.15, 0.6)  # 90 mm
    dr = 20.0
    start_w = taw - dr
    days = [{"precip": 30, "etm": 5}, {"precip": 80, "etm": 4}, {"precip": 0, "etm": 6}]
    res = water.run_cycle(dr, days, taw_mm=taw, p=0.5)
    end_w = taw - res["dr_end"]
    assert start_w + 110 - res["dp_sum"] - res["eta_sum"] == pytest.approx(end_w)
    assert 0 <= res["dr_end"] <= taw

def test_no_deficit_full_response():
    taw = water.taw(0.30, 0.15, 0.6)
    res = water.run_cycle(0, [{"precip": 5, "etm": 5}] * 10, taw_mm=taw, p=0.5)
    assert res["eta_sum"] == pytest.approx(res["etm_sum"])

def test_invalid_params():
    with pytest.raises(ValueError):
        water.taw(0.1, 0.2, 0.5)
