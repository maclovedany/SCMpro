from __future__ import annotations
from datetime import date
from pathlib import Path
import typer
from .config import Settings, ENGINE_DIR
from .db.sqlite import SQLiteDB
from .db.postgres import PostgresDB
from . import export_raw, verify

app = typer.Typer(help="SCM 엔진 CLI")
ROOT = ENGINE_DIR.parent

def _sqlite() -> SQLiteDB:
    return SQLiteDB(Settings.load().sqlite_path)

def _pg() -> PostgresDB:
    s = Settings.load()
    if not s.db_url:
        raise typer.BadParameter("SUPABASE_DB_URL 이 비어 있습니다 — 로컬은 engine/.env, Railway 는 서비스 Variables 에 설정")
    return PostgresDB(s.db_url)

@app.command("export-raw")
def export_raw_cmd(out: Path = ROOT / "data" / "export"):
    counts = export_raw.export_all(_sqlite(), out)
    for t, n in counts.items():
        typer.echo(f"{t:24} {n:>8}")

@app.command("verify")
def verify_cmd(target: str = "postgres", report_dir: Path = ROOT / "docs" / "reports"):
    src = _sqlite()
    dst = _pg() if target == "postgres" else src
    counts = verify.compare_counts(src, dst)
    multi = verify.xcn_multi_hoc_report(src)
    mism = verify.hoc_mismatch_report(src)
    report_dir.mkdir(parents=True, exist_ok=True)
    p = report_dir / f"verify-{date.today():%Y%m%d}.md"
    p.write_text(
        f"# 검증 리포트 ({date.today()}, target={target})\n\n## 행수 대조 (src=scm.db)\n"
        + counts.to_markdown(index=False)
        + f"\n\n## XCN 다중 HOC 귀속 (R-XCN-08) — {len(multi)}건 (상위 50)\n" + multi.head(50).to_markdown(index=False)
        + f"\n\n## CSV HOC vs XCN 불일치 (R-XCN-07) — {len(mism)}건 (상위 50)\n" + mism.head(50).to_markdown(index=False) + "\n",
        encoding="utf-8")
    typer.echo(counts.to_string(index=False))
    typer.echo(f"리포트: {p}")
    raise typer.Exit(code=0 if bool(counts["ok"].all()) else 1)

if __name__ == "__main__":
    app()

@app.command("seed-app")
def seed_app_cmd(snap_date: str = "2026-08-31", target: str = "postgres",
                 out: Path = ROOT / "supabase" / "seed" / "app_seed.sql"):
    """더미 시드 SQL 생성 (D-007). 키 집합은 Postgres(core 뷰 최신 규칙) 기준이 정본."""
    from . import seed_app
    db = _pg() if target == "postgres" else _sqlite()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(seed_app.build_seed_sql(db, snap_date), encoding="utf-8")
    typer.echo(f"생성: {out}")
    if target == "postgres":                     # 고객사·수요 라인 등 D-058 더미 (analytics·app 뷰가 필요해 postgres 전용)
        out2 = out.with_name("app_seed_customer.sql")
        out2.write_text(seed_app.build_customer_seed_sql(db, snap_date), encoding="utf-8")
        typer.echo(f"생성: {out2}")

@app.command("gen-types")
def gen_types_cmd(out: Path = ROOT / "web" / "lib" / "types" / "database.ts"):
    """web/lib/types/database.ts 생성 (app, analytics, core)."""
    from . import gen_types
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("// 자동 생성: engine gen-types — 수정 금지\n" + gen_types.generate(_pg()), encoding="utf-8")
    typer.echo(f"생성: {out}")

