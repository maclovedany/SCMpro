import numpy as np, pandas as pd
from scm_engine.forecast import metrics
from scm_engine.forecast.classify import sbc_pattern, xyz_class, abc_class, classify_items

def test_metrics_basic():
    m = metrics.all_metrics([110, 90, 100], [100, 100, 100])
    assert abs(m["wape"] - 20 / 300) < 1e-9 and abs(m["bias"]) < 1e-9 and m["n"] == 3
    assert metrics.wape([1, 2], [0, 0]) is None
    assert metrics.mape([1, 2], [0, 4]) == 0.5

def test_sbc_patterns():
    assert sbc_pattern(np.array([10, 11, 9, 10, 12, 10]))[0] == "smooth"
    assert sbc_pattern(np.array([0, 0, 5, 0, 0, 5, 0, 0]))[0] == "intermittent"
    assert sbc_pattern(np.array([0, 0, 50, 0, 0, 1, 0, 0]))[0] == "lumpy"
    assert sbc_pattern(np.zeros(6))[0] == "dead"

def test_xyz_abc():
    assert xyz_class(np.array([10, 10, 10]))[0] == "X"
    assert xyz_class(np.array([0, 20, 0, 20]))[0] == "Y" or xyz_class(np.array([0, 20, 0, 20]))[0] == "Z"
    cls = abc_class(pd.Series({"a": 80, "b": 15, "c": 5}))
    assert cls.to_dict() == {"a": "A", "b": "B", "c": "C"}

def test_classify_items_shape():
    months = pd.period_range("2024-01", "2026-06", freq="M").strftime("%Y-%m")
    rows = []
    for k, base in [("A1", 100), ("B1", 10), ("C1", 1)]:
        for i, ym in enumerate(months):
            rows.append({"key_code": k, "category": "PART", "ym": ym, "qty": base if (k != "C1" or i % 4 == 0) else 0})
    df = classify_items(pd.DataFrame(rows))
    assert set(df.columns) >= {"key_code", "pattern", "abc", "xyz", "value_12m", "share"}
    assert df.set_index("key_code").loc["A1", "abc"] == "A"
    assert df.set_index("key_code").loc["C1", "pattern"] in ("intermittent", "lumpy")
