import csv
from scm_engine.db.sqlite import SQLiteDB
from scm_engine import export_raw, verify

def test_export_all_writes_csv_with_header(scm_db_path, tmp_path):
    db = SQLiteDB(scm_db_path)
    counts = export_raw.export_all(db, tmp_path)
    assert counts["dim_model"] == 156
    with open(tmp_path / "dim_model.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    assert rows[0] == ["model_key", "model_base", "biz", "iot_code", "sources"]
    assert len(rows) == 157

def test_compare_counts_self_is_ok(scm_db_path):
    db = SQLiteDB(scm_db_path)
    df = verify.compare_counts(db, db)
    assert df["ok"].all() and len(df) == 10

def test_xcn_multi_hoc_report_picks_one(scm_db_path):
    df = verify.xcn_multi_hoc_report(SQLiteDB(scm_db_path))
    assert len(df) == 454
    assert df["chosen_hoc"].notna().all()
