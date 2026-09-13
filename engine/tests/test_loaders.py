from scm_engine.db.sqlite import SQLiteDB
from scm_engine import loaders

def test_load_monthly_supply_fills_zero_and_clips(scm_db_path):
    db = SQLiteDB(scm_db_path)
    df = loaders.load_monthly(db, "SUPPLY")
    months = sorted(df["ym"].unique())
    assert months[0] == "2023-04" and months[-1] == "2026-07"
    per_item = df.groupby("key_code")["ym"].count()
    assert per_item.min() == per_item.max() == len(months)
    assert (df["qty"] >= 0).all()

def test_load_monthly_part_uses_hoc(scm_db_path):
    db = SQLiteDB(scm_db_path)
    raw_items = db.read_df("select count(distinct item_code) n from fact_shipment where item_type='PART'").iloc[0,0]
    df = loaders.load_monthly(db, "PART", by_hoc=True)
    assert df["key_code"].nunique() < raw_items

def test_load_mc_plan_actual_fills_biz(scm_db_path):
    df = loaders.load_mc_plan_actual(SQLiteDB(scm_db_path))
    assert df["model_base"].notna().all()
    assert df["biz"].isna().mean() < 0.01
