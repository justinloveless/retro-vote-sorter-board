# Self-Host Migration Plan: Node + PostgreSQL (DUN-74)

**Goal:** Stop paying for hosted Supabase and Lovable by running Retroscope on a Hetzner VPS with a lean stack: **Node API + PostgreSQL** (not full self-hosted Supabase). Preserve Google OAuth and email/password logins. Allow an **admin-only UI toggle** to switch between the hosted Supabase backend and the self-hosted backend during cutover.

**Non-goals:** Full Supabase Docker stack (GoTrue + Realtime + Storage + Kong + Studio + etc.) — too heavy for the target VPS. Rewriting the React UI. Shipping billing/Jira/Slack parity on day one.

### Locked decisions

| Decision | Choice | Notes |
|----------|--------|-------|
| Data API sidecar | **PostgREST — yes** | Approved; keeps RLS + avoids rewriting ~280 FE query sites |
| Orchestration | **Coolify** on the existing Hetzner VPS | VPS already hosts many personal projects via Coolify |
| App stack | Node (Fastify) + Postgres + PostgREST + static FE | No full Supabase self-host |
| Object storage | **Docker volumes** | Named volume (e.g. `retroscope_uploads`) mounted into Node; bucket prefixes for `avatars`, `poker-session-chat-images`, `retro-audio`, later `tts-audio-cache` |

Still open for Phase 1: production Coolify FQDNs for `web` + `api` (needed for Google OAuth redirect URI).

---

## Current state (main)

| Area | Reality |
|------|---------|
| Frontend | Vite/React SPA; talks **directly** to hosted Supabase |
| Auth | Supabase Auth: Google OAuth + email/password (`src/components/AuthForm.tsx`, `src/hooks/useAuth.tsx`) |
| Data | ~280 `supabase.from(...)` call sites, ~6 RPCs, ~40 tables |
| Edge functions | ~40 Deno functions (Jira, Slack, Stripe, AI/TTS, admin, invites) |
| Realtime | Critical for retro boards + poker (~15 channels / presence / postgres_changes) |
| Storage | Buckets: `avatars`, `poker-session-chat-images`, `tts-audio-cache`, `retro-audio` |
| Admin | Gated by `profiles.role === 'admin'` under `/admin/*` |
| Config | Hardcoded Supabase URL/anon key in `src/config/environment.ts` |

**Related prior work (do not ignore):**

- `origin/feature/api-dotnet-solution-setup-1` — C# dual-path proxy, local Postgres + PostgREST, local auth + Google OAuth, Coolify compose. **Useful as a design reference**, but this plan intentionally targets **Node** per DUN-74.
- `origin/vps-supabase` — FE env injection for self-hosted Supabase URL/keys (still “Supabase-shaped”).
- `documentation/plans/csharp-pass-through-api-plan.md` — typed passthrough roadmap (superseded for stack choice; keep coverage inventory ideas).

---

## Target architecture

```
Browser (React SPA)
    │
    ├─ Auth + privileged/edge routes ──► Node API (Fastify) ──┐
    │                                                        ├─► PostgreSQL (schema + RLS)
    ├─ Table CRUD (user JWT) ──► PostgREST (internal only) ──┘
    │
    ├─ Realtime ──► Node WebSockets (Socket.IO / LISTEN-NOTIFY)
    ├─ Storage ──► Docker volume (`retroscope_uploads` bucket prefixes)
    │
    └─ (dual-path) ──► Hosted Supabase when admin toggle = "supabase"

Edge: Coolify Traefik (TLS + domains). PostgREST has no public domain.
```

### Recommended lean stack (Coolify Docker Compose)

| Service | Role | Why this, not full Supabase |
|---------|------|-----------------------------|
| **PostgreSQL 16** | Source of truth; keep existing schema + RLS | Same DB you already have |
| **Node (Fastify)** | Auth, edge-function ports, storage signed URLs, WebSockets; proxies/guards PostgREST | One process you control; small RAM footprint |
| **PostgREST (sidecar)** | Expose tables with existing RLS via JWT `role` claim | Approved; avoids rewriting 280 query shapes; ~50–100MB RAM |
| **FE (Nginx static)** | Built SPA image | Coolify Traefik terminates TLS |
| **Docker volume storage** | Replace Supabase Storage | Locked: `retroscope_uploads` (or similar) with per-bucket prefixes; served/signed by Node |

**Data path:** Browser → Node (auth + privileged routes) and/or PostgREST (table CRUD with user JWT). FE keeps a Supabase-compatible fluent client pointed at self-hosted URLs when the admin toggle is `selfhosted`.

