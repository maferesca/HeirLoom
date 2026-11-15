"""FastAPI surface (spec 6). Scores come from the engine, never from an LLM."""
from __future__ import annotations

import os

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


def _load_env_file():
    """Minimal .env reader (engine/.env); real environment variables win."""
    from pathlib import Path
    f = Path(__file__).resolve().parents[1] / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_file()

from . import compare, quality, simulate  # noqa: E402
from .compare import CompareReq, ProfileReq  # noqa: E402
from .providers import nasa_power  # noqa: E402

app = FastAPI(title="Heirloom engine", version=compare.ENGINE_VERSION)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
                   allow_methods=["*"], allow_headers=["*"])
RUNS: dict[str, dict] = {}


def load_series(req: ProfileReq):
    out, manifests = {}, []
    y = req.startYear
    while y <= req.endYear:  # controlled 5-year chunks
        y2 = min(y + 4, req.endYear)
        try:
            r = nasa_power.fetch_daily(req.location.lat, req.location.lon, f"{y}0101", f"{y2}1231")
        except RuntimeError as e:
            raise HTTPException(502, str(e))
        s = quality.clean_series(r["raw"], r["manifest"]["fillValue"] or -999.0)
        for k, v in s.items():
            out.setdefault(k, {}).update(v)
        manifests.append(r["manifest"])
        y = y2 + 1
    return out, manifests


@app.get("/api/places")
def places(q: str = Query(min_length=3), language: str = "es"):
    token = os.getenv("MAPBOX_TOKEN")
    if not token:
        raise HTTPException(503, "geocoder_unconfigured: set MAPBOX_TOKEN")
    r = httpx.get("https://api.mapbox.com/search/geocode/v6/forward",
                  params={"q": q, "country": "mx", "language": language, "limit": 5, "access_token": token}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(502, "geocoder_error")
    return {"results": [{"name": f["properties"].get("name"), "full": f["properties"].get("full_address"),
                         "lon": f["geometry"]["coordinates"][0], "lat": f["geometry"]["coordinates"][1]}
                        for f in r.json().get("features", [])], "temporary": True}


@app.post("/api/location-profile")
def location_profile(req: ProfileReq):
    series, manifests = load_series(req)
    return {"location": req.location, "period": [req.startYear, req.endYear],
            "label": "historical reconstruction, not forecast",
            "quality": quality.quality_stats(series), "alerts": quality.physical_alerts(series),
            "monthly": quality.monthly_summary(series), "sources": manifests,
            "provenance": "reanalysis", "spatialNote": "regional grid cell, not parcel resolution"}


@app.post("/api/rotation-comparison")
def rotation_comparison(req: CompareReq):
    series, manifests = load_series(req)
    eff = manifests[0]["effectiveLocation"]
    try:
        run = compare.build_run(req, series, manifests, eff[2] if isinstance(eff, list) and len(eff) > 2 else None)
    except ValueError as e:
        raise HTTPException(422, str(e))
    RUNS[run["runId"]] = run
    return run


@app.post("/api/scenarios")
def scenarios(req: CompareReq):
    return rotation_comparison(req)  # same engine, changed inputs => new reproducible run


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    if run_id not in RUNS:
        raise HTTPException(404, "run_not_found")
    return RUNS[run_id]


@app.get("/api/runs/{run_id}/export")
def export_run(run_id: str):
    return get_run(run_id)


@app.get("/api/methodology")
def methodology():
    return {"engineVersion": app.version, "catalogVersion": simulate.CATALOG["version"],
            "weights": {"A": "1/6", "H": "1/6", "S": "1/6", "E": "1/6", "U": "1/3"},
            "active": ["eto_fao56_pm", "water_bucket_daily", "water_score", "geometric_aggregation"],
            "pending": {k: [m["item"] for m in v] for k, v in compare.PENDING.items()},
            "sources": ["NASA POWER daily (AG community)", "FAO-56"]}
