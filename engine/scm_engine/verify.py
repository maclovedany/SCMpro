"""적재 검증: 행수 대조, XCN 다중 HOC 귀속 리포트(R-XCN-08), CSV HOC 불일치(R-XCN-07)."""
from __future__ import annotations
import pandas as pd
from .db.base import DB
from .export_raw import RAW_TABLES, SEED_ONLY_TABLES

def compare_counts(src: DB, dst: DB) -> pd.DataFrame:
    rows = []
    for t in RAW_TABLES:
        a, b = src.table_count(f"raw.{t}"), dst.table_count(f"raw.{t}")
        rows.append({"table": t, "src_n": a, "dst_n": b, "ok": a == b})
    for t, n in SEED_ONLY_TABLES.items():
        b = n if dst is src else dst.table_count(f"raw.{t}")
        rows.append({"table": t, "src_n": n, "dst_n": b, "ok": n == b})
    return pd.DataFrame(rows)

# R-XCN-08: 최근 24개월 출고 최다 HOC, 동률은 코드 정렬 최댓값
XCN_MULTI_SQL = """
with multi as (
  select related_item from raw.bridge_xcn group by related_item having count(distinct hoc_item) > 1
), cand as (
  select x.related_item, x.hoc_item,
         coalesce((select sum(qty) from raw.fact_shipment f
                   where f.item_code = x.hoc_item and f.ym >= '2024-08'), 0) as vol
  from raw.bridge_xcn x join multi m on m.related_item = x.related_item
)
select related_item, count(*) as n_hoc,
       (select hoc_item from cand c2 where c2.related_item = cand.related_item
        order by vol desc, hoc_item desc limit 1) as chosen_hoc
from cand group by related_item"""

def xcn_multi_hoc_report(db: DB) -> pd.DataFrame:
    return db.read_df(XCN_MULTI_SQL)

def hoc_mismatch_report(db: DB) -> pd.DataFrame:
    return db.read_df("""select d.item_code, d.hoc_code as csv_hoc, x.hoc_item as xcn_hoc
        from raw.dim_item d join raw.bridge_xcn x on x.related_item = d.item_code
        where d.hoc_code is not null and d.hoc_code <> '' and d.hoc_code <> x.hoc_item""")
