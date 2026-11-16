# Heirloom: project reference (data, calculations, sources)

This file is the single reference for **what Heirloom computes, with which data, with which formulas, and how to check it**. Every claim points to a file and line in this repository, to an exported run, or to a test. Engine version **0.6.1**, crop catalog **0.2.0-pilot**. Figures were re-checked on 2026-11-15 against the running engine.

Other documents go deeper on one topic: [`WATER_PARAMETERS.md`](WATER_PARAMETERS.md) (every crop parameter and its FAO-56 table), [`VERIFICATION_CARRANZA.md`](VERIFICATION_CARRANZA.md) (the reproducible case), [`METHODS.md`](METHODS.md), [`LIMITATIONS.md`](LIMITATIONS.md), [`VALIDATION.md`](VALIDATION.md), [`AUDIT_REQUIREMENTS.md`](AUDIT_REQUIREMENTS.md), [`JUDGING_EVIDENCE.md`](JUDGING_EVIDENCE.md).

---

## 1. The question and the scope

**Question:** *What could I plant next, and why does this option fit my land and my constraints?*

Heirloom compares crop rotations (one crop per cycle, maize and dry bean in the pilot) for one location. It combines:
- **NASA POWER** daily climate records (2005–2024) for the point,
- a **SoilGrids 2.0** regional soil estimate converted to soil water parameters,
- **FAO-56** crop parameters,
- what the **farmer** declares: crop history, planting date, water regime, crops they can plant and seed, equipment or buyer constraints.

