# Verification: Jesús Carranza case (real NASA POWER and SoilGrids data)

Engine 0.6.1 · catalog 0.2.0-pilot · parameter sources in `WATER_PARAMETERS.md` · requirement status in `AUDIT_REQUIREMENTS.md`.

## The case (one click, fully editable)
In the app, **"Probar con el caso de Jesús Carranza"** (hero) or **"Usar caso de prueba"** (map section) resets every answer and loads:

| Input | Value |
|---|---|
| Point | 17.432993, -95.02336 (locality coordinates, not a plot) |
| Historical period | 2005–2024 |
| History | maize → bean → maize, three successive cycles; "Sembrado junto con" = **Ninguno** |
| Usual planting date | 15 June; no planting window |
| Water | rainfed (irrigation = 0 mm) |
| Soil | regional estimate from SoilGrids (nearest valid cell, 556 m) + Saxton & Rawls pedotransfer |
| Crops allowed | maize and bean; no seed, equipment or buyer restrictions; no management answers (residues and cover "sin dato") |
| Base scenario | shift 0 days, rainfall 100 % |

The button also fetches climate and the soil profile and runs the comparison, and shows the base result. With the simulator untouched the cards show **only the base result**; the 80 % rainfall scenario (same planting date) appears when you move **Lluvia (%)** to 80. Nothing from a previous session is carried over: window, irrigation, restrictions, management, soil values, cycles and the "sown together" selectors are all reset (the `p5.pdf` print showed maize + maize cycles, a 14 January date, a 1–31 January window and residue/cover answers left from earlier clicks; the "sown together" list also offered the crop itself).

## Reproduce
Run from `engine/`. These are two separate commands.

Unit tests (synthetic data only, 63 tests):

```bash
.venv/Scripts/python -m pytest
```

Verification script (NASA POWER and SoilGrids, writes `data/verification/carranza_*.json` and checks the reference numbers):

```bash
.venv/Scripts/python scripts/verify_carranza.py
```

In the app (`/es` or `/en`): press the case button → wait for the comparison (about 40 s the first time, SoilGrids is cached in `engine/data/soilgrids/`) → move **Lluvia (%)** in the simulator → **Exportar JSON** (or "Exportar JSON" next to the title).

## Reference exports and numbers (regional soil)
Files: `data/verification/carranza_base.json` (rain 100 %) and `carranza_rain80.json` (rain 80 %), both with shift 0 days. 18 of 18 historical blocks valid.

| Run | Median (water) | P10 | P90 |
|---|---|---|---|
| Rain 100 % | 99.8820 | 96.9861 | 100.0 |
| Rain 80 % | 99.6378 | 96.2546 | 100.0 |

The expected reference 99.88 → 99.64 and 96.99 → 96.26 **matches**, with one note: the exact 80 % P10 is 96.2546, which rounds to **96.25**; "96.26" in the earlier report came from double rounding (96.2546 → 96.255 → 96.26). No input or version changed. The UI shows 99.9 → 99.6 for the typical result; the exact values are in the JSON and in "Ver detalles".

Same case with the illustrative soil (0.30/0.15, rainfed) for reference: median 100.0 → 99.957, P10 97.934 → 97.355 (`carranza_demo_soil_*.json`).

## Results screen (short cards)
Each option shows crops and dates, then only two blocks: **"Por qué aparece esta opción"** (one sentence from the engine checks, e.g. "Puedes sembrar frijol y maíz, y cada cosecha termina antes de la siguiente siembra.") and **"Qué cambia en este escenario"** (base result; base and adjusted plus one sentence only when a control moved). Notices common to all options appear **once** in "Avisos para todas las opciones" (regional soil with its distance, heat/carbon/erosion/margin pending, water between cycles and pests not evaluated, no planting window, crops sown together → water score of the current practice pending, priority notes) and the technical lists (RothC, GloREDa, erosion factors) are in its "Ver detalles". Waterlogging/runoff notices stay visible next to the results. Dates are labelled **"Calendario base"**, or **"Calendario del escenario"** when the simulator shifts planting (checked: +4 days gives 19 jun → 22 oct for maize and 19 jun → 7 oct for bean, identical to the exported `timeline`; gaps stay 240 and 255 days).

