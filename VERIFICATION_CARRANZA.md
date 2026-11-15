# Verification: Jesús Carranza case (real NASA POWER and SoilGrids data)

Point 17.432993, -95.02336 · history maize → bean → maize · base planting 15 June · 2005–2024 · rainfed · shift 0 d. Engine 0.4.0, catalog 0.2.0-pilot. Parameter sources: `WATER_PARAMETERS.md`. Status against the audit list: `AUDIT_REQUIREMENTS.md`.

The same history, date and years are used in every run below. "Demo soil" = thetaFC 0.30 / thetaWP 0.15 (**illustrative assumptions, not measurements**). "Regional soil" = SoilGrids profile + Saxton & Rawls function.

## Reproduce
Run from `engine/`. These are two separate commands.

Unit tests (synthetic data only, 56 tests):

```bash
.venv/Scripts/python -m pytest
```

Verification script (calls NASA POWER and SoilGrids; writes `data/verification/carranza_*.json`):

```bash
.venv/Scripts/python scripts/verify_carranza.py
```

The first SoilGrids call for a masked point searches nearby cells and can take a couple of minutes; the result is cached in `data/soilgrids/`. In the app (`/es` or `/en`): "test case" button → use this location → see data → rainfed → soil section → "Estimate with SoilGrids" → compare → start simulator → rainfall 80 %.

## 1. Water balance order (what changed and why)
Documented in `engine/heirloom/water.py` and `METHODS.md`. Per day: the rainfall factor is applied to P; **Ks is computed with the depletion at the end of the previous day** (FAO-56 eq. 84, and the methodology DOCX: "se utiliza el déficit previo"); the day's inflow (P − RO + I + CR) enters the store; ETₐ = min(available water, Ks·ETₘ); depletion is updated; drainage is the excess over TAW. Same-day rain therefore feeds the store for the next day but does not relieve that day's stress.

Before 0.4.0 the engine computed Ks on the depletion **after** same-day wetting (the master prompt's discretization, section 10.2). The two documents disagree; the FAO-56 / DOCX order was adopted. The old order is still available (`ksTiming: "after_wetting"`) and the script reproduces the old run exactly (P10 98.3227 and 97.7460), so the comparison below is purely the effect of the order. Test `test_ks_uses_previous_day_deficit_and_rain_enters_after`: a day with 60 mm of rain after a drought gives Ks 0.2 and ETₐ 1.0 mm (previous day) versus Ks 1.0 and ETₐ 5.0 mm (after wetting); both conserve mass and both add the rain to the store.

| Demo soil | Median | P10 | P90 | Blocks changed |
|---|---|---|---|---|
| Rain 100 %, before (after-wetting) | 100.0000 | 98.3227 | 100.0 | – |
| Rain 100 %, now (previous day) | 100.0000 | 97.9340 | 100.0 | 7 of 18 (2018: 97.655 → 97.264; 2017: 98.359 → 97.937) |
| Rain 80 %, before | 99.9775 | 97.7460 | 100.0 | – |
| Rain 80 %, now | 99.9570 | 97.3552 | 100.0 | 10 of 18 (2018: 96.367 → 95.885; 2017: 97.851 → 97.424) |

At 80 % rain ten blocks drop (largest 2018, 97.264 → 95.885); the median difference (unrounded) is −0.0430, shown as "±0.0 vs. baseline". Seven blocks stay below 100 at 100 % rain and ten at 80 %.

## 2. Soil: three separate sources
- **SoilGrids (regional estimate).** The REST API answers, but the cell at the exact Carranza coordinate is masked (all values null). The adapter searched nearby and used the nearest valid cell, **556 m away** (17.4295, −95.0197), flagged `nearest_valid_cell` and `requested_cell_masked_null`. Texture by depth (clay %, Q0.05–Q0.95): 0–5 cm 29.7 (4.2–67.7), 5–15 cm 30.0, 15–30 cm 30.3, 30–60 cm 35.6, 60–100 cm 33.9; sand 39.5–44.6 %; SOC 26.4 → 3.9 g/kg. The Q0.05–Q0.95 intervals are wide and are **not** propagated into the water parameters.
- **Pedotransfer function.** Saxton & Rawls (2006), inputs sand and clay (fractions) and organic matter (% = SOC × 1.724 / 10). Coefficients were checked on 2026-11-14 against two independent published implementations that agree (USDA-ARS WEPP `saxpar.for` and the R package `rcropmod`); the paper itself could not be opened. Reference test: sand 0.40, clay 0.20, OM 2.5 % → wilting point 0.1370, field capacity 0.2796 m³/m³ (hand evaluation in the test). Result for the Carranza profile: field capacity 0.313–0.342 and wilting point 0.190–0.218 m³/m³ by layer; thickness-weighted over the root zone: maize (1.0 m) 124.1 mm/m → TAW 124.1 mm; bean (0.6 m) 125.0 mm/m → TAW 75.0 mm. Caveats: no coarse-fragment correction (cfvo is 6–7 %), and the area is classified as Vertisols with 25 % probability, a soil type this function covers poorly. The result is a regional estimate, not a measurement.
- **Farmer observation and demo values** stay as separate entries in `soil.sources`; `soil.active` says which one drives the model.

| Regional soil | Median | P10 | P90 | Blocks below 100 |
|---|---|---|---|---|
| Rain 100 % | 99.8820 | 96.9861 | 100.0 | 12 of 18 |
| Rain 80 % | 99.6378 | 96.2546 | 100.0 | 14 of 18 (14 blocks drop; largest 2018: 96.37 → 94.82) |

## 3. Overall score
`overall.missing` now lists only `H, S, E, U` for every rotation; the total stays null. With all five indicators available (unit test) the total uses the defined weights and gives 80 for the DOCX example.

## 4. Screening of alternatives (all crops allowed)
Selected: bean → maize → bean and bean → maize → maize. Admitted but not selected: maize → maize → bean, bean → bean → maize, maize → bean → bean. Discarded: bean → bean → bean and maize → maize → maize ("monoculture discarded: a rotation is possible"). Every option carries its reasons; **water compatibility and family/pest compatibility are shown as "not evaluated"**, not as "met", because no locally backed rule exists. With "no buyer for dry bean" declared, every bean-based option is discarded with that reason and the only remaining candidate is the maize monoculture, labelled as such. Cycle overlap is computed from the catalog cycle length: worst-case gap between harvest (planting at the window end + 125 d for maize) and the next planting is 240 days after maize and 255 days after bean, so no overlap here.

## 5. Daily trace and exports
`blocks[0].dailyTrace` now records `drForKsMm` (the depletion used for Ks), `ks`, `pUsed`, original and adjusted rainfall (at 80 %: 40.18 mm → 32.144 mm on 15 June 2005, before the balance) and irrigation. New JSON fields: `soil.sources`, `soil.active`, `screening`, `waterBalance`, `viableCrops.blocked`, `overall.components`.

## Remaining caveats (unchanged)
Root depth at the lower bound of the FAO range, constant from planting; stage lengths from other regions; Kc not climate-adjusted; RO = CR = 0; initial depletion 0.5 × TAW; no soil-water simulation between cycles.
