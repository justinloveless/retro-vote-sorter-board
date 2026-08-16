# Coolify Self-Host Deployment (Phase 1–4)

Lean stack for Retroscope on a shared Coolify VPS: **Postgres + PostgREST + Node API + Nginx FE**. Phase 2 adds local `/auth/v1/*` (Google + password). Phase 3 adds PostgREST data. Phase 4 adds Docker-volume storage + P0 edge ports.

| Compose file | When to use |
|--------------|-------------|
| **`docker-compose.selfhost.prebuilt.yml`** | **Recommended on small Hetzner/Coolify hosts** — pulls GHCR images; VPS never runs `vite build` |
| `docker-compose.selfhost.yml` | Local/dev or a dedicated build server (builds `api`/`web` from Dockerfiles) |

## Services & domains

| Service | Container port | Coolify domain | Notes |
|---------|----------------|----------------|-------|
| `web` | `80` | `https://retro.example.com` (placeholder) | SPA via nginx (`try_files` → `index.html`) |
| `api` | `3000` | `https://retro-api.example.com` (placeholder) | Enable **WebSocket** support on this domain (Phase 5 realtime) |
| `postgres` | `5432` | **none** | Internal only |
| `postgrest` | `3000` | **none** | Internal only — Node talks to `http://postgrest:3000` |

Replace `retro.example.com` / `retro-api.example.com` with real FQDNs when DNS is ready.

## Coolify hard rules

