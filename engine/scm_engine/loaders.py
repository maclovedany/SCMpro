"""월별 시계열·마스터 로더. R-XCN-01 (부품은 HOC 합산), R-FC-33 (음수 클리핑)."""
from __future__ import annotations
import pandas as pd
from .db.base import DB

MONTHLY_SQL = {
    "PART_HOC": "select hoc_item as key_code, ym, qty from core.v_shipment_by_hoc",
    "PART": "select item_code as key_code, ym, qty from raw.fact_shipment where item_type='PART'",
    "SUPPLY": "select item_code as key_code, ym, qty from raw.fact_shipment where item_type='SUPPLY'",
    "OPTION": "select item_code as key_code, ym, qty from raw.fact_shipment where item_type='OPTION'",
}

def load_monthly(db: DB, item_type: str, *, by_hoc: bool = True,
                 fill_zero: bool = True, clip_negative: bool = True) -> pd.DataFrame:
    key = "PART_HOC" if (item_type == "PART" and by_hoc) else item_type
    df = db.read_df(MONTHLY_SQL[key])
    df["qty"] = df["qty"].astype(float)          # postgres numeric(Decimal) → float
    df = df.groupby(["key_code", "ym"], as_index=False)["qty"].sum()
    if clip_negative:
        df["qty"] = df["qty"].clip(lower=0)
    if fill_zero:
        months = pd.period_range(df["ym"].min(), df["ym"].max(), freq="M").strftime("%Y-%m")
        idx = pd.MultiIndex.from_product([df["key_code"].unique(), months], names=["key_code", "ym"])
        df = df.set_index(["key_code", "ym"]).reindex(idx, fill_value=0).reset_index()
    return df

def load_mc_plan_actual(db: DB) -> pd.DataFrame:
    """FY24 시트의 biz 누락을 dim_model 로 보완, model_base NULL(합계행) 제외."""
    return db.read_df("""
        select p.model_base, coalesce(p.biz, m.biz) as biz, p.ym, p.sales_ol, p.scm_ol, p.act
        from raw.fact_mc_plan_actual p
        left join (select model_base, max(biz) as biz from raw.dim_model
                   where biz is not null group by model_base) m on m.model_base = p.model_base
        where p.model_base is not null""")
