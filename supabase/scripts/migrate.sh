#!/usr/bin/env bash
# migrations 를 파일명 순으로 psql 적용. 각 파일은 재실행 가능(if not exists / drop+create view)해야 한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
# 권한(grants)은 파일명 순서와 무관하게 **항상 마지막** — 이후 추가된 마이그레이션의 객체도 포함되도록
GRANTS="$(ls "$ROOT"/supabase/migrations/*grants*.sql | tail -1)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  [ "$f" = "$GRANTS" ] && continue
  echo "==> $(basename "$f")"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$f"
done
echo "==> $(basename "$GRANTS")"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$GRANTS"
echo "migrations 완료"
