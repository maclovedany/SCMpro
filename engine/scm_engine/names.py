"""표시 이름 적재 (D-075, R-UI-17). 치환표에서 **이름 쌍만** 읽어 app.name_alias 를 채운다.
- 'Family 전체값' → kind=family (제품군·Product 전체 이름), '기종 코드네임' → kind=codename (기종 묶음 MDLnnn)
- '부품·옵션 코드' 시트(코드 복원 쌍)는 읽지 않는다 — 품목코드·IOT 는 익명 체계 그대로 (D-059).
치환표는 저장소 밖에 두고 경로를 CLI 인자로만 받는다. 실제 이름은 저장소·테스트·문서에 쓰지 않는다."""
from __future__ import annotations
from pathlib import Path
import pandas as pd

SHEETS = {"family": "Family 전체값", "codename": "기종 코드네임"}
COLUMNS = ["kind", "anon", "anon_key", "real_name"]
PREFER = "MC_OL_vs_ACT"     # 같은 익명 이름에 표기가 여럿이면 이 출처의 표기를 쓴다 (화면이 원본 파일과 같게)


def _s(v) -> str:
    return "" if v is None else str(v).strip()


def read_pairs(path: Path) -> tuple[pd.DataFrame, dict]:
    """(kind, anon, anon_key, real_name). 빈 값·#N/A·원본과 같은 값은 제외, 같은 익명 이름이 여럿이면 기종 OL 파일의 표기, 없으면 첫 쌍."""
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out, seen, dup = [], set(), 0
    for kind, sheet in SHEETS.items():
        rows = list(wb[sheet].iter_rows(values_only=True))[1:]
        rows.sort(key=lambda r: PREFER not in _s(r[2] if r and len(r) > 2 else ""))     # 안정 정렬: 기종 OL 파일에 나온 표기를 앞으로
        for r in rows:
            real, anon = (_s(r[0]), _s(r[1])) if r and len(r) >= 2 else ("", "")
            if not real or not anon or real == "#N/A" or anon == "#N/A" or real == anon:
                continue
            if (kind, anon) in seen:
                dup += 1; continue
            seen.add((kind, anon)); out.append((kind, anon, anon.upper(), real))
    df = pd.DataFrame(out, columns=COLUMNS)
    return df, {"duplicate_anon": dup, **{k: int((df.kind == k).sum()) for k in SHEETS}}


# 기종(MC) Product 의 실제 이름은 두지 않는다 — 화면은 회사가 준 보안용 약자(app.mc_family)를 쓴다 (D-077).
# 같은 이름이 부품·소모품·옵션의 제품군으로도 쓰이면 남긴다.
DROP_MC = """delete from app.name_alias a where a.kind = 'family'
  and exists (select 1 from raw.dim_model m where upper(btrim(m.model_key)) = a.anon_key)
  and not exists (select 1 from raw.dim_item i where upper(btrim(i.family)) = a.anon_key);
"""


def _q(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def to_sql(df: pd.DataFrame) -> str:
    """테이블 전체 교체 (재실행 안전)"""
    rows = [f"({_q(r.kind)},{_q(r.anon)},{_q(r.anon_key)},{_q(r.real_name)})" for r in df.itertuples()]
    body = "".join(f"insert into app.name_alias(kind, anon, anon_key, real_name) values\n" + ",\n".join(rows[i:i + 500]) + ";\n" for i in range(0, len(rows), 500))
    return "begin;\ndelete from app.name_alias;\n" + body + DROP_MC + "commit;\n"
