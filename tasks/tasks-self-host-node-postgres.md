## Tasks: Self-Host Migration — Node + PostgreSQL (DUN-74)

Source plan: `documentation/plans/self-host-node-postgres-migration-plan.md`

Status values: Not started | In progress | Blocked | In review | Done

### Phase 0 — Plan

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 0.1 | Publish migration plan | Land plan doc + this task list; get stakeholder approval on PostgREST sidecar + storage choice | In review | - | DUN-74 |
| 0.2 | Inventory FE Supabase call sites | Seed `documentation/plans/self-host-coverage-tracker.md` from ripgrep of `.from(`, `.rpc(`, `.functions.`, `.channel(`, `.storage.` | Not started | 0.1 | Reuse ideas from csharp-api-coverage-tracker |
| 0.3 | Decide VPS topology | Confirm Hetzner size, domain, TLS, backup target | Not started | 0.1 | |

### Phase 1 — Skeleton

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 1.1 | Scaffold `server/` Fastify app | Healthz/readyz, config from env, TypeScript build, Dockerfile | Not started | 0.1 | |
| 1.2 | Compose stack | `docker-compose.selfhost.yml`: postgres, api, web (nginx), optional postgrest/minio | Not started | 1.1 | Keep under ~4GB RAM total |
| 1.3 | FE backend facade stub | `src/lib/backend/getDataClient.ts` + mode types; default still Supabase | Not started | 0.1 | |
| 1.4 | `app_config.backend_provider` | Migration + types for mode + self-hosted base URL | Not started | 1.3 | |
| 1.5 | Admin Backend page | `/admin/backend` toggle UI, admin-only, confirm dialog, session preview override | Not started | 1.4 | Gate via `profiles.role === 'admin'` |
| 1.6 | Nginx routes | Proxy `/api`, `/auth`, `/realtime` to Node; SPA fallback | Not started | 1.2 | |

### Phase 2 — Auth

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 2.1 | Auth schema | Local `auth.users`, `auth.identities`, `auth.refresh_tokens`, verification codes | Not started | 1.2 | Preserve UUID PK shape |
| 2.2 | Password signup/login/refresh | Supabase-compatible `/auth/v1/*` token endpoints | Not started | 2.1 | bcrypt compatible with Supabase hashes |
| 2.3 | Google OAuth | authorize + callback; link by provider_id / verified email | Not started | 2.2 | New redirect URI on VPS domain |
| 2.4 | Password reset email | Recover + confirm; SMTP/Resend | Not started | 2.2 | |
| 2.5 | User/identity import script | Export from Supabase → import local with same UUIDs | Not started | 2.1 | |
| 2.6 | FE auth facade | Switch `useAuth` to facade; toggle selects hosted vs Node auth | Not started | 2.2, 1.5 | |
| 2.7 | Auth QA | Google + password for QA user; profile UUID unchanged | Not started | 2.3, 2.5, 2.6 | |

### Phase 3 — Data

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 3.1 | Postgres roles + RLS bootstrap | `anon` / `authenticated` / `service_role`; grant patterns | Not started | 1.2 | See api-dotnet `api/postgres/init` as reference only |
| 3.2 | Staging restore | `pg_dump`/`pg_restore` from hosted Supabase to VPS | Not started | 3.1 | |
| 3.3 | PostgREST or Node REST proxy | JWT → DB role; expose tables | Not started | 3.2 | Prefer PostgREST sidecar |
| 3.4 | FE rest client | Fluent proxy compatible with common `.from().select()` usage | Not started | 3.3, 1.3 | Inspired by csharp `supabaseProxyClient` |
| 3.5 | Migrate core hooks | profiles, teams, members, notifications, retro board CRUD behind facade | Not started | 3.4 | |
| 3.6 | Migrate poker + orgs hooks | Sessions, rounds, chat metadata (without realtime yet if needed) | Not started | 3.5 | |
| 3.7 | RPC parity | Port or proxy critical RPCs used by FE | Not started | 3.3 | |

### Phase 4 — Storage & edge ports

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 4.1 | Storage backend | Disk or MinIO; buckets for avatars + chat images | Not started | 1.2 | |
| 4.2 | Copy existing objects | Migrate blobs; fix public URLs if host changes | Not started | 4.1, 3.2 | |
| 4.3 | Admin/notify edge ports | search users, send notification, team members, invites email | Not started | 2.2, 3.3 | |
| 4.4 | Jira/Slack ports (if used) | Move only integrations you rely on | Not started | 3.3 | Can defer |
| 4.5 | Stripe decision | Keep on Supabase temporarily or port | Not started | - | Explicit product choice |

### Phase 5 — Realtime

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 5.1 | WebSocket gateway | Socket.IO + room model for boards/sessions/users | Not started | 1.1, 3.2 | |
| 5.2 | Postgres notify hooks | Triggers or LISTEN on hot tables | Not started | 5.1 | |
| 5.3 | FE realtime adapter | Subset of supabase channel/presence/broadcast API | Not started | 5.1, 1.3 | |
| 5.4 | Collaborative QA | Retro voting + poker presence/rounds under self-hosted mode | Not started | 5.3 | |

### Phase 6 — Cutover

| # | Task Name | Task Description | Status | Blocked By | Notes |
|---|---|---|---|---|---|
| 6.1 | Backup + restore drill | Nightly dump + successful restore test | Not started | 3.2 | |
| 6.2 | Production freeze + final sync | Maintenance window; final dump/restore | Not started | 2.7, 3.5, 4.3, 5.4 | |
| 6.3 | Flip default toggle to selfhosted | Monitor errors; rollback plan = flip back | Not started | 6.2 | |
| 6.4 | DNS / leave Lovable | Serve production from VPS; stop Lovable publish | Not started | 6.3 | |
| 6.5 | Decommission Supabase | After soak (~2 weeks), cancel hosted Supabase | Not started | 6.3, 6.4 | |
| 6.6 | Remove hosted code paths | Delete dual-path once stable; tracker 100% | Not started | 6.5 | |

### Reference (do not implement as primary path)

| Item | Location | Use |
|------|----------|-----|
| C# dual-path proxy / local auth | `origin/feature/api-dotnet-solution-setup-1` | Design reference only |
| Env-injected Supabase URL | `origin/vps-supabase` | Pattern for build-args |
| Old C# passthrough plan | `documentation/plans/csharp-pass-through-api-plan.md` | Superseded stack choice for DUN-74 |
