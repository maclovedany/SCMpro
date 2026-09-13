#!/usr/bin/env bash
# data/export/*.csv → raw.* (\copy). 기존 행은 truncate 후 적재. bridge_scc_config 는 seed SQL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a; source "$ROOT/engine/.env"; set +a
TABLES="dim_item dim_model fact_shipment fact_mc_plan_actual bridge_bom bridge_mc_cap bridge_cap_option bridge_option_model bridge_xcn"
for t in $TABLES; do
  echo "==> raw.$t"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "truncate raw.$t" \
    -c "\\copy raw.$t from '$ROOT/data/export/$t.csv' with (format csv, header true, null '')"
done
echo "==> raw.bridge_scc_config (seed)"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/seed/raw_bridge_scc_config.sql"
psql "$SUPABASE_DB_URL" -Atc "select 'dim_item', count(*) from raw.dim_item union all select 'fact_shipment', count(*) from raw.fact_shipment union all select 'bridge_scc_config', count(*) from raw.bridge_scc_config"