**Shared-VPS reality:** This app is one Coolify project among many. Budget Retroscope tightly so neighbors stay healthy. Target **steady-state ≤ ~1.0–1.5 GB RAM** for the whole compose stack (Postgres + PostgREST + Node + FE). Do **not** add Coqui TTS, pgAdmin, or MinIO to the production compose.

---

## Design principles

1. **Stable user IDs.** Migrate `auth.users` / `profiles` with the **same UUIDs** so all FK data (teams, boards, votes, poker) keeps working.
2. **One data-access facade in the FE.** No more scattering `createClient` calls. Introduce `getDataClient()` that returns either the hosted Supabase client or the self-hosted proxy client based on the admin toggle.
3. **Admin toggle is server-authoritative.** UI control writes `app_config` (or a dedicated `backend_mode` row); FE reads it. localStorage override is only for admin debugging, never the sole source of truth.
4. **Cut over by capability, not big-bang.** Auth → CRUD → Storage → Edge ports → Realtime → decommission Supabase.
5. **Reuse RLS.** Keep policies; issue JWTs with `role=authenticated` and `sub=<user uuid>` so PostgREST/RLS behave like today.

---

## Auth plan (Google + password)

### What users need

- Existing Google accounts keep working (same person, same data).
- Existing email/password accounts keep working (or get a forced reset if hashes cannot be imported).
- New signups work on self-hosted.

### Node auth module (`server/auth`)

Expose Supabase-compatible routes where practical so FE churn stays low:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/v1/signup` | Email/password register |
| POST | `/auth/v1/token?grant_type=password` | Login |
| POST | `/auth/v1/token?grant_type=refresh_token` | Refresh |
| GET | `/auth/v1/user` | Current user |
| POST | `/auth/v1/logout` | Revoke refresh |
| GET | `/auth/v1/authorize?provider=google` | Start Google OAuth |
| GET | `/auth/v1/callback` | OAuth callback |
| POST | `/auth/v1/recover` | Password reset email |
| GET | `/auth/v1/.well-known/jwks.json` | JWT verification keys |

**Libraries (suggested):** Fastify, `@fastify/jwt` or `jose`, `bcrypt`/`argon2`, `openid-client` (Google), `nodemailer` or Resend for reset mail, `pg`.

### Google OAuth continuity

1. Create a **new** Google OAuth client (or add redirect URIs) for the VPS domain: `https://<domain>/auth/v1/callback`.
2. On first Google login after migration:
   - Read Google `sub` + email.
   - Look up `auth.identities` where `provider = 'google'` and `provider_id = <sub>`.
   - If found → issue JWT for that existing user UUID.
   - Else if email matches an existing user → link identity to that UUID (admin-configurable; default: auto-link verified Google email).
   - Else → create user (or reject if invites-only).
3. Export identities from Supabase before cutover:

```sql
-- Run against hosted Supabase (service role / SQL editor)
select id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at
from auth.users;

select id, user_id, provider, identity_data, provider_id, created_at
from auth.identities;
```

### Password continuity

- Supabase stores bcrypt hashes in `auth.users.encrypted_password`. Import them into the local auth table and verify with the same algorithm.
- If any hash format cannot be verified, force password reset for those users only; Google users are unaffected.
- Keep QA account (`justin.n.loveless@gmail.com`) working in both backends during dual-path testing.

### Session / FE changes

- Abstract auth behind `src/lib/auth/client.ts` with the same surface used by `useAuth` (`signInWithPassword`, `signInWithOAuth`, `signUp`, `signOut`, `onAuthStateChange`, `resetPasswordForEmail`, `updateUser`).
- Hosted mode: wrap current `supabase.auth`.
- Self-hosted mode: talk to Node `/auth/v1/*`, store access/refresh tokens (localStorage or httpOnly cookie — prefer httpOnly cookie for production; localStorage OK for parity phase).

---

## Admin backend toggle

### Requirements

- Visible only when `profiles.role === 'admin'`.
- Switches the **live** backend used by the SPA: `supabase` | `selfhosted`.
- Survives refresh (persisted).
- Safe: switching should not brick non-admin users; default for everyone follows server config.

### Implementation

1. **Config store** — row in `app_config`:

```json
{
  "key": "backend_provider",
  "value": { "mode": "supabase", "selfHostedApiBaseUrl": "https://api.example.com" }
}
```

2. **Admin UI** — new section under Admin → Integrations (or `/admin/backend`):
   - Radio/select: Hosted Supabase / Self-hosted Node
   - Status chips: Auth OK, DB OK, Realtime OK (health probes)
   - “Apply for all users” vs “Preview for my session only”
   - Confirm dialog explaining dual-write / data divergence risks

