# Methods / Métodos

- ETo: FAO-56 Penman–Monteith with Ra, Rso, Rnl per FAO-56 ch. 3 (`engine/heirloom/eto.py`). Rs/Rso capped at 1. Missing inputs give no value (never patched).
- Water: daily bucket (`water.py`) in the project order of spec section 10.2; RO=0, CR=0 and initial Dr=0.5*TAW are recorded simplifications (sensitivity not yet run).
- A = 1+99*clip(1-Ky*(1-sum ETa/sum ETm),0,1) per cycle; rotation = geometric mean; blocks = overlapping 3-year windows (not independent); summary = median and P10–P90 across blocks.
- Overall = exp((lnA+lnH+lnS+lnE)/6 + lnU/3); any missing component gives null. Weights are Heirloom design choices, not NASA's.
- Normalization P10/P90 (`scoring.py`) needs a frozen regional reference sample; none exists yet, so S/E/U are pending.
- Scenarios: precipitation scale and planting shift (+-30 d) re-run the engine; temperature, rain lag, irrigation and residues are not implemented.
