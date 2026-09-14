"""Postgres 저장: 런·결과·정확도·분류 bulk write (psycopg COPY)."""
from __future__ import annotations
import io, json, uuid
from datetime import datetime, timezone
import pandas as pd
from ..db.postgres import PostgresDB

def _copy(db: PostgresDB, table: str, df: pd.DataFrame, cols: list[str]):
    if df.empty: return
    buf = io.StringIO()
    df[cols].to_csv(buf, index=False, header=False, na_rep="")
    buf.seek(0)
    with db.conn.cursor() as cur, cur.copy(f"copy {table} ({', '.join(cols)}) from stdin with (format csv, null '')") as cp:
        cp.write(buf.read())

def create_run(db: PostgresDB, run_type: str, *, eval_fy: int | None, train_from: str, train_to: str, horizon: int, params: dict, requested_by=None, run_id: str | None = None) -> str:
    rid = run_id or str(uuid.uuid4())
    if run_id:
        db.execute("update app.forecast_run set status='running', started_at=now(), eval_fy=%s, train_from=%s, train_to=%s, horizon=%s, params_snapshot=%s where id=%s",
                   (eval_fy, train_from, train_to, horizon, json.dumps(params), rid))
    else:
        db.execute("insert into app.forecast_run(id, run_type, eval_fy, train_from, train_to, horizon, status, params_snapshot, requested_by, started_at) values (%s,%s,%s,%s,%s,%s,'running',%s,%s,now())",
                   (rid, run_type, eval_fy, train_from, train_to, horizon, json.dumps(params), requested_by))
    return rid

def finish_run(db: PostgresDB, run_id: str, summary: dict, error: str | None = None):
    db.execute("update app.forecast_run set status=%s, finished_at=now(), summary=%s, error=%s where id=%s",
               ("failed" if error else "done", json.dumps(summary, default=str), error, run_id))

def write_results(db: PostgresDB, run_id: str, df: pd.DataFrame):
    """df: level,key_code,category,ym,method,value,lower,upper,is_champion,actual"""
    d = df.copy(); d["run_id"] = run_id
    for c in ("lower", "upper", "actual", "category"):
        if c not in d: d[c] = None
    _copy(db, "app.forecast_result", d, ["run_id", "level", "key_code", "category", "ym", "method", "value", "lower", "upper", "is_champion", "actual"])

def write_accuracy(db: PostgresDB, run_id: str, df: pd.DataFrame):
    d = df.copy(); d["run_id"] = run_id
    if "extra" in d: d["extra"] = d["extra"].map(lambda x: json.dumps(x) if isinstance(x, dict) else x)
    else: d["extra"] = None
    _copy(db, "app.forecast_accuracy", d, ["run_id", "level", "key", "method", "bias", "wape", "mape", "n", "sum_actual", "extra"])

def write_item_class(db: PostgresDB, run_id: str, df: pd.DataFrame):
    db.execute("delete from app.item_class")
    d = df.copy(); d["run_id"] = run_id; d["computed_at"] = datetime.now(timezone.utc).isoformat()
    if "champion_method" not in d: d["champion_method"] = None
    _copy(db, "app.item_class", d, ["key_code", "category", "pattern", "abc", "xyz", "adi", "cv2", "cv", "value_12m", "share", "champion_method", "run_id", "computed_at"])

def load_methods(db) -> list[dict]:
    df = db.read_df("select key, family, patterns, abc_scope, level, min_history, enabled, is_baseline, params from app.forecast_method order by sort")
    return df.to_dict("records")

def load_policy(db) -> dict[str, list[str]]:
    df = db.read_df("select cell, methods from app.forecast_policy")
    return {r.cell: list(r.methods) for r in df.itertuples()}

def load_settings(db) -> dict:
    df = db.read_df("select key, value from app.system_settings")
    return {r.key: r.value for r in df.itertuples()}

def prune_runs(db: PostgresDB) -> dict:
    """보존 정책 (D-045): 설정 run_retention(기본 3) 개만 남기고 결과 삭제 + 감사 로그 정리"""
    keep = int(load_settings(db).get("run_retention", 3))
    return db.read_df("select app.fn_prune_runs(%s) as r", (keep,)).iloc[0, 0]
