"""NASA POWER daily point adapter (spec 7.1). Real HTTP; no fixtures here."""
from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone

import httpx

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = "T2M,T2M_MAX,T2M_MIN,T2MDEW,RH2M,WS2M,PS,PRECTOTCORR,ALLSKY_SFC_SW_DWN"
_cache: dict = {}


def fetch_daily(lat: float, lon: float, start: str, end: str, retries: int = 3, timeout: float = 60) -> dict:
    """start/end YYYYMMDD. Returns raw payload + manifest. Raises RuntimeError on failure."""
    key = (round(lat, 4), round(lon, 4), start, end, PARAMS)
    if key in _cache:
        return _cache[key]
    q = dict(latitude=lat, longitude=lon, start=start, end=end, community="AG",
             parameters=PARAMS, format="JSON", **{"time-standard": "UTC"})
    last = None
    for i in range(retries):
        try:
            r = httpx.get(URL, params=q, timeout=timeout)
            r.raise_for_status()
            raw = r.json()
            break
        except Exception as e:  # limited retries with backoff
            last = e
            time.sleep(2 ** i)
    else:
        raise RuntimeError(f"NASA POWER request failed: {last}")
    body = json.dumps(raw, sort_keys=True).encode()
    out = {
        "raw": raw,
        "manifest": {
            "url": str(r.url), "retrievedAt": datetime.now(timezone.utc).isoformat(),
            "sha256": hashlib.sha256(body).hexdigest(),
            "apiVersion": raw.get("header", {}).get("api", {}).get("version"),
            "fillValue": raw.get("header", {}).get("fill_value"),
            "units": {k: v.get("units") for k, v in raw.get("parameters", {}).items()},
            "effectiveLocation": raw.get("geometry", {}).get("coordinates"),
            "sourceType": "reanalysis", "timeStandard": "UTC",
        },
    }
    _cache[key] = out
    return out
