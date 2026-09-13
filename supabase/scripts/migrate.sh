#!/usr/bin/env bash
# migrations 를 파일명 순으로 psql 적용. 각 파일은 재실행 가능(if not exists / drop+create view)해야 한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> $(basename "$f")"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$f"
done
echo "migrations 완료"
