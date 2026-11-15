# Audit requirements: status tracker

Same 42 DOCX requirements (`Heirloom_Metodologia_de_puntuacion.docx`, sections 1–9) and the same 12 master-prompt requirements as the first audit (commit `3e39d76`), re-assessed on engine 0.4.0. Scoring: Cumple = 1, Parcial = 0.5, Pendiente = 0, equal weight. These percentages are audit estimates, not a certification.
Evidence type: **real** (NASA/SoilGrids/API), **unit** (test with synthetic data), **internal** (code or on-screen text only).

## DOCX requirements (42)

| # | Requirement | Before | Now | Evidence |
|---|---|---|---|---|
| 1 | Compares three rotations for the same location and period | Cumple | Cumple | `compare.py` plan list; API run (real) |
| 2 | Overall score 1–100 per rotation from five indicators | Pendiente | Pendiente | `overall.raw = null`; only A is available |
| 3 | Original unit → 1–100 → weighted geometric mean | Parcial | Parcial | Real chain only for water; `overall_from_indicators` wired and tested (unit) |
| 4 | Same location, reference area, period, limits and weights in the simulator | Parcial | Parcial | Unchanged; the 1 ha reference is still implicit |
| 5 | ET₀ Penman–Monteith | Cumple | Cumple | `eto.py`; FAO-56 example 18 (unit) |
| 6 | ETₘ = Kc × ET₀ by stage | Cumple | Cumple | `simulate.py:kc_curve`; `WATER_PARAMETERS.md` |
| 7 | Water balance with P, RO, I, CR, ETₐ, DP, initial moisture and soil/root parameters | Parcial | Parcial | RO = CR = 0 and initial depletion remain assumptions; soil can now come from SoilGrids + PTF |
| 8 | TAW, RAW, Kₛ | Cumple | Cumple | `water.py` + tests |
| 9 | ETₐ = Kₛ·Kc·ET₀ with the deficit before the day's ET | Parcial | **Cumple** | `water.step` default `previous_day`; `test_ks_uses_previous_day_deficit_and_rain_enters_after` (unit); Carranza before/after (real) |
| 10 | rₐ, A[j] = 1 + 99·clip, out-of-range flag | Cumple | Cumple | `scoring.py`; `clipped` in JSON |
| 11 | Ky for the whole cycle (1.25 / 1.15) | Cumple | Cumple | `catalog.json` |
| 12 | 75.25-point example | Cumple | Cumple | unit test |
| 13 | Daily Kₕ from AquaCrop (logistic) | Pendiente | Pendiente | `heat.py` placeholder, unverified |
| 14 | H[j] weighted by flowering fraction | Parcial | Parcial | `heat_fraction` tested, not wired |
| 15 | Moving planting moves flowering and temperatures | Pendiente | Pendiente | no phenology |
| 16 | Missing thresholds or flowering → H pending | Cumple | Cumple | API shows H pending with `missing` |
| 17 | RothC monthly model | Pendiente | Pendiente | not integrated |
| 18 | ΔC = (Cf − Ci)/N | Pendiente | Pendiente | no code |
| 19 | Horizon and residue provenance documented | Parcial | Parcial | unchanged |
| 20 | RothC domain (no permanent waterlogging) | Pendiente | Pendiente | only a warning for water |
| 21 | Erosion A = R·K·LS·C·P | Pendiente | Pendiente | no module |
| 22 | C by stage incl. periods between crops | Pendiente | Pendiente | no code |
| 23 | R from GloREDa, slope from INEGI | Pendiente | Pendiente | no data |
| 24 | Rainfall alone is not enough for R | Cumple | Cumple | E stays pending in scenarios |
| 25 | Margin M = Σ(Y·p − C)/N | Pendiente | Pendiente | no module |
| 26 | Yield from AquaCrop/DGSIAP; FIRA prices and costs | Pendiente | Pendiente | no data |
| 27 | Farmer costs adjust the budget | Parcial | Parcial | captured, unused |
| 28 | Water and heat with 1 + 99x | Parcial | Parcial | heat not wired |
| 29 | Geometric mean, equal weight per cycle | Cumple | Cumple | `simulate.py` |
| 30 | P10–P90 rescale with regional references | Parcial | Parcial | no reference sample |
| 31 | Same limits when moving the simulator; P10 = P90 → pending | Parcial | Parcial | no limits to keep |
| 32 | Exact weights 1/6, 1/6, 1/6, 1/6, 1/3 | Cumple | Cumple | `scoring.py`; `/api/methodology` |
| 33 | Global formula, rounding at the end | Cumple | Cumple | unit test |
| 34 | Missing component → total pending (no 50, no reweighting) | Parcial | **Cumple** | `compare.overall_from_indicators` reads the real indicators; `overall.missing = [H,S,E,U]` (real API run); `test_overall_with_all_five_available_uses_the_defined_weights` and `test_overall_lists_only_the_four_pending_indicators` (unit) |
| 35 | Full 80/100 example | Cumple | Cumple | unit test |
| 36 | Simulator recomputes affected indicators | Parcial | Parcial | only water |
| 37 | Shows new score and difference vs. baseline | Parcial | Parcial | water indicator only; total pending |
| 38 | Sentences generated after the calculation | Pendiente | Pendiente | only fixed labels and reason text; no sentence module |
| 39 | Missing data is named | Cumple | Cumple | `missing` lists; global message now names H, S, E, U |
| 40 | Validation against held-out yields | Pendiente | Pendiente | no data |
| 41 | Correlations between indicators | Pendiente | Pendiente | no code |
| 42 | Sensitivity of weights and limits | Pendiente | Pendiente | only water-parameter sensitivities |

