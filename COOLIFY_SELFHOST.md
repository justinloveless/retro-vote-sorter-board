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
3. Set **CPU/memory limits** (already in compose).
4. Enable Coolify **volume backups** for `retroscope_pg_data` and `retroscope_uploads`.
5. Vite `VITE_*` vars are **build-time** — change → **rebuild** the `web` service.

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

### `npm ci` / ERESOLVE during `web` build

Coolify builds the frontend with Docker `npm ci`. This repo requires `.npmrc` (`legacy-peer-deps=true`) because Atlaskit pulls `react-intl@5` with a TypeScript 4 peer range while the app uses TypeScript 5.

The root `Dockerfile` copies `.npmrc` before `npm ci`. Do not remove that step, and keep `.npmrc` in the repo.

### PostgREST shows no healthcheck

Expected. The official PostgREST image is scratch-based (no `wget`/`curl`). Use `GET /readyz` on the API domain for Postgres + PostgREST readiness.

