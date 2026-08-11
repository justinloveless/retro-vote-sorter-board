# Self-Host Migration Plan: Node + PostgreSQL (DUN-74)

**Goal:** Stop paying for hosted Supabase and Lovable by running Retroscope on a Hetzner VPS with a lean stack: **Node API + PostgreSQL** (not full self-hosted Supabase). Preserve Google OAuth and email/password logins. Allow an **admin-only UI toggle** to switch between the hosted Supabase backend and the self-hosted backend during cutover.

**Non-goals:** Full Supabase Docker stack (GoTrue + Realtime + Storage + Kong + Studio + etc.) — too heavy for the target VPS. Rewriting the React UI. Shipping billing/Jira/Slack parity on day one.

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
    ├─ Auth + REST + Edge replacements ──► Node API (Fastify)
    │                                         │
    │                                         ├─► PostgreSQL (app schema + auth schema + RLS)
    │                                         ├─► Object storage (local disk or S3-compatible, e.g. MinIO / Hetzner Object Storage)
    │                                         └─► WebSocket realtime (Socket.IO or `pg` LISTEN/NOTIFY fanout)
    │
    └─ (optional during migration) ──► Hosted Supabase (when admin toggle = "supabase")
```

### Recommended lean VPS stack

| Service | Role | Why this, not full Supabase |
|---------|------|-----------------------------|
| **PostgreSQL 16** | Source of truth; keep existing schema + RLS | Same DB you already have |
| **Node (Fastify)** | Auth, REST facade, edge-function ports, storage signed URLs, WebSockets | One process you control; small RAM footprint |
| **PostgREST (optional sidecar)** | Expose tables with existing RLS via JWT `role` claim | Avoids reimplementing 280 query shapes; ~50–100MB RAM |
| **Nginx / Caddy** | TLS, static SPA, reverse proxy `/api`, `/auth`, `/realtime` | Standard VPS edge |
| **MinIO or filesystem** | Replace Supabase Storage | Avatars/chat/TTS assets |

**Decision for Phase 1 data access:** Prefer **PostgREST sidecar** behind the Node gateway (or proxied by Node) so the FE can keep a Supabase-compatible query client during migration. If PostgREST is undesirable later, replace table access with typed Node repositories **after** auth/realtime/storage are stable — do not block cutover on rewriting every query.

**Approximate VPS sizing (starting point):** 2 vCPU / 4 GB RAM / 40 GB SSD is enough for Postgres + Node + PostgREST + Nginx for a small team app. Full Supabase self-host typically wants 8 GB+; that is what we are avoiding.

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
   - `GET /readyz` checks Postgres (+ PostgREST if used)
   - Admin-only `GET /api/admin/backend-status`

5. **Do not** put the toggle behind a public feature flag that non-admins can flip. Reuse admin gate from `AdminLayout`.

---

## Data migration

### One-time export → import

1. `pg_dump` schema + data from Supabase Postgres (exclude Supabase-internal noise if desired; **include** `auth.*` and `storage` object metadata).
2. Restore into VPS Postgres.
3. Ensure roles exist for RLS: `anon`, `authenticated`, `service_role` (patterns already explored on the api-dotnet branch under `api/postgres/init/`).
4. Replay/verify critical RPCs (`accept_team_invitation`, `is_team_member`, `get_user_email_if_admin`, etc.).
5. Copy storage objects (avatars, chat images, TTS cache) to MinIO/disk; rewrite public URLs in DB if host changes.

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
| P3 | Stripe (`check-subscription`, checkout, portal, admin-manage) | Keep on Supabase until billing needed self-hosted, or port with Stripe SDK |
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
    restClient.ts          # PostgREST or proxy fluent API
    realtimeClient.ts
    storageClient.ts
src/pages/admin/AdminBackendPage.tsx
src/components/admin/BackendProviderToggle.tsx
```

Replace direct imports of `@/integrations/supabase/client` gradually with `getDataClient()`. Track remaining call sites in `documentation/plans/self-host-coverage-tracker.md`.

---

## Hetzner / Lovable exit sequence

### Deploy (self-hosted)

1. Provision VPS + domain + TLS (Caddy or Nginx + Let’s Encrypt).
2. `docker compose` services: `postgres`, `postgrest` (optional), `api` (Node), `web` (nginx static), optional `minio`, optional `tts`.
3. CI: build FE + Node images; deploy on push to `main` or `deploy` branch.
4. Set Google redirect URIs and Slack/Jira callbacks to the new domain.

### Leave Lovable

1. Source of truth becomes GitHub (already true for agent work).
2. Stop editing in Lovable; disable Lovable publish once VPS serves production traffic.
3. Point DNS from `retro-scope.lovable.app` / custom domain to Hetzner.

### Leave hosted Supabase

1. Toggle default → `selfhosted` after soak.
2. Keep Supabase project read-only for ~2 weeks as rollback.
3. Cancel Supabase subscription only after: auth login verified (Google + password), retro+poker realtime verified, storage URLs working, edge ports for features you use working, backup/restore tested.

---

## Phased delivery

### Phase 0 — Plan & inventory (this PR)

- Publish this plan + task list.
- Confirm VPS size, domain, and whether PostgREST sidecar is accepted.

### Phase 1 — Skeleton on VPS

- `server/` Node Fastify app: health, config, JWT util.
- Docker Compose: Postgres (+ init roles), Node, Nginx FE.
- Admin Backend page + `app_config.backend_provider` (toggle UI; both modes still point at Supabase until Phase 2).

### Phase 2 — Local auth

- Implement `/auth/v1/*` + Google OAuth.
- Import users/identities from Supabase.
- FE auth facade switches by toggle.
- Password + Google login work against local auth with **same UUIDs**.

### Phase 3 — Local data path

- Restore schema/data to VPS Postgres.
- PostgREST (or Node proxy) + FE `restClient`.
- Migrate high-traffic hooks behind facade: teams, profiles, notifications, retro board CRUD.
- Admin dual-path compare for reads (optional).

### Phase 4 — Storage + critical edge ports

- Avatars + poker chat images.
- Admin + invite email functions.
- Jira/Slack only if you use them daily.

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
| Secrets in FE | Stop hardcoding anon keys; inject via Vite env at build; service secrets stay on server |
| VPS backup neglect | Nightly `pg_dump` to Hetzner Object Storage / offsite; test restore once before go-live |

---

## Acceptance criteria (DUN-74 done)

- [ ] Plan approved (this doc).
- [ ] App runs on Hetzner with Node + Postgres (no full Supabase stack).
- [ ] Google OAuth and email/password both work for migrated users with prior data intact.
- [ ] Admin-only UI can switch backend provider; non-admins cannot.
- [ ] Retro + poker usable on self-hosted (including live updates).
- [ ] Lovable publish no longer required for production.
- [ ] Hosted Supabase can be cancelled after soak without data loss.

---

## Immediate next actions

1. Approve stack choices: **PostgREST sidecar yes/no**, storage = disk vs MinIO vs Hetzner Object Storage.
2. Reserve domain + Google OAuth redirect URIs.
3. Start Phase 1 scaffold PR: `server/` + compose + Admin Backend toggle wired to `app_config`.
4. Schedule a staging restore of production dump to validate schema/RLS on lean Postgres.
