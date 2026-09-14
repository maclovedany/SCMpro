"""AI 정교화 (R-FC-42, D-016): 백테스트 런 요약 → gpt-5-nano → 진단·조정 제안(JSON) → app.forecast_tuning_proposal.
자동 적용 금지 — 웹에서 승인(kind=forecast_tuning) 후 fn_apply_tuning 이 params 에 병합."""
from __future__ import annotations
import json, os, uuid
import pandas as pd
from ..db.postgres import PostgresDB

SCHEMA = {
    "name": "forecast_tuning",
    "schema": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "diagnosis": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                "properties": {"area": {"type": "string"}, "finding": {"type": "string"}, "evidence": {"type": "string"}},
                "required": ["area", "finding", "evidence"]}},
            "proposals": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                "properties": {"method_key": {"type": "string"}, "param_patch": {"type": "object", "additionalProperties": True},
                               "enabled": {"type": ["boolean", "null"]}, "scope": {"type": "string"}, "rationale": {"type": "string"}, "expected_effect": {"type": "string"}},
                "required": ["method_key", "param_patch", "enabled", "scope", "rationale", "expected_effect"]}},
            "data_issues": {"type": "array", "items": {"type": "string"}},
            "dos_adjustments": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                "properties": {"scope": {"type": "string", "enum": ["item", "cell"]}, "key": {"type": "string"}, "target_dos_days": {"type": "integer"}, "rationale": {"type": "string"}},
                "required": ["scope", "key", "target_dos_days", "rationale"]}},
        },
        "required": ["diagnosis", "proposals", "data_issues", "dos_adjustments"],
    },
}

SYSTEM = """당신은 복합기 부품·소모품·옵션·기계의 월간 수요예측을 검토하는 SCM 수요예측 전문가입니다.
회계연도는 4월 시작(FY25 = 2025-04~2026-03)입니다. 지표: WAPE = Σ|예측−실적|/Σ실적, Bias = Σ(예측−실적)/Σ실적(양수=과대).
주어진 백테스트 결과만 근거로 (1) 오차 원인을 진단하고 (2) 기법별 파라미터 조정 또는 on/off 제안을 JSON 으로 작성하세요.
제안의 method_key 는 제공된 기법 목록에 있는 키만 사용하고, param_patch 는 해당 기법의 params 키만 수정합니다. 근거 없는 추정은 하지 마세요. 한국어로 작성합니다.
주의: 어떤 기법이 특정 레벨(예: 기종 레벨의 ol_bias)에서 챔피언 WAPE 를 만들고 있으면 그 기법을 끄자고 제안하지 마세요. 기법 off 제안은 그 기법이 어떤 레벨·셀에서도 챔피언이 아닐 때만 하세요. Sales OL / SCM OL 은 기법이 아니라 비교 대상입니다.
발주 피드백(order_feedback)이 있으면: 지난 계획에서 시스템 제안대로 발주했을 때 결품/과잉이 반복된 품목·ABC-XYZ 셀, 담당자가 체계적으로(3회 이상, 같은 방향) 오버라이드한 품목에 대해 목표 DoS 조정을 dos_adjustments 로 제안하세요(scope item = 품목코드, cell = 'AX' 같은 셀 키, target_dos_days 는 5~180 정수). 근거가 없으면 빈 배열."""

def build_summary(db: PostgresDB, run_id: str, worst_n: int = 30) -> dict:
    run = db.read_df("select eval_fy, train_from, train_to, summary, params_snapshot from app.forecast_run where id=%s", (run_id,)).iloc[0]
    acc = db.read_df("select level, key, method, bias, wape, mape, n from app.forecast_accuracy where run_id=%s and level in ('total','category','biz','abcxyz','pattern')", (run_id,))
    worst = db.read_df("""select a.key, a.wape, a.bias, a.n, c.category, c.pattern, c.abc, c.xyz, c.champion_method
        from app.forecast_accuracy a join app.item_class c on c.key_code = a.key
        where a.run_id=%s and a.level='item' and a.method = c.champion_method and a.n >= 6 order by a.wape desc nulls last limit %s""", (run_id, worst_n))
    methods = db.read_df("select key, name, family, enabled, params, patterns, abc_scope from app.forecast_method order by sort")
    champ_share = run["summary"].get("champion_share") if isinstance(run["summary"], dict) else None
    feedback = order_feedback(db)
    return {
        "run": {"eval_fy": int(run["eval_fy"]), "train_from": run["train_from"], "train_to": run["train_to"], "summary": run["summary"]},
        "accuracy": acc.round(4).to_dict("records"),
        "worst_items": worst.round(4).to_dict("records"),
        "champion_share": champ_share,
        "methods": [{**m, "params": m["params"], "patterns": list(m["patterns"]), "abc_scope": list(m["abc_scope"])} for m in methods.to_dict("records")],
        "order_feedback": feedback,
    }

def order_feedback(db: PostgresDB, months: int = 12) -> dict | None:
    """발주 피드백 루프 (D-044): 최근 승인 계획의 사후 채점 + 오버라이드 패턴. 채점할 실적이 없으면 None"""
    try:
        sc = db.read_df("select app.fn_recent_scorecards(%s) as s", (months,)).iloc[0, 0]
        pat = db.read_df("select app.fn_override_patterns(%s) as p", (months,)).iloc[0, 0]
    except Exception:
        return None
    if not sc or not sc.get("plans"):
        return None
    return {"scorecards": sc, "override_patterns": pat}

def call_llm(summary: dict, model: str = "gpt-5-nano", client=None) -> dict:
    from openai import OpenAI
    client = client or OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    user = "백테스트 요약(JSON):\n" + json.dumps(summary, ensure_ascii=False, default=str)[:60000]
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
        response_format={"type": "json_schema", "json_schema": {"name": SCHEMA["name"], "schema": SCHEMA["schema"], "strict": False}},
    )
    content = resp.choices[0].message.content
    return json.loads(content)

def tune(db: PostgresDB, run_id: str, model: str | None = None, client=None) -> str:
    settings = dict(db.read_df("select key, value from app.system_settings").itertuples(index=False))
    model = model or (settings.get("ai_model") if isinstance(settings.get("ai_model"), str) else None) or "gpt-5-nano"
    summary = build_summary(db, run_id)
    prompt = json.dumps(summary, ensure_ascii=False, default=str)
    response = call_llm(summary, model=model, client=client)
    pid = str(uuid.uuid4())
    db.execute("insert into app.forecast_tuning_proposal(id, run_id, model, prompt, response, status) values (%s,%s,%s,%s,%s,'pending')",
               (pid, run_id, model, prompt[:20000], json.dumps(response, ensure_ascii=False)))   # 프롬프트 원문은 20KB 까지만 보관 (D-045)
    return pid
