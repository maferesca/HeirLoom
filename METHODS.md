# Methods / Métodos

- ETo: FAO-56 Penman–Monteith with Ra, Rso, Rnl per FAO-56 ch. 3 (`engine/heirloom/eto.py`). Rs/Rso capped at 1. Missing inputs give no value (never patched).
- Water: daily bucket (`water.py`) in the project order of spec section 10.2; RO=0, CR=0 and initial Dr=0.5*TAW are recorded simplifications (sensitivity not yet run).
- A = 1+99*clip(1-Ky*(1-sum ETa/sum ETm),0,1) per cycle; rotation = geometric mean; blocks = overlapping 3-year windows (not independent); summary = median and P10–P90 across blocks.
- Overall = exp((lnA+lnH+lnS+lnE)/6 + lnU/3); any missing component gives null. Weights are Heirloom design choices, not NASA's.
- Normalization P10/P90 (`scoring.py`) needs a frozen regional reference sample; none exists yet, so S/E/U are pending.
- Scenarios: precipitation scale and planting shift (+-30 d) re-run the engine; temperature, rain lag, irrigation and residues are not implemented.

## Water balance order (engine 0.4.0)
Within a day: (1) the scenario rainfall factor multiplies P; (2) Ks is computed from the depletion at the **end of the previous day** (FAO-56 eq. 84 and the methodology DOCX); (3) inflow Q = P − RO + I + CR enters the store and drainage is the excess over TAW; (4) ETa = min(available water, Ks·ETm); (5) depletion is updated. The master prompt's alternative (Ks on the depletion after same-day wetting) is kept as `ksTiming: "after_wetting"` for comparison only; effects are listed in `VERIFICATION_CARRANZA.md`.

## Soil parameters
Three separate sources: farmer-declared values, a regional estimate (SoilGrids 2.0 profile → Saxton & Rawls 2006 pedotransfer, thickness-weighted over each crop's root depth) and illustrative demo values. The active source is exported in `soil.active`.

## Screening of alternatives
`engine/heirloom/screening.py`: availability (allowed crops plus declared seed, equipment and buyer restrictions), planting window, cycle overlap from catalog cycle length, and structure (monoculture only when no rotation is possible). Water and family/pest compatibility are reported as "not evaluated" because no backed rule exists. Selection among admitted options is deterministic: largest difference from the current practice, then alphabetical.
