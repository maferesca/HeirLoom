"""Pollination heat-stress coefficient (spec 11).

The AquaCrop eq. 3.2c logistic function is NOT verified here against the official
code (release/commit not pinned). In real mode H stays `pending`; `kh_logistic`
exists only for synthetic tests and is flagged unverified.
"""
from __future__ import annotations

import math

KH_VERIFIED = False  # set True only after pinning and comparing with AquaCrop code


def kh_logistic_unverified(t: float, t_start: float, span: float = 5.0) -> float:
    if t <= t_start:
        return 1.0
    if t >= t_start + span:
        return 0.0
    x = (t - t_start) / span
    return 1.0 / (1.0 + math.exp(12.0 * (x - 0.5)))  # PLACEHOLDER shape, not AquaCrop


def heat_status() -> dict:
    return {"status": "pending", "reason": "AquaCrop Kh function not yet verified against pinned official code"}
