#!/usr/bin/env bash
# Imports a Supabase/Lovable Cloud backup (pg_dump custom format, .backup) into our Supabase:
# the user accounts (auth.users + auth.identities) and every app table. Everything runs in one
# transaction: it either all lands or nothing changes.
#
#   bash scripts/import-backup.sh /path/to/project.backup
#
# Needs PostgreSQL 18 client tools (pg_restore, psql) and SUPABASE_DB_URL in .env.local
# (Supabase → Connect → Session pooler). Credit lines set in the new app are kept.
set -euo pipefail

BACKUP="${1:?Usage: bash scripts/import-backup.sh /path/to/file.backup}"
PG_BIN="${PG_BIN:-/c/Program Files/PostgreSQL/18/bin}"
PG_RESTORE="$PG_BIN/pg_restore"; PSQL="$PG_BIN/psql"
command -v "$PG_RESTORE" >/dev/null 2>&1 || { PG_RESTORE=pg_restore; PSQL=psql; }

cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL en .env.local}"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT   # the extracted SQL holds password hashes: never keep it

# Pick only what the app owns, in dependency order.
"$PG_RESTORE" -l "$BACKUP" > "$TMP/toc.txt"
: > "$TMP/pick.txt"
for t in "auth users" "auth identities" "public profiles" "public accounts" "public subscriptions" \
         "public debts" "public installments" "public io_expenses" "public bcp_movements"; do
  grep "TABLE DATA $t " "$TMP/toc.txt" >> "$TMP/pick.txt" || echo "aviso: '$t' no está en el backup"
done
"$PG_RESTORE" --data-only -L "$TMP/pick.txt" -f "$TMP/data.sql" "$BACKUP"

to_native() { command -v cygpath >/dev/null 2>&1 && cygpath -m "$1" || echo "$1"; }
cat > "$TMP/import.sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
-- keep credit lines configured in the new app (column doesn't exist in the old backup)
CREATE TEMP TABLE keep_limits AS SELECT id, credit_limit FROM public.accounts WHERE credit_limit IS NOT NULL;
TRUNCATE public.bcp_movements, public.io_expenses, public.installments, public.accounts,
         public.debts, public.subscriptions, public.profiles;
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users);
DELETE FROM auth.users;
\i '$(to_native "$TMP/data.sql")'
UPDATE public.accounts a SET credit_limit = k.credit_limit FROM keep_limits k WHERE a.id = k.id;
SELECT setval('public.bcp_movements_seq_seq', COALESCE((SELECT max(seq) FROM public.bcp_movements), 1));
COMMIT;
SELECT 'usuarios' AS tabla, count(*) FROM auth.users
UNION ALL SELECT 'cuentas', count(*) FROM public.accounts
UNION ALL SELECT 'movimientos debito', count(*) FROM public.bcp_movements
UNION ALL SELECT 'gastos tarjeta', count(*) FROM public.io_expenses
UNION ALL SELECT 'cuotas', count(*) FROM public.installments
UNION ALL SELECT 'deudas', count(*) FROM public.debts
UNION ALL SELECT 'suscripciones', count(*) FROM public.subscriptions;
SQL

"$PSQL" "$SUPABASE_DB_URL" -q -X -f "$(to_native "$TMP/import.sql")"
echo "Importación terminada."
