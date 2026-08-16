#!/usr/bin/env bash
# Copy objects from hosted Supabase Storage into the local retroscope_uploads volume (DUN-79).
#
# Required env:
#   SUPABASE_URL              e.g. https://xxxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY service role key (list + download)
#   UPLOADS_DIR               target volume mount (default: /data/uploads)
#
# Optional:
#   STORAGE_BUCKETS           comma-separated (default: avatars,poker-session-chat-images,retro-audio,tts-audio-cache)
#   PUBLIC_API_BASE_URL       if set, rewrite public Supabase storage URLs in public.profiles.avatar_url
#   DATABASE_URL              required when rewriting avatar URLs
#   DRY_RUN=1                 list only
#
# Example:
#   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… UPLOADS_DIR=./tmp/uploads \
#     ./scripts/selfhost/copy-storage-from-supabase.sh

set -euo pipefail

UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"
STORAGE_BUCKETS="${STORAGE_BUCKETS:-avatars,poker-session-chat-images,retro-audio,tts-audio-cache}"
DRY_RUN="${DRY_RUN:-0}"
LIMIT="${LIMIT:-1000}"

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" >&2
  exit 1
fi

SUPABASE_URL="${SUPABASE_URL%/}"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
APIKEY_HEADER="apikey: ${SUPABASE_SERVICE_ROLE_KEY}"

mkdir -p "$UPLOADS_DIR"

copy_bucket() {
  local bucket="$1"
  local offset=0
  local copied=0
  mkdir -p "${UPLOADS_DIR}/${bucket}"

  echo "==> Listing objects in bucket: ${bucket}"
  while true; do
    local page
    page="$(curl -fsS \
      -H "$AUTH_HEADER" \
      -H "$APIKEY_HEADER" \
      "${SUPABASE_URL}/storage/v1/object/list/${bucket}" \
      -H 'Content-Type: application/json' \
      -d "{\"prefix\":\"\",\"limit\":${LIMIT},\"offset\":${offset}}")"

    local names
    names="$(python3 -c 'import json,sys; data=json.load(sys.stdin); print("\n".join(item.get("name","") for item in data if item.get("name")))' <<<"$page")"
    if [[ -z "$names" ]]; then
      break
    fi

    local count=0
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      # Skip "folder" placeholder objects ending with /
      [[ "$name" == */ ]] && continue
      count=$((count + 1))
      local dest="${UPLOADS_DIR}/${bucket}/${name}"
      mkdir -p "$(dirname "$dest")"
      if [[ "$DRY_RUN" == "1" ]]; then
        echo "  DRY_RUN would copy ${bucket}/${name}"
      else
        curl -fsS \
          -H "$AUTH_HEADER" \
          -H "$APIKEY_HEADER" \
          "${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${name}" \
          -o "$dest" \
          || curl -fsS \
            -H "$AUTH_HEADER" \
            -H "$APIKEY_HEADER" \
            "${SUPABASE_URL}/storage/v1/object/public/${bucket}/${name}" \
            -o "$dest"
        echo "  copied ${bucket}/${name}"
      fi
      copied=$((copied + 1))
    done <<<"$names"

    if [[ "$count" -lt "$LIMIT" ]]; then
      break
    fi
    offset=$((offset + LIMIT))
  done

  echo "==> ${bucket}: ${copied} object(s)"
}

IFS=',' read -r -a BUCKETS <<<"$STORAGE_BUCKETS"
for bucket in "${BUCKETS[@]}"; do
  bucket="$(echo "$bucket" | xargs)"
  [[ -z "$bucket" ]] && continue
  copy_bucket "$bucket"
done

if [[ -n "${PUBLIC_API_BASE_URL:-}" && -n "${DATABASE_URL:-}" && "$DRY_RUN" != "1" ]]; then
  echo "==> Rewriting avatar public URLs → ${PUBLIC_API_BASE_URL%/}/storage/v1/object/public/avatars/…"
  python3 - <<'PY'
import os, re, sys
try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed; skip URL rewrite (pip install psycopg2-binary)", file=sys.stderr)
    sys.exit(0)

db = os.environ["DATABASE_URL"]
api = os.environ["PUBLIC_API_BASE_URL"].rstrip("/")
supabase = os.environ["SUPABASE_URL"].rstrip("/")
pattern = re.compile(
    re.escape(supabase) + r"/storage/v1/object/public/avatars/(.+)$"
)
conn = psycopg2.connect(db)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT id, avatar_url FROM public.profiles WHERE avatar_url IS NOT NULL")
rows = cur.fetchall()
updated = 0
for user_id, url in rows:
    if not url:
        continue
    m = pattern.match(url)
    if not m:
        continue
    new_url = f"{api}/storage/v1/object/public/avatars/{m.group(1)}"
    cur.execute("UPDATE public.profiles SET avatar_url = %s WHERE id = %s", (new_url, user_id))
    updated += 1
print(f"Updated {updated} profile avatar_url row(s)")
cur.close()
conn.close()
PY
fi

echo "==> Done. Objects live under ${UPLOADS_DIR}"
echo "    Mount this path as the Coolify volume retroscope_uploads → /data/uploads on api."