@app.command("import-erp")
def import_erp_cmd(src: Path = typer.Option(..., help="ERP 추출 파일 폴더 (저장소 밖)"), key: Path = typer.Option(..., help="치환표_MAPPING_KEY.xlsx (저장소·DB 에 올리지 않는다)"),
                   snap_date: str = None, out: Path = ROOT / "data" / "export" / "erp_import.sql",
                   report_dir: Path = ROOT / "docs" / "reports"):
    """ERP 실코드 파일(현재고·Open PO·파트너·Line Type) → 익명코드 SQL (D-059~063). 적용은 supabase/scripts/import-erp.sh."""
    from . import erp_import as e
    onhand_f, sub_f, po_f = e.pick(src, "Onhand"), e.pick(src, "Subinventory"), e.pick(src, "Open_PO")
    partner_f, lt_f = e.pick(src, "파트너"), e.pick(src, "Line_Type")
    mk, wh, ctx = e.MappingKey.load(key), e.Warehouses.load(onhand_f, sub_f), e.load_context(_pg())
    onhand = e.read_onhand(onhand_f)
    po, po_date = e.read_open_po(po_f)
    snap = snap_date or (po_date.isoformat() if po_date else date.today().isoformat())
    inv, inv_un, inv_stat = e.build_inventory(onhand, mk, wh, ctx)
    ms, ms_stat = e.build_model_stock(onhand, mk, wh)
    inbound, suppliers, item_sup, po_un, po_stat = e.build_inbound(po, mk, ctx)
    customers, line_types, cats = e.read_partners(partner_f), e.read_line_types(lt_f), e.read_category_map(po_f)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(e.build_sql(snap, inv, ms, inbound, suppliers, item_sup, customers, line_types, cats, ctx.protected,
                               {"inventory_snapshot": "Daily_Onhand", "inbound": "Open_PO", "supplier": "Open_PO", "customer": "partner list"}), encoding="utf-8")
    inv_un.to_csv(out.with_name("erp_unmatched_onhand.csv"), index=False, encoding="utf-8-sig")     # 실코드 — gitignore 된 폴더에만
    po_un.to_csv(out.with_name("erp_unmatched_po.csv"), index=False, encoding="utf-8-sig")
    cls = inv.groupby("stock_class")["qty"].agg(["count", "sum"]).reset_index()
    cat = sorted({k.split(":")[1] for k in inv_stat if ":" in k})
    match = [(c, inv_stat[f"matched:{c}"], inv_stat[f"unmatched:{c}"]) for c in cat]
    pmatch = [(c, po_stat[f"matched:{c}"], po_stat[f"unmatched:{c}"]) for c in sorted({k.split(":")[1] for k in po_stat if k.startswith(("matched", "unmatched"))})]
    report_dir.mkdir(parents=True, exist_ok=True)
    rp = report_dir / f"erp-import-{snap.replace('-', '')}.md"
    rp.write_text(
        f"# ERP 실데이터 반입 리포트 (기준일 {snap}, 생성 {date.today()})\n\n가용 기준: 끝이 -N 인 창고, ARES·ARNS 제외 (D-065) · 더미 유지 품목(시연·E2E): {len(ctx.protected)}개\n\n"
        f"## 현재고 — 재고 행 매칭 (행 수)\n| ERP 카테고리 | 매칭 | 미매칭 |\n|---|---:|---:|\n" + "".join(f"| {c} | {a:,} | {b:,} |\n" for c, a, b in match)
        + f"\n적재 {len(inv):,}행 (그중 0 채움 {inv_stat['zero_filled']:,}품목), 더미 유지로 건너뛴 행 {inv_stat['skipped_protected_rows']:,}\n\n"
        f"## 재고구분별 적재 (R-INV-11)\n| 재고구분 | 품목 수 | 수량 |\n|---|---:|---:|\n" + "".join(f"| {r.stock_class} | {int(r['count']):,} | {r['sum']:,.0f} |\n" for _, r in cls.iterrows())
        + f"\n## 기종 단위 기기 재고 (R-INV-12)\n기기 품목 {ms_stat['machine_items']:,}개 중 {ms_stat['machine_items_mapped']:,}개가 {ms_stat['models']:,}개 기종에 연결, 기종 미연결 {ms_stat['unmapped_items']:,}개\n\n"
        f"## 입고예정 — Open PO 유효 {len(po):,}행\n| ERP 카테고리 | 매칭 | 미매칭 |\n|---|---:|---:|\n" + "".join(f"| {c} | {a:,} | {b:,} |\n" for c, a, b in pmatch)
        + f"\n적재 {len(inbound):,}행 · 예정일 = Need By Date (D-065), 날짜 없는 행 {po_stat['no_date']:,} · 공급처 {len(suppliers)}곳 · 주 공급처 지정 품목 {len(item_sup):,}개\n\n"
        f"## 참조 마스터\n고객(파트너) {len(customers):,}곳 · Line Type {len(line_types):,}종(출고 집계 {int(line_types['counts_as_shipment'].sum()):,}) · ERP 카테고리 {len(cats):,}종\n", encoding="utf-8")
    typer.echo(f"생성: {out}\n리포트: {rp}\n미매칭 목록: {out.with_name('erp_unmatched_onhand.csv')}")

