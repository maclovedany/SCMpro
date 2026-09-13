import numpy as np, pandas as pd
from scm_engine.forecast.registry import run_series_method, SERIES_METHODS, eligible, MethodSpec
from scm_engine.forecast.methods.ml import GlobalLGBM
from scm_engine.forecast.methods.mc import ol_bias

rng = np.random.default_rng(0)
SEASONAL = np.array([100 + 30 * np.sin(2 * np.pi * i / 12) + rng.normal(0, 5) for i in range(36)]).clip(0)
INTERMIT = np.array([0, 0, 5, 0, 0, 0, 7, 0, 0, 4, 0, 0] * 3, dtype=float)

def test_all_series_methods_return_nonneg_horizon():
    for key in SERIES_METHODS:
        if key == "prophet":
            continue   # 느림 — 별도 테스트
        for y in (SEASONAL, INTERMIT, np.zeros(12)):
            f = run_series_method(key, y, 6, {"window": 3} if key == "ma3" else {})
            assert f.point.shape == (6,) and (f.point >= 0).all(), key
            if f.lower is not None:
                assert (f.lower <= f.point + 1e-9).all() and (f.upper >= f.point - 1e-9).all(), key

def test_snaive_uses_last_year():
    y = np.array([10] * 12 + [20] * 12, dtype=float)
    f = run_series_method("snaive", y, 3, {"trend_window": 6})
    assert f.point[0] > 15   # 전년 20 × 추세비(≥1)

def test_hw_captures_seasonality():
    f = run_series_method("hw", SEASONAL, 12, {"period": 12})
    assert f.point.std() > 5

def test_croston_sba_lower_than_croston():
    c = run_series_method("croston", INTERMIT, 1, {"alpha": 0.1}).point[0]
    s = run_series_method("sba", INTERMIT, 1, {"alpha": 0.1}).point[0]
    assert 0 < s < c

def test_prophet_smoke():
    f = run_series_method("prophet", SEASONAL, 3, {"_start": "2023-04-01"})
    assert f.point.shape == (3,) and (f.point >= 0).all()

def test_lgbm_global_fit_predict():
    months = pd.period_range("2023-04", "2026-03", freq="M").strftime("%Y-%m")
    rows = []
    for k in range(30):
        base = 50 + k
        for i, ym in enumerate(months):
            rows.append({"key_code": f"K{k}", "ym": ym, "qty": max(0, base + 10 * np.sin(2 * np.pi * i / 12) + rng.normal(0, 3)), "cat": "PART", "pat": "smooth"})
    panel = pd.DataFrame(rows)
    m = GlobalLGBM({"lags": 12, "n_estimators": 50}).fit(panel)
    hist = {f"K{k}": panel[panel.key_code == f"K{k}"]["qty"].to_numpy() for k in range(3)}
    out = m.predict(hist, {k: ("PART", "smooth") for k in hist}, "2026-03", 6)
    assert out["K0"].shape == (6,) and (out["K0"] >= 0).all()
    assert abs(out["K0"].mean() - 50) < 25

def test_ol_bias_corrects_overforecast():
    f = ol_bias(np.array([130.0, 130.0]), np.array([130.0] * 12), np.array([100.0] * 12), {})
    assert abs(f.point[0] - 91) < 1   # bias 0.3 → ×0.7

def test_eligible_rules():
    spec = MethodSpec("hw", "ets", ["smooth", "erratic"], ["A", "B"], "both", 24, True, False, {})
    assert eligible(spec, "smooth", "A", 36, "item", None)
    assert not eligible(spec, "lumpy", "A", 36, "item", None)
    assert not eligible(spec, "smooth", "C", 36, "item", None)
    assert not eligible(spec, "smooth", "A", 12, "item", None)
    assert not eligible(spec, "smooth", "A", 36, "item", ["ma3"])
    base = MethodSpec("baseline6", "simple", [], [], "both", 3, True, True, {})
    assert eligible(base, "dead", "C", 3, "item", ["ma3"])
