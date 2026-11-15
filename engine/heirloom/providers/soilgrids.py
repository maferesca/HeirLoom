"""SoilGrids 2.0 (ISRIC) point profile adapter via the public REST API.

Verified live on 2026-11-14: the REST endpoint answers (HTTP 200). Some cells are masked and return null for
every property (for example the exact Jesus Carranza coordinate). In that case this adapter searches the
nearest valid cell within MAX_RADIUS_DEG and flags the result `nearest_valid_cell` with the distance, never
presenting a neighbouring cell as the requested point. Results are cached on disk with a manifest.

Unit conversion uses the d_factor returned by the API for each property (mapped -> target units).
Uncertainty is reported as the Q0.05-Q0.95 interval (same target units); the joint distribution of
properties is NOT sampled.
"""
from __future__ import annotations

import hashlib
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import tempfile
from pathlib import Path

import httpx

URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPERTIES = ("clay", "sand", "silt", "soc", "bdod", "cfvo")
DEPTHS = ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm")
RADII_DEG = (0.0025, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05)  # 0.0025 deg ~ 275 m
MAX_RADIUS_DEG = RADII_DEG[-1]
# Bundled cache inside engine/ (ships with the deploy). On read-only hosts (Vercel) new profiles go to the temp dir.
CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "soilgrids"
TMP_CACHE_DIR = Path(tempfile.gettempdir()) / "heirloom-soilgrids"
KEYMAP = {"clay": "clay_pct", "sand": "sand_pct", "silt": "silt_pct", "soc": "soc_g_kg", "bdod": "bdod_kg_dm3", "cfvo": "cfvo_pct"}


def _params(lat: float, lon: float):
    p = [("lon", lon), ("lat", lat)]
    p += [("property", x) for x in PROPERTIES] + [("depth", d) for d in DEPTHS]
    p += [("value", v) for v in ("mean", "Q0.05", "Q0.95")]
    return p


def parse(payload: dict) -> list[dict] | None:
    """Layers with converted units, or None when every value is null (masked cell)."""
    by_depth: dict[str, dict] = {}
    any_value = False
    for layer in payload["properties"]["layers"]:
        name = layer["name"]
        factor = layer["unit_measure"]["d_factor"]
        for d in layer["depths"]:
            row = by_depth.setdefault(d["label"], {"label": d["label"], "top_cm": d["range"]["top_depth"],
                                                    "bottom_cm": d["range"]["bottom_depth"]})
            vals = d["values"]
            key = KEYMAP[name]
            conv = lambda v: None if v is None else v / factor  # noqa: E731
            row[key] = conv(vals.get("mean"))
            row[key + "_q05"] = conv(vals.get("Q0.05"))
            row[key + "_q95"] = conv(vals.get("Q0.95"))
            if vals.get("mean") is not None:
                any_value = True
    if not any_value:
        return None
    return sorted(by_depth.values(), key=lambda r: r["top_cm"])


def _query(lat: float, lon: float, timeout: float = 25) -> tuple[list[dict] | None, str]:
    r = httpx.get(URL, params=_params(lat, lon), timeout=timeout)
    r.raise_for_status()
    return parse(r.json()), str(r.url)


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _ring(lat: float, lon: float, r: float):
    k = math.cos(math.radians(lat))
    return [(lat + dy * r, lon + dx * r / k) for dx, dy in
            ((1, 0), (-1, 0), (0, 1), (0, -1), (0.707, 0.707), (0.707, -0.707), (-0.707, 0.707), (-0.707, -0.707))]


def fetch_profile(lat: float, lon: float, use_cache: bool = True) -> dict:
    """Returns {status, layers, requested, effective, distanceM, qualityFlags, manifest} or status 'unavailable'."""
    key = f"{round(lat, 4)}_{round(lon, 4)}.json"
    if use_cache:
        for f in (CACHE_DIR / key, TMP_CACHE_DIR / key):
            if f.exists():
                out = json.loads(f.read_text(encoding="utf-8"))
                out["fromCache"] = True
                return out
    requested = {"lat": lat, "lon": lon}
    flags: list[str] = []
    try:
        try:
            layers, url = _query(lat, lon)
        except httpx.TimeoutException:  # the ISRIC service is sometimes slow: one retry before giving up
            layers, url = _query(lat, lon)
        eff = requested
        if layers is None:
            flags.append("requested_cell_masked_null")
            found = None
            with ThreadPoolExecutor(max_workers=8) as ex:
                for r in RADII_DEG:
                    pts = _ring(lat, lon, r)
                    results = list(ex.map(lambda p: _safe_query(*p), pts))
                    valid = [(p, res) for p, res in zip(pts, results) if res and res[0]]
                    if valid:
                        valid.sort(key=lambda pr: _haversine_m(lat, lon, *pr[0]))
                        found = valid[0]
                        break
            if not found:
                return {"status": "unavailable", "requested": requested, "qualityFlags": flags,
                        "reason": f"no valid SoilGrids cell within {MAX_RADIUS_DEG} deg of the point"}
            (elat, elon), (layers, url) = found
            eff = {"lat": elat, "lon": elon}
            flags.append("nearest_valid_cell")
    except httpx.TimeoutException as e:
        return {"status": "unavailable", "requested": requested, "qualityFlags": ["api_timeout"],
                "reason": "The SoilGrids (ISRIC) service did not answer in time: " + str(e)}
    except Exception as e:  # network or API paused
        return {"status": "unavailable", "requested": requested, "qualityFlags": ["api_error"], "reason": str(e)}
    out = {"status": "ok", "layers": layers, "requested": requested, "effective": eff,
           "distanceM": _haversine_m(lat, lon, eff["lat"], eff["lon"]), "qualityFlags": flags,
           "manifest": {"product": "SoilGrids 2.0", "endpoint": URL, "url": url,
                        "retrievedAt": datetime.now(timezone.utc).isoformat(),
                        "sha256": hashlib.sha256(json.dumps(layers, sort_keys=True).encode()).hexdigest(),
                        "sourceType": "spatial_estimate", "spatialResolution": "250 m",
                        "license": "CC BY 4.0 (ISRIC); cite ISRIC - World Soil Information",
                        "note": "mean and Q0.05/Q0.95 per depth; units converted with the API d_factor"}}
    for d in (CACHE_DIR, TMP_CACHE_DIR):  # the bundled folder is read-only on serverless hosts
        try:
            d.mkdir(parents=True, exist_ok=True)
            (d / key).write_text(json.dumps(out, indent=2), encoding="utf-8")
            break
        except OSError:
            continue
    return out


def _safe_query(lat, lon):
    try:
        return _query(lat, lon)
    except Exception:
        return None
