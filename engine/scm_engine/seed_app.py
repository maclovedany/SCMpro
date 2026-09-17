"""더미 시드 SQL 생성 (D-007). 결정적(seed 고정). 전부 is_dummy=true, source='seed'.
실데이터 업로드 시 fn_apply_upload 가 is_dummy=false 로 덮어쓴다."""
from __future__ import annotations
import random
import uuid
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


# ── 고객사·수요 라인·기기 재고·품목 그룹·긴급발주 더미 (D-058, Q-022~024) ─────────────────────────
CUSTOMERS = [("CUST-001", "가온금융", "금융", True), ("CUST-002", "누리대학교", "교육", False), ("CUST-003", "다솜병원", "의료", True),
             ("CUST-004", "라온물산", "제조", False), ("CUST-005", "마루건설", "건설", False), ("CUST-006", "바른제약", "제약", True),
             ("CUST-007", "새봄교육청", "공공", False), ("CUST-008", "아라리조트", "서비스", False), ("CUST-009", "자람유통", "유통", False),
             ("CUST-010", "차오름테크", "IT", False)]
GROUPS = [("CARD_READER", "카드리더기", "marketing", "description ilike '%card reader%'"),
          ("PAPER", "용지", "marketing", "description ilike '%paper%' and (item_type = 'SUPPLY' or description ilike '%roll%')"),
          ("TONER", "토너", "service", "item_type = 'SUPPLY' and description ilike '%toner%'")]
URGENT = [  # (요청 부서, 수량, 단계, 계획입고 offset일, 이벤트[(stage, offset일)])
    ("service", 40, "approved", None, []), ("service", 60, "po_accepted", 21, [("po_accepted", -2)]),
    ("marketing", 30, "departed", 14, [("po_accepted", -12), ("shipped", -8), ("departed", -5)]),
    ("service", 80, "customs", 3, [("po_accepted", -25), ("shipped", -20), ("departed", -16), ("arrived", -3), ("customs", -1)]),
    ("sales", 20, "received", -2, [("po_accepted", -30), ("shipped", -24), ("departed", -20), ("arrived", -6), ("customs", -4), ("received", -2)]),
    ("service", 50, "delayed", -4, [("po_accepted", -28), ("shipped", -15)])]
_NS = uuid.uuid5(uuid.NAMESPACE_URL, "scmpro-dummy-d058")