Tally: **Cumple 16, Parcial 11, Pendiente 15** → (16 + 5.5) / 42 = **21.5 / 42 = 51.2 %** (was 20.5 / 42 = 48.8 %; items 9 and 34 moved from Parcial to Cumple).

Functional indicators: still **1 of 5** (water). Weight of that indicator in the global index: **1/6 of 1 = 16.7 %**.

## Master-prompt requirements (12, reported apart)

| # | Requirement | Before | Now | Evidence |
|---|---|---|---|---|
| M1 | Soil texture/profile from SoilGrids | Pendiente | **Parcial** | `providers/soilgrids.py`; live profile for the Carranza point (nearest valid cell, 556 m; the exact cell is masked); cached in `data/soilgrids/`. Parcial: nearest-cell substitute, 250 m, no propagated uncertainty |
| M2 | Farmer observations recorded and used | Parcial | Parcial | residues/cover still not used in calculations |
| M3 | Documented method for field capacity and wilting point | Pendiente | **Cumple** | `ptf.py` Saxton & Rawls (2006); coefficients checked against two independent published implementations; reference test (unit) and Carranza profile (real). Caveat: poor coverage of Vertisols; no gravel correction |
| M4 | Demo soil values labelled as editable assumptions | Cumple | Cumple | now one of three separate sources (`soil.sources`) |
| M5 | Allowed-crop restriction applied in the engine | Cumple | Cumple | `screening.blocked_crops` |
| M6 | Calendar filter | Parcial | **Cumple** | window check + cycle-overlap check from cycle duration with a reason per option; `test_overlap_detected_from_cycle_duration` (unit), screening panel (real) |
| M7 | Water compatibility between successive crops | Pendiente | Pendiente | reported as **not evaluated** (no backed rule), distinct from "met" |
| M8 | Family and pest rules with a local source | Pendiente | Pendiente | reported as not evaluated; families shown as information |
| M9 | Equipment and market constraints as rules | Pendiente | **Cumple** | structured filters `seedUnavailable`, `equipmentUnsupported`, `noBuyer`; `test_seed_equipment_and_buyer_constraints_become_filters` (unit) and UI (real) |
| M10 | Deterministic non-dominated selection | Pendiente | Pendiente | selection is deterministic and explained, but by difference from the current practice, not dominance |
| M11 | Crops sown together are not converted | Cumple | Cumple | structure `intercrop` is now its own label |
| M12 | No forced three options; monoculture labelled | Cumple | Cumple | unchanged, reasons now concrete |

Tally: Cumple = M3, M4, M5, M6, M9, M11, M12 (7); Parcial = M1, M2 (2); Pendiente = M7, M8, M10 (3). → (7 + 1) / 12 = **8 / 12 = 66.7 %** (was 5 / 12 = 41.7 %).
