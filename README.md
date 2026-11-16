# Heirloom

**What should I plant next, and why does this option fit my land and my constraints?**

Heirloom helps a farmer compare crop rotations before planting. It combines NASA POWER climate records, a SoilGrids regional soil estimate, FAO-56 crop parameters and what the farmer knows about their land, and shows, cycle by cycle, what they could plant, why each option appears and what to check before deciding.

Built for NASA Space Apps 2026, challenge **Field Shift: Adapting Farms with NASA Data**. Pilot case: Jesús Carranza, Veracruz, Mexico (maize and dry bean).

> Exploration tool: not validated agronomic advice, not a forecast, not endorsed by NASA.
> *Herramienta exploratoria: no es asesoría agronómica validada, no es un pronóstico y no tiene aval de la NASA.*

**Full reference of data, formulas and sources: [`PROJECT_REFERENCE.md`](PROJECT_REFERENCE.md).**

---

## What it does

1. **Place**: pick a point on the map (Mapbox) or load the Jesús Carranza test case.
2. **Climate**: 20 years of daily NASA POWER data (2005–2024), shown as monthly rain and temperature, with the source and data quality one click away.
3. **What the farmer knows**: crop history, usual planting date and window, rainfed or irrigated, which crops they can plant, and seed, equipment or buyer constraints. "?" guides explain how to answer.
4. **Soil**: a SoilGrids 2.0 regional estimate converted to field capacity and wilting point (Saxton & Rawls 2006), the farmer's own values, or labelled demo values.
5. **What to plant each cycle**: the current practice and alternatives, each with the reason it appears. Options that break a constraint are listed with the reason they were removed.
6. **Between harvest and planting**: days without a crop between cycles.
7. **Water indicator**: how well the rain covers each crop's water demand (FAO-56 water balance → relative yield → 1–100), over 18 historical periods. The simulator tests less rain or a shifted planting date.
8. **Export**: the full run as JSON, with every source, parameter and a daily trace.

## How NASA data enters the calculation

```
NASA POWER PRECTOTCORR (daily rain) ──────────────────────────────> water available to the crop
NASA POWER temperature, dew point, wind, pressure, solar radiation ──> FAO-56 ETo ──× Kc──> crop water demand
SoilGrids texture + organic carbon ──> Saxton & Rawls ──> water the soil can hold (TAW)
                daily water balance ──> ΣETa / ΣETm ──> 1 − Ky(1 − ratio) ──> 1–100 per cycle
                ──> geometric mean per rotation ──> median and P10 over 18 historical blocks
```

