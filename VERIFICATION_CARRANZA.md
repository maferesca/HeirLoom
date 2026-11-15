# Verification: Jesús Carranza case (real NASA POWER data)

Point 17.432993, -95.02336 · history maize → bean → maize · base planting 15 June · 2005–2024 · soil thetaFC 0.30 / thetaWP 0.15 (**illustrative demo assumptions, not measurements**) · rainfed · shift 0 d. Engine 0.3.0, catalog 0.2.0-pilot. Parameter sources: `WATER_PARAMETERS.md`.

## Reproduce
Run from `engine/`. These are two separate commands.

Unit tests (synthetic data only, 38 tests):

```bash
.venv/Scripts/python -m pytest
```

Verification script (calls NASA POWER; writes `data/verification/carranza_base.json` and `carranza_rain80.json`):

```bash
.venv/Scripts/python scripts/verify_carranza.py
```

In the app (`/es` or `/en`): coordinates above → see data → rainfed → "illustrative demo values" → compare → start simulator → rainfall 80 %.

## Results (engine 0.3.0, from the exported JSON)
1. **Plant-available water:** (0.30 − 0.15) × 1000 = **150 mm per metre**. Exported per cycle: `awcMmPerM`, `rootDepthM`, `tawMm` (maize 1.0 m → 150 mm; bean 0.6 m → 90 mm).
2. **Maize → bean → maize, 18 of 18 blocks valid:**

| Run | Median | P10 | P90 |
|---|---|---|---|
| Rain 100 % | 100.0000 | 98.3227 | 100.0 |
| Rain 80 % | 99.9775 | 97.7460 | 100.0 |

   Median difference (unrounded) −0.0225, shown as "±0.0 vs. baseline" with a note that the median sits at the top of the scale. Ten blocks drop at 80 % rain (largest 2018: 97.655 → 96.367, −1.288); eight blocks stay at 100 in both runs.
3. **Filters:** allowed crops = maize only → the bean alternative disappears, history stays maize → bean → maize, and the only candidate left is labelled **monoculture** (maize → maize → maize) with the explanation that no rotation needs at least two crops. If the history itself is a monoculture and only maize is allowed, no alternative is offered. Window 15 May–15 Jul → shifts −30…+30 d viable; window 10–20 Jun → only 0 d. Known irrigation (June–October, 20 mm / 10 d) shows 260 / 220 / 260 mm per cycle in the balance (rain 80 %: median 100.0, P10 99.56).
4. **Daily trace** (`blocks[0].dailyTrace`): at 80 % rain the 40.18 mm of 15 June 2005 becomes 32.144 mm before the balance (and the day's `pUsed` is recorded). Unit test: 10 mm → 8 mm.

## What changed versus the previous run, and why
The only model change is the daily adjustment of the depletion fraction p with ETc (FAO-56 Table 22, footnote 2). On rainy days ETc is below 5 mm/day, so p rises above its tabulated value; on hot dry days it falls, so stress starts earlier. No catalog value changed.

| Run | Median | P10 | Blocks changed |
|---|---|---|---|
| Rain 100 % | 100.0000 → 100.0000 | 98.5062 → 98.3227 | 7 of 18 (e.g. 2014: 98.415 → 98.238; 2017: 98.545 → 98.359) |
| Rain 80 % | 100.0000 → 99.9775 | 97.9028 → 97.7460 | 10 of 18 (e.g. 2014: 97.650 → 97.502; 2017: 98.011 → 97.851) |

Earlier results used no elevation default of 0 m; since 0.2.0 the NASA cell elevation (121.65 m here) is used when the user gives none. The pre-change JSON files are kept as `*_before_p_adjust.json` for comparison.

## Sensitivities (not the base run)
- Root depth at the upper bound of the FAO range (maize 1.7 m, bean 0.9 m): rain 100 % median 100.0, P10 99.61; rain 80 % median 100.0, P10 99.36. Root depth is a pilot assumption that matters.
- Dry start (initial depletion = TAW), rain 80 %: median 98.94, P10 96.49.
