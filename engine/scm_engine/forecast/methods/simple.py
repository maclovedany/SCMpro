"""단순 기법: 이동평균, 기준선, 전년동월×추세 (R-FC-31, R-FC-08)."""
from __future__ import annotations
import numpy as np
from . import Forecast, flat

def moving_average(y: np.ndarray, h: int, params: dict) -> Forecast:
    w = int(params.get("window", 6))
    tail = y[-w:] if len(y) >= 1 else y
    return Forecast(flat(tail.mean() if len(tail) else 0.0, h), meta={"window": w})

def baseline6(y: np.ndarray, h: int, params: dict) -> Forecast:
    return moving_average(y, h, {"window": 6})

def seasonal_naive(y: np.ndarray, h: int, params: dict) -> Forecast:
    """전년동월 × (최근 tw개월 / 전년 같은 tw개월) 추세비. 12개월 미만이면 평균으로 폴백."""
    tw = int(params.get("trend_window", 6))
    if len(y) < 12:
        return moving_average(y, h, {"window": 6})
    recent = y[-tw:].sum(); prev = y[-12 - tw:-12].sum() if len(y) >= 12 + tw else 0.0
    ratio = float(recent / prev) if prev > 0 else 1.0
    ratio = float(np.clip(ratio, 0.5, 2.0))
    pts = np.array([y[len(y) - 12 + (i % 12)] * ratio for i in range(h)], dtype=float)
    return Forecast(pts, meta={"trend_ratio": ratio})
