import pandas as pd
from scm_engine.db.sqlite import SQLiteDB

def test_sqlite_read_df(scm_db_path):
    db = SQLiteDB(scm_db_path)
    df = db.read_df("select item_code, ym, qty from raw.fact_shipment limit 3")
    assert list(df.columns) == ["item_code", "ym", "qty"] and len(df) == 3

def test_sqlite_table_count_strips_schema(scm_db_path):
    db = SQLiteDB(scm_db_path)
    assert db.table_count("raw.dim_model") == db.table_count("dim_model") == 156

def test_sqlite_execute_creates_temp(scm_db_path):
    db = SQLiteDB(scm_db_path, readonly=False)
    db.execute("create temp table t(x int)")
    db.execute("insert into t values (1)")
    assert db.read_df("select * from t").iloc[0, 0] == 1
