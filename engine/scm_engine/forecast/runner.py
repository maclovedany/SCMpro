"""런 오케스트레이션: 데이터 로드 → 백테스트/프로덕션 → 저장. (spec §5)"""
from __future__ import annotations
import logging, time
import pandas as pd
from ..db.postgres import PostgresDB
from ..fiscal import fy_range
from .backtest import Config, run_items, run_models, aggregate_accuracy
from .registry import MethodSpec
from . import store

log = logging.getLogger(__name__)

def _cfg(db, n_jobs: int, heavy_limit: int | None = None) -> Config:
    ms = [MethodSpec(key=m["key"], family=m["family"], patterns=list(m["patterns"]), abc_scope=list(m["abc_scope"]), level=m["level"],
                     min_history=int(m["min_history"]), enabled=bool(m["enabled"]), is_baseline=bool(m["is_baseline"]), params=dict(m["params"] or {}))
          for m in store.load_methods(db)]
    settings = store.load_settings(db)
    return Config(methods=ms, policy=store.load_policy(db), fy_start=int(settings.get("fiscal_year_start_month", 4)), n_jobs=n_jobs, heavy_limit=heavy_limit)

def load_inputs(db) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    monthly = db.read_df("select key_code, category, ym, qty from analytics.v_item_monthly where category <> 'SW' order by key_code, ym")
    monthly["qty"] = monthly["qty"].astype(float).clip(lower=0)
    prices = db.read_df("select item_code, unit_price from app.item_setting where unit_price is not null").set_index("item_code")["unit_price"].astype(float)
    mc = db.read_df("""select p.model_base, coalesce(p.biz, m.biz) as biz, p.ym, p.sales_ol, p.scm_ol, p.act
        from raw.fact_mc_plan_actual p left join (select model_base, max(biz) biz from raw.dim_model where biz is not null group by 1) m on m.model_base = p.model_base
        where p.model_base is not null order by 1, 3""")
    for c in ("sales_ol", "scm_ol", "act"):
        mc[c] = mc[c].astype(float)
    # 같은 기종의 변형 model_key(예: MDL142, MDL142-1.5)는 기종·월로 합산 (전부 NaN 이면 NaN 유지)
    mc = mc.groupby(["model_base", "ym"], as_index=False).agg(biz=("biz", "first"), sales_ol=("sales_ol", lambda s: s.sum(min_count=1)),
                                                              scm_ol=("scm_ol", lambda s: s.sum(min_count=1)), act=("act", lambda s: s.sum(min_count=1)))
    return monthly, prices, mc

def backtest(db: PostgresDB, eval_fy: int, *, n_jobs: int = 6, heavy_limit: int | None = None, run_id: str | None = None, item_limit: int | None = None) -> str:
    t0 = time.time()
    cfg = _cfg(db, n_jobs, heavy_limit)
    monthly, prices, mc = load_inputs(db)
    if item_limit:
        keep = monthly.groupby("key_code")["qty"].sum().sort_values(ascending=False).head(item_limit).index
        monthly = monthly[monthly.key_code.isin(keep)]
    train_from = monthly["ym"].min()
    prev_to = fy_range(eval_fy - 1, cfg.fy_start)[1]
    ev_from, ev_to = fy_range(eval_fy, cfg.fy_start)
    last_actual = monthly["ym"].max()
    ev_to_eff = min(ev_to, last_actual)
    horizon = (pd.Period(ev_to_eff, "M") - pd.Period(prev_to, "M")).n
    rid = store.create_run(db, "backtest", eval_fy=eval_fy, train_from=train_from, train_to=prev_to, horizon=horizon,
                           params={"methods": [m.key for m in cfg.methods if m.enabled], "n_items": int(monthly.key_code.nunique()), "eval_to": ev_to_eff}, run_id=run_id)
    try:
        eval_actual = monthly[(monthly.ym > prev_to) & (monthly.ym <= ev_to_eff)]
        res_i, cls, acc_i = run_items(monthly, prices, cfg, train_to=prev_to, horizon=horizon, eval_actual=eval_actual)
        res_m, acc_m = run_models(mc, cfg, train_to=prev_to, horizon=horizon, eval_to=ev_to_eff)
        results = pd.concat([res_i, res_m], ignore_index=True)
        agg = aggregate_accuracy(results, cls)
        acc = pd.concat([acc_i, acc_m, agg], ignore_index=True)
        store.write_results(db, rid, results)
        store.write_accuracy(db, rid, acc)
        store.write_item_class(db, rid, cls[["key_code", "category", "pattern", "abc", "xyz", "adi", "cv2", "cv", "value_12m", "share", "champion_method"]])
        tot = agg[(agg.level == "total") & (agg.method == "champion")].set_index("key")
        summary = {"eval_fy": eval_fy, "train_to": prev_to, "eval_to": ev_to_eff, "n_items": int(cls.shape[0]), "n_models": int(res_m.key_code.nunique()) if not res_m.empty else 0,
                   "item_wape": float(tot.loc["item", "wape"]) if "item" in tot.index else None, "item_bias": float(tot.loc["item", "bias"]) if "item" in tot.index else None,
                   "model_wape": float(tot.loc["model", "wape"]) if "model" in tot.index else None, "model_bias": float(tot.loc["model", "bias"]) if "model" in tot.index else None,
                   "champion_share": cls["champion_method"].value_counts(normalize=True).round(3).to_dict(), "seconds": round(time.time() - t0, 1)}
        ol = acc_m[acc_m.method.isin(["sales_ol", "scm_ol"])] if not acc_m.empty else pd.DataFrame()
        if not ol.empty:
            from .metrics import all_metrics
            for k in ("sales_ol", "scm_ol"):
                d = res_m[res_m.method == "ol_bias"][["key_code", "ym", "actual"]].dropna() if not res_m.empty else pd.DataFrame()
                summary[f"{k}_wape"] = None
            # OL 총 WAPE 는 mc 프레임에서 직접
            ev = mc[(mc.ym > prev_to) & (mc.ym <= ev_to_eff)].dropna(subset=["act"])
            for k in ("sales_ol", "scm_ol"):
                mm = all_metrics(ev[k].fillna(0).to_numpy(), ev["act"].to_numpy()); summary[f"{k}_wape"] = mm["wape"]; summary[f"{k}_bias"] = mm["bias"]
        store.finish_run(db, rid, summary)
        log.info("backtest done %s", summary)
    except Exception as e:
        store.finish_run(db, rid, {}, error=f"{type(e).__name__}: {e}")
        raise
    return rid

