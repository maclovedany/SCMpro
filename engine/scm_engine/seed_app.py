"""더미 시드 SQL 생성 (D-007). 결정적(seed 고정). 전부 is_dummy=true, source='seed'.
실데이터 업로드 시 fn_apply_upload 가 is_dummy=false 로 덮어쓴다."""
from __future__ import annotations
import random
import pandas as pd
from .db.base import DB
from .loaders import load_monthly

SUPPLIERS = [("SUP-VN", "베트남 공장", "VN", 7, 35), ("SUP-CN", "중국 공장", "CN", 7, 30),
             ("SUP-JP", "일본 공장", "JP", 10, 25), ("SUP-HK", "홍콩 물류", "HK", 7, 28), ("SUP-KR", "국내 공급", "KR", 3, 10)]
MOQ = {"PART": 1, "SUPPLY": 10, "OPTION": 5}
PRICE = {"PART": (5_000, 200_000), "SUPPLY": (20_000, 300_000), "OPTION": (100_000, 3_000_000)}
HOLIDAYS_2026 = [("2026-01-01", "신정"), ("2026-02-16", "설날 연휴"), ("2026-02-17", "설날"), ("2026-02-18", "설날 연휴"),
                 ("2026-03-01", "삼일절"), ("2026-03-02", "대체공휴일"), ("2026-05-05", "어린이날"), ("2026-05-24", "부처님오신날"),
                 ("2026-05-25", "대체공휴일"), ("2026-06-06", "현충일"), ("2026-08-15", "광복절"), ("2026-08-17", "대체공휴일"),
                 ("2026-09-24", "추석 연휴"), ("2026-09-25", "추석"), ("2026-09-26", "추석 연휴"), ("2026-10-03", "개천절"),
                 ("2026-10-05", "대체공휴일"), ("2026-10-09", "한글날"), ("2026-12-25", "성탄절")]
SW_SQL = "select distinct d.item_code from raw.dim_item d where d.item_type like '%OPTION%' and (d.family like 'LICENSE%' or d.description like '%1DAY CODE%')"

def _q(s: str) -> str:
    return "'" + str(s).replace("'", "''") + "'"

def _stats(db: DB) -> pd.DataFrame:
    frames = []
    for t in ("PART", "SUPPLY", "OPTION"):
        df = load_monthly(db, t)
        df["category"] = t
        frames.append(df)
    m = pd.concat(frames)
    sw = set(db.read_df(SW_SQL)["item_code"])
    m = m[~m["key_code"].isin(sw)]                       # SW 라이선스 제외 (R-BOM-11)
    months = sorted(m["ym"].unique())
    last6, last12 = set(months[-6:]), set(months[-12:])
    m["q6"] = m["qty"].where(m["ym"].isin(last6), 0)
    m["q12"] = m["qty"].where(m["ym"].isin(last12), 0)
    st = m.groupby(["key_code", "category"], as_index=False).agg(avg6=("q6", "sum"), tot12=("q12", "sum"))
    st["avg6"] = st["avg6"] / 6
    return st.sort_values("key_code").reset_index(drop=True)

def build_seed_sql(db: DB, snap_date: str, seed: int = 42) -> str:
    rnd = random.Random(seed)
    stats = _stats(db)
    out = ["-- 자동 생성: engine seed-app (D-007 더미). 실데이터 업로드 시 덮어써짐. 재실행 시 더미만 교체.", "begin;",
           "set local session_replication_role = replica;   -- 더미 시드는 감사 트리거(trg_audit) 제외",
           "delete from app.inbound where is_dummy; delete from app.inventory_snapshot where is_dummy;",
           "delete from app.item_setting where is_dummy; delete from app.supplier where is_dummy and id not in (select supplier_id from app.inbound where supplier_id is not null);"]
    out.append("insert into app.supplier(code,name,country,prep_days,lead_time_days,source,is_dummy) values")
    out.append(",\n".join(f"({_q(c)},{_q(n)},{_q(k)},{p},{l},'seed',true)" for c, n, k, p, l in SUPPLIERS) + " on conflict (code) do nothing;")

    rows = []
    for r in stats.itertuples():
        lo, hi = PRICE[r.category]
        rows.append(f"({_q(r.key_code)},30,{MOQ[r.category]},{rnd.randint(lo, hi)},'approved','seed',true)")
    out.append("insert into app.item_setting(item_code,target_dos_days,moq,unit_price,status,source,is_dummy) values")
    out.append(",\n".join(rows) + " on conflict (item_code) do nothing;")

    rows = []
    for r in stats.itertuples():
        qty = round(r.avg6 * rnd.uniform(0.5, 2.0))
        rows.append(f"({_q(r.key_code)},{_q(snap_date)},{qty},'normal','seed',true)")
        if rnd.random() < 0.10 and r.avg6 > 0:
            rows.append(f"({_q(r.key_code)},{_q(snap_date)},{max(1, round(r.avg6 * 0.2))},'inspection','seed',true)")
    out.append("insert into app.inventory_snapshot(item_code,snap_date,qty,stock_class,source,is_dummy) values")
    out.append(",\n".join(rows) + " on conflict (item_code,snap_date,stock_class) do nothing;")

    top = stats.sort_values(["tot12", "key_code"], ascending=[False, True]).head(300)
    rows = []
    for i, r in enumerate(top.itertuples()):
        sup = SUPPLIERS[i % 5][0]
        day = 15 + (i % 46)
        planned = f"2026-09-{day:02d}" if day <= 30 else f"2026-10-{day - 30:02d}"
        rows.append(f"({_q(r.key_code)},(select id from app.supplier where code={_q(sup)}),{_q('PO-D' + str(i + 1).zfill(4))},{max(1, round(r.avg6))},{_q(planned)},'ordered','seed',true)")
    out.append("insert into app.inbound(item_code,supplier_id,po_no,qty,planned_date,status,source,is_dummy) values")
    out.append(",\n".join(rows) + ";")

    out.append("insert into app.holiday(date,name,country) values " + ",".join(f"({_q(d)},{_q(n)},'KR')" for d, n in HOLIDAYS_2026) + " on conflict (date) do nothing;")
    out.append("commit;")
    return "\n".join(out) + "\n"