For each candidate rotation it shows the crops and dates per cycle, why the option appears (rule checks), the days between harvest and the next planting, and a **water indicator** (how much of the crop's water demand the rain covers, as relative yield on a 1–100 scale) over 18 historical periods.

**What it does not do (yet):** heat, soil carbon, erosion and profit indicators are pending, so there is **no overall score** and Heirloom does not say which option is better. It is a historical reconstruction, not a forecast, and it is not validated in the field. It is an exploration tool, not agronomic advice, and it is not endorsed by NASA.

---

## 2. Architecture and repository map

```
web (Next.js) ──HTTP──> engine (FastAPI, Python) ──> NASA POWER API, SoilGrids API
    │                          │
 Mapbox map/search        engine/data/catalog.json (FAO-56 crop parameters)
                          engine/data/soilgrids/   (cached soil profiles)
```

| Path | What it holds |
|---|---|
| `engine/heirloom/api.py` | HTTP endpoints (section 10) |
| `engine/heirloom/providers/nasa_power.py` | NASA POWER daily download, fill values, manifest |
| `engine/heirloom/providers/soilgrids.py` | SoilGrids point profile, nearest valid cell, cache |
| `engine/heirloom/quality.py` | Data completeness and the monthly climate summary |
| `engine/heirloom/eto.py` | FAO-56 Penman–Monteith reference evapotranspiration |
| `engine/heirloom/ptf.py` | Saxton & Rawls (2006) field capacity and wilting point |
| `engine/heirloom/water.py` | Daily soil-water balance, TAW, Ks, daily p |
| `engine/heirloom/simulate.py` | Kc curve, cycles, rotations, historical blocks |
| `engine/heirloom/scoring.py` | Water score, geometric mean, percentiles, overall score |
| `engine/heirloom/screening.py` | Rules that admit or discard each candidate rotation |
| `engine/heirloom/compare.py` | Builds a run: soil source, timeline, indicators, notices |
| `engine/heirloom/heat.py` | Heat indicator placeholder (pending, not used in runs) |
| `engine/data/catalog.json` | Crop parameters (maize, dry bean) |
| `engine/data/soilgrids/` | Cached SoilGrids profile for the pilot point |
| `engine/tests/` | 63 unit tests |
| `engine/scripts/verify_carranza.py` | Reproduces the reference case with live data |
| `data/verification/` | Exported reference runs (JSON) |
| `web/components/Journey.tsx` | The whole user journey (map → climate → answers → results) |
| `web/lib/i18n.ts`, `engineText.ts`, `screeningText.ts` | Spanish and English texts |
| `scripts/` | Generators of the website's illustrations (procedural SVG) |
| `video/` | Demo video project (Remotion), see `video/AI_DISCLOSURE.md` |

---

## 3. What the user does and what changes

Status: **UI** = works in the interface and the engine; **Engine** = only in the engine or tests; **Pending** = not built.

| Step | User action | Result | Where | Status |
|---|---|---|---|---|
| Location | Search a locality, press the test case, or type lat/lon | Point fixed; climate is requested | `Journey.tsx:135-178` | UI (search needs a Mapbox token) |
| Climate | Pick a month on the chart | Median monthly rain and mean temperature together; "View source" shows API version, grid cell and data quality | `quality.py:44-64` | UI |
| Crop history | One crop per cycle (+ "planted together with", approximate date) | Defines the current practice | `compare.py:273` | UI. Intercrops → water pending; approximate date is stored only |
| "?" guides | Open a field guide | Plain question, what to observe, answers incl. "I don't know" | `web/components/HelpedField.tsx` | UI. Observations are recorded, never change soil values (`compare.py:194-201`) |
| Planting date / window | Usual date; optional window | Candidate dates marked viable or not | `compare.py` calendar | UI |
| Water regime | Rainfed, irrigated or both (+ window, depth, interval) | Rainfed: I = 0; irrigated: applications on schedule | `simulate.py:67-86` | UI |
| Soil source | Regional (SoilGrids), my values, or illustrative demo | Changes FC and WP used by the balance | `compare.py:211-255` | UI |
| Constraints | Tick "no seed / equipment / buyer" per crop | Options with that crop are discarded with a reason | `screening.py:33-45` | UI |
| Results | Read the cards | Crops, dates, "Why this option appears", water indicator | `screening.py`, `compare.py` | UI |
| Between harvest and planting | Read the timeline | Days without a crop and their dates | `compare.py:147-166` | UI |
| Simulator | Shift planting (±30 d) or scale rain (70–130 %) | Baseline vs adjusted water indicator + one sentence | `simulate.py:106` | UI |
| Export | "Export JSON" | Full run with sources, soil, daily trace of the first block | `api.py:115` | UI |
| Heat, carbon, erosion, profit, overall score | — | Listed as pending with what is missing | `/api/methodology` | Pending |
| Water/pest compatibility between crops | — | Reported "not evaluated" | `screening.py` | Pending |

---

## 4. Data sources

| Source | Link | Variables and units | Period and resolution | Used for | License / credit |
|---|---|---|---|---|---|
| **NASA POWER** daily point API, v2.10.3, community AG | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ | `T2M_MAX`, `T2M_MIN`, `T2M`, `T2MDEW` (°C); `WS2M` (m/s); `PS` (kPa); `ALLSKY_SFC_SW_DWN` (MJ/m²/day); `PRECTOTCORR` (mm/day); `RH2M` (%) downloaded, not used | 2005-01-01 to 2024-12-31, daily, UTC, 4 requests of 5 years. Regional grid cell (POWER meteorology ½° × ⅝°, solar 1°, see POWER docs). Pilot cell: 17.433, −95.023, elevation 121.65 m | Rain in the water balance; all others → ETo; `T2M` and `PRECTOTCORR` → monthly chart; cell elevation → ETo | NASA POWER; not an endorsement |
| **SoilGrids 2.0** (ISRIC) REST point query | https://www.isric.org/explore/soilgrids | clay, sand (%), soil organic carbon (g/kg); silt, bulk density, coarse fragments downloaded, not used; mean and Q0.05–Q0.95 | 5 depths (0–5, 5–15, 15–30, 30–60, 60–100 cm), 250 m | Field capacity and wilting point per layer → TAW | CC BY 4.0, cite ISRIC |
| **FAO-56** (Allen et al., 1998) | https://www.fao.org/4/x0490e/x0490e00.htm | Kc, stage lengths, root depth, depletion fraction p, Ky | — | Crop water demand and response | FAO |
| **Saxton & Rawls (2006)** | https://doi.org/10.2136/sssaj2005.0117 | Pedotransfer coefficients | — | FC and WP from texture and organic matter | Published method |
| **Mapbox** (with OpenStreetMap and Maxar imagery) | https://www.mapbox.com/ | Map tiles, satellite imagery, geocoding | — | Display and search only; not in calculations | © Mapbox © OpenStreetMap © Maxar |

Every run records its sources: NASA POWER URL, retrieval time, sha256, API version, fill value and units in `sources`; the SoilGrids URL, retrieval time, sha256, resolution and license in `soil.sources.regional.manifest`.

### Data path: source → variable → calculation → what the user sees

```
NASA POWER PRECTOTCORR ──× rain factor──> P (mm/day) ──> daily water balance ──> ETa ──┐
NASA POWER T2M_MAX/MIN, T2MDEW, WS2M, PS, ALLSKY_SFC_SW_DWN + cell elevation           │
   ──> ETo (FAO-56) ──× Kc (catalog) ──> ETm (crop demand) ────────────────────────────┤
SoilGrids clay, sand, SOC ──> Saxton & Rawls ──> FC, WP per layer ──> root-zone FC, WP │
   ──× root depth (catalog) ──> TAW, RAW ───────────────────────────────────────────────┤
Catalog Ky ──> relative yield 1 − Ky(1 − ΣETa/ΣETm) ──> score 1–100 per cycle <────────┘
   ──> geometric mean per rotation ──> 18 historical blocks ──> median and P10 on the card
Farmer answers ──> history, dates, allowed crops, constraints ──> screening rules ──> which options appear and why
NASA POWER PRECTOTCORR, T2M ──> monthly median rain, mean temperature ──> climate chart
Catalog stage lengths + usual date ──> harvest dates ──> days between harvest and planting
```

### Kinds of data

| Kind | Examples | Shown as |
|---|---|---|
| Farmer observation | History, dates, water regime, allowed crops, constraints, soil feel, waterlogging, runoff | "Your answers"; observations are recorded, never converted into soil numbers |
| Regional estimate | NASA POWER grid cell; SoilGrids 250 m cell | Labelled "regional grid cell" / "regional estimate, not a measurement" |
| Bibliographic parameter | FAO-56 Kc, stage lengths, root depth, p, Ky | `WATER_PARAMETERS.md` with table numbers |
| Illustrative value | Demo soil FC 0.30 / WP 0.15; website illustrations | Labelled "illustrative" / "AI-generated visuals" |

**Active soil source in the Jesús Carranza case: `regional`** (`soil.active = "regional"` in the run). The requested SoilGrids cell is masked (no data), so the nearest valid cell is used: 17.429458, −95.019655, **556 m** away (`qualityFlags: requested_cell_masked_null, nearest_valid_cell`).

---

## 5. Crop parameters (catalog 0.2.0-pilot)

Full sources per value in [`WATER_PARAMETERS.md`](WATER_PARAMETERS.md); file `engine/data/catalog.json`.

| Crop | Stages ini/dev/mid/late (days) | Cycle | Kc ini / mid / end | Root depth Zr | p | Ky | Family |
|---|---|---|---|---|---|---|---|
| Maize | 20 / 35 / 40 / 30 | 125 d | 0.30 / 1.20 / 0.60 | 1.0 m | 0.55 | 1.25 | Poaceae |
| Dry bean | 20 / 30 / 40 / 20 | 110 d | 0.40 / 1.15 / 0.35 | 0.6 m | 0.45 | 1.15 | Fabaceae |

---

## 6. Calculations

Units: mm/day unless stated. Each step names the code that runs it. Section 6.11 lists what is **not** run.

### 6.1 Reference evapotranspiration, ETo (FAO-56 Penman–Monteith) — `engine/heirloom/eto.py`

| Quantity | Formula | Line |
|---|---|---|
| Saturation vapour pressure | e°(T) = 0.6108 · exp(17.27 T / (T + 237.3)) [kPa] | `eto.py:8` |
| es, ea | es = (e°(Tmax) + e°(Tmin)) / 2; ea = e°(Tdew) | `eto.py:25-27` |
| Slope Δ, psychrometric γ | Δ = 4098 · e°(Tmean) / (Tmean + 237.3)²; γ = 0.000665 · P | `eto.py:28-29` |
| Extraterrestrial radiation | dr = 1 + 0.033 cos(2πJ/365); δ = 0.409 sin(2πJ/365 − 1.39); Ra = (24·60/π) · 0.0820 · dr · [ωs sin φ sin δ + cos φ cos δ sin ωs] | `eto.py:31-36` |
| Net radiation | Rso = (0.75 + 2·10⁻⁵ z) Ra; Rns = 0.77 Rs; Rnl = σ[(Tmax,K⁴ + Tmin,K⁴)/2](0.34 − 0.14√ea)(1.35 Rs/Rso − 0.35), Rs/Rso ≤ 1; Rn = Rns − Rnl; G = 0 | `eto.py:37-45` |
| **ETo** | ETo = [0.408 Δ (Rn − G) + γ · 900/(T + 273) · u₂ (es − ea)] / [Δ + γ (1 + 0.34 u₂)] | `eto.py:46` |

T in °C, P in kPa, u₂ wind at 2 m (m/s), Rs solar radiation (MJ/m²/day), z elevation (m), J day of year, φ latitude, σ = 4.903·10⁻⁹. A day with any missing input has no ETo (never patched; `simulate.py:25-40`). Tested against FAO-56 Example 18.

### 6.2 Crop demand, ETm — `simulate.py:16-22, 106`
Kc is constant in the initial stage, linear during development, constant mid-season and linear in the late stage. **ETm = Kc · ETo** (single crop coefficient).

### 6.3 Soil water parameters — `ptf.py:19-38`, `simulate.py:43-64`
Saxton & Rawls (2006), S and C as fractions, OM in % by weight = SOC (g/kg) × 1.724 / 10:
- θ1500t = −0.024S + 0.487C + 0.006OM + 0.005S·OM − 0.013C·OM + 0.068SC + 0.031; **θWP** = θ1500t + (0.14 θ1500t − 0.02)
- θ33t = −0.251S + 0.195C + 0.011OM + 0.006S·OM − 0.027C·OM + 0.452SC + 0.299; **θFC** = θ33t + (1.283 θ33t² − 0.374 θ33t − 0.015)

Root-zone values: thickness-weighted mean over 0–Zr. Carranza: maize (Zr 1.0 m) FC 0.330, WP 0.206; bean (Zr 0.6 m) FC 0.331, WP 0.206 (m³/m³).

### 6.4 Available water — `water.py:19-31, 50-52`
- **TAW** = 1000 (θFC − θWP) · Zr [mm] → Carranza maize 124.1 mm, bean 75.0 mm
- **RAW** = p · TAW, with p adjusted daily: p = p_table + 0.04 (5 − ETc), limited to 0.1–0.8 (FAO-56 Table 22, footnote 2)

### 6.5 Daily water balance — `water.py:34-47`, `simulate.py:106`
Order within one day:
1. P′ = P × rain factor (the simulator's rainfall %; 1.0 in the base run)
2. Ks from the depletion at the end of the previous day: Ks = 1 if Dr(i−1) ≤ RAW, else Ks = (TAW − Dr(i−1)) / (TAW − RAW)
3. Q = P′ − RO + I + CR (RO = CR = 0; I = 0 when rainfed); DP = max(0, W₀ + Q − TAW); W_wet = min(TAW, W₀ + Q)
4. **ETa = min(W_wet, Ks · ETm)**
5. Dr(i) = TAW − (W_wet − ETa)

Dr = root-zone depletion (mm), W = stored water (mm), DP = deep percolation, RO = runoff, I = irrigation, CR = capillary rise. Mass is conserved (tested).

### 6.6 Water score per cycle — `scoring.py:20-46`, `simulate.py:110`
- rₐ = 1 − Ky (1 − ΣETa / ΣETm) (relative yield, FAO-33 / FAO-56 Table 24)
- **A_cycle = 1 + 99 · clip(rₐ, 0, 1)**

### 6.7 Rotation — `simulate.py:121-140`
A_rotation = (Π A_cycle)^(1/n) (geometric mean of the n cycles). One cycle per year; the soil-water state passes from one cycle to the next. Initial Dr = 0.5 · TAW.

### 6.8 Historical aggregation — `simulate.py:152-168`, `scoring.py:57-64`
Overlapping 3-year blocks starting in 2005, 2006 … 2022 (**18 blocks**, 2005–2024). The card shows the **median**; details show P10 and P90 (linear interpolation, unrounded in the JSON). The blocks overlap, so they are not independent samples.

### 6.9 Worked example (illustrative numbers, the engine's formula)
Maize cycle with ΣETa = 400 mm and ΣETm = 500 mm:
400 ÷ 500 = 0.80 → 1 − 1.25 (1 − 0.80) = 0.75 → 1 + 99 × 0.75 = **75.25 points**. The same fixture is tested in `engine/tests/test_scoring.py`.

### 6.10 Days between harvest and planting — `compare.py:147-166`
harvest = planting date + Σ stage days (maize 125, bean 110); **gap = 365 − cycle days** → after maize **240 days** (18 Oct → 15 Jun), after bean **255 days** (3 Oct → 15 Jun). Calendar only: cover between cycles is "no data" unless declared; carbon and erosion are pending.

### 6.11 Screening rules — `screening.py`
For every sequence of the allowed crops other than the current practice (3 cycles, 2 crops → 2³ − 1 = 7 candidates):
- **availability**: crop allowed and not blocked by a declared seed, equipment or buyer constraint (`screening.py:33-45`)
- **window**: planting dates inside the declared window
- **overlap**: each harvest ends before the next planting (`screening.py:68-85`)
- **structure**: monoculture discarded when a rotation is possible (`screening.py:89`)
- **water between crops** and **family/pests**: reported *not evaluated* (no sourced rule)

Admitted options are ordered by difference from the current practice, then alphabetically; two are shown. This is not a dominance (Pareto) selection.

### 6.12 Not run in a real run
| Formula | Where | Why |
|---|---|---|
| Overall = round(A^(1/6) H^(1/6) S^(1/6) E^(1/6) U^(1/3)) | `scoring.py:74-81` | H, S, E, U missing → `overall.raw = null`; tested with synthetic fixtures only |
| Heat Kh (AquaCrop) | `heat.py`, `scoring.py:49-54` | Official function not verified; pending |
| P10/P90 normalization for S, E, U | `scoring.py:67-71` | No frozen regional reference sample |
| Ks after same-day wetting | `water.py:43` (`ks_timing="after_wetting"`) | Kept only for comparison |

---

## 7. Reference case: Jesús Carranza, Veracruz

**Inputs** (button "Try the Jesús Carranza case"): point 17.432993, −95.02336 (locality, not a plot); 2005–2024; history maize → dry bean → maize; usual planting 15 June, no window; rainfed; maize and dry bean allowed; no constraints; soil = SoilGrids regional estimate; base scenario (shift 0 d, rain 100 %).

**Climate seen in the app** (median monthly rain, mean temperature): September is the wettest month (315 mm, 25.9 °C), March the driest (21 mm), May the warmest (29.7 °C). Data quality 7305/7305 days for every variable.

**Results** (18/18 valid blocks; water indicator, unrounded):

| Run | Option | Sequence | Median | P10 | What the card says |
|---|---|---|---|---|---|
| Base | Current practice | maize → bean → maize | 99.8820 | 96.9861 | "This is what you entered in step 1." · Baseline 99.9/100 |
| Base | Alternative 1 | bean → maize → bean | 99.6883 | 96.7940 | "You can plant dry bean and maize, and each harvest ends before the next planting." · 99.7/100 |
| Base | Alternative 2 | bean → maize → maize | 99.8850 | 97.0230 | same reason · 99.9/100 |
| No buyer for dry bean | Alternative 1 | maize → maize → maize (monoculture) | 99.8944 | 99.1149 | The 6 sequences with bean are listed in "Options that do not appear and why" with "This option includes dry bean and you told us you have no buyer for it." |
| Rain 80 %, date fixed | Current practice | maize → bean → maize | 99.6378 | 96.2546 | "Baseline 99.9 · Adjusted 99.6 (−0.2)" — the typical result barely changes, less favourable years got worse |
| Rain 80 %, date fixed | Alternative 1 | bean → maize → bean | 98.6504 | 96.2008 | "Baseline 99.7 · Adjusted 98.7 (−1.0)" — typical result −1.0, less favourable scenarios −0.6 |

How to read it: in this humid location the rain covers almost all the crop demand, so every option is close to 100 and differences of tenths are not a reason to choose. The value of the comparison is in the reasons, the constraints and the calendar. The simulator shows how much margin each option has when rain drops.

**Reproduce**
- App: press the case button, then "Export JSON".
- Engine with live data (from `engine/`): `.venv/Scripts/python scripts/verify_carranza.py` → `data/verification/carranza_base.json`, `carranza_rain80.json`.
- API: `POST /api/rotation-comparison` with the inputs above (`soilSource: "regional"`), and `POST /api/scenarios` with `precipScale: 0.8`.

---

## 8. Assumptions and limitations

- NASA POWER is a regional reanalysis grid, not a plot measurement; results are a historical reconstruction, not a forecast.
- SoilGrids is a 250 m estimate from a neighbouring cell (556 m) with wide uncertainty (clay Q5–Q95 4–68 % at the surface); intervals are not propagated; Saxton & Rawls covers very clayey soils (Vertisols) poorly; no gravel correction.
- Root depth at the lower bound of the FAO range, constant from planting; stage lengths from other regions; Kc not climate-adjusted; single Kc (no separate soil evaporation).
- RO = CR = 0; initial depletion 0.5 × TAW; no soil-water simulation between cycles; one cycle per year.
- The water indicator is relative yield under water stress, not water saved nor harvest probability.
- Only maize and dry bean; only water is computed; no overall score; no field validation; not agronomic advice.

## 9. Verification

- `cd engine && .venv/Scripts/python -m pytest` → **63 passed**: FAO-56 Example 18 ETo, mass conservation, Ks order, daily p, Saxton & Rawls reference values, scoring fixtures (75.25, synthetic total 80), screening and constraint filters, observations, timeline.
- Reference numbers above match `VERIFICATION_CARRANZA.md` and the exported runs in `data/verification/`.
- Not validated against observed yields or with farmers (pending).

## 10. API (engine)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/places?q=` | Locality search (Mapbox geocoding; needs `MAPBOX_TOKEN`) |
| POST | `/api/location-profile` | Climate summary, data quality and sources for a point |
| POST | `/api/soil-profile` | SoilGrids profile + pedotransfer results |
| POST | `/api/rotation-comparison` | Full run (rotations, screening, timeline, indicators) |
| POST | `/api/scenarios` | Same with `plantShiftDays` and `precipScale` |
| GET | `/api/runs/{id}`, `/api/runs/{id}/export` | A stored run and its JSON export |
| GET | `/api/methodology` | Engine version, weights, active and pending methods |

Interactive docs: `/docs` on the engine URL.

## 11. Glossary

| Term | Meaning |
|---|---|
| ETo | Reference evapotranspiration of a grass surface (mm/day) |
| Kc | Crop coefficient by growth stage |
| ETm / ETa | Crop water demand without stress / actual crop evapotranspiration |
| FC, WP | Field capacity, wilting point (volumetric water content, m³/m³) |
| TAW, RAW | Total / readily available water in the root zone (mm) |
| Dr | Root-zone depletion (mm below field capacity) |
| Ks | Water-stress coefficient (0–1) |
| p | Fraction of TAW that can be used before stress |
| Ky | Yield response factor to water deficit |
| P10 / P90 | 10th / 90th percentile across the 18 historical blocks |

## 12. References

- Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). *Crop evapotranspiration — Guidelines for computing crop water requirements.* FAO Irrigation and Drainage Paper 56. https://www.fao.org/4/x0490e/x0490e00.htm
- Doorenbos, J., Kassam, A.H. (1979). *Yield response to water.* FAO Irrigation and Drainage Paper 33 (Ky values, as tabulated in FAO-56 Table 24).
- Saxton, K.E., Rawls, W.J. (2006). Soil water characteristic estimates by texture and organic matter for hydrologic solutions. *Soil Sci. Soc. Am. J.* 70:1569–1578. https://doi.org/10.2136/sssaj2005.0117
- Poggio, L. et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. *SOIL* 7:217–240. https://doi.org/10.5194/soil-7-217-2021
- NASA Prediction Of Worldwide Energy Resources (POWER). https://power.larc.nasa.gov/

## 13. AI use

See the **AI Use Disclosure** section of [`README.md`](README.md) and [`video/AI_DISCLOSURE.md`](video/AI_DISCLOSURE.md).
