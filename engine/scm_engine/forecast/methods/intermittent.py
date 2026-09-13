"""간헐수요: Croston, SBA (Syntetos-Boylan 보정)."""
from __future__ import annotations
import numpy as np
from . import Forecast, flat

def _croston_core(y: np.ndarray, alpha: float) -> tuple[float, float]:
    nz_idx = np.flatnonzero(y > 0)
    if len(nz_idx) == 0:
        return 0.0, 1.0
    z = float(y[nz_idx[0]]); p = float(nz_idx[0] + 1)
    last = nz_idx[0]
    for i in nz_idx[1:]:
        q = float(i - last)
        z = z + alpha * (float(y[i]) - z)
        p = p + alpha * (q - p)
        last = i
    return z, max(p, 1.0)

def croston(y: np.ndarray, h: int, params: dict) -> Forecast:
    a = float(params.get("alpha", 0.1))
    z, p = _croston_core(y, a)
    return Forecast(flat(z / p, h), meta={"z": z, "p": p})

def sba(y: np.ndarray, h: int, params: dict) -> Forecast:
    a = float(params.get("alpha", 0.1))
    z, p = _croston_core(y, a)
    return Forecast(flat((1 - a / 2) * z / p, h), meta={"z": z, "p": p})
