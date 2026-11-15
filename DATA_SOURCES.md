# Data sources

- NASA POWER daily point API (community AG): https://power.larc.nasa.gov/docs/services/api/temporal/daily/ — integrated; per-run manifest (URL, retrievedAt, sha256, API v2.10.3, units).
- FAO-56 (Allen et al., 1998) crop parameters: transcribed in `data/catalog.json`, needs re-verification against the source.
- Not yet integrated: SoilGrids, INEGI DEM, GloREDa, DGSIAP, FIRA, RothC, AquaCrop, Mapbox (credentials needed).

## Update (engine 0.4.0)
- SoilGrids 2.0 (ISRIC) point profile via `https://rest.isric.org/soilgrids/v2.0/properties/query`: **integrated and verified live** for the Carranza point (nearest valid cell when the requested cell is masked). Cached in `data/soilgrids/` with a manifest (URL, retrieval time, sha256). License CC BY 4.0; cite ISRIC.
- Pedotransfer: Saxton & Rawls (2006), coefficients cross-checked against USDA-ARS WEPP `saxpar.for` and the R package `rcropmod`.
