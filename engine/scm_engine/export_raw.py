"""scm.db → CSV (raw 적재용). 컬럼 순서 = sqlite 테이블 순서 = raw 스키마 순서."""
from __future__ import annotations
import csv
from pathlib import Path
from .db.sqlite import SQLiteDB

# scm.db 에 있는 9개. bridge_scc_config 는 sqlite 에 없어 supabase/seed/raw_bridge_scc_config.sql 로 적재.
RAW_TABLES = ["dim_item", "dim_model", "fact_shipment", "fact_mc_plan_actual", "bridge_bom",
              "bridge_mc_cap", "bridge_cap_option", "bridge_option_model", "bridge_xcn"]
SEED_ONLY_TABLES = {"bridge_scc_config": 88}

def export_all(db: SQLiteDB, out_dir: Path) -> dict[str, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for t in RAW_TABLES:
        cur = db.conn.execute(f'select * from "{t}"')
        cols = [d[0] for d in cur.description]
        n = 0
        with open(out_dir / f"{t}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for row in cur:
                w.writerow(["" if v is None else v for v in row])
                n += 1
        counts[t] = n
    return counts
