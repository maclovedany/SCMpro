"""소규모 end-to-end: 합성 패널 → run_items 백테스트 → 챔피언·정확도 형태 검증 (DB 없음)."""
import numpy as np, pandas as pd
from scm_engine.forecast.backtest import Config, run_items, run_models, aggregate_accuracy, _pick_champion
from scm_engine.forecast.registry import MethodSpec

def _spec(key, fam="simple", pats=("smooth","erratic","intermittent","lumpy"), abc=("A","B","C"), level="both", mh=3, base=False, params=None):
    return MethodSpec(key, fam, list(pats), list(abc), level, mh, True, base, params or {})

CFG = Config(methods=[_spec("baseline6", base=True, params={"window": 6}), _spec("ma3", params={"window": 3}), _spec("snaive", mh=24), _spec("ses", "ets", ("smooth","erratic")),
                      _spec("croston", "intermittent", ("intermittent","lumpy"), level="item"), _spec("lgbm", "ml", mh=12, level="item", params={"lags": 6, "n_estimators": 30}),
                      _spec("ol_bias", "mc", level="model")],
             policy={}, n_jobs=1)

def _panel():
    months = pd.period_range("2023-04", "2026-03", freq="M").strftime("%Y-%m")
    rng = np.random.default_rng(1); rows = []
    for k in range(12):
        for i, ym in enumerate(months):
            q = max(0, 100 + 30 * np.sin(2 * np.pi * i / 12) + rng.normal(0, 8)) if k < 8 else (5 if i % 3 == 0 else 0)
            rows.append({"key_code": f"K{k}", "category": "PART" if k < 6 else "SUPPLY", "ym": ym, "qty": float(q)})
    return pd.DataFrame(rows)

def test_run_items_backtest_and_champion():
    m = _panel()
    ev = m[(m.ym > "2025-03") & (m.ym <= "2026-03")]
    res, cls, acc = run_items(m, None, CFG, train_to="2025-03", horizon=12, eval_actual=ev)
    assert res.ym.min() == "2025-04" and res.ym.max() == "2026-03"
    assert res.groupby("key_code")["is_champion"].sum().eq(12).all()      # 품목당 챔피언 1기법 × 12개월
    assert set(cls.champion_method.unique()) <= {"baseline6", "ma3", "snaive", "ses", "croston", "lgbm"}
    assert (acc.level == "item").all() and acc.wape.notna().any()
    agg = aggregate_accuracy(res, cls)
    assert "total" in set(agg.level) and "category" in set(agg.level)

def test_champion_prefers_baseline_on_tie_and_beats_rule():
    assert _pick_champion({"baseline6": 0.3, "ses": 0.3}) == "baseline6"
    assert _pick_champion({"baseline6": 0.3, "ses": 0.2}) == "ses"
    assert _pick_champion({"baseline6": None, "ses": None}) == "baseline6"

def test_run_models_with_ol():
    months = pd.period_range("2023-04", "2026-03", freq="M").strftime("%Y-%m")
    rows = [{"model_base": "MDL1", "biz": "DT", "ym": ym, "sales_ol": 120.0, "scm_ol": 130.0, "act": 100.0} for ym in months]
    res, acc = run_models(pd.DataFrame(rows), CFG, train_to="2025-03", horizon=12, eval_to="2026-03")
    assert "ol_bias" in set(res.method)
    assert set(acc.method) >= {"sales_ol", "scm_ol", "ol_bias"}
    ob = res[(res.method == "ol_bias")].value.iloc[0]
    assert 85 < ob < 95      # 130 × (1 − 0.3) = 91


def test_trim_leading_zeros():
    from scm_engine.forecast.backtest import trim_leading_zeros
    assert list(trim_leading_zeros(np.array([0, 0, 3, 0, 5]))) == [3, 0, 5]
    assert len(trim_leading_zeros(np.zeros(4))) == 4