Step-by-step formulas with file and line: [`PROJECT_REFERENCE.md`, section 6](PROJECT_REFERENCE.md#6-calculations).

## What is real and what is pending

| Piece | Status |
|---|---|
| NASA POWER daily data (9 variables, 2005–2024, manifest with URL and sha256) | Working, live |
| FAO-56 Penman–Monteith ETo | Working; tested against FAO-56 Example 18 |
| SoilGrids 2.0 profile + Saxton & Rawls pedotransfer | Working; nearest valid cell when the point is masked (556 m in the pilot) |
| Daily water balance and water indicator (A) | Working |
| Screening with reasons (allowed crops, seed/equipment/buyer, window, overlap, monoculture) | Working |
| Calendar between harvest and planting | Working |
| Simulator (rain 70–130 %, planting ±30 days) and JSON export | Working |
| Map and locality search (Mapbox) | Working with a token |
| Heat (AquaCrop), soil carbon (RothC), erosion (USLE), profit | Pending: data or verified models missing |
| Overall score | Pending: needs all five indicators (formula tested with synthetic data only) |
| Water and pest compatibility between successive crops | Reported "not evaluated" |
| Field validation with farmers and observed yields | Pending |

## Reference case: Jesús Carranza, Veracruz

Maize → dry bean → maize, planting 15 June, rainfed, SoilGrids regional soil:

| Option | Sequence | Water indicator (median) | With 80 % of the rain |
|---|---|---|---|
| Current practice | maize → bean → maize | 99.9 | 99.6 |
| Alternative 1 | bean → maize → bean | 99.7 | 98.7 (−1.0) |
| Alternative 2 | bean → maize → maize | 99.9 | 99.7 |

With "no buyer for dry bean", every option with bean is removed with that reason and only the maize monoculture remains. In this humid location the rain covers almost all the crop demand, so the differences are small: the value is in the reasons, the constraints and the calendar. Exact values, inputs and how to reproduce: [`PROJECT_REFERENCE.md`, section 7](PROJECT_REFERENCE.md#7-reference-case-jesús-carranza-veracruz) and [`VERIFICATION_CARRANZA.md`](VERIFICATION_CARRANZA.md).

## Run locally

Requirements: Python 3.11+, Node.js 20+.

```bash
# engine (FastAPI): http://localhost:8000/docs
cd engine
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m pytest                     # 63 tests
.venv/Scripts/python -m uvicorn heirloom.api:app --port 8000

# web (Next.js): http://localhost:3000/es or /en
cd ../web
npm install
npm run dev
```

Configuration (see [`.env.example`](.env.example)):

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_ENGINE_URL` | `web/.env.local` | Engine URL (default `http://localhost:8000`) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `web/.env.local` | Public Mapbox token for the map |
| `MAPBOX_TOKEN` | `engine/.env` | Locality search |
| `CORS_ORIGINS` | `engine/.env` | Allowed web origins, comma-separated |

Without tokens the map and search show a "not configured" state; typing coordinates still works.

**Deploy:** the web app deploys from `web/`; the engine deploys from `engine/`. The engine ships `engine/data/` (crop catalog and the cached pilot soil profile) and caches new soil profiles in the temp folder on read-only hosts. Set `NEXT_PUBLIC_ENGINE_URL` on the web and `CORS_ORIGINS` on the engine.

## Repository

| Path | Contents |
|---|---|
| `engine/` | Python engine: data providers, ETo, soil, water balance, scoring, screening, API, tests |
| `engine/data/` | Crop catalog (FAO-56) and cached SoilGrids profile |
| `web/` | Next.js app (Spanish and English) |
| `data/verification/` | Exported reference runs of the Jesús Carranza case |
| `scripts/` | Generators of the website's procedural illustrations |
| `video/` | Demo video project (Remotion) |

## Documentation

| File | What it covers |
|---|---|
| [`PROJECT_REFERENCE.md`](PROJECT_REFERENCE.md) | **Everything in one place:** data sources, variables, formulas with code lines, assumptions, reference results, API |
| [`WATER_PARAMETERS.md`](WATER_PARAMETERS.md) | Each crop parameter and the FAO-56 table it comes from |
| [`VERIFICATION_CARRANZA.md`](VERIFICATION_CARRANZA.md) | The reproducible reference case |
| [`METHODS.md`](METHODS.md) | Method notes (water balance order, soil sources, screening) |
| [`DATA_SOURCES.md`](DATA_SOURCES.md) | Data sources and their status |
| [`LIMITATIONS.md`](LIMITATIONS.md) | What the results do not mean |
| [`VALIDATION.md`](VALIDATION.md) | Tests and what is not validated |
| [`AUDIT_REQUIREMENTS.md`](AUDIT_REQUIREMENTS.md) | Requirement tracker against the methodology document |
| [`JUDGING_EVIDENCE.md`](JUDGING_EVIDENCE.md) | Evidence per judging criterion |

## Data credits

- NASA POWER (Prediction Of Worldwide Energy Resources): https://power.larc.nasa.gov/
- SoilGrids 2.0, ISRIC World Soil Information, CC BY 4.0: https://www.isric.org/explore/soilgrids
- FAO Irrigation and Drainage Paper 56: https://www.fao.org/4/x0490e/x0490e00.htm
- Saxton & Rawls (2006): https://doi.org/10.2136/sssaj2005.0117
- Map data and imagery © Mapbox © OpenStreetMap © Maxar

## AI Use Disclosure

**Code.** Claude Code (Anthropic; Claude Sonnet 5.5 and Claude Opus 5.5 models) assisted with writing and revising the prototype code (engine, web app, tests, data-capture scripts) and the documentation. The team reviewed and directed the work. The water-balance numbers come from the engine running on real data, not from an AI model.

**Data (not AI-generated).** Climate: NASA POWER daily data (2005–2024, cell 17.433, −95.023). Soil: SoilGrids 2.0 (ISRIC, CC BY 4.0) regional estimate, converted to field capacity and wilting point with the published Saxton & Rawls (2006) function. Map and satellite imagery: Mapbox (© Mapbox © OpenStreetMap © Maxar).

**Images on the website.** The hero illustration (`web/public/hero-dusk.svg`, `hero-fields.svg`) and the gold contour-line backgrounds (`contours-*.svg`) are procedurally generated by Python scripts in `scripts/` that Claude Code wrote. No image-generation model was used for them. The hero carries the visible label "AI-generated visuals". The logo (`web/public/logo-heirloom.webp`, used in the demo video) was generated with ChatGPT (OpenAI).

**Demo video (`video/`, 29.8 s).** Claude Code assembled the demo: it scripted the app captures (Playwright), the edit (Remotion) and the audio. Every shot with AI-generated imagery or animation carries an "AI-generated visuals" label in the top-right corner. Real app screenshots carry a "Real app screenshots" label in the top-left corner.
- Real app footage: screenshots of the running Heirloom prototype (Jesús Carranza case); figures and labels are the app's own.
- Earth zoom: real Mapbox satellite imagery (credited on screen: © Mapbox © OpenStreetMap © Maxar), with a camera animation scripted by Claude Code (labelled "AI-generated visuals · Camera animation").
- Seed and sprout scenes, title cards, highlights, zooms and backgrounds: code-generated animation written by Claude Code (Remotion/SVG). No image or video generation model was used.
- End card logo: generated with ChatGPT (OpenAI).
- Narration: synthetic voice generated offline with Kokoro-82M (hexgrad, Apache-2.0) through `kokoro-onnx` 0.6.1, a blend of the `af_heart` and `af_kore` voices (`video/scripts/make_vo_kokoro.py`).
- Music and sound effects: synthesized by a NumPy script written by Claude Code (`video/scripts/make_music.py`). No music generation model or samples were used.

Short version for the Space Apps "AI Tools" field: `video/AI_DISCLOSURE.md`.
