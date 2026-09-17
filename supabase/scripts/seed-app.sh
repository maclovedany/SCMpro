#!/usr/bin/env bash
# 더미 시드 적용 + 물리화 뷰 갱신
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed/app_seed.sql"
# 고객사·수요 라인·기기 재고·품목 그룹·긴급발주 더미 (D-058) — 위 시드가 더미 재고·입고를 지운 뒤에 적용해야 한다
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed/app_seed_customer.sql"
psql "$SUPABASE_DB_URL" -Atq -c "select app.fn_refresh_matviews()" -c "select 'supplier', count(*) from app.supplier union all select 'item_setting', count(*) from app.item_setting union all select 'inventory', count(*) from app.inventory_snapshot union all select 'inbound', count(*) from app.inbound union all select 'holiday', count(*) from app.holiday"
