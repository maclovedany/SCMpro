from scm_engine.db.sqlite import SQLiteDB
from scm_engine import seed_app

def test_seed_sql_is_deterministic_and_marks_dummy(scm_db_path):
    db = SQLiteDB(scm_db_path)
    a = seed_app.build_seed_sql(db, "2026-08-31")
    b = seed_app.build_seed_sql(db, "2026-08-31")
    assert a == b
    assert "insert into app.supplier" in a and a.count("SUP-") >= 5
    assert "is_dummy" in a and "'seed'" in a
    assert "2026-10-03" in a   # 개천절

def test_seed_moq_by_category(scm_db_path):
    sql = seed_app.build_seed_sql(SQLiteDB(scm_db_path), "2026-08-31")
    block = sql[sql.index("insert into app.item_setting"):sql.index("insert into app.inventory_snapshot")]
    # SUPPLY 는 MOQ 10, OPTION 5, PART 1 이 모두 등장
    assert ",30,10," in block and ",30,5," in block and ",30,1," in block