3. **FE routing**

```ts
// Conceptual
const mode = adminSessionOverride ?? appConfig.backend_provider.mode;
const client = mode === 'selfhosted' ? selfHostedClient : supabaseClient;
```

4. **Server enforcement** — Node health endpoints:
   - `GET /healthz` liveness
   - `GET /readyz` checks Postgres + PostgREST
   - Admin-only `GET /api/admin/backend-status`

5. **Do not** put the toggle behind a public feature flag that non-admins can flip. Reuse admin gate from `AdminLayout`.

---

## Data migration

### One-time export → import

1. `pg_dump` schema + data from Supabase Postgres (exclude Supabase-internal noise if desired; **include** `auth.*` and `storage` object metadata).
2. Restore into VPS Postgres.
3. Ensure roles exist for RLS: `anon`, `authenticated`, `service_role` (patterns already explored on the api-dotnet branch under `api/postgres/init/`).
4. Replay/verify critical RPCs (`accept_team_invitation`, `is_team_member`, `get_user_email_if_admin`, etc.).
5. Copy storage objects (avatars, chat images, TTS cache) into the Coolify Docker volume bucket prefixes; rewrite public URLs in DB if host changes.

### Dual-path period

While toggle exists:

| Mode | Auth | Data | Realtime |
|------|------|------|----------|
| `supabase` | Hosted Auth | Hosted PostgREST | Hosted Realtime |
| `selfhosted` | Node Auth | Local Postgres via PostgREST/Node | Node WebSockets |

