# Retroscope API (Phase 5 — realtime Socket.IO)

Fastify service for the self-hosted Coolify stack.

## Scripts

```bash
npm install
npm run dev      # tsx watch
npm run build
npm start
npm test
npm run import-auth-users -- --users users.json --identities identities.json
```

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Postgres + PostgREST readiness |
| * | `/rest/v1/*` | Proxies to Coolify-internal PostgREST (forwards JWT / Prefer / Range) |
| POST | `/auth/v1/signup` | Email/password register |
| POST | `/auth/v1/token?grant_type=password` | Login |
| POST | `/auth/v1/token?grant_type=refresh_token` | Refresh |
| GET | `/auth/v1/user` | Current user (Bearer) |
| PUT | `/auth/v1/user` | Update password / metadata |
| POST | `/auth/v1/logout` | Revoke refresh token |
| GET | `/auth/v1/authorize?provider=google` | Start Google OAuth |
| GET | `/auth/v1/callback` | OAuth callback → FE hash tokens |
| POST | `/auth/v1/recover` | Password reset email |
| POST | `/auth/v1/verify` | Confirm recovery code + new password |
| GET | `/auth/v1/.well-known/jwks.json` | Empty JWKS (HS256 shared secret) |
| GET | `/api/admin/backend-status` | Bearer token required (admin UI) |
| GET/POST | `/api/admin/migrate-from-supabase` | Admin-only copy from hosted Supabase DB/storage |
| GET | `/api/storage/buckets` | Lists volume bucket prefixes |
| POST/PUT | `/storage/v1/object/:bucket/*` | Upload (Bearer; `x-upsert: true` optional) |
| GET | `/storage/v1/object/public/:bucket/*` | Public object fetch |
| POST | `/storage/v1/object/sign/:bucket/*` | Create signed URL |
| GET | `/storage/v1/object/sign/:bucket/*` | Fetch via signed query token |
| * | `/socket.io` | Phase 5 realtime (WebSocket); presence / broadcast / postgres_changes |
| DELETE | `/storage/v1/object/:bucket/*` | Delete object (Bearer) |
| POST | `/functions/v1/:name` | P0 edge ports (admin + invites); Stripe → 501 keep_on_supabase |

### Ported functions (P0)

- `admin-search-users`
- `admin-send-notification`
- `admin-team-members`
- `get-user-email`
- `send-invitation-email`
- `notify-team-invite`
- `notify-org-invite`

### Explicit Stripe decision

`check-subscription`, `create-checkout`, `customer-portal`, `admin-manage-subscription` remain on hosted Supabase for Phase 4. Node responds with `501` and `decision: "keep_on_supabase"`.

## Storage migration

```bash
# Copy blobs into the uploads volume
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… UPLOADS_DIR=/data/uploads \
  ../scripts/selfhost/copy-storage-from-supabase.sh

# Rewrite public URLs in DB after host change
DATABASE_URL=… SUPABASE_URL=… PUBLIC_API_BASE_URL=https://retro-api.example.com \
  ../scripts/selfhost/rewrite-storage-urls.sh
```

## Auth + RLS schema

Applied by `db-init` / Postgres init:

- `postgres/init/01-roles.sql` — `anon` / `authenticated` / `service_role` / `authenticator` / `retroscope_app`
- `postgres/init/02-auth-schema.sql` — local `auth.users` / identities / refresh / verification
- `postgres/init/03-rls-helpers.sql` — `auth.uid()` / `auth.role()` / `auth.jwt()` + PostgREST grants
- `postgres/init/04-post-restore-grants.sql` — run after staging `pg_restore`
- `postgres/init/05-realtime-notify.sql` — `pg_notify('retroscope_changes')` triggers on hot tables

Access JWTs are HS256 with `role=authenticated` and `sub=<user uuid>` so PostgREST RLS matches hosted Supabase.

## Realtime (Phase 5)

Socket.IO on `/socket.io` with rooms `board:{id}`, `poker:{sessionId}`, `team:{id}`, `user:{id}`.
Enable WebSocket support on the Coolify `api` domain. Admin backend-status reports `checks.realtime`.

## Staging restore

See `../scripts/selfhost/dump-from-supabase.sh` and `restore-to-local.sh`, plus `COOLIFY_SELFHOST.md`.
