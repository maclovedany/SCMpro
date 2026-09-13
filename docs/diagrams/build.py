#!/usr/bin/env python3
"""src/*.html 조각을 공통 CSS · JS · 아이콘과 합쳐 독립 실행 HTML로 내보낸다.

배치: <project>/diagrams/build.py
필요: <project>/diagrams/src/_diagram.css · _edges.js · _icons.svg
사용: python3 diagrams/build.py
출력: <project>/diagrams/NN_*.html + index.html
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

for required in ("_diagram.css", "_edges.js", "_icons.svg"):
    if not (SRC / required).exists():
        sys.exit(f"없음: {SRC / required} — skill 의 assets/ 에서 복사하세요")

CSS = (SRC / "_diagram.css").read_text(encoding="utf-8")
JS = (SRC / "_edges.js").read_text(encoding="utf-8")
ICONS = (SRC / "_icons.svg").read_text(encoding="utf-8")

TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
{css}
</style>
</head>
<body>
{icons}
<div class="wrap">
<div class="stage">
{body}
</div>
</div>
<script>
{js}
</script>
</body>
</html>
"""


def build_one(src: Path) -> tuple[str, str]:
    raw = src.read_text(encoding="utf-8")
    m = re.search(r"<title>(.*?)</title>", raw, re.S)
    title = m.group(1).strip() if m else src.stem
    body = raw[m.end():].strip() if m else raw
    out = ROOT / src.name
    out.write_text(
        TEMPLATE.format(title=title, css=CSS, icons=ICONS, body=body, js=JS),
        encoding="utf-8",
    )
    return src.name, title


def build_index(items: list[tuple[str, str]]) -> None:
    cards = "\n".join(
        f'<a class="card" href="{name}"><span class="n">{i + 1:02d}</span><span class="t">{title}</span>'
        f'<iframe src="{name}" loading="lazy" tabindex="-1"></iframe></a>'
        for i, (name, title) in enumerate(items)
    )
    html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>다이어그램 모음</title>
<style>
body{{margin:0;padding:40px;background:#f8fafc;font-family:Pretendard,"Apple SD Gothic Neo",system-ui,sans-serif;color:#0f172a}}
h1{{font-size:26px;margin:0 0 6px}} p{{margin:0 0 28px;color:#64748b}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:24px}}
.card{{display:block;position:relative;background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;text-decoration:none;color:inherit;box-shadow:0 2px 8px rgba(15,23,42,.05)}}
.card:hover{{border-color:#1d4ed8}}
.card .n{{font-family:ui-monospace,Menlo,monospace;font-weight:700;color:#1d4ed8;margin-right:8px}}
.card .t{{font-weight:700;font-size:15px}}
.card iframe{{display:block;width:100%;aspect-ratio:16/9;border:1px solid #e2e8f0;border-radius:8px;margin-top:10px;pointer-events:none;background:#fff}}
</style></head><body>
<h1>다이어그램 모음</h1>
<p>카드를 클릭하면 1920×1080 단일 페이지로 열립니다.</p>
<div class="grid">
{cards}
</div></body></html>"""
    (ROOT / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    items = [build_one(p) for p in sorted(SRC.glob("[0-9][0-9]_*.html"))]
    if not items:
        sys.exit(f"조각 없음: {SRC}/NN_이름.html 형식으로 만드세요")
    build_index(items)
    for name, title in items:
        print(f"built {name}  ·  {title}")
    print(f"built index.html ({len(items)} diagrams)")


if __name__ == "__main__":
    main()
