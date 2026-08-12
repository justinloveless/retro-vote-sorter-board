# Coolify Self-Host Deployment (Phase 1)

Lean stack for Retroscope on a shared Coolify VPS: **Postgres + PostgREST + Node API + Nginx FE**.

Compose file: `docker-compose.selfhost.yml`

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

## Deploy CPU (shared VPS)

Coolify runs `docker compose build` on the same host as other apps. Runtime `deploy.resources.limits` do **not** apply during builds. Retroscope’s Atlaskit frontend `npm ci` + `vite build` is heavy enough to peg CPU and thrash memory if left unbounded.

**Do this once on the Coolify server**

1. **Servers → [your VPS] → Configuration → Advanced**
2. Set **Number of concurrent builds** to **`1`** (Coolify default is `2`).
3. Optionally raise **Deployment timeout** if a single capped build exceeds 60 minutes.

**Do this on the Retroscope compose resource**

Add environment variable:

```bash
COMPOSE_PARALLEL_LIMIT=1
```

This forces `api` and `web` images to build one at a time instead of in parallel.

**Already baked into the Dockerfiles**

| Cap | Value | Why |
|-----|-------|-----|
| `BUILD_MAX_OLD_SPACE_SIZE` / Node heap | `3072` (web) | Atlaskit needs ~3GB; old `8192` swap-thrashed small VPS hosts |
| `taskset -c ${BUILD_CPU_LIST:-0}` | core `0` | **Hard** CPU pin for `npm ci` / `vite build` (`nice` alone still pegs all cores) |
| `GOMAXPROCS` / `RAYON_NUM_THREADS` | `1` | Limits esbuild (Go) + SWC (Rayon) worker pools |
| `UV_THREADPOOL_SIZE` | `1` | Limits libuv thread pool |
| `npm_config_maxsockets` | `2` | Gentler `npm ci` network/extract parallelism |
| `vite.build.reportCompressedSize` | `false` | Gzipping multi‑MB chunks for size logs pegged CPU at the end of step 6/6 |
| npm `postinstall` during image build | skipped | Advisor zip runs once via `prebuild` |

Optional overrides on the resource:

```bash
BUILD_MAX_OLD_SPACE_SIZE=3584   # only if the web build OOMs
BUILD_CPU_LIST=0                # default; use 0,1 only on a larger host
```

Expect the web image build to be slower (one core) but the VPS should stay responsive.

If deploys still starve the host, offload builds to a Coolify [build server](https://coolify.io/docs/knowledge-base/server/build-server) so compile work never runs on the production VPS.

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

1. Coolify → **New Resource** → **Docker Compose**.
2. Point at this repo; set compose path to `docker-compose.selfhost.yml`.
3. Paste env vars above.
4. Domains:
   - `web` → production FE FQDN, port `80`
   - `api` → API FQDN, port `3000`, WebSockets on
5. Deploy.
6. Verify:
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

Image builds ignore runtime CPU limits. The heavy spike is usually **web Dockerfile step 6/6** (`vite build` / Atlaskit). Confirm:

1. Server **Concurrent builds = 1**
2. Resource has `COMPOSE_PARALLEL_LIMIT=1`
3. Deployed commit includes `taskset` CPU pinning + `reportCompressedSize: false`
4. During deploy, `htop` should show the build bound to roughly **one** core

A capped web build is slower but should leave the host responsive. If the machine has under ~4GB free RAM during deploy, add swap or use a Coolify build server.

### `npm ci` / ERESOLVE during `web` build

Coolify builds the frontend with Docker `npm ci`. This repo requires `.npmrc` (`legacy-peer-deps=true`) because Atlaskit pulls `react-intl@5` with a TypeScript 4 peer range while the app uses TypeScript 5.

The root `Dockerfile` copies `.npmrc` before `npm ci`. Do not remove that step, and keep `.npmrc` in the repo.

### PostgREST shows no healthcheck

Expected. The official PostgREST image is scratch-based (no `wget`/`curl`). Use `GET /readyz` on the API domain for Postgres + PostgREST readiness.