def build_customer_seed_sql(db: DB, snap_date: str, seed: int = 58) -> str:
    """결정적 더미. 전부 is_dummy=true. 실데이터 업로드 시 같은 키는 덮어써지고, 재실행하면 더미만 교체된다."""
    rnd = random.Random(seed)
    machines = list(db.read_df("select item_code from raw.dim_item where item_type = 'MACHINE' order by item_code limit 12")["item_code"])
    supplies = list(db.read_df("select key_code from analytics.v_item_master where category = 'SUPPLY' order by total_12m desc nulls last, key_code limit 6")["key_code"])
    mlist = ",".join(_q(m) for m in machines)
    sales = "(select user_id from app.profiles where role = 'sales' order by created_at limit 1)"
    cur, nxt = "to_char(current_date, 'YYYY-MM')", "to_char(current_date + interval '1 month', 'YYYY-MM')"
    out = ["-- 자동 생성: engine seed-app (D-058 더미). 고객사·수요 라인·기기 재고·더미 주문/배정·품목 그룹·긴급발주. 재실행 시 더미만 교체.", "begin;",
           "set local session_replication_role = replica;   -- 감사·알림 트리거 제외",
           "delete from app.allocation where order_id in (select id from app.sales_order where is_dummy);",
           "delete from app.sales_order where is_dummy; delete from app.demand_line where is_dummy;",
           "delete from app.inbound_event where is_dummy; delete from app.extra_demand where is_dummy; delete from app.inbound where is_dummy and po_no like 'PO-U%';",
           "delete from app.item_group_item where group_code in (select code from app.item_group where is_dummy); delete from app.item_group where is_dummy;",
           f"delete from app.inventory_snapshot where is_dummy and item_code in ({mlist});",
           "delete from app.customer c where c.is_dummy and not exists (select 1 from app.sales_order o where o.customer_code = c.code) and not exists (select 1 from app.demand_line d where d.customer_code = c.code);"]
    out.append("insert into app.customer(code,name,segment,is_strategic,sales_rep,source,is_dummy) values")
    out.append(",\n".join(f"({_q(c)},{_q(n)},{_q(g)},{str(st).lower()},{sales},'seed',true)" for c, n, g, st in CUSTOMERS) + " on conflict (code) do nothing;")

    stock = {m: rnd.randint(10, 40) for m in machines}
    out.append("insert into app.inventory_snapshot(item_code,snap_date,qty,stock_class,source,is_dummy) values")
    out.append(",\n".join(f"({_q(m)},{_q(snap_date)},{q},'normal','seed',true)" for m, q in stock.items()) + " on conflict (item_code,snap_date,stock_class) do nothing;")

    lines, orders, allocs, n = [], [], [], 0
    for k, m in enumerate(machines):
        budget = stock[m] // 2 if k % 3 == 0 else stock[m]          # 3종 중 1종은 가용을 남겨 강제배정 시연
        for ci in sorted(rnd.sample(range(len(CUSTOMERS)), rnd.randint(3, 5))):
            cust, qty = CUSTOMERS[ci], rnd.randint(2, 12)
            dept = "biz_enable" if rnd.random() < 0.2 else "sales"
            lines.append(f"({nxt if rnd.random() < 0.5 else cur},{_q(dept)},{_q(cust[0])},{_q(m)},{qty},'seed',true)")
            if rnd.random() >= 0.75: continue                       # 수요만 내고 아직 주문이 없는 고객사
            n += 1
            oid = str(uuid.uuid5(_NS, f"so-{n}")); give = min(budget, qty); budget -= give
            firm = give == qty and n % 3 == 0
            status = "confirmed" if firm else "review_requested" if give == qty else "partial" if give > 0 else "waiting"
            exp = "null" if firm or give == 0 else f"now() + interval '{30 - (n % 25)} days'"
            orders.append(f"({_q(oid)},{_q('SO-D-' + str(n).zfill(4))},{_q(m)},{qty},{_q(cust[1])},{_q(cust[0])},{sales},{_q(status)},'partial',{90 if cust[3] else 100},"
                          f"now() - interval '{n * 3} hours',{exp},{'now()' if firm else 'null'},true)")
            if give > 0:
                allocs.append(f"({_q(oid)},{_q(m)},{give},{_q('firm' if firm else 'temp')},{exp})")
    out.append("insert into app.demand_line(ym,dept,customer_code,item_code,qty,source,is_dummy) values")
    out.append(",\n".join(lines) + " on conflict (ym,dept,customer_code,item_code) do nothing;")
    out.append("insert into app.sales_order(id,order_no,item_code,qty,customer,customer_code,sales_rep,status,alloc_mode,priority,requested_at,expires_at,confirmed_at,is_dummy) values")
    out.append(",\n".join(orders) + " on conflict (id) do nothing;")
    out.append("insert into app.allocation(order_id,item_code,qty,kind,expires_at) values")
    out.append(",\n".join(allocs) + ";")

    out.append("insert into app.item_group(code,name,owner_dept,source,is_dummy) values " +
               ",".join(f"({_q(c)},{_q(nm)},{_q(d)},'seed',true)" for c, nm, d, _ in GROUPS) + " on conflict (code) do nothing;")
    for c, _, _, cond in GROUPS:
        out.append(f"insert into app.item_group_item(item_code, group_code) select item_code, {_q(c)} from (select i.item_code from core.v_item i "
                   f"where {cond} and exists (select 1 from app.inventory_snapshot s where s.item_code = i.item_code) order by i.item_code limit 10) t on conflict (item_code) do nothing;")
    out.append("update app.inventory_snapshot s set qty = case when abs(hashtext(s.item_code)) % 4 = 0 then 0 else 5 + abs(hashtext(s.item_code)) % 60 end "
               "where s.is_dummy and s.stock_class = 'normal' and s.qty = 0 and s.item_code in (select item_code from app.item_group_item m join app.item_group g on g.code = m.group_code where g.is_dummy);")

    po_rows, ed_rows, ev_rows = [], [], []
    for i, ((dept, qty, stage, plan, events), item) in enumerate(zip(URGENT, supplies), start=1):
        po = f"PO-U{str(i).zfill(4)}"; eid = str(uuid.uuid5(_NS, f"urgent-{i}"))
        if plan is not None:
            ist = "received" if stage == "received" else "ordered" if stage == "po_accepted" else "shipped"
            po_rows.append(f"({_q(item)},(select id from app.supplier where code = {_q(SUPPLIERS[i % 5][0])}),{_q(po)},{qty},current_date + {plan},"
                           f"{'current_date + ' + str(plan) if stage == 'received' else 'null'},{_q(ist)},'seed',true)")
        inb = f"(select id from app.inbound where po_no = {_q(po)} and is_dummy order by id desc limit 1)" if plan is not None else "null"
        ed_rows.append(f"({_q(eid)},'urgent',{_q(item)},to_char(current_date + {plan if plan is not None else 10}, 'YYYY-MM'),{qty},'현장 재고 소진 — 긴급 보충 요청 (더미)','approved',"
                       f"(select user_id from app.profiles where role = {_q(dept)} order by created_at limit 1),now() - interval '{(7 - i) * 4} days',current_date + {plan if plan is not None else 10},{_q(dept)},{inb},true)")
        ev_rows += [f"({inb},{_q(s)},current_date + {off},'seed',true)" for s, off in events]
    out.append("insert into app.inbound(item_code,supplier_id,po_no,qty,planned_date,actual_date,status,source,is_dummy) values")
    out.append(",\n".join(po_rows) + ";")
    out.append("insert into app.extra_demand(id,kind,item_code,need_ym,qty,reason,status,created_by,created_at,need_date,requested_dept,inbound_id,is_dummy) values")
    out.append(",\n".join(ed_rows) + " on conflict (id) do nothing;")
    out.append("insert into app.inbound_event(inbound_id,stage,event_date,source,is_dummy) values")
    out.append(",\n".join(ev_rows) + " on conflict (inbound_id,stage) do nothing;")
    out.append("commit;")
    return "\n".join(out) + "\n"
