"""기법 키 → 함수. DB app.forecast_method 의 enabled/params/patterns/abc_scope 로 후보를 거른다 (R-FC-34)."""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from .methods import Forecast, simple, ets, intermittent, stat

SERIES_METHODS = {
    "baseline6": simple.baseline6, "ma3": simple.moving_average, "ma12": simple.moving_average, "snaive": simple.seasonal_naive,
    "ses": ets.ses, "holt": ets.holt, "hw": ets.holt_winters,
    "croston": intermittent.croston, "sba": intermittent.sba,
    "arima": stat.arima, "prophet": stat.prophet,
}
GLOBAL_METHODS = {"lgbm"}      # 패널 단위 1회 학습
MC_METHODS = {"ol_bias"}       # 기종 전용, OL 필요

@dataclass
class MethodSpec:
    key: str; family: str; patterns: list[str]; abc_scope: list[str]; level: str
    min_history: int; enabled: bool; is_baseline: bool; params: dict

def run_series_method(key: str, y: np.ndarray, h: int, params: dict) -> Forecast:
    fn = SERIES_METHODS[key]
    return fn(np.asarray(y, dtype=float), h, params).clipped()

def eligible(spec: MethodSpec, pattern: str, abc: str, n_hist: int, level: str, policy_methods: list[str] | None) -> bool:
    if not spec.enabled: return False
    if spec.level not in (level, "both"): return False
    if spec.is_baseline: return True
    if pattern not in spec.patterns and pattern != "dead": return False
    if abc not in spec.abc_scope: return False
    if n_hist < spec.min_history: return False
    if policy_methods is not None and spec.key not in policy_methods: return False
    return True
