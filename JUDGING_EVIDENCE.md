# Judging evidence (no self-grading)

| Criterion | Evidence in the repo / app | Pending |
|---|---|---|
| Impact | One concrete farmer decision: which crop in each cycle, with the reasons, the water response under less rain, the calendar between harvest and planting and what is still unchecked (cards in "Qué sembraría en cada ciclo"). Filters from the farmer (allowed crops, seed, equipment, buyer, planting window) are applied in `screening.py` | Usability test with farmers; real yields, prices and costs for the margin |
| Creativity | One continuous story from map to climate to answers to alternatives; contour lines that return across sections; a month selector that reads rain and temperature together; the "between harvest and planting" timeline; plain-language explanations generated from engine checks | Field feedback on the explanations |
| Validity | 63 unit tests, FAO-56 reference ETo, water-balance mass conservation, `WATER_PARAMETERS.md` re-read from FAO-56, Saxton & Rawls cross-checked with two published implementations, reproducible case with exported JSON and the reference numbers (`VERIFICATION_CARRANZA.md`), `AUDIT_REQUIREMENTS.md` (21.5/42 DOCX, 8/12 master prompt, estimates) | Validation against observed yields; heat (AquaCrop function), carbon (RothC), erosion (R, K, LS, C) and margin; frozen P10/P90 reference sample; sensitivity of weights |
| Pertinence (NASA) | NASA POWER daily series → FAO-56 ETo → daily balance → water indicator, visible in the climate section ("Ver origen") and in the water line of every card | Optional SMAP/GPM only if they add a defined function |
| Presentation | `/es` and `/en` fully working, mobile and reduced-motion versions, reproducible demo in one click | Final pitch deck (7 slides) or 30 s video |

Limits stated in the app: historical reconstruction, not a forecast; SoilGrids estimate from a neighbouring cell; only the water indicator is computed; the overall score stays pending; field validation pending.
