"""지수평활 계열 (statsmodels). SES / Holt(damped) / Holt-Winters 가법 12."""
from __future__ import annotations
import warnings
import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing
from . import Forecast, flat

def _band(point: np.ndarray, resid: np.ndarray, h: int) -> tuple[np.ndarray, np.ndarray]:
    s = float(np.nanstd(resid)) if len(resid) > 2 else 0.0
    k = 1.28 * s * np.sqrt(np.arange(1, h + 1))   # 80% 구간, 지평선에 따라 확대
    return point - k, point + k

def ses(y: np.ndarray, h: int, params: dict) -> Forecast:
    if len(y) < 3 or y.sum() == 0:
        return Forecast(flat(y.mean() if len(y) else 0, h))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = SimpleExpSmoothing(y, initialization_method="estimated").fit(optimized=True)
    pt = fit.forecast(h)
    lo, up = _band(pt, fit.resid, h)
    return Forecast(pt, lo, up, {"alpha": float(fit.params.get("smoothing_level", np.nan))})

def holt(y: np.ndarray, h: int, params: dict) -> Forecast:
    if len(y) < 6 or y.sum() == 0:
        return ses(y, h, params)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ExponentialSmoothing(y, trend="add", damped_trend=bool(params.get("damped", True)), initialization_method="estimated").fit(optimized=True)
    pt = fit.forecast(h)
    lo, up = _band(pt, fit.resid, h)
    return Forecast(pt, lo, up)

def holt_winters(y: np.ndarray, h: int, params: dict) -> Forecast:
    period = int(params.get("period", 12))
    if len(y) < 2 * period or y.sum() == 0:
        return holt(y, h, params)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            fit = ExponentialSmoothing(y, trend="add", damped_trend=True, seasonal=params.get("seasonal", "add"),
                                       seasonal_periods=period, initialization_method="estimated").fit(optimized=True)
        except Exception:
            return holt(y, h, params)
    pt = fit.forecast(h)
    lo, up = _band(pt, fit.resid, h)
    return Forecast(pt, lo, up)
