# Coolify Self-Host Deployment (Phase 1)

Lean stack for Retroscope on a shared Coolify VPS: **Postgres + PostgREST + Node API + Nginx FE**.

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

1. In the GitHub repo set:
   - **Variables:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`
   - **Secrets:** `VITE_SUPABASE_PUBLISHABLE_KEY`, **`COOLIFY_WEBHOOK`** (required for post-image deploy)
   - Optional secret: `COOLIFY_TOKEN` if your Coolify webhook requires Bearer auth
2. In Coolify for this resource:
   - Compose path: **`docker-compose.selfhost.prebuilt.yml`**
   - **Disable Auto Deploy** on git push (Configuration → General / Webhooks). Git auto-deploy races GHCR and starts before new images exist.
   - Copy **Deploy Webhook** URL → GitHub secret `COOLIFY_WEBHOOK`
3. Merge to `main` (or run workflow **Coolify images** manually). Order is:
   1. Actions builds/pushes `*-api` + `*-web` to GHCR  
   2. `deploy-coolify` calls the webhook  
   3. Coolify pulls (`pull_policy: always`) and restarts
4. If packages are private, on the VPS once:
   ```bash
   echo <GITHUB_PAT_with_read:packages> | docker login ghcr.io -u <github-user> --password-stdin
   ```
   Or set the GHCR package visibility to **Public**.
5. Confirm deploy logs show **pull** for `web`/`api`, not `RUN vite build` / `npm ci`.

`VITE_*` changes require a new Actions build (baked into the web image), then the webhook redeploy.

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

Phase 1 still uses hosted Supabase for auth/data regardless of the admin toggle. Keep Supabase Vite vars set until Phase 2+.

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
```

> Default DB role passwords in `server/postgres/init/01-roles.sql` are for bootstrap only. Change them (and matching `DATABASE_URL` / `PGRST_DB_URI`) before any real data restore.

### Optional later (Phase 2+)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_GOOGLE_REDIRECT_URI=https://retro-api.example.com/auth/v1/callback
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
| `GET /api/admin/backend-status` | Bearer-token stub status for the admin UI |

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

### `db-init`: `/init/01-roles.sql: No such file or directory`

Old compose used a bind mount Coolify rewrites to an empty host dir. Use a release that defines `configs.retroscope_roles_sql` (file → `/init/01-roles.sql`).

### `deploy-coolify` skipped / Coolify deploys before new images exist

1. GitHub Actions secret **`COOLIFY_WEBHOOK`** must be set (Coolify → resource → Deploy Webhook URL). Without it the job no-ops.
2. **Disable Coolify Auto Deploy** on git push for this app; otherwise Coolify redeploys from git immediately and pulls stale `:latest` while Actions is still building.

