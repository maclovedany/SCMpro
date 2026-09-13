"""기종(MC) 전용: OL 편향 보정 (D-002). system = scm_ol × (1 − bias_hist), bias_hist = 학습 구간 Σ(ol−act)/Σact."""
from __future__ import annotations
import numpy as np
from . import Forecast

def ol_bias(ol_future: np.ndarray, ol_hist: np.ndarray, act_hist: np.ndarray, params: dict) -> Forecast:
    m = ~(np.isnan(ol_hist) | np.isnan(act_hist))
    s = act_hist[m].sum()
    b = float((ol_hist[m] - act_hist[m]).sum() / s) if s > 0 else 0.0
    b = float(np.clip(b, -0.5, 0.8))
    pt = np.nan_to_num(ol_future, nan=0.0) * (1 - b) if b > -1 else ol_future
    return Forecast(np.clip(pt, 0, None), meta={"bias_hist": b})
