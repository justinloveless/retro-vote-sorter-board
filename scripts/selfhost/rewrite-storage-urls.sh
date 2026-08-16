#!/usr/bin/env bash
# Rewrite hosted Supabase public storage URLs in the local DB to the self-hosted API host.
#
# Required:
#   DATABASE_URL
#   PUBLIC_API_BASE_URL   e.g. https://retro-api.example.com
#   SUPABASE_URL          old host to replace (e.g. https://xxx.supabase.co)
#
# Optional:
#   DRY_RUN=1

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL required}"
: "${PUBLIC_API_BASE_URL:?PUBLIC_API_BASE_URL required}"
: "${SUPABASE_URL:?SUPABASE_URL required}"

DRY_RUN="${DRY_RUN:-0}"
API="${PUBLIC_API_BASE_URL%/}"
OLD="${SUPABASE_URL%/}"

echo "==> Rewriting ${OLD}/storage/v1/object/public/… → ${API}/storage/v1/object/public/…"

if [[ "$DRY_RUN" == "1" ]]; then
  psql "$DATABASE_URL" -c "
    SELECT id, avatar_url
    FROM public.profiles
    WHERE avatar_url LIKE '${OLD}/storage/v1/object/public/%'
    LIMIT 20;
  "
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
UPDATE public.profiles
SET avatar_url = replace(avatar_url, '${OLD}/storage/v1/object/public/', '${API}/storage/v1/object/public/')
WHERE avatar_url LIKE '${OLD}/storage/v1/object/public/%';

-- Poker chat image URLs stored in message bodies / image_url columns when present
DO \$\$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'poker_session_chat_messages'
      AND column_name = 'image_url'
  ) THEN
    EXECUTE format(
      'UPDATE public.poker_session_chat_messages
       SET image_url = replace(image_url, %L, %L)
       WHERE image_url LIKE %L',
      '${OLD}/storage/v1/object/public/',
      '${API}/storage/v1/object/public/',
      '${OLD}/storage/v1/object/public/%'
    );
  END IF;
END
\$\$;
SQL

echo "==> URL rewrite complete"
