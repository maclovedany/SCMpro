"""FY 롤링 백테스트 + 프로덕션 예측 (R-FC-30/31/40/41). 품목(item)과 기종(model) 두 레벨."""
from __future__ import annotations
import logging
from dataclasses import dataclass
import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from ..fiscal import fy_range
from .registry import MethodSpec, run_series_method, eligible, GLOBAL_METHODS, MC_METHODS
from .methods.ml import GlobalLGBM
from .methods.mc import ol_bias
from .metrics import all_metrics
from .classify import classify_items

log = logging.getLogger(__name__)
SIMPLE_PRIORITY = ["baseline6", "ma3", "ma12", "snaive", "ses", "holt", "croston", "sba", "hw", "arima", "lgbm", "prophet", "ol_bias"]

@dataclass
class Config:
    methods: list[MethodSpec]
    policy: dict[str, list[str]]
    fy_start: int = 4
    n_jobs: int = 6
    heavy_limit: int | None = None     # 테스트용: arima/prophet 대상 품목 상한

def _months_between(a: str, b: str) -> list[str]:
    return list(pd.period_range(a, b, freq="M").strftime("%Y-%m"))

def _specs(cfg: Config) -> dict[str, MethodSpec]:
    return {m.key: m for m in cfg.methods}

def _candidates(cfg: Config, pattern: str, abc: str, xyz: str, n_hist: int, level: str) -> list[MethodSpec]:
    pol = cfg.policy.get(f"{abc}{xyz}")
    return [m for m in cfg.methods if eligible(m, pattern, abc, n_hist, level, pol)]

def trim_leading_zeros(y: np.ndarray) -> np.ndarray:
    """품목 이력 시작 전 0 구간 제거 (과거 연도 추가 시 달력이 전체로 늘어나므로, D-030)"""
    nz = np.flatnonzero(np.asarray(y) > 0)
    return np.asarray(y)[nz[0]:] if len(nz) else np.asarray(y)

def _forecast_one(key: str, y: np.ndarray, h: int, cands: list[MethodSpec], start_ym: str) -> dict[str, tuple[np.ndarray, np.ndarray | None, np.ndarray | None]]:
    out = {}
    y = trim_leading_zeros(y)
    for m in cands:
        if m.key in GLOBAL_METHODS or m.key in MC_METHODS:
            continue
        try:
            p = dict(m.params); p["_start"] = f"{start_ym}-01"
            f = run_series_method(m.key, y, h, p)
            out[m.key] = (f.point, f.lower, f.upper)
        except Exception as e:  # 기법 실패는 후보 제외
            log.debug("method %s failed for %s: %s", m.key, key, e)
    return out

def _pick_champion(scores: dict[str, float | None], baseline_key: str = "baseline6") -> str:
    """WAPE 최소. 기준선보다 나쁘면 기준선. 동률은 단순 기법 우선 (R-FC-31)."""
    valid = {k: v for k, v in scores.items() if v is not None}
    if not valid:
        return baseline_key
    best = min(valid.values())
    ties = [k for k, v in valid.items() if abs(v - best) < 1e-9]
    ties.sort(key=lambda k: SIMPLE_PRIORITY.index(k) if k in SIMPLE_PRIORITY else 99)
    champ = ties[0]
    if baseline_key in valid and valid[baseline_key] <= best + 1e-9:
        return baseline_key
    return champ

