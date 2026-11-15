# Water module parameters (maize and dry bean)

Verified on 2026-11-14 by re-reading the FAO-56 web edition (Allen et al., 1998): Tables 11 and 12 at <https://www.fao.org/4/x0490e/x0490e0b.htm>, Tables 22 and 24 at <https://www.fao.org/4/x0490e/x0490e0e.htm>. The machine-readable copy with the same tags is `engine/data/catalog.json` (a test checks that the documented values equal the values the engine uses).

Type: **B** = bibliographic (value read from the table), **A** = pilot assumption (a choice Heirloom made).

| Crop | Parameter | Value | Unit | Reference | Type |
|---|---|---|---|---|---|
| Maize | Kc ini | 0.30 | – | Table 12, Cereals group value 0.3 (the per-row cell is an image on the web page, so it could not be read as text) | B (cell not machine-readable) |
| Maize | Kc mid | 1.20 | – | Table 12, "Maize, Field (grain)" | B |
| Maize | Kc end | 0.60 | – | Table 12, "Maize, Field (grain)", 0.60–0.35 footnote 11 (0.60 = harvest at high grain moisture) | B; choice of 0.60 over 0.35 is A |
| Maize | Stage lengths ini/dev/mid/late | 20/35/40/30 (125) | days | Table 11, "Maize (grain)", June, Nigeria (humid) | B; transfer to Veracruz/Oaxaca is A |
| Maize | Rooting depth Zr | 1.0 | m | Table 22 gives 1.0–1.7 m (footnote 1: larger values for rainfed / water-stress modeling) | **A** (lower bound, constant from planting) |
| Maize | Depletion fraction p | 0.55 | – | Table 22, valid for ETc ≈ 5 mm/day; adjusted daily with p + 0.04 (5 − ETc), limited to 0.1–0.8 (fn 2) | B |
| Maize | Ky | 1.25 | – | Table 24 (from FAO-33), "Maize"; whole season | B |
| Bean | Kc ini | 0.40 | – | Table 12, "Beans, dry and Pulses" | B |
| Bean | Kc mid | 1.15 | – | Table 12, same row, footnote 2 (1.20 if grown on tall stalks) | B; bush type is A |
| Bean | Kc end | 0.35 | – | Table 12, same row | B |
| Bean | Stage lengths | 20/30/40/20 (110) | days | Table 11, "Beans (dry)", May/June, Continental Climates | B; regional transfer is A |
| Bean | Rooting depth Zr | 0.6 | m | Table 22 gives 0.6–0.9 m | **A** (lower bound, constant) |
| Bean | Depletion fraction p | 0.45 | – | Table 22, ETc ≈ 5 mm/day; same daily adjustment | B |
| Bean | Ky | 1.15 | – | Table 24, "Beans"; whole season | B |

All numeric values written in the earlier catalog turned out to match the tables, so no value was corrected. One **model** correction was made: p is now adjusted daily with ETc as FAO-56 Table 22 footnote 2 prescribes (engine 0.3.0), instead of being constant. The earlier catalog also cited "Table 25", which was not checked and has been removed.

## Assumptions that remain
- Root depth at the lower bound of the FAO range, constant from day 1 (no root growth). Upper-bound sensitivity is in `VERIFICATION_CARRANZA.md`.
- Stage lengths from rows of other regions (Nigeria humid; continental climates), not local phenology.
- Kc ini not refined for frequent wetting (FAO Figs. 29–30); the eq. 62 climate adjustment of Kc mid/end is not applied.
- Kc end of maize 0.60 (high-moisture harvest) and bush-type beans (Kc mid 1.15).
- Linear Kc interpolation between stages; no soil evaporation component (single Kc).
- Soil water: thetaFC 0.30 / thetaWP 0.15 are illustrative demo values; RO = 0, CR = 0; initial depletion 0.5 × TAW; no soil-water simulation between cycles.
- Ky is used on the whole-season ratio; the resulting 1–100 water score and the geometric mean are Heirloom design choices, not FAO.
