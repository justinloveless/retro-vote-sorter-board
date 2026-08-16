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

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" >&2
  exit 1
fi

SUPABASE_URL="${SUPABASE_URL%/}"
export SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY
export UPLOADS_DIR
export DRY_RUN
export STORAGE_BUCKETS

mkdir -p "$UPLOADS_DIR"

python3 - <<'PY'
import json, os, pathlib, urllib.error, urllib.request

supabase = os.environ["SUPABASE_URL"].rstrip("/")
service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
uploads = pathlib.Path(os.environ["UPLOADS_DIR"])
dry_run = os.environ.get("DRY_RUN", "0") == "1"
buckets = [b.strip() for b in os.environ.get("STORAGE_BUCKETS", "").split(",") if b.strip()]

headers = {
    "Authorization": f"Bearer {service}",
    "apikey": service,
    "Content-Type": "application/json",
}


def list_prefix(bucket: str, prefix: str, depth: int = 0) -> list[str]:
    if depth > 20:
        raise RuntimeError(f"recursion too deep for {bucket}/{prefix}")
    names: list[str] = []
    limit = 1000
    offset = 0
    while True:
        req = urllib.request.Request(
            f"{supabase}/storage/v1/object/list/{bucket}",
            data=json.dumps({"prefix": prefix, "limit": limit, "offset": offset}).encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            page = json.load(resp)
        if not page:
            break
        for item in page:
            name = (item.get("name") or "").lstrip("/")
            if not name or name == ".emptyFolderPlaceholder":
                continue
            full = f"{prefix.rstrip('/')}/{name}" if prefix else name
            full = full.lstrip("/")
            is_folder = item.get("id") is None and item.get("metadata") is None
            if is_folder:
                child = full if full.endswith("/") else full + "/"
                names.extend(list_prefix(bucket, child, depth + 1))
            else:
                names.append(full)
        if len(page) < limit:
            break
        offset += limit
    return names


def download(bucket: str, key: str) -> bytes:
    encoded = "/".join(urllib.request.quote(part) for part in key.split("/") if part)
    for kind in ("authenticated", "public"):
        url = f"{supabase}/storage/v1/object/{kind}/{bucket}/{encoded}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {service}", "apikey": service})
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.read()
        except urllib.error.HTTPError:
            continue
    raise RuntimeError(f"download failed for {bucket}/{key}")


for bucket in buckets:
    print(f"==> Listing objects in bucket: {bucket}")
    keys = list(dict.fromkeys(list_prefix(bucket, "")))
    copied = 0
    errors = 0
    for key in keys:
        dest = uploads / bucket / key
        if dry_run:
            print(f"  DRY_RUN would copy {bucket}/{key}")
            copied += 1
            continue
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(download(bucket, key))
            print(f"  copied {bucket}/{key}")
            copied += 1
        except Exception as exc:
            print(f"  ERROR {bucket}/{key}: {exc}")
            errors += 1
    print(f"==> {bucket}: {copied} object(s), {errors} error(s)")

print(f"==> Done. Objects live under {uploads}")
PY

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

echo "    Mount this path as the Coolify volume retroscope_uploads → /data/uploads on api."