def production(db: PostgresDB, horizon: int | None = None, *, n_jobs: int = 6, heavy_limit: int | None = None, run_id: str | None = None) -> str:
    t0 = time.time()
    cfg = _cfg(db, n_jobs, heavy_limit)
    settings = store.load_settings(db)
    horizon = horizon or int(settings.get("projection_future_months", 6))
    monthly, prices, mc = load_inputs(db)
    train_to = monthly["ym"].max()
    # 최신 백테스트 챔피언을 품목별 기법으로 사용
    champ = db.read_df("select key_code, champion_method from app.item_class")
    rid = store.create_run(db, "production", eval_fy=None, train_from=monthly["ym"].min(), train_to=train_to, horizon=horizon,
                           params={"methods": [m.key for m in cfg.methods if m.enabled], "horizon": horizon}, run_id=run_id)
    try:
        res_i, cls, _ = run_items(monthly, prices, cfg, train_to=train_to, horizon=horizon, eval_actual=None)
        if not champ.empty:
            cm = champ.set_index("key_code")["champion_method"]
            have = res_i.groupby("key_code")["method"].agg(set)
            def champ_for(k):
                c = cm.get(k)
                return c if c in have.get(k, set()) else ("baseline6" if "baseline6" in have.get(k, set()) else next(iter(have.get(k, {None}))))
            target = res_i["key_code"].map(champ_for)
            res_i["is_champion"] = res_i["method"] == target
        mc_train_to = mc.dropna(subset=["act"])["ym"].max()
        mchamp = db.read_df("""select distinct on (r.key_code) r.key_code, r.method from app.forecast_result r
            join app.forecast_run f on f.id = r.run_id where f.run_type='backtest' and f.status='done' and r.level='model' and r.is_champion
            order by r.key_code, f.finished_at desc""")
        res_m, _ = run_models(mc, cfg, train_to=mc_train_to, horizon=horizon, eval_to=None, model_champ=dict(zip(mchamp.key_code, mchamp.method)))
        results = pd.concat([res_i, res_m], ignore_index=True)
        store.write_results(db, rid, results)
        summary = {"train_to": train_to, "horizon": horizon, "n_items": int(res_i.key_code.nunique()), "n_models": int(res_m.key_code.nunique()) if not res_m.empty else 0,
                   "months": sorted(res_i.ym.unique().tolist()), "seconds": round(time.time() - t0, 1)}
        store.finish_run(db, rid, summary)
    except Exception as e:
        store.finish_run(db, rid, {}, error=f"{type(e).__name__}: {e}")
        raise
    return rid

def process_pending(db: PostgresDB, **kw) -> list[str]:
    df = db.read_df("select id, run_type, eval_fy, horizon from app.forecast_run where status = 'requested' order by created_at")
    done = []
    for r in df.itertuples():
        if r.run_type == "backtest":
            done.append(backtest(db, int(r.eval_fy), run_id=r.id, **kw))
        else:
            done.append(production(db, int(r.horizon) if r.horizon else None, run_id=r.id, **kw))
    return done
