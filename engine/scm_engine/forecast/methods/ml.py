"""LightGBM 전역 회귀 (spec §4 lgbm): 전 품목을 하나의 모델로. 피처 = lag1..L, rolling mean 3/6/12, 월(FY 기준), 카테고리, 패턴.
재귀 예측(직전 예측을 lag 로 사용)."""
from __future__ import annotations
import numpy as np
import pandas as pd

FEATS_BASE = ["rm3", "rm6", "rm12", "month", "cat", "pat"]

def _fy_month(ym: str, start: int) -> int:
    m = int(ym[5:7]); return ((m - start) % 12) + 1

def build_train(panel: pd.DataFrame, lags: int, fy_start: int = 4) -> tuple[pd.DataFrame, list[str]]:
    """panel: [key_code, ym, qty, cat, pat] (0채움, ym 정렬). 반환 학습 프레임(target=qty)."""
    panel = panel.sort_values(["key_code", "ym"]).copy()
    g = panel.groupby("key_code")["qty"]
    for l in range(1, lags + 1):
        panel[f"lag{l}"] = g.shift(l)
    for w in (3, 6, 12):
        panel[f"rm{w}"] = g.shift(1).rolling(w, min_periods=1).mean().reset_index(level=0, drop=True)
    panel["month"] = panel["ym"].map(lambda s: _fy_month(s, fy_start))
    feats = [f"lag{l}" for l in range(1, lags + 1)] + FEATS_BASE
    return panel.dropna(subset=[f"lag{lags}"]), feats

class GlobalLGBM:
    def __init__(self, params: dict):
        self.lags = int(params.get("lags", 12))
        self.params = {"n_estimators": int(params.get("n_estimators", 300)), "learning_rate": float(params.get("learning_rate", 0.05)),
                       "num_leaves": 31, "min_child_samples": 20, "subsample": 0.8, "colsample_bytree": 0.8, "verbose": -1, "n_jobs": 4}
        self.model = None; self.feats = None; self.cat_map = {}; self.pat_map = {}

    def fit(self, panel: pd.DataFrame, fy_start: int = 4):
        import lightgbm as lgb
        p = panel.copy()
        self.cat_map = {c: i for i, c in enumerate(sorted(p["cat"].unique()))}
        self.pat_map = {c: i for i, c in enumerate(sorted(p["pat"].unique()))}
        p["cat"] = p["cat"].map(self.cat_map); p["pat"] = p["pat"].map(self.pat_map)
        tr, feats = build_train(p, self.lags, fy_start)
        self.feats = feats
        self.model = lgb.LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3, **self.params)
        self.model.fit(tr[feats], tr["qty"])
        return self

    def predict(self, hist: dict[str, np.ndarray], meta: dict[str, tuple[str, str]], last_ym: str, h: int, fy_start: int = 4) -> dict[str, np.ndarray]:
        """hist: key → 과거 수요 배열(마지막 = last_ym). meta: key → (cat, pat). 재귀 h 스텝."""
        keys = list(hist.keys())
        series = {k: list(hist[k].astype(float)) for k in keys}
        out = {k: [] for k in keys}
        y, m = int(last_ym[:4]), int(last_ym[5:7])
        for step in range(h):
            m += 1
            if m > 12: m = 1; y += 1
            ym = f"{y}-{m:02d}"
            rows = []
            for k in keys:
                s = series[k]
                row = {f"lag{l}": (s[-l] if len(s) >= l else 0.0) for l in range(1, self.lags + 1)}
                for w in (3, 6, 12): row[f"rm{w}"] = float(np.mean(s[-w:])) if s else 0.0
                row["month"] = _fy_month(ym, fy_start)
                row["cat"] = self.cat_map.get(meta[k][0], 0); row["pat"] = self.pat_map.get(meta[k][1], 0)
                rows.append(row)
            X = pd.DataFrame(rows, columns=self.feats)
            pred = np.clip(self.model.predict(X), 0, None)
            for k, v in zip(keys, pred):
                out[k].append(float(v)); series[k].append(float(v))
        return {k: np.array(v) for k, v in out.items()}
