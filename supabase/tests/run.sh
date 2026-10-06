#!/usr/bin/env bash
# Test the migration and its row level security on a plain Postgres.
# Usage: PGURL=postgres://postgres@localhost:5432 supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PGURL=${PGURL:-postgres://postgres@localhost:5432}
psql "$PGURL/postgres" -qc "drop database if exists brenqo_test" -qc "create database brenqo_test" >/dev/null
for f in supabase/tests/supabase-stub.sql supabase/migrations/*.sql supabase/tests/rls.sql; do
  psql "$PGURL/brenqo_test" -v ON_ERROR_STOP=1 -q -f "$f"
done