## What the cards say for this case (generated from the run and from `screening.py`)
- Moving rainfall to 80 %, current practice (maize → bean → maize): "Con 80 % de la lluvia, el resultado típico apenas cambia, pero los escenarios históricos menos favorables empeoraron." (median −0.24, P10 −0.73).
- Alternative 1 (bean → maize → bean): "Puedes sembrar frijol y maíz y cada cosecha termina antes de la siguiente siembra (al menos 240 días de margen)." / "No indicaste una ventana de siembra; usamos las fechas de la simulación." Rain 80 %: typical result −1.0, less favourable scenarios −0.6.
- Alternative 2 (bean → maize → maize) is the other selected option; bean/maize monocultures are discarded ("repite un solo cultivo y con los cultivos que puedes sembrar es posible hacer una rotación").
- "Entre cosecha y siembra" (text: "240 días entre cosecha y siembra", dates kept): maize planted 15 Jun, harvest 18 Oct (125 d) → **240 days** without crop (18 Oct → 15 Jun); bean harvest 3 Oct (110 d) → **255 days** (3 Oct → 15 Jun). Cover in each period: "sin confirmar" when a cover crop is declared without timing, "sin dato" otherwise. Carbon and erosion stay pending.

## Additional cases checked in the browser (UI text compared with the engine output)
1. **No buyer for bean** (`constraints.noBuyer = ["bean"]`): every bean option is discarded with "Esta opción incluye frijol y nos dijiste que no tienes comprador para ese cultivo"; the only candidate left is the maize monoculture, labelled as such, with "Con solo maíz permitido no es posible una rotación".
2. **Crops sown together** (cycle 1 = maize + bean): current practice shows "Asociación (cultivos juntos)", water pending, timeline "Falta el dato: un solo cultivo por ciclo"; each alternative says it is evaluated on its own and why there is no point of comparison. Duplicate selections (maize + maize) are no longer possible and the engine collapses repeated crops (`test_same_crop_listed_twice_is_not_an_intercrop`).
3. **Residues and cover declared, no timing** (residues "los conservas", cover "sí usas"): shown as general information of the plot; the cover of every harvest→planting interval remains "desconocida". With no answers: "sin dato".

## Field guides ("?" buttons) and farmer observations (engine 0.6.0)
Next to soil type, waterlogging, runoff (and, with the same component, planting window, residues and cover crop) the **"Cómo saber este dato"** button opens a mini guide below the field: one plain question, one thing to observe or remember, and the same answers as radio buttons including **"No lo sé"**. It works with touch and keyboard (Enter/Space opens, Escape closes and returns the focus to the button, 44 × 44 px target) and never clears answers.
- **Soil type (optional):** gritty / smooth / sticky / no sé, from rubbing moistened soil between the fingers. Shown as "Observación del agricultor" next to the SoilGrids estimate with its provenance; it has no numeric values and **does not change** field capacity or wilting point, which stay tied to the active soil source (`observations[].usedInCalculation = false`).
- **Waterlogging / runoff = yes:** recorded in `observations` with the notice they trigger ("You observe runoff/waterlogging: the model assumes RO=0 and CR=0…"); the "Tus respuestas" bar shows the observation and "activa el aviso de agua". **"No lo sé" records nothing and the comparison completes** (Carranza with runoff "No lo sé", waterlogging "Sí" and soil "Pegajosa": water median 99.8820, unchanged; one notice; `observations` = soil feel + waterlogging).
- Tests: `test_observations_are_recorded_apart_from_soil_values`, `test_unknown_answers_record_nothing_and_do_not_block_the_comparison`, `test_runoff_alone_triggers_the_water_warning_and_no_answer_keeps_it_off`.

## Changes since the previous verification and why they are separate from the reference
- Engine 0.5.0 adds the per-cycle `timeline` (planting/harvest dates and gap days from the catalog cycle length and the usual date) and collapses repeated crops in one cycle. The water numbers did not change.
- Earlier changes still apply: Ks uses the previous day's depletion (engine 0.4.0; saved before/after runs `*_before_ks_order.json`), p adjusted daily with ETc (0.3.0), elevation from the NASA cell. See `WATER_PARAMETERS.md` and `METHODS.md`.

## Remaining caveats
Root depth at the lower bound of the FAO range, stage lengths from other regions, Kc not climate-adjusted, RO = CR = 0, initial depletion 0.5 × TAW, no soil-water simulation between cycles, SoilGrids estimate from a neighbouring cell (556 m) with wide uncertainty and a pedotransfer function that covers Vertisols poorly.