def run_items(monthly: pd.DataFrame, prices: pd.Series | None, cfg: Config, *, train_to: str, horizon: int,
              eval_actual: pd.DataFrame | None = None, item_ol: pd.DataFrame | None = None) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """품목 레벨. monthly: [key_code, category, ym, qty] 전체 이력(0채움).
    train_to 까지 학습, horizon 개월 예측. eval_actual 이 있으면(백테스트) 정확도 계산·챔피언 선택, 없으면(프로덕션) item_class.champion_method 를 쓴다.
    item_ol: 품목 제출 OL [key_code, ym, qty] (D-040) — 평가월에 OL 이 있으면 method='scm_ol' 로 채점, ol_bias 스펙이 item 레벨이면 후보로도 사용.
    반환: results(level,key_code,category,ym,method,value,lower,upper,is_champion,actual), item_class, accuracy(item 레벨)."""
    train = monthly[monthly["ym"] <= train_to]
    months = sorted(train["ym"].unique())
    fut_months = _months_between(pd.Period(train_to, "M") + 1, pd.Period(train_to, "M") + horizon) if horizon else []
    fut_months = [str(m) for m in fut_months]
    cls = classify_items(train, prices)
    cls_map = cls.set_index("key_code")
    series = {k: g.set_index("ym")["qty"].reindex(months, fill_value=0.0).to_numpy(dtype=float) for k, g in train.groupby("key_code", sort=False)}
    cats = train.groupby("key_code")["category"].first()

    # 후보 산정
    cand_map = {}
    heavy_count = 0
    for k in series:
        r = cls_map.loc[k]
        nz = int((series[k] > 0).sum())
        cands = _candidates(cfg, r["pattern"], r["abc"], r["xyz"], len(trim_leading_zeros(series[k])) if nz else 0, "item")
        if cfg.heavy_limit is not None:
            if any(c.key in ("arima", "prophet") for c in cands):
                heavy_count += 1
                if heavy_count > cfg.heavy_limit:
                    cands = [c for c in cands if c.key not in ("arima", "prophet")]
        cand_map[k] = cands

    # 시계열 기법 (병렬)
    start_ym = months[0]
    keys = list(series.keys())
    res = Parallel(n_jobs=cfg.n_jobs, batch_size=64)(delayed(_forecast_one)(k, series[k], horizon, cand_map[k], start_ym) for k in keys)
    fc: dict[str, dict] = dict(zip(keys, res))

    # 전역 LightGBM
    lgbm_spec = next((m for m in cfg.methods if m.key == "lgbm" and m.enabled), None)
    if lgbm_spec and horizon:
        panel = train.rename(columns={"category": "cat"}).copy()
        panel["pat"] = panel["key_code"].map(cls_map["pattern"])
        model = GlobalLGBM(lgbm_spec.params).fit(panel[["key_code", "ym", "qty", "cat", "pat"]], cfg.fy_start)
        targets = [k for k in keys if any(c.key == "lgbm" for c in cand_map[k])]
        if targets:
            pred = model.predict({k: series[k] for k in targets}, {k: (cats[k], cls_map.loc[k, "pattern"]) for k in targets}, train_to, horizon, cfg.fy_start)
            for k, v in pred.items():
                fc[k]["lgbm"] = (v, None, None)

    # 품목 제출 OL (D-040): 미래 OL → ol_bias 후보(스펙 level 이 item/both 일 때), 평가월 OL → scm_ol 채점
    ol_fut_map, ol_hist_map = {}, {}
    if item_ol is not None and not item_ol.empty:
        for k, g in item_ol.groupby("key_code"):
            if k not in series: continue
            gi = g.set_index("ym")["qty"]
            ol_fut_map[k] = gi.reindex(fut_months).to_numpy(dtype=float)
            ol_hist_map[k] = gi.reindex(months).to_numpy(dtype=float)
        ob = next((m for m in cfg.methods if m.key == "ol_bias" and m.enabled and m.level in ("item", "both")), None)
        if ob is not None and horizon:
            from .methods.mc import ol_bias
            for k, olf in ol_fut_map.items():
                oh = ol_hist_map[k]; overlap = int((~np.isnan(oh) & (series[k] >= 0)).sum())
                if np.isnan(olf).any() or overlap < ob.min_history: continue
                fc[k]["ol_bias"] = (ol_bias(olf, oh, series[k], ob.params).point, None, None)

    # 정확도·챔피언
    act_map = {}
    if eval_actual is not None:
        for k, g in eval_actual.groupby("key_code"):
            act_map[k] = g.set_index("ym")["qty"].reindex(fut_months).to_numpy(dtype=float)
    rows, acc_rows, champions = [], [], {}
    for k in keys:
        scores = {}
        a = act_map.get(k)
        for mk, (pt, lo, up) in fc[k].items():
            if a is not None:
                m = all_metrics(pt, a); scores[mk] = m["wape"]
                acc_rows.append({"level": "item", "key": k, "method": mk, **m})
        if a is not None and k in ol_fut_map and not np.isnan(ol_fut_map[k]).all():
            acc_rows.append({"level": "item", "key": k, "method": "scm_ol", **all_metrics(ol_fut_map[k], a)})   # 제출 OL 채점 (후보 아님)
        if eval_actual is not None:
            champ = _pick_champion(scores)
        else:
            champ = cls_map.loc[k].get("champion_method") if "champion_method" in cls_map.columns else None
            if champ not in fc[k]:
                champ = _pick_champion({mk: None for mk in fc[k]}) if not fc[k] else ("baseline6" if "baseline6" in fc[k] else next(iter(fc[k])))
        champions[k] = champ
        for mk, (pt, lo, up) in fc[k].items():
            for i, ym in enumerate(fut_months):
                rows.append({"level": "item", "key_code": k, "category": cats[k], "ym": ym, "method": mk, "value": round(float(pt[i]), 3),
                             "lower": None if lo is None else round(float(lo[i]), 3), "upper": None if up is None else round(float(up[i]), 3),
                             "is_champion": mk == champ, "actual": None if a is None or np.isnan(a[i]) else float(a[i])})
    cls["champion_method"] = cls["key_code"].map(champions)
    return pd.DataFrame(rows), cls, pd.DataFrame(acc_rows)