@app.command("load-lifecycle")
def load_lifecycle_cmd(raw_dir: Path = ROOT / "data" / "raw", out: Path = ROOT / "data" / "export" / "item_lifecycle.sql", apply: bool = True):
    """품목 수명주기·관리구분 적재 (D-071): 소모품 관리구분·GC-BOM EOL·옵션 KBN → app.item_lifecycle, app.eol_eos."""
    from . import lifecycle
    db = _pg()
    lc = lifecycle.build(raw_dir)
    known = set(db.read_df("select item_code from raw.dim_item")["item_code"])
    sql, dropped = lifecycle.to_sql(lc, known)
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(sql, encoding="utf-8")
    if apply:
        db.execute(sql)
        db.execute("select app.fn_refresh_matviews()")
    typer.echo(f"{'적용' if apply else '생성'}: {out} — 품목 {len(lc.items) - dropped:,}건(마스터 밖 {dropped:,} 제외) · 기종 EOL {len(lc.models)}건")
    typer.echo(lc.items.groupby(["lifecycle", "in_forecast_scope"]).size().to_string())

@app.command("load-names")
def load_names_cmd(key: Path = typer.Option(..., help="치환표 파일 경로 (저장소 밖)")):
    """표시 이름 적재 (D-075): 치환표의 제품군·기종 이름 쌍 → app.name_alias. 코드 복원 쌍은 읽지 않는다."""
    from . import names
    df, stat = names.read_pairs(key)
    _pg().execute(names.to_sql(df))
    typer.echo(f"적용: app.name_alias — 제품군 {stat['family']:,}쌍 · 기종 {stat['codename']:,}쌍 (같은 익명 이름 중복 {stat['duplicate_anon']:,}건 제외)")

@app.command("load-mc")
def load_mc_cmd(src: Path = typer.Option(..., help="회사 정리본 'MC OL vs ACT' 파일 (실제 이름·실코드, 저장소 밖)"), key: Path = typer.Option(..., help="치환표 파일 경로 (저장소 밖)")):
    """기종(MC) 마스터·제품 단위 OL 실적 적재 (D-077 · D-078): 제품군은 회사 약자로(없으면 회사 파일의 이름), Item Code 는 익명 코드로 바꿔 app.mc_family · app.mc_plan_item 에 넣는다."""
    from . import mc_master
    db = _pg()
    fam, items, rep = mc_master.build(mc_master.read_plan(src), mc_master.read_lineage(src), mc_master.Key.load(key), db.read_df("select model_key, model_base, iot_code from raw.dim_model"))
    db.execute(mc_master.to_sql(fam, items))
    typer.echo(f"적용: app.mc_family {rep['families']:,}개 · app.mc_plan_item {rep['rows']:,}행 — 구분 {fam.biz.value_counts(dropna=False).to_dict()} · 전임기 연결 {int(fam.predecessor.notna().sum())}건")
    typer.echo(f"회사 약자가 없어 회사 파일의 이름을 그대로 쓴 제품군 {len(rep['no_alias'])}개(D-078) · 치환표에 없는 Item Code {rep['unmapped_codes']}개(코드 없이 적재)")

