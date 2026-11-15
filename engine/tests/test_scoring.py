import math
import pytest
from heirloom import scoring as s

# SYNTHETIC FIXTURES (spec section 19) - arithmetic only, not real data.

def test_water_fixture():
    r = s.water_score_cycle(400, 500, 1.25)
    assert r["fraction"] == pytest.approx(0.75)
    assert r["score"] == pytest.approx(75.25)

def test_water_edges():
    assert s.water_score_cycle(500, 500, 1.25)["score"] == 100
    r = s.water_score_cycle(0, 500, 1.25)  # fraction -0.25 -> clipped
    assert r["score"] == 1 and r["clipped"]
    assert s.water_score_cycle(10, 0, 1.25) is None

def test_composite_fixture():
    A = s.geometric_mean([s.score_fraction(x) for x in [0.75, 0.885, 0.91]])
    H = s.geometric_mean([s.score_fraction(x) for x in [0.78, 0.90, 0.95]])
    assert A == pytest.approx(84.69, abs=0.01)
    assert H == pytest.approx(87.50, abs=0.01)
    S = s.normalize_p10_p90(0.90 / 3, -0.5, 0.5)
    E = s.normalize_p10_p90(4.5, 2, 10, lower_is_better=True)
    U = s.normalize_p10_p90((6000 + 7000 + 6500) / 3, -1500, 8500)
    assert S == pytest.approx(80.20) and E == pytest.approx(69.0625) and U == pytest.approx(80.20)
    assert s.overall_score(A, H, S, E, U)["display"] == 80

def test_all_100_all_1_missing():
    assert s.overall_score(100, 100, 100, 100, 100)["display"] == 100
    assert s.overall_score(1, 1, 1, 1, 1)["display"] == 1
    o = s.overall_score(50, None, 50, 50, 50)
    assert o["raw"] is None and o["missing"] == ["H"]

def test_heat_pending_without_flowering():
    assert s.heat_fraction([0, 0], [1, 1]) is None

def test_normalization_degenerate_is_pending():
    assert s.normalize_p10_p90(5, 3, 3) is None

def test_erosion_monotonic_and_margin_monotonic():
    assert s.normalize_p10_p90(3, 2, 10, True) > s.normalize_p10_p90(5, 2, 10, True)
    assert s.normalize_p10_p90(7000, -1500, 8500) > s.normalize_p10_p90(6000, -1500, 8500)

def test_round_half_up():
    assert s.round_half_up(79.5) == 80 and s.round_half_up(79.49) == 79

def test_percentile_linear():
    assert s.percentile_linear([1, 2, 3, 4, 5], 0.1) == pytest.approx(1.4)