def run_models(mc: pd.DataFrame, cfg: Config, *, train_to: str, horizon: int, eval_to: str | None, model_champ: dict[str, str] | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """기종 레벨. mc: [model_base, biz, ym, sales_ol, scm_ol, act]. ACT 시계열 기법 + ol_bias. 백테스트면 eval 구간 정확도·챔피언, 또 Sales/SCM OL 정확도(level='ol') 도 기록."""
    mc = mc.sort_values(["model_base", "ym"])
    fut_months = [str(m) for m in _months_between(pd.Period(train_to, "M") + 1, pd.Period(train_to, "M") + horizon)]
    rows, acc = [], []
    ol_specs = [m for m in cfg.methods if m.key in MC_METHODS and m.enabled]
    for mb, g in mc.groupby("model_base"):
        g = g.set_index("ym")
        hist = g[g.index <= train_to]
        y = hist["act"].fillna(0).clip(lower=0).to_numpy(dtype=float)
        if len(y) < 6 or y.sum() == 0:
            continue
        from .classify import sbc_pattern, xyz_class
        pat, _, _ = sbc_pattern(y[-24:]); xyz, _ = xyz_class(y[-24:])
        abc = "A" if y[-12:].sum() >= 100 else "B" if y[-12:].sum() >= 20 else "C"
        cands = [m for m in cfg.methods if eligible(m, pat, abc, len(y), "model", None) and m.key not in GLOBAL_METHODS and m.key not in MC_METHODS]
        fc = _forecast_one(mb, y, horizon, cands, str(hist.index[0]))
        fut = g.reindex(fut_months)
        for spec in ol_specs:
            src = spec.params.get("source", "scm_ol")
            ol_fut = fut[src].to_numpy(dtype=float)
            if np.isnan(ol_fut).all():
                continue   # 미래 OL 없음 → ol_bias 사용 불가
            f = ol_bias(ol_fut, hist[src].to_numpy(dtype=float), hist["act"].to_numpy(dtype=float), spec.params)
            fc["ol_bias"] = (f.point, None, None)
        a = fut["act"].to_numpy(dtype=float) if eval_to else None
        scores = {}
        if a is not None:
            for mk, (pt, lo, up) in fc.items():
                m = all_metrics(pt, a); scores[mk] = m["wape"]; acc.append({"level": "model", "key": mb, "method": mk, **m})
            for olk in ("sales_ol", "scm_ol"):
                m = all_metrics(fut[olk].to_numpy(dtype=float), a); acc.append({"level": "model", "key": mb, "method": olk, **m})
        if a is not None:
            champ = _pick_champion(scores)
        else:
            champ = (model_champ or {}).get(mb)
            if champ not in fc:
                champ = "ol_bias" if "ol_bias" in fc else ("baseline6" if "baseline6" in fc else next(iter(fc), "baseline6"))
        for mk, (pt, lo, up) in fc.items():
            for i, ym in enumerate(fut_months):
                rows.append({"level": "model", "key_code": mb, "category": g["biz"].dropna().iloc[0] if g["biz"].notna().any() else None, "ym": ym, "method": mk,
                             "value": round(float(pt[i]), 3), "lower": None if lo is None else round(float(lo[i]), 3), "upper": None if up is None else round(float(up[i]), 3),
                             "is_champion": mk == champ, "actual": None if a is None or np.isnan(a[i]) else float(a[i])})
    return pd.DataFrame(rows), pd.DataFrame(acc)

def aggregate_accuracy(results: pd.DataFrame, item_class: pd.DataFrame | None) -> pd.DataFrame:
    """레벨별 집계 (R-FC-41): total / category / abcxyz / pattern / biz — 챔피언 기준 + 기법별."""
    r = results.dropna(subset=["actual"]).copy()
    if r.empty:
        return pd.DataFrame(columns=["level", "key", "method", "bias", "wape", "mape", "n", "sum_actual"])
    if item_class is not None:
        ic = item_class.set_index("key_code")
        r["cell"] = r["key_code"].map(ic["abc"].astype(str) + ic["xyz"].astype(str))
        r["pattern"] = r["key_code"].map(ic["pattern"])
    out = []
    def agg(df, level, key, method):
        m = all_metrics(df["value"].to_numpy(), df["actual"].to_numpy()); out.append({"level": level, "key": key, "method": method, **m})
    for lvl in ("item", "model"):
        d = r[r.level == lvl]
        if d.empty: continue
        champ = d[d.is_champion]
        agg(champ, "total", lvl, "champion")
        for mk, dm in d.groupby("method"): agg(dm, "total", lvl, mk)
        for cat, dc in champ.groupby("category"): agg(dc, "category" if lvl == "item" else "biz", str(cat), "champion")
        if lvl == "item" and "cell" in d:
            for cell, dc in champ.groupby("cell"): agg(dc, "abcxyz", str(cell), "champion")
            for pat, dc in champ.groupby("pattern"): agg(dc, "pattern", str(pat), "champion")
    return pd.DataFrame(out)