forecast_app = typer.Typer(help="예측 엔진 (SP2)")
app.add_typer(forecast_app, name="forecast")

@forecast_app.command("backtest")
def fc_backtest(eval_fy: int = 2025, n_jobs: int = 3, heavy_limit: int = None, item_limit: int = None):
    """FY 롤링 백테스트 (R-FC-40). 학습 ~ eval_fy-1, 평가 eval_fy."""
    import logging; logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    from .forecast import runner
    rid = runner.backtest(_pg(), eval_fy, n_jobs=n_jobs, heavy_limit=heavy_limit, item_limit=item_limit)
    typer.echo(f"run_id={rid}")

@forecast_app.command("run")
def fc_run(horizon: int = None, n_jobs: int = 3, heavy_limit: int = None):
    """프로덕션 예측 (최신 백테스트 챔피언 사용)."""
    import logging; logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    from .forecast import runner
    rid = runner.production(_pg(), horizon, n_jobs=n_jobs, heavy_limit=heavy_limit)
    typer.echo(f"run_id={rid}")

@forecast_app.command("pending")
def fc_pending(n_jobs: int = 3):
    """웹에서 요청된(requested) 런 처리."""
    import logging; logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    from .forecast import runner
    for rid in runner.process_pending(_pg(), n_jobs=n_jobs):
        typer.echo(f"done {rid}")

@forecast_app.command("tune")
def fc_tune(run_id: str = None, model: str = None):
    """LLM(설정 ai_model)으로 최신(또는 지정) 백테스트 런의 오차를 분석해 조정안 저장 (R-FC-42)."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from .forecast import ai_tuning
    db = _pg()
    if not run_id:
        run_id = db.read_df("select id from app.forecast_run where run_type='backtest' and status='done' order by finished_at desc limit 1").iloc[0, 0]
    pid = ai_tuning.tune(db, str(run_id), model)
    typer.echo(f"proposal_id={pid} (run {run_id})")

@app.command("tick")
def tick_cmd():
    """주기 작업 (pg_cron 대안): 배정 만료·예고·반복 알림 + 제출 마감 알림 + 이메일 발송."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from . import notify
    from .forecast import auto_run
    db = _pg()
    res = db.read_df("select app.fn_tick() as r").iloc[0, 0]
    auto = auto_run.maybe_run(db)          # 월 1회 자동 백테스트·프로덕션 (D-041) — 설정 off 면 즉시 반환
    from . import agent
    ag = agent.run(db)                     # 자율 모드 감시 (D-042) — agent_mode off 면 즉시 반환
    from .forecast import runner, store
    n_jobs = int(store.load_settings(db).get("engine_n_jobs", 3))
    pend = runner.process_pending(db, n_jobs=n_jobs)   # 웹 요청 런·AI 분석 요청 처리 (D-052)
    mail = notify.send_pending(db)
    typer.echo(f"tick={res} auto_run={auto} agent={ag} pending={len(pend)} email={mail}")

@app.command("agent")
def agent_cmd(mode: str = None, no_llm: bool = False):
    """AI 감시 1회 실행 (D-042). --mode off|dryrun|notify|propose 로 설정을 덮어쓰고, --no-llm 이면 규칙 판단만."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from . import agent
    typer.echo(str(agent.run(_pg(), mode_override=mode, use_llm=not no_llm)))

@app.command("notify")
def notify_cmd(dry_run: bool = False):
    """이메일 채널 미발송 알림 발송 (SMTP 미설정 시 skipped)."""
    from dotenv import load_dotenv; load_dotenv(ENGINE_DIR / ".env")
    from . import notify
    typer.echo(str(notify.send_pending(_pg(), dry_run=dry_run)))