Optional **shadow compare** (admin-only): call both backends for read endpoints and log diffs (pattern from C# `X-DualPath`). Useful before flipping default to self-hosted.

**Warning:** Dual-write is hard. Prefer **read cutover after a freeze window**: put app in maintenance, final dump/restore, flip toggle, reopen. For long dual-path, treat self-hosted as staging with periodic refresh from prod dumps until go-live.

---

## Edge functions → Node ports

Prioritize by “blocks leaving Supabase”:

| Priority | Functions | Port to |
|----------|-----------|---------|
| P0 | `admin-search-users`, `admin-send-notification`, `admin-team-members`, `get-user-email`, invite notify/email | Node admin/notify modules |
| P1 | `delete-session-data`, `cleanup-poker-sessions` | Node jobs / cron |
| P2 | Jira suite (~15) | Node `/api/jira/*` using existing team credentials |
| P2 | Slack suite | Node `/api/slack/*` |
| P3 | Stripe (`check-subscription`, checkout, portal, admin-manage) | **Decision (Phase 4):** keep on hosted Supabase until billing must be self-hosted; Node returns `501` + `decision: keep_on_supabase` for these names |
| P3 | OpenAI / TTS | Node; can keep pointing at existing Coqui `tts-server` compose service |

Shared secrets move to VPS env / Docker secrets: `JWT_SECRET`, `GOOGLE_CLIENT_*`, `STRIPE_*`, `OPENAI_API_KEY`, Slack tokens, SMTP, service role equivalent.

---

## Realtime strategy

Realtime is the hardest cutover piece (retro + poker collaboration).

**Phase A (keep shipping):** When toggle = `supabase`, keep current channels. When toggle = `selfhosted`, use Node WebSocket gateway.

**Phase B (self-hosted implementation):**

1. Node subscribes to Postgres `LISTEN` channels or uses `pg_notify` triggers on hot tables (`retro_items`, `retro_votes`, `poker_session_rounds`, chat, notifications, feature_flags).
2. Socket.IO rooms keyed by `board:{id}`, `poker:{sessionId}`, `user:{id}`.
3. FE adapter implements the small subset of the Supabase realtime API used today: `channel`, `on('postgres_changes')`, `on('presence')`, `on('broadcast')`, `track`, `subscribe`.
4. Presence: in-memory on Node (single instance) first; Redis adapter if you scale to multiple Node replicas later.

Do **not** block auth/DB cutover on perfect presence parity — but poker/retro must be validated before flipping production default.

---

## Frontend migration shape

```
src/lib/backend/
  types.ts                 # BackendMode, health types
  config.ts                # read app_config + admin override
  getDataClient.ts         # facade
  supabase/
    client.ts              # existing hosted client
  selfhosted/
    authClient.ts
    restClient.ts          # PostgREST fluent API
    realtimeClient.ts
    storageClient.ts
src/pages/admin/AdminBackendPage.tsx
src/components/admin/BackendProviderToggle.tsx
```

Replace direct imports of `@/integrations/supabase/client` gradually with `getDataClient()`. Track remaining call sites in `documentation/plans/self-host-coverage-tracker.md`.

---

## Coolify deployment (shared Hetzner VPS)

The VPS already runs Coolify for many personal projects. Retroscope must be a **good neighbor**: no host port binds, hard memory limits, and no heavy optional sidecars in prod.

### Compose layout for Coolify

Ship Coolify-oriented compose files (reuse lessons from `feature/api-dotnet-solution-setup-1` / `COOLIFY_DEPLOYMENT.md`, but Node instead of C#):

| File | Coolify resource | Services |
|------|------------------|----------|
| `docker-compose.selfhost.yml` (or `.prod.yml`) | Production | `web`, `api`, `postgres`, `postgrest` |
| `docker-compose.selfhost.dev.yml` | Optional staging resource | Same + slightly higher limits; no pgAdmin/TTS unless needed |

**Coolify hard rules for this repo:**

1. **Use `expose`, never `ports`** on shared host — Coolify/Traefik publishes via domains. Host port binds collide with other projects.
2. **One Docker Compose resource per environment** (prod vs staging). Do not mix hot-reload/dev volume mounts into the prod resource.
3. **Domains via Coolify UI**, e.g.:
   - `web` → `retro.example.com` (container port 80)
   - `api` → `retro-api.example.com` (container port 3000/8080)
   - PostgREST stays **internal-only** (no public domain); Node proxies or FE talks through API/CORS as designed.
4. **Vite env vars are build-time.** Set `VITE_*` in Coolify and **rebuild** when they change (`VITE_API_BASE_URL`, eventual self-host flags, etc.).
5. **Set `deploy.resources.limits`** on every service so a runaway Postgres/Node cannot starve sibling apps.
6. **Named volumes only for Retroscope data** (`retroscope_pg_data`, `retroscope_uploads`). Mount `retroscope_uploads` into the Node API for bucket prefixes (`avatars/`, `poker-session-chat-images/`, `retro-audio/`, …). Enable Coolify volume backups for both. Do not share a Postgres container with unrelated Coolify apps unless you intentionally run a central DB service — default is **dedicated Postgres in this compose** for blast-radius isolation.
7. **WebSockets:** ensure Coolify/Traefik has websocket support enabled for the `api` domain (needed for self-hosted realtime).
8. **Healthchecks** on `api` and `postgres` so Coolify restart policy behaves.

### Suggested resource caps (starting point on a busy VPS)

| Service | CPU limit | Memory limit |
|---------|-----------|--------------|
| `postgres` | 0.50 | 512M–768M |
| `postgrest` | 0.25 | 128M–256M |
| `api` (Node) | 0.50 | 256M–512M |
| `web` (Nginx) | 0.10 | 64M–128M |

Tune after soak; prefer raising Postgres before Node. Skip bundling Coqui TTS in this compose — if TTS is needed later, point at an existing shared service or keep that feature on the hosted path until cutover.

### Env vars (Coolify)

**Build-time (web):**

```bash
VITE_API_BASE_URL=https://retro-api.example.com
# dual-path / toggle defaults as implemented
```

**Runtime (api / postgrest / postgres):**

```bash
DATABASE_URL=postgres://retroscope_app:...@postgres:5432/retroscope
JWT_SECRET=...                 # shared with PostgREST for role claims
PGRST_JWT_SECRET=...           # same secret
PGRST_DB_URI=...
PGRST_DB_ANON_ROLE=anon
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_GOOGLE_REDIRECT_URI=https://retro-api.example.com/auth/v1/callback
ALLOW_ORIGINS=https://retro.example.com
# hosted Supabase keys only during dual-path period
```

### Reference from prior Coolify work

`origin/feature/api-dotnet-solution-setup-1` already solved Coolify footguns (`expose` vs `ports`, separate `docker-compose.dev.yml`, build-time `VITE_*`). Steal those operational patterns; do not reuse the C# API as the long-term runtime.

---

## Lovable / Supabase exit sequence

### Deploy (self-hosted via Coolify)

1. Create Coolify Docker Compose resource → `docker-compose.selfhost.yml`.
2. Attach domains, env vars, volume backups.
3. Deploy; verify `/healthz`, FE load, CORS.
4. Set Google redirect URIs (and Slack/Jira if used) to Coolify API domain.

### Leave Lovable

1. Source of truth stays GitHub; Coolify deploys from the repo.
2. Stop Lovable publish once Coolify serves production traffic.
3. Point custom DNS at the Coolify/Traefik endpoint (not Lovable).

### Leave hosted Supabase

1. Toggle default → `selfhosted` after soak.
2. Keep Supabase project read-only for ~2 weeks as rollback.
3. Cancel Supabase only after: Google + password auth verified, retro+poker realtime verified, storage URLs working, needed edge ports working, Coolify backup/restore tested.

---

## Phased delivery

### Phase 0 — Plan & inventory (**complete**)

- Publish this plan + task list.
- PostgREST sidecar — **accepted**.
- Object storage — **Docker volumes accepted**.
- FE Supabase call-site inventory seeded in `documentation/plans/self-host-coverage-tracker.md`.
- Coolify FQDNs for `web`/`api` remain open (needed to start Phase 1 OAuth wiring; compose scaffold can proceed with placeholders).

### Phase 1 — Skeleton on Coolify

- `server/` Node Fastify app: health, config, JWT util.
- Coolify compose: Postgres (+ init roles), PostgREST, Node, Nginx FE — `expose` only, memory limits set.
- Admin Backend page + `app_config.backend_provider` (toggle UI; both modes still point at Supabase until Phase 2).

### Phase 2 — Local auth

- Implement `/auth/v1/*` + Google OAuth.
- Import users/identities from Supabase.
- FE auth facade switches by toggle.
- Password + Google login work against local auth with **same UUIDs**.

### Phase 3 — Local data path

- Restore schema/data to VPS Postgres.
- PostgREST sidecar + FE `restClient` (Node may proxy).
- Migrate high-traffic hooks behind facade: teams, profiles, notifications, retro board CRUD.
- Admin dual-path compare for reads (optional).

### Phase 4 — Storage + critical edge ports

- Avatars + poker chat images + retro-audio served from `retroscope_uploads` via Node `/storage/v1/object/*`.
- P0 admin + invite email/notify functions on Node `/functions/v1/*`.
- Stripe stays on Supabase (`keep_on_supabase`).
- Jira/Slack deferred unless actively used daily.

### Phase 5 — Realtime

- WebSocket gateway + FE adapter.
- Validate retro board + poker session collaboration.

### Phase 6 — Production cutover

- Maintenance window → final dump/restore → toggle default `selfhosted` → soak → remove Lovable/Supabase billing.
- Delete hosted-only code paths after burn-in.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| UUID / identity mismatch breaks FK data | Export/import `auth.users` + `auth.identities`; never create parallel user rows for the same person |
| Password hash import fails | Verify bcrypt round-trip in staging; fallback reset email |
| Realtime parity gaps | Keep Supabase realtime until Socket adapter passes poker/retro QA checklist |
| 280 call sites too many to rewrite | PostgREST + fluent proxy client (pattern from api-dotnet `supabaseProxyClient`) |
| Toggle causes split-brain data | Prefer freeze + cutover; dual-path for reads/staging only |
| Secrets in FE | Stop hardcoding anon keys; inject via Vite env at Coolify **build**; service secrets stay on server |
| Shared VPS noisy-neighbor | Hard memory/CPU limits; no host `ports:`; PostgREST not publicly exposed; skip heavy sidecars |
| Coolify port conflicts | Always `expose`; let Traefik map domains (known footgun from prior Coolify work) |
| VPS backup neglect | Coolify volume backups + nightly `pg_dump` offsite; test restore once before go-live |

---

## Acceptance criteria (DUN-74 done)

- [ ] Plan approved (this doc).
- [ ] App runs on Coolify (shared Hetzner VPS) with Node + Postgres + PostgREST (no full Supabase stack).
- [ ] Compose uses `expose` + resource limits and coexists with other Coolify projects.
- [ ] Google OAuth and email/password both work for migrated users with prior data intact.
- [ ] Admin-only UI can switch backend provider; non-admins cannot.
- [ ] Retro + poker usable on self-hosted (including live updates).
- [ ] Lovable publish no longer required for production.
- [ ] Hosted Supabase can be cancelled after soak without data loss.

---

## Immediate next actions (Phase 1)

1. Pick Coolify FQDNs for `web` + `api` (placeholders OK in compose until DNS exists).
2. Scaffold `server/` Fastify app + `docker-compose.selfhost.yml` (Postgres, PostgREST, Node, FE, `retroscope_uploads` volume) with `expose` + resource limits.
3. Add Admin Backend toggle wired to `app_config.backend_provider` (both modes still Supabase until Phase 2).
4. Document Coolify env var block (build-time `VITE_*` vs runtime secrets).
