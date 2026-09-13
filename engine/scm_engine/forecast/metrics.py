"""정확도 지표 (spec §8). WAPE = Σ|f−a|/Σa, Bias = Σ(f−a)/Σa (양수=과대), MAPE = mean(|f−a|/a | a>0)."""
from __future__ import annotations
import numpy as np

def _arr(x):
    a = np.asarray(x, dtype=float)
    return a

def wape(f, a) -> float | None:
    f, a = _arr(f), _arr(a)
    m = ~(np.isnan(f) | np.isnan(a))
    s = a[m].sum()
    return None if s <= 0 else float(np.abs(f[m] - a[m]).sum() / s)

def bias(f, a) -> float | None:
    f, a = _arr(f), _arr(a)
    m = ~(np.isnan(f) | np.isnan(a))
    s = a[m].sum()
    return None if s <= 0 else float((f[m] - a[m]).sum() / s)

def mape(f, a) -> float | None:
    f, a = _arr(f), _arr(a)
    m = ~(np.isnan(f) | np.isnan(a)) & (a > 0)
    return None if m.sum() == 0 else float(np.mean(np.abs(f[m] - a[m]) / a[m]))

def all_metrics(f, a) -> dict:
    f, a = _arr(f), _arr(a)
    m = ~(np.isnan(f) | np.isnan(a))
    return {"bias": bias(f, a), "wape": wape(f, a), "mape": mape(f, a), "n": int(m.sum()), "sum_actual": float(a[m].sum())}
