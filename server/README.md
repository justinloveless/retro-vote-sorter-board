# Retroscope API (Phase 2 — local auth)

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
| GET | `/api/storage/buckets` | Lists volume bucket prefixes |
| GET/PUT | `/api/storage/:bucket/*` | 501 stubs until Phase 4 |

## Auth schema

Applied by `db-init` / Postgres init:

- `server/postgres/init/01-roles.sql`
- `server/postgres/init/02-auth-schema.sql` (`auth.users`, `auth.identities`, `auth.refresh_tokens`, `auth.verification_codes`)

Keep compose `configs.content` in sync with those files (no `$` in SQL — Compose interpolates).

## Env

See [`../COOLIFY_SELFHOST.md`](../COOLIFY_SELFHOST.md).