1. Compose uses **`expose` only** — never host `ports` (avoids collisions on the shared VPS).
2. Attach Coolify domains to **`web`** and **`api` only**.
3. Set **CPU/memory limits** (already in compose) — these apply to **running** containers only.
4. Enable Coolify **volume backups** for `retroscope_pg_data` and `retroscope_uploads`.
5. Vite `VITE_*` vars are **build-time** — change → **rebuild** the `web` service.
6. Cap **build** concurrency (see [Deploy CPU](#deploy-cpu-shared-vps)) — image builds ignore runtime CPU limits and can freeze a small Hetzner VPS.

## Deploy CPU (shared VPS) — use prebuilt images

On a 2–4 GB / 3 vCPU Hetzner box, Atlaskit `vite build` will still saturate CPU and disk (multi‑GB `node_modules` reads during `transforming...`) even with `taskset` / `nice`. The browserslist “run `npx update-browserslist-db`” line in Coolify logs is only a **warning**, not a command Coolify runs.

**Recommended: build on GitHub Actions, pull on Coolify**

Keep your **GitHub App** connection (repo access). For prebuilt images you only change *when* Coolify deploys:

| Mechanism | Role |
|-----------|------|
| **GitHub App** | Stays installed — Coolify can read the repo / compose file |
| **Auto Deploy** (Advanced → Deployment & Git) | **Turn OFF** — otherwise merge-to-main deploys immediately and pulls stale GHCR `:latest` while Actions is still building |
| **Deploy Webhook** (not a “manual Git webhook”) | Coolify URL that **GitHub Actions** calls *after* images are pushed. Direction is CI → Coolify, opposite of the GitHub App’s git events |

1. In the GitHub repo set:
   - **Variables:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`
   - **Secrets:** `VITE_SUPABASE_PUBLISHABLE_KEY`, **`COOLIFY_WEBHOOK`**
   - Optional secret: `COOLIFY_TOKEN` if your Coolify instance requires Bearer auth on deploy API calls
2. In Coolify for this resource:
   - Compose path: **`docker-compose.selfhost.prebuilt.yml`**
   - **Disable Auto Deploy** (Configuration → Advanced → Deployment & Git). Leave the GitHub App source as-is.
   - Open the resource **Deploy Webhook** / deploy API URL → save it as GitHub secret `COOLIFY_WEBHOOK`
3. Merge to `main` (or run workflow **Coolify images** manually). Order is:
   1. Actions builds/pushes `*-api` + `*-web` to GHCR  
   2. `deploy-coolify` calls the Deploy Webhook  
   3. Coolify pulls (`pull_policy: always`) and restarts
4. If packages are private, on the VPS once:
   ```bash
   echo <GITHUB_PAT_with_read:packages> | docker login ghcr.io -u <github-user> --password-stdin
   ```
   Or set the GHCR package visibility to **Public**.
5. Confirm deploy logs show **pull** for `web`/`api`, not `RUN vite build` / `npm ci`.

`VITE_*` changes require a new Actions build (baked into the web image), then the post-image redeploy.

If you keep GitHub App **Auto Deploy** on, every merge will race GHCR; you’d need to click **Redeploy** in Coolify after the Actions workflow finishes (or accept stale images).

### Fallback: build on the VPS (not recommended on small hosts)

Use `docker-compose.selfhost.yml` only if you have spare CPU/RAM or a Coolify [build server](https://coolify.io/docs/knowledge-base/server/build-server).

1. Server → Advanced → **Concurrent builds = 1**
2. Resource env: `COMPOSE_PARALLEL_LIMIT=1`
3. Dockerfiles still apply `taskset`, heap caps, and `reportCompressedSize: false` — expect a slow, still-heavy build.

## Named volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `retroscope_pg_data` | Postgres data dir | Database |
| `retroscope_uploads` | `/data/uploads` on `api` | Bucket prefixes: `avatars/`, `poker-session-chat-images/`, `retro-audio/`, `tts-audio-cache/` |

## Environment variables

### Build-time (`web`)

These are baked into the Vite bundle. Rebuild after any change.

```bash
VITE_API_BASE_URL=https://retro-api.example.com
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
```

When the admin Backend toggle is **Hosted Supabase**, auth + data stay on Supabase. When set to **Self-hosted**, the FE auth facade talks to Node `/auth/v1/*`, table CRUD / RPCs go to local PostgREST via Node `/rest/v1/*`, uploads use `/storage/v1/object/*` on the `retroscope_uploads` volume, and P0 edge functions hit `/functions/v1/*`. Realtime channels still use hosted Supabase until Phase 5. Stripe billing functions stay on hosted Supabase (`keep_on_supabase`). Keep Supabase Vite vars set through dual-path cutover.

### Runtime secrets (`api` / `postgres` / `postgrest`)

```bash
# Postgres
POSTGRES_DB=retroscope
POSTGRES_USER=postgres
POSTGRES_PASSWORD=generate-a-strong-password

# Shared JWT secret (min 32 chars) — must match PostgREST
JWT_SECRET=generate-a-long-random-secret-at-least-32-chars

# Optional overrides (defaults work inside the compose network)
DATABASE_URL=postgresql://retroscope_app:retroscope_app_pass@postgres:5432/retroscope
PGRST_DB_URI=postgresql://authenticator:retroscope_authenticator_pass@postgres:5432/retroscope
POSTGREST_URL=http://postgrest:3000
PGRST_DB_ANON_ROLE=anon

# CORS + public API URL used in health/status payloads
ALLOW_ORIGINS=https://retro.example.com
SELF_HOSTED_API_BASE_URL=https://retro-api.example.com
PUBLIC_SITE_URL=https://retro.example.com

# Phase 2 — Google OAuth (redirect URI must match Coolify API FQDN)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_GOOGLE_REDIRECT_URI=https://retro-api.example.com/auth/v1/callback

# Phase 2 — password reset email (Resend preferred; SMTP optional)
RESEND_API_KEY=...
EMAIL_FROM=Retroscope <noreply@yourdomain.com>
# SMTP_HOST=...
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...

# Phase 4 — Admin "Copy from Supabase" tool (optional; enable when ready to sync)
# Session-mode URI from Supabase → Project Settings → Database
MIGRATE_SOURCE_DATABASE_URL=postgresql://postgres.…@db.…supabase.co:5432/postgres
# Needed for storage copy AND for dual-path migrate auth (hosted admin session → API)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
# Optional fallback for validating hosted user JWTs
# SUPABASE_ANON_KEY=eyJhbGc...
```

> Default DB role passwords in `server/postgres/init/01-roles.sql` are for bootstrap only. Change them (and matching `DATABASE_URL` / `PGRST_DB_URI`) before any real data restore.

### Auth import (Phase 2)

Export from hosted Supabase, then import with UUID preservation:

```bash
# From server/
DATABASE_URL=postgresql://... npm run import-auth-users -- \
  --users ./export/users.json \
  --identities ./export/identities.json
```

See `server/src/scripts/import-auth-users.ts` for the SQL export shape.

### Staging DB restore (Phase 3)

Dump hosted Supabase Postgres, restore into Coolify Postgres, then re-apply PostgREST roles/RLS helpers:

```bash
# On a machine with network access to Supabase + pg_dump
SUPABASE_DB_URL='postgresql://postgres:…@db.…supabase.co:5432/postgres' \
  ./scripts/selfhost/dump-from-supabase.sh

# Against the VPS / compose Postgres (superuser URL recommended)
DATABASE_URL='postgresql://postgres:…@postgres:5432/retroscope' \
  ./scripts/selfhost/restore-to-local.sh
```

Init SQL applied on every Coolify deploy via `db-init`:

- `server/postgres/init/01-roles.sql` — `anon` / `authenticated` / `service_role` / `authenticator`
- `server/postgres/init/02-auth-schema.sql` — local auth tables
- `server/postgres/init/03-rls-helpers.sql` — `auth.uid()` / `auth.role()` / `auth.jwt()` + grants

After restore, confirm:

- `GET /readyz` → postgres + postgrest green
- With a self-hosted access JWT: `GET /rest/v1/profiles?select=id&limit=1` (via API domain)

### Storage copy (Phase 4)

**Option A — Admin UI:** open **Admin → Backend → Copy from Supabase** (requires the env vars above). Prefer dry-run first.

**Option B — CLI:** copy hosted Supabase Storage objects into the Coolify `retroscope_uploads` volume (mounted at `/data/uploads` on `api`):

```bash
SUPABASE_URL='https://YOUR_PROJECT.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='…' \
UPLOADS_DIR=/data/uploads \
  ./scripts/selfhost/copy-storage-from-supabase.sh

# After API FQDN is final, rewrite public URLs stored in Postgres:
DATABASE_URL='postgresql://…' \
SUPABASE_URL='https://YOUR_PROJECT.supabase.co' \
PUBLIC_API_BASE_URL='https://retro-api.example.com' \
  ./scripts/selfhost/rewrite-storage-urls.sh
```

## Deploy steps

1. Publish images via GitHub Actions (**Coolify images** workflow) after setting `VITE_*` repo vars/secrets.
2. Coolify → **New Resource** → **Docker Compose** (or edit existing).
3. Point at this repo; set compose path to **`docker-compose.selfhost.prebuilt.yml`**.
4. Paste **runtime** env vars above (Postgres/JWT/CORS). `VITE_*` are baked in CI — not required at Coolify build time when using prebuilt.
5. Domains:
   - `web` → production FE FQDN, port `80`
   - `api` → API FQDN, port `3000`, WebSockets on
6. Deploy (should pull GHCR images only).
7. Verify:
   - `https://retro-api.example.com/healthz` → `{ "status": "healthy" }`
   - `https://retro-api.example.com/readyz` → Postgres + PostgREST green
   - FE loads; Admin → **Backend** page (admin users only)

## Health endpoints

| Path | Meaning |
|------|---------|
| `GET /healthz` | Process liveness |
| `GET /readyz` | Postgres + PostgREST readiness (503 if either fails) |
| `GET|POST|PATCH|DELETE /rest/v1/*` | PostgREST proxy (JWT forwarded; internal PostgREST only) |
| GET | `/api/admin/backend-status` | Bearer-token stub status for the admin UI |
| GET/POST | `/api/admin/migrate-from-supabase` | Admin-only Supabase → self-host data/storage copy |
| `POST/GET/DELETE /storage/v1/object/*` | Docker-volume uploads (avatars, chat images, retro-audio) |
| `POST /functions/v1/*` | P0 admin/invite ports; Stripe stays on Supabase |

## Resource budget (starting point)

| Service | CPU | Memory |
|---------|-----|--------|
| postgres | 0.50 | 768M |
| postgrest | 0.25 | 256M |
| api | 0.50 | 512M |
| web | 0.10 | 128M |

Total ≈ **1.6GB** ceiling; tune after soak (prefer raising Postgres first).

## Troubleshooting

### VPS freezes / 100% CPU during Coolify deploy

If logs show `vite build` / `transforming...` / huge disk reads, Coolify is still **building on the VPS**. Switch the compose path to `docker-compose.selfhost.prebuilt.yml` and confirm Actions has published GHCR images.

The browserslist “Please run: npx update-browserslist-db” line is informational only.

### `npm ci` / ERESOLVE during `web` build

Coolify builds the frontend with Docker `npm ci`. This repo requires `.npmrc` (`legacy-peer-deps=true`) because Atlaskit pulls `react-intl@5` with a TypeScript 4 peer range while the app uses TypeScript 5.

The root `Dockerfile` copies `.npmrc` before `npm ci`. Do not remove that step, and keep `.npmrc` in the repo.

### PostgREST shows no healthcheck

Expected. The official PostgREST image is scratch-based (no `wget`/`curl`). Use `GET /readyz` on the API domain for Postgres + PostgREST readiness.

### `password authentication failed for user "authenticator"` / role does not exist

Postgres only runs `/docker-entrypoint-initdb.d` on a **brand-new** data volume. If `retroscope_pg_data` already existed from an earlier deploy, the `authenticator` / `retroscope_app` roles were never created.

Compose includes a `db-init` one-shot that re-applies `server/postgres/init/01-roles.sql` on every deploy (via Docker **configs**, not bind mounts — Coolify empties `./` bind mounts).

**Immediate fix (no code wait):** in Coolify → postgres terminal, paste/run the contents of `server/postgres/init/01-roles.sql` as the `postgres` superuser, then restart `postgrest`.

Ensure Coolify env matches the bootstrap passwords (or change both together):

```bash
PGRST_DB_URI=postgresql://authenticator:retroscope_authenticator_pass@postgres:5432/retroscope
DATABASE_URL=postgresql://retroscope_app:retroscope_app_pass@postgres:5432/retroscope
```

### `db-init`: `/init/01-roles.sql` missing or `bind source path does not exist`

Coolify runs `docker compose` inside a helper container. Host bind mounts and `configs.file:` paths under `/artifacts/...` are **not** visible to the Docker daemon, so they fail.

Use a release that defines `configs.retroscope_roles_sql` with **inline `content:`** (not `file:`).

### `db-init`: `syntax error at or near "$"` / `DO $`

Docker Compose treats `$$` as an escaped `$`, so PL/pgSQL `DO $$ ... $$` becomes `DO $ ... $` and fails. Roles SQL uses psql `\gexec` instead (no dollar-quoting). Keep the SQL free of `$` characters when embedding in compose.

### `deploy-coolify` skipped / Coolify deploys before new images exist

Using a **GitHub App** does not set `COOLIFY_WEBHOOK` by itself. The App notifies Coolify of git changes; the Actions job needs the separate **Deploy Webhook** URL.

1. Coolify → resource → copy **Deploy Webhook** → GitHub Actions secret **`COOLIFY_WEBHOOK`**. Without it, `deploy-coolify` warns and exits 0 (appears “skipped” / no-op).
2. Coolify → Advanced → Deployment & Git → **disable Auto Deploy**. Keep the GitHub App; only stop deploy-on-push so CI can deploy after GHCR is updated.

