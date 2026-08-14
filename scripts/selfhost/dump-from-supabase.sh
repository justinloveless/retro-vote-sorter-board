#!/usr/bin/env bash
# Dump schema + data from hosted Supabase Postgres for VPS restore (DUN-78 Phase 3).
#
# Required env:
#   SUPABASE_DB_URL  postgres connection string with privileges to dump
#                    (Database settings → Connection string → URI, use session mode)
#
# Optional:
#   DUMP_DIR         output directory (default: ./tmp/selfhost-dump)
#   SKIP_DATA=1      schema-only dump
#
# Example:
#   SUPABASE_DB_URL='postgresql://postgres.…@db.…supabase.co:5432/postgres' \
#     ./scripts/selfhost/dump-from-supabase.sh

set -euo pipefail

DUMP_DIR="${DUMP_DIR:-./tmp/selfhost-dump}"
SKIP_DATA="${SKIP_DATA:-0}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required" >&2
  exit 1
fi

mkdir -p "$DUMP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SCHEMA_FILE="$DUMP_DIR/schema-${STAMP}.sql"
DATA_FILE="$DUMP_DIR/data-${STAMP}.dump"
LATEST_SCHEMA="$DUMP_DIR/schema-latest.sql"
LATEST_DATA="$DUMP_DIR/data-latest.dump"

echo "==> Dumping schema to $SCHEMA_FILE"
pg_dump "$SUPABASE_DB_URL" \
  --format=plain \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=supabase_migrations \
  --exclude-schema=supabase_functions \
  --exclude-schema=realtime \
  --exclude-schema=storage \
  --exclude-schema=_realtime \
  --exclude-schema=net \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=pgbouncer \
  --exclude-schema=pgsodium \
  --exclude-schema=pgsodium_masks \
  --exclude-schema=vault \
  --exclude-schema=extensions \
  > "$SCHEMA_FILE"

# Keep public + auth (auth.users for FKs / get_user_email_if_admin). Re-include auth explicitly.
pg_dump "$SUPABASE_DB_URL" \
  --format=plain \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=auth \
  >> "$SCHEMA_FILE" || true

cp "$SCHEMA_FILE" "$LATEST_SCHEMA"

if [[ "$SKIP_DATA" != "1" ]]; then
  echo "==> Dumping data (custom format) to $DATA_FILE"
  pg_dump "$SUPABASE_DB_URL" \
    --format=custom \
    --data-only \
    --no-owner \
    --schema=public \
    --schema=auth \
    --file="$DATA_FILE"
  cp "$DATA_FILE" "$LATEST_DATA"
else
  echo "==> SKIP_DATA=1 — schema only"
fi

echo "==> Done."
echo "    Schema: $LATEST_SCHEMA"
if [[ "$SKIP_DATA" != "1" ]]; then
  echo "    Data:   $LATEST_DATA"
fi
echo "Next: DATABASE_URL=… ./scripts/selfhost/restore-to-local.sh"
