#!/usr/bin/env bash
# Restore a Supabase dump into local/VPS Postgres and apply PostgREST bootstrap (DUN-78).
#
# Required env:
#   DATABASE_URL   target Postgres (superuser recommended for restore)
#
# Optional:
#   DUMP_DIR                 default ./tmp/selfhost-dump
#   SCHEMA_FILE              default $DUMP_DIR/schema-latest.sql
#   DATA_FILE                default $DUMP_DIR/data-latest.dump
#   SKIP_SCHEMA=1            skip schema SQL apply
#   SKIP_DATA=1              skip data restore
#   REPO_ROOT                default: repo root inferred from script path
#
# Example:
#   DATABASE_URL='postgresql://postgres:…@postgres:5432/retroscope' \
#     ./scripts/selfhost/restore-to-local.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
DUMP_DIR="${DUMP_DIR:-./tmp/selfhost-dump}"
SCHEMA_FILE="${SCHEMA_FILE:-$DUMP_DIR/schema-latest.sql}"
DATA_FILE="${DATA_FILE:-$DUMP_DIR/data-latest.dump}"
SKIP_SCHEMA="${SKIP_SCHEMA:-0}"
SKIP_DATA="${SKIP_DATA:-0}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

INIT_DIR="$REPO_ROOT/server/postgres/init"

echo "==> Applying roles + auth schema + RLS helpers"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$INIT_DIR/01-roles.sql" \
  -f "$INIT_DIR/02-auth-schema.sql" \
  -f "$INIT_DIR/03-rls-helpers.sql"

if [[ "$SKIP_SCHEMA" != "1" ]]; then
  if [[ ! -f "$SCHEMA_FILE" ]]; then
    echo "Schema file not found: $SCHEMA_FILE" >&2
    echo "Run scripts/selfhost/dump-from-supabase.sh first, or set SCHEMA_FILE." >&2
    exit 1
  fi
  echo "==> Applying schema from $SCHEMA_FILE"
  # Dumps often reference Supabase-only roles/extensions; continue past benign errors
  # by wrapping in a transaction only when clean. Prefer ON_ERROR_STOP for real failures
  # after sanitizing the dump — operators should review the first restore carefully.
  set +e
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f "$SCHEMA_FILE"
  SCHEMA_RC=$?
  set -e
  if [[ $SCHEMA_RC -ne 0 ]]; then
    echo "Warning: schema apply exited $SCHEMA_RC (review output for hard failures)" >&2
  fi
fi

if [[ "$SKIP_DATA" != "1" ]]; then
  if [[ ! -f "$DATA_FILE" ]]; then
    echo "Data file not found: $DATA_FILE" >&2
    echo "Set SKIP_DATA=1 for schema-only, or run dump-from-supabase.sh." >&2
    exit 1
  fi
  echo "==> Restoring data from $DATA_FILE"
  pg_restore \
    --dbname="$DATABASE_URL" \
    --data-only \
    --no-owner \
    --disable-triggers \
    --exit-on-error \
    "$DATA_FILE" || {
      echo "pg_restore reported errors — retrying without --exit-on-error for partial loads" >&2
      pg_restore \
        --dbname="$DATABASE_URL" \
        --data-only \
        --no-owner \
        --disable-triggers \
        "$DATA_FILE" || true
    }
fi

echo "==> Post-restore grants + PostgREST reload notify"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$INIT_DIR/03-rls-helpers.sql" \
  -f "$INIT_DIR/04-post-restore-grants.sql"

echo "==> Restore complete. Verify with API GET /readyz and a JWT-authenticated PostgREST select."
