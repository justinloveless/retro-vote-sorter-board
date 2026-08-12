# Retroscope API (Phase 1 skeleton)

Fastify service for the self-hosted Coolify stack.

## Scripts

```bash
npm install
npm run dev      # tsx watch
npm run build
npm start
```

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Postgres + PostgREST readiness |
| GET | `/api/admin/backend-status` | Bearer token required (admin UI) |
| GET | `/api/storage/buckets` | Lists volume bucket prefixes |
| GET/PUT | `/api/storage/:bucket/*` | 501 stubs until Phase 4 |

## Env

See [`../COOLIFY_SELFHOST.md`](../COOLIFY_SELFHOST.md).
