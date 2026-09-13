"""통계 모델: AutoARIMA (statsforecast), Prophet. 느리므로 A/B 등급에만 (spec §3)."""
from __future__ import annotations
import logging, warnings
import numpy as np
import pandas as pd
from . import Forecast, flat

logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

def arima(y: np.ndarray, h: int, params: dict) -> Forecast:
    from statsforecast.models import AutoARIMA
    if len(y) < 12 or y.sum() == 0:
        return Forecast(flat(y[-6:].mean() if len(y) else 0, h))
    m = int(params.get("season_length", 12))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            model = AutoARIMA(season_length=m if len(y) >= 2 * m else 1)
            res = model.forecast(y=y.astype(float), h=h, level=[80])
        except Exception:
            return Forecast(flat(y[-6:].mean(), h))
    return Forecast(np.asarray(res["mean"]), np.asarray(res.get("lo-80", res["mean"])), np.asarray(res.get("hi-80", res["mean"])))

def prophet(y: np.ndarray, h: int, params: dict) -> Forecast:
    from prophet import Prophet
    if len(y) < 24 or y.sum() == 0:
        return Forecast(flat(y[-6:].mean() if len(y) else 0, h))
    start = pd.Timestamp(params.get("_start", "2020-01-01"))
    ds = pd.date_range(start, periods=len(y), freq="MS")
    df = pd.DataFrame({"ds": ds, "y": y.astype(float)})
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            m = Prophet(yearly_seasonality=bool(params.get("yearly_seasonality", True)), weekly_seasonality=False, daily_seasonality=False,
                        interval_width=0.8, uncertainty_samples=100)
            m.fit(df)
            fut = pd.DataFrame({"ds": pd.date_range(ds[-1] + pd.offsets.MonthBegin(1), periods=h, freq="MS")})
            fc = m.predict(fut)
        except Exception:
            return Forecast(flat(y[-6:].mean(), h))
    return Forecast(fc["yhat"].to_numpy(), fc["yhat_lower"].to_numpy(), fc["yhat_upper"].to_numpy())
