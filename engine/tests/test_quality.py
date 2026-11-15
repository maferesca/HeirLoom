from heirloom import quality as q

RAW = {"properties": {"parameter": {
    "ALLSKY_SFC_SW_DWN": {"20250101": 20.0, "20250102": -999.0},
    "PRECTOTCORR": {"20250101": 0.0, "20250102": -999.0},
    "T2M_MAX": {"20250101": 30.0}, "T2M_MIN": {"20250101": 31.0}}},
    "parameters": {"ALLSKY_SFC_SW_DWN": {"units": "MJ/m^2/day"}}}  # synthetic test payload

def test_fill_and_no_double_conversion():
    s = q.clean_series(RAW)
    assert s["ALLSKY_SFC_SW_DWN"]["20250101"] == 20.0
    assert s["ALLSKY_SFC_SW_DWN"]["20250102"] is None
    assert s["PRECTOTCORR"]["20250101"] == 0.0  # zero rain is valid, not missing

def test_kwh_converted():
    raw = {**RAW, "parameters": {"ALLSKY_SFC_SW_DWN": {"units": "kW-hr/m^2/day"}}}
    assert q.clean_series(raw)["ALLSKY_SFC_SW_DWN"]["20250101"] == 72.0

def test_alerts_and_stats():
    s = q.clean_series(RAW)
    assert q.physical_alerts(s)
    assert q.quality_stats(s)["PRECTOTCORR"]["missing"] == 1
