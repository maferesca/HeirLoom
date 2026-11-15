# Heirloom

Explore crop-rotation options with NASA POWER data and what the farmer knows. Exploratory tool, **not** validated agronomic advice and **not** endorsed by NASA. / Herramienta exploratoria, sin validación agronómica ni aval de NASA.

## Run
```bash
cd engine && python -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]" && .venv/Scripts/python -m pytest
.venv/Scripts/python -m uvicorn heirloom.api:app --port 8000
cd ../web && npm install && npm run build && npm run start   # http://localhost:3000/es , /en
```
Copy `.env.example`. Without tokens: search/map show a "not configured" state; coordinates still work.

## Status (what is real)
| Piece | State |
|---|---|
| NASA POWER daily adapter (2005–2024, 5-yr chunks, fill value, UTC, manifest+sha256) | **Active, verified live** |
| FAO-56 Penman–Monteith ETo | **Active**, tested vs FAO-56 Example 18 (about 3.9 mm/day) |
| Daily water bucket + Ky seasonal score A, geometric mean, 3-yr historical blocks | **Active** (needs user-declared thetaFC/thetaWP; else pending) |
| Overall score (weights 1/6,1/6,1/6,1/6,1/3, round-half-up) | **Engine tested** with synthetic fixture (80/100); in real runs it stays null |
| H heat (AquaCrop) | Pending: official function not verified/pinned |
| S carbon (RothC), E erosion (USLE), U margin | Pending: models/datasets not integrated |
| Mapbox search/map | Search adapter written, **untested without token**; map not wired |
| Crop catalog | Maize, bean; FAO-56 values transcribed, re-verified against FAO-56 on 2026-11-14 (see `WATER_PARAMETERS.md`) |
| Hero photo | CSS placeholder, labelled illustrative; real licensed photo pending |

See `METHODS.md`, `DATA_SOURCES.md`, `LIMITATIONS.md`, `VALIDATION.md`, `JUDGING_EVIDENCE.md`.

## Update: farmer answers wired to the engine
History (with intercrops flagged, not converted), usual date + planting window, rainfed/irrigated with irrigation simulated when dates, depth and interval are known, allowed crops, management and priority, optional soil in the technical detail (illustrative demo values are labelled). H, S, E, U remain pending, each with the missing data/source/model listed; the overall score stays null. See `VERIFICATION_CARRANZA.md` to reproduce the verification case.
